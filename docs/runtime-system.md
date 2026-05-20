# Ameo AI — Runtime System Documentation

The Runtime System is the central execution layer of Ameo AI. It manages all AI provider interactions — from intelligent routing and governance-gated execution to hallucination detection and artifact generation.

---

## Overview

The Runtime Engine (`src/lib/runtime/engine.ts`) is a singleton orchestrator that provides a unified interface for executing AI calls across multiple providers. Every execution follows a strict 12-step lifecycle with full audit trailing.

```
┌─────────────────────────────────────────────────────────────┐
│                    Runtime System                             │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────────┐  │
│  │    Router    │  │    Queue     │  │  Failure Classifier│  │
│  │  (routing)   │  │ (scheduling)│  │   (error handling) │  │
│  └──────┬───────┘  └──────┬──────┘  └──────────┬─────────┘  │
│         │                  │                     │            │
│  ┌──────▼──────────────────▼─────────────────────▼─────────┐ │
│  │                   RuntimeEngine                         │ │
│  │  execute()  resumeAfterApproval()  verify()             │ │
│  └──────┬──────────────────────────────────────────────────┘ │
│         │                                                     │
│  ┌──────▼───────┐ ┌────────────┐ ┌──────────┐ ┌───────────┐ │
│  │  OpenRouter  │ │   Groq     │ │  Gemini  │ │  Ollama   │ │
│  │   Adapter    │ │  Adapter   │ │ Adapter  │ │ Adapter   │ │
│  └──────────────┘ └────────────┘ └──────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Provider Adapters

All adapters implement the `ProviderAdapter` interface:

```typescript
interface ProviderAdapter {
  type: string;
  execute(params: {
    apiKey: string;
    baseUrl?: string;
    modelId: string;
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
  }): Promise<{
    content: string;
    usage?: { promptTokens, completionTokens, totalTokens };
  }>;
}
```

### Supported Providers

| Provider | Adapter File | Auth Method | Models |
|----------|-------------|-------------|--------|
| **OpenRouter** | `adapter-openrouter.ts` | API key in header | Multi-provider gateway (Anthropic, OpenAI, Meta, etc.) |
| **Groq** | `adapter-groq.ts` | API key in header | Llama, Mixtral, Gemma (fast inference) |
| **Gemini** | `adapter-gemini.ts` | API key in query param | Gemini Pro, Gemini Flash |
| **Ollama** | `adapter-ollama.ts` | No auth required (local) | Any locally hosted model |

### Configuration

Providers are configured per-workspace through the Runtime Hub UI or API:

```typescript
// Provider record in database
{
  name: "Claude via OpenRouter",
  type: "openrouter",       // adapter type
  modelId: "anthropic/claude-3.5-sonnet",
  role: "primary",           // primary | secondary | fallback
  apiKey: "sk-or-v1-...",   // stored encrypted
  baseUrl: null,             // use default endpoint
  status: "active",          // active | inactive | error
  healthScore: 95.0,        // 0-100, updated after each execution
  rating: 4.5,              // user-assigned rating
}
```

### Adapter Implementation Details

Each adapter:

1. **Makes real HTTP calls** to the provider's API (no mocking)
2. **Normalizes requests** into the provider's expected format
3. **Parses responses** into a standard `{ content, usage? }` format
4. **Respects abort signals** for timeout handling (30s default)
5. **Propagates errors** as structured `RuntimeError` objects for classification

---

## Intelligent Routing Algorithm

The `RuntimeRouter` (`src/lib/runtime/router.ts`) selects the optimal provider for each execution using a multi-factor scoring algorithm.

### Routing Priority

```
Step 1: Explicit provider requested?
  ├── Yes → Use if active + has API key
  └── No  → Fall through to automatic routing

Step 2: Filter eligible providers
  └── Must be: status="active" AND apiKey configured

Step 3: Sort by composite score
  ├── Primary sort: Role priority
  │     primary (0) > secondary (1) > fallback (2) > unassigned (3)
  ├── Secondary sort: Health score (descending, 0-100)
  └── Tertiary sort: Rating (descending, 0-5)

Step 4: Return top-ranked provider
```

### Health Score Calculation

Health scores are updated after every execution using an exponential moving average:

| Outcome | Latency | Delta |
|---------|---------|-------|
| Success | < 5s | +0.05 |
| Success | 5-15s | +0.02 |
| Success | > 15s | 0.00 |
| Failure | any | -0.10 |

The score is clamped to `[0, 100]`. A provider with no history starts at `0` and quickly rises with successful executions.

### Routing Example

```
Available providers:
  - "GPT-4o"     role=primary,    health=92.0, rating=4.8
  - "Claude 3.5" role=secondary,  health=88.0, rating=4.7
  - "Llama 3"    role=fallback,   health=95.0, rating=4.2

Sorted result: "GPT-4o" (primary wins despite lower health)
Reason: primary provider, health: 92.0, rating: 4.8
```

---

## Governance Approval Flow

Every execution passes through the governance layer before reaching an AI provider.

### Rule Evaluation

```typescript
// Governance rules are evaluated from database
{
  type: "approval",              // only approval rules block execution
  enabled: true,
  config: {
    providerTypes: ["openrouter"],  // applies to specific providers
    minPromptLength: 500,           // applies to prompts above this length
  }
}
```

### Execution Lifecycle with Governance

```
1.  Create RuntimeExecution (status: pending)
2.  Fetch active providers
3.  Route to best provider
4.  Update execution with selected provider (status: approved)
5.  Check governance rules
    ├── No matching rules → Continue to step 7
    └── Matching rule found → Step 6
6.  Create ApprovalRequest (status: pending, expires: 30 min)
    Update execution (status: awaiting_approval)
    Return approval_required response to caller
    ── Caller approves or rejects ──
    ├── Rejected → execution status: rejected, END
    └── Approved → resumeAfterApproval() → Re-execute with skipApproval=true
7.  Validate provider has API key
8.  Execute via adapter (status: executing)
9.  Run hallucination detection
10. Generate artifact if substantial
11. Update execution (status: completed)
12. Update provider health, create audit log
```

### Approval Request Lifecycle

```
pending ──► approved ──► (execution resumes)
    │
    └──► rejected ──► (execution fails)
    │
    └──► expired ──► (30 min timeout, execution fails)
```

---

## Hallucination Detection

The built-in hallucination detector (`detectHallucinations`) runs post-execution on every AI response. It is a heuristic-based system that checks for common quality issues.

### Detection Rules

| Check | Condition | Result |
|-------|-----------|--------|
| Empty response | `content.trim()` is empty | `fail` — hallucination detected |
| Very short | Length < 10 chars | `warning` — may be incomplete |
| Error patterns | Matches "I cannot", "I'm sorry", "as an AI", etc. | `warning` — refusal patterns |
| Repetitive content | Unique sentences < 60% of total | `warning` — hallucination suspected |
| Normal | None of the above | `pass` — quality OK |

### Error Pattern Regexes

```typescript
const errorPatterns = [
  /error:\s*(invalid|unauthorized|forbidden|not found)/i,
  /i cannot (fulfill|process|complete|answer)/i,
  /i'm (sorry|unable)/i,
  /as an ai/i,
  /i don't have (access|information|knowledge)/i,
];
```

### Impact on Artifacts

- **Pass**: Artifact status = `verified`
- **Warning**: Artifact status = `draft` (needs review)
- **Fail**: Artifact status = `draft`, `hallucinationDetected = true`

---

## Artifact Generation

Substantial AI outputs (≥ 200 characters) are automatically persisted as Artifacts.

### Artifact Types

The system classifies artifacts by analyzing prompt and response content:

| Type | Detection Keywords |
|------|-------------------|
| `code` | `` ``` ``, `function`, `class`, `import`, `const`, `def` |
| `architecture` | `architecture`, `design`, `component`, `module`, `service` |
| `plan` | `plan`, `roadmap`, `milestone`, `step`, `phase` |
| `report` | `report`, `analysis`, `summary`, `metric`, `data` |
| `spec` | `spec`, `requirement`, `specification`, `feature` |
| `general` | Default fallback |

### Artifact Lifecycle

```
draft ──► verified ──► approved ──► archived
    │           │
    └──► rejected
```

### Artifact Metadata

Each artifact stores execution context:

```json
{
  "providerType": "openrouter",
  "providerName": "Claude via OpenRouter",
  "modelId": "anthropic/claude-3.5-sonnet",
  "latencyMs": 3240,
  "tokenUsage": { "promptTokens": 150, "completionTokens": 500, "totalTokens": 650 }
}
```

---

## Queue Management

The `ExecutionQueueManager` (`src/lib/runtime/queue-manager.ts`) provides priority-based execution scheduling with automatic retry.

### Queue Item Lifecycle

```
pending ──► running ──► completed
    │           │
    │           └──► retrying ──► running ──► ...
    │                                    │
    │                                    └──► failed (max retries exceeded)
    │
    └──► cancelled
```

### Priority Scheduling

Items are dequeued in order:

1. **Priority** (descending) — Higher numbers execute first
2. **Scheduled time** (ascending) — Earlier items first
3. **Creation time** (ascending) — FIFO within same priority

### Concurrency Control

```typescript
const queue = new ExecutionQueueManager(maxConcurrency = 3);
```

- Default concurrency: **3 parallel executions**
- Configurable via `setMaxConcurrency()` (range: 1–20)
- Running count checked before dequeue

### Exponential Backoff

Retry delay formula: `delay = retryDelayMs × 2^retryCount`

| Retry | Delay (default base: 1000ms) |
|-------|------------------------------|
| 1st | 2,000 ms |
| 2nd | 4,000 ms |
| 3rd | 8,000 ms |

### Queue Operations API

```typescript
const queue = getQueueManager();

// Add to queue
const queueId = await queue.enqueue({
  workspaceId: "ws_123",
  priority: 5,
  providerId: "prov_456",
  prompt: "Build a REST API...",
  maxRetries: 3,
});

// Process next item
const item = await queue.processNext();

// Complete or fail
await queue.complete(queueId, result);
await queue.fail(queueId, error, "timeout", "high");

// Manual retry
await queue.retry(queueId);

// Stats
const stats = await queue.getQueueStats("ws_123");
// { pending: 5, running: 3, retrying: 1, failed: 2, ... }

// Purge old items (older than 24h)
const purged = await queue.purgeCompleted(24 * 60 * 60 * 1000);
```

---

## Failure Classification & Recovery

The `FailureClassifier` (`src/lib/runtime/failure-classifier.ts`) categorizes errors into typed categories with deterministic recovery actions.

### Failure Types

| Type | Severity | Category | Recovery | Retryable |
|------|----------|----------|----------|-----------|
| `timeout` | High | System | Retry | Yes |
| `auth_failed` | High | Runtime/Governance | Abort | No |
| `rate_limited` | Medium | Network | Retry | Yes |
| `provider_unavailable` | High | Network/System | Retry/Fallback | Yes |
| `connection_refused` | Critical | Network | Retry | Yes |
| `validation_failed` | Medium | Runtime/Governance | Retry | Yes |
| `unknown` | Low | System | Abort | No |

### Classification Pipeline

```
Error input
    │
    ├── Already classified? → Return as-is
    │
    ├── HTTP status code? → Map to known classification
    │   401 → auth_failed (abort)
    │   403 → auth_failed (abort)
    │   429 → rate_limited (retry)
    │   500 → provider_unavailable (retry)
    │   502 → provider_unavailable (retry)
    │   503 → provider_unavailable (retry)
    │
    ├── DOMException AbortError? → timeout (retry)
    │
    ├── Error message pattern match? → Map via regex
    │   "econnrefused" → connection_refused (retry)
    │   "rate limit" → rate_limited (retry)
    │   "invalid api key" → auth_failed (abort)
    │   ...
    │
    └── Fallback → unknown (abort)
```

### Recurring Failure Detection

When 3+ failures of the same type occur within 1 hour:

- **Severity escalated** (low → medium → high → critical)
- **Recovery action changed** to `manual_intervention`
- **`isRecurring` flag** set to `true`
- **`occurrenceCount`** incremented for pattern analysis

### Error Recording

Each failure is persisted to the `FailureRecord` table with:

```typescript
{
  failureType: "timeout",
  failureSeverity: "high",
  category: "runtime",
  errorMessage: "Request timed out after 30000ms",
  errorStack: "Error: ...",
  providerType: "openrouter",
  modelId: "anthropic/claude-3.5-sonnet",
  recoveryAction: "retry",
  isRecurring: false,
  occurrenceCount: 1
}
```

---

## Verification System

### Built-in Verification

Runs automatically after every execution via `detectHallucinations()`.

### Manual Verification

Triggered via API for deeper analysis:

```typescript
const engine = getRuntimeEngine();
const result = await engine.verify(executionId, db);
// { result: "pass", notes: "Response passed basic quality checks" }
```

### Verification Results

| Result | Meaning | Artifact Status |
|--------|---------|-----------------|
| `pass` | No issues detected | `verified` |
| `warning` | Potential issues found | `draft` |
| `fail` | Significant quality issues | `draft` |

### Provider Health Checks

Each provider can be health-checked independently:

```bash
# Via API
POST /api/runtime/[id]/healthcheck

# The endpoint:
# 1. Fetches the provider's configuration
# 2. Sends a minimal test prompt
# 3. Measures response latency
# 4. Records a RuntimeHealthLog entry
# 5. Updates the provider's healthScore and lastHealthCheck
```

---

## Runtime Request Types

| Type | Description | Use Case |
|------|-------------|----------|
| `chat` | Conversational interaction | Agent dialogue, user queries |
| `completion` | Single-turn generation | Code generation, analysis |
| `embedding` | Vector embedding generation | Search, similarity (future) |

---

## Configuration Reference

### Runtime Constants

```typescript
// src/lib/runtime/types.ts
DEFAULT_TIMEOUT_MS = 30_000    // 30 second request timeout
ARTIFACT_MIN_LENGTH = 200      // Minimum response length for artifact generation
```

### Queue Defaults

```typescript
// src/lib/runtime/queue-manager.ts
maxConcurrency = 3             // Parallel executions
maxRetries = 3                 // Retry attempts
retryDelayMs = 1_000           // Base backoff delay (exponential)
```

### Approval Defaults

```typescript
// src/lib/runtime/engine.ts
approvalExpiryMs = 30 * 60 * 1000  // 30 minute approval window
promptPreviewLength = 500           // Characters shown in approval preview
```
