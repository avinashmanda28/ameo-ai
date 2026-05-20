# Ameo AI — Intelligence System Documentation

The Intelligence System is the operational brain of Ameo AI. It provides the coordination, observability, and analytical capabilities that bind all subsystems together into a cohesive, self-monitoring platform.

---

## Overview

Located in `src/lib/operational/`, the intelligence system consists of six interconnected modules, each exported as a singleton:

```
┌──────────────────────────────────────────────────────────────┐
│                  Intelligence System                          │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Event Bus   │  │  Lineage     │  │  Health Monitor   │  │
│  │  (nervous    │  │  Tracker     │  │  (vital signs)    │  │
│  │   system)    │  │  (memory)    │  │                   │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬──────────┘  │
│         │                  │                    │             │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌────────▼──────────┐  │
│  │   Agent      │  │   State      │  │   Graph           │  │
│  │   Coordinator│  │   Consistency│  │   Analyzer        │  │
│  │   (task      │  │   Engine     │  │   (workflow       │  │
│  │    mgmt)     │  │   (drift     │  │    intelligence)   │  │
│  │              │  │    detect)   │  │                   │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                   Sandbox Manager                        │ │
│  │              (execution boundaries)                      │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## Agent Coordination System

**File:** `src/lib/operational/agent-coordinator.ts`

The Agent Coordination layer provides formal task management and conflict prevention. It ensures that two agents never operate on the same resource simultaneously.

### Core Concepts

| Concept | Description |
|---------|-------------|
| **Task** | A unit of work claimed by an agent |
| **Lock** | Exclusive access to a task's resources (default: 30 min) |
| **Conflict** | When two agents try to work on the same resource |
| **Handoff** | Transfer of task ownership between agents |

### Task Lifecycle

```
claimed ──► active ──► completed
    │          │
    │          ├──► handed_off ──► (new task created for receiving agent)
    │          │
    │          ├──► failed
    │          │
    │          └──► expired (lock timeout, 30 min default)
    │
    └──► expired
```

### Claiming a Task

When an agent claims a task, the system performs:

1. **Prune expired locks** — Release any past-expiry locks
2. **Duplicate check** — Prevent claiming an already-active task
3. **Conflict detection** — Check if another agent has locked the same resource
4. **Capacity check** — Limit of 10 active tasks per agent
5. **Lock acquisition** — Set lock with 30-minute expiry

```typescript
const coordinator = getAgentCoordinator();

const task = await coordinator.claimTask({
  workspaceId: "ws_123",
  taskId: "build:api:endpoints",
  taskType: "build",
  agentId: "agent_builder_1",
  agentType: "builder",
  description: "Implement REST API endpoints",
  authorityScope: { resources: ["api", "routes"], actions: ["create", "modify"] },
  permissionSet: ["read", "write", "execute"],
  priority: 5,
  resourceType: "workflow",
  resourceId: "wf_api_build",
  lockDurationMs: 30 * 60 * 1000, // 30 minutes
});
```

### Conflict Detection

Conflicts are detected by comparing resource identifiers:

```typescript
const check = await coordinator.checkConflict(
  agentId: "agent_qa_1",
  resourceType: "artifact",
  resourceId: "artifact_789"
);

// Result:
{
  hasConflict: false,
  conflictingTasks: [],
  conflictingAgentIds: [],
  details: "No conflicts detected"
}
```

If a conflict is found, a `CoordinationConflictError` is thrown with the list of conflicting tasks.

### Task Handoff

```typescript
// Transfer a task from one agent to another
const result = await coordinator.handoffTask(
  taskId: "build:api:endpoints",
  toAgentId: "agent_qa_1",
  reason: "Build complete, handing off to QA for testing"
);
```

### Coordination Status

```typescript
const status = await coordinator.getCoordinationStatus("ws_123");
// {
//   totalTasks: 15,
//   activeTasks: 4,
//   lockedTasks: 4,
//   completedTasks: 8,
//   failedTasks: 1,
//   handedOffTasks: 1,
//   expiredTasks: 1,
//   activeAgents: 3,
//   agentsById: { ... }
// }
```

---

## Event Bus Architecture

**File:** `src/lib/operational/event-bus.ts`

The Event Bus is the nervous system of Ameo AI. All subsystems communicate through structured events with full correlation and lineage tracking.

### Event Structure

Every event contains:

| Field | Description |
|-------|-------------|
| `eventType` | Dot-namespaced identifier (e.g., `runtime.executed`, `queue.retrying`) |
| `source` | Subsystem that emitted the event |
| `level` | Severity: `debug`, `info`, `warn`, `error`, `critical` |
| `correlationId` | Links related events in a chain (auto-generated) |
| `causationId` | Points to the event that caused this event (parent) |
| `traceId` | Overall trace spanning multiple operations |
| `payload` | JSON structured data |
| `resourceType` / `resourceId` | What was affected |
| `actorId` / `actorType` | Who triggered the event (agent, user, system) |

### Emitting Events

```typescript
const bus = getEventBus();

const event = await bus.emit({
  workspaceId: "ws_123",
  eventType: "runtime.executed",
  source: "runtime",
  level: "info",
  correlationId: "corr_abc123",    // optional, auto-generated
  causationId: "evt_parent_xyz",   // optional, links to parent event
  traceId: "trace_build_456",      // optional, operation trace
  payload: {
    provider: "openrouter",
    modelId: "anthropic/claude-3.5-sonnet",
    latencyMs: 3240,
  },
  resourceType: "execution",
  resourceId: "exec_789",
  actorId: "agent_builder_1",
  actorType: "agent",
  tags: ["build", "code-generation"],
});
```

### Querying Events

```typescript
// Filtered query with pagination
const { events, total } = await bus.query({
  workspaceId: "ws_123",
  source: "runtime",
  level: "error",
  since: new Date("2025-01-01"),
  limit: 50,
  offset: 0,
});

// Get event chain (all events with same correlationId)
const chain = await bus.getEventChain("corr_abc123");

// Get causation lineage (follow causationId back to root)
const lineage = await bus.getEventLineage("evt_current");

// Event statistics
const stats = await bus.getStats("ws_123");
// {
//   total: 1542,
//   byType: { "runtime.executed": 320, "queue.enqueued": 150, ... },
//   byLevel: { "info": 1200, "warn": 200, "error": 100, ... },
//   bySource: { "runtime": 500, "queue": 300, ... },
//   recentCounts: { lastHour: 45, last24Hours: 320, last7Days: 1542 }
// }
```

### In-Memory Subscriptions

```typescript
// Subscribe to specific event types
const unsub = bus.subscribe("runtime.executed", (event) => {
  console.log("Runtime executed:", event.payload);
});

// Wildcard — receive all events
const unsubAll = bus.subscribe("*", (event) => {
  console.log("Any event:", event.eventType);
});

// Unsubscribe
unsub();
```

### Event Replay

For recovery scenarios and testing:

```typescript
const replayed = await bus.replay({
  workspaceId: "ws_123",
  eventType: "runtime.executed",
  since: new Date("2025-01-15"),
  limit: 100,
});
// Re-emits as new events with type suffix ".replayed" and replay metadata
```

---

## Execution Lineage Tracking

**File:** `src/lib/operational/lineage-tracker.ts`

Lineage tracking provides complete operational traceability. Every execution is tracked with full parent-child relationships across all subsystems.

### Trace Operations

| Operation | Description |
|-----------|-------------|
| `execute` | AI provider execution |
| `verify` | Quality verification |
| `approve` | Governance approval |
| `queue` | Queue management |
| `retry` | Retry attempt |
| `recover` | Failure recovery |
| `checkpoint` | Workflow checkpoint |
| `coordinate` | Agent coordination |
| `snapshot` | State snapshot |

### Creating a Trace

```typescript
const tracker = getLineageTracker();

// Start a trace chain
const traceId = await tracker.startTrace({
  workspaceId: "ws_123",
  operation: "execute",
  subsystem: "runtime",
  executionId: "exec_789",
  agentId: "agent_builder_1",
  inputSnapshot: { prompt: "Build API...", modelId: "claude-3.5" },
});

// Add child steps
const queueStep = await tracker.addStep({
  workspaceId: "ws_123",
  traceId,
  operation: "queue",
  subsystem: "queue",
  queueId: "queue_456",
  parentId: rootStepId, // optional nesting
});

// Complete a step
await tracker.completeStep(traceId, queueStep.id, {
  status: "completed",
  duration: "1.2s",
});
```

### Full Execution Lineage

```typescript
const lineage = await tracker.getExecutionLineage("exec_789");
// {
//   execution: { operation: "execute", subsystem: "runtime", ... },
//   queue:      { operation: "queue", subsystem: "queue", ... },
//   workflow:   { operation: "execute", subsystem: "workflow", ... },
//   verification: { operation: "verify", subsystem: "governance", ... },
//   artifact:   { operation: "execute", subsystem: "artifact", ... },
//   audit:      [ ... ]   // all governance audit steps
// }
```

### Timeline Visualization

```typescript
const timeline = await tracker.getTraceTimeline(traceId);
// Returns a tree structure:
// [
//   {
//     step: { operation: "execute", subsystem: "runtime", durationMs: 3240 },
//     durationLabel: "3.2s",
//     statusLabel: "Completed",
//     operationLabel: "Execute",
//     children: [
//       { step: { operation: "verify", subsystem: "governance", ... }, children: [] }
//     ]
//   }
// ]
```

---

## System Health Monitoring

**File:** `src/lib/operational/health-monitor.ts`

The Health Monitor provides whole-system operational monitoring with per-subsystem scoring and degradation detection.

### Monitored Subsystems

| Subsystem | What It Monitors |
|-----------|-----------------|
| `queue` | Execution queue pressure, congestion |
| `runtime` | AI provider latency, availability |
| `workflow` | Workflow state consistency, blocked count |
| `verification` | Hallucination rates, quality scores |
| `recovery` | Retry success rates, recovery speed |
| `agent` | Agent activity, task completion rates |
| `event_bus` | Event throughput, processing latency |

### Metric Types

| Type | Meaning | Higher is... |
|------|---------|-------------|
| `pressure` | Load/congestion percentage | Worse |
| `latency` | Response time in ms | Worse |
| `failure_rate` | Error percentage | Worse |
| `throughput` | Events per second | Better |
| `congestion` | Queue fill percentage | Worse |
| `health_score` | Composite score (0-100) | Better |

### Severity Thresholds

Default thresholds for automatic severity classification:

| Severity | Health Score | Latency | Failure Rate |
|----------|-------------|---------|--------------|
| `normal` | ≥ 80 | < 5,000 ms | < 10% |
| `warning` | 60–79 | 5,000–15,000 ms | 10–25% |
| `degraded` | 40–59 | 15,000–30,000 ms | 25–50% |
| `critical` | < 40 | > 30,000 ms | > 50% |

### Recording Metrics

```typescript
const monitor = getHealthMonitor();

const metric = await monitor.recordMetric({
  workspaceId: "ws_123",
  subsystem: "runtime",
  metricType: "latency",
  value: 8500,             // 8.5 seconds
  unit: "ms",
  threshold: 10000,        // custom warning threshold
});
// Auto-classified as: severity = "warning" (8500 < 10000 threshold)
```

### Health Score Calculation

Scores use exponential decay weighting — more recent metrics have greater influence:

```
score = Σ(weight_i × severityScore_i) / Σ(weight_i)

where weight_i = exp(-age_i / halfLife)
      halfLife = 30 minutes
      severityScore = { normal: 100, warning: 70, degraded: 40, critical: 10 }
```

### System Health Summary

```typescript
const summary = await monitor.getSystemHealthSummary("ws_123");
// {
//   overallScore: 85,
//   subsystems: {
//     queue:      { score: 92, severity: "normal", details: "10 recent metrics, all normal" },
//     runtime:    { score: 78, severity: "warning", details: "2 warning(s) in: latency" },
//     workflow:   { score: 95, severity: "normal", details: "8 recent metrics, all normal" },
//     verification:{ score: 88, severity: "normal", ... },
//     recovery:   { score: 90, severity: "normal", ... },
//     agent:      { score: 85, severity: "normal", ... },
//     eventBus:   { score: 95, severity: "normal", ... },
//   },
//   lastUpdatedAt: "2025-01-20T10:30:00Z"
// }
```

### Degradation Detection

```typescript
const result = await monitor.detectDegradation("runtime");
// {
//   isDegrading: true,
//   severity: "warning",
//   currentScore: 45,
//   previousScore: 72,
//   trend: "degrading",
//   details: "runtime is degrading: score dropped from 72 to 45 (-27.0 points)"
// }
```

Compares metrics from the last 15 minutes against the preceding 45 minutes. A trend is classified as "degrading" when the score drops by more than 10 points and the current score is below 60.

---

## Graph Analysis

**File:** `src/lib/operational/graph-analyzer.ts`

The Graph Analyzer provides dependency analysis and graph intelligence for the workflow engine.

### Analysis Capabilities

| Capability | Algorithm | Severity |
|-----------|-----------|----------|
| **Circular dependencies** | DFS cycle detection | Error |
| **Deadlocks** | Mutual dependency detection on blocked workflows | Error |
| **Orphan workflows** | Zero-degree node detection | Warning |
| **Self-references** | Direct self-edge detection | Error |
| **Missing dependencies** | Dangling edge detection | Warning |
| **Execution plan** | Kahn's topological sort | — |

### Running Full Analysis

```typescript
const analyzer = getGraphAnalyzer();
const result = await analyzer.analyzeGraph("ws_123");
// {
//   isValid: true,
//   issues: [
//     { type: "orphan", severity: "warning", description: "...", affectedNodes: ["wf_3"] }
//   ],
//   nodeCount: 12,
//   edgeCount: 18,
//   executionPlan: [["wf_1", "wf_2"], ["wf_3"], ["wf_4", "wf_5", "wf_6"]],
//   integrityScore: 85
// }
```

### Execution Plan Generation

The execution plan uses Kahn's algorithm (topological sort) to produce layers of workflows that can execute in parallel:

```
Layer 1: [wf_1, wf_2]     ← No dependencies, execute in parallel
Layer 2: [wf_3]           ← Depends on wf_1
Layer 3: [wf_4, wf_5, wf_6] ← All depend on wf_3
```

If circular dependencies exist, the affected nodes are placed in a final fallback layer.

### Integrity Score Calculation

```
base = 100
- 15 per error issue
- 5 per warning issue
- 20 if any circular dependencies
- 15 if any deadlocks
- (orphanRatio × 20) for orphan penalty

clamped to [0, 100]
minimum 50 if graph has no errors
```

---

## State Consistency Checking

**File:** `src/lib/operational/state-consistency.ts`

The State Consistency Engine prevents desynchronization, duplicates, and drift by capturing periodic snapshots and comparing them.

### Monitored Subsystems

| Subsystem | State Captured |
|-----------|---------------|
| `workflow` | State, priority, timestamps |
| `queue` | Status distribution, priority, failure types |
| `runtime` | Provider status, health, roles |
| `agent` | Type, status, capabilities |
| `artifact` | Type, status, verification results |
| `governance` | Rule counts, pending approvals |
| `system` | Entity counts, recent event count |

### Capture & Compare

```typescript
const engine = getStateConsistencyEngine();

// Capture a snapshot
const snapshot = await engine.captureSnapshot(
  subsystem: "workflow",
  workspaceId: "ws_123",
  reason: "periodic"  // periodic | pre_execution | post_execution | recovery | manual
);
// {
//   subsystem: "workflow",
//   stateHash: "hash_abc123_456",
//   consistencyStatus: "consistent",
//   driftDetected: false,
//   snapshotReason: "periodic"
// }

// Detect drift (compare two most recent snapshots)
const drift = await engine.detectDrift("workflow", "ws_123");
// {
//   isIdentical: false,
//   driftDetected: true,
//   changes: [
//     { field: "items[2].state", oldValue: "active", newValue: "blocked" }
//   ],
//   driftDetails: { ... }
// }
```

### Duplicate Prevention

```typescript
const check = await engine.preventDuplicate(
  resourceType: "execution",
  resourceId: "exec_789",
  operation: "verify"
);
// {
//   isDuplicate: true,
//   existingOperationId: "coord_456",
//   details: "Operation 'verify' on execution:exec_789 is already claimed by agent agent_qa_1"
// }
```

### Consistency Report

```typescript
const report = await engine.getConsistencyReport("ws_123");
// {
//   overallStatus: "consistent",
//   totalSnapshots: 142,
//   subsystems: {
//     workflow:   { status: "consistent", lastSnapshotAt: "...", driftDetected: false, snapshotCount: 24 },
//     queue:      { status: "drifted", lastSnapshotAt: "...", driftDetected: true, snapshotCount: 18 },
//     runtime:    { status: "consistent", ..., snapshotCount: 20 },
//     ...
//   }
// }
```

---

## Sandbox Management

**File:** `src/lib/operational/sandbox-manager.ts`

The Sandbox Manager defines execution boundaries and permission scopes. It is a pure logic module (no database model) that validates execution parameters against permission profiles.

### Built-in Profiles

| Profile | Permissions | Max Time | Max Memory | Restricted Paths |
|---------|------------|----------|------------|-----------------|
| **Restricted** | `read` | 30s | 256 MB | `*` (all) |
| **Standard** | `read`, `write` | 60s | 512 MB | `/etc/*`, `/var/*`, `/root/*` |
| **Elevated** | `read`, `write`, `execute`, `network`, `file_system` | 120s | 1024 MB | none |
| **Unrestricted** | All permissions | 300s | 2048 MB | none |

### Validation

```typescript
const sandbox = getSandboxManager();

const result = sandbox.validateExecution(
  sandbox.getProfile("standard"),  // or custom profile ID
  {
    requestedPermissions: ["read", "write", "execute"],
    executionTimeMs: 45000,
    memoryMb: 400,
    filePaths: ["/app/src/index.ts", "/etc/passwd"],
    networkAccess: true,
  }
);
// {
//   allowed: false,
//   violations: [
//     "Permission 'execute' is not granted in profile 'Standard'",
//     "Network access requested but not permitted by sandbox profile",
//     "File path '/etc/passwd' is restricted by sandbox profile"
//   ],
//   warnings: [
//     "Memory usage 400MB is close to limit 512MB"
//   ],
//   effectivePermissions: ["read", "write"],
//   resourceLimits: { maxExecutionTimeMs: 60000, maxMemoryMb: 512 }
// }
```

### Custom Profiles

```typescript
const customProfile = sandbox.createProfile({
  id: "agent-builder",
  name: "Agent Builder",
  description: "Sandbox for builder agent code generation",
  permissions: ["read", "write", "execute", "network"],
  restrictedPaths: ["/etc/*", "/root/*"],
  maxExecutionTimeMs: 90000,
  maxMemoryMb: 768,
});

// List all profiles
const profiles = sandbox.listProfiles();
// [
//   { id: "restricted", name: "Restricted", isBuiltIn: true },
//   { id: "standard", name: "Standard", isBuiltIn: true },
//   { id: "elevated", name: "Elevated", isBuiltIn: true },
//   { id: "unrestricted", name: "Unrestricted", isBuiltIn: true },
//   { id: "agent-builder", name: "Agent Builder", isBuiltIn: false },
// ]

// Delete custom profile (cannot delete built-ins)
sandbox.deleteProfile("agent-builder");
```

### Path Restriction Patterns

| Pattern | Meaning |
|---------|---------|
| `*` | Matches all paths (everything restricted) |
| `/etc/*` | Matches any path under `/etc/` |
| `/dir/file.ext` | Exact file match |

---

## Build Rating Engine

The Build Rating system provides multi-dimensional quality assessment of workspace artifacts.

### Rating Dimensions

| Dimension | Key | What It Measures |
|-----------|-----|-----------------|
| Architecture Quality | `architectureQuality` | Code structure, patterns, modularity |
| Runtime Stability | `runtimeStability` | Execution success rate, latency |
| UI Integrity | `uiIntegrity` | Component quality, accessibility |
| Workflow Quality | `workflowQuality` | Pipeline reliability, recovery |
| Verification Confidence | `verificationConfidence` | Trust in outputs |
| Hallucination Risk | `hallucinationRisk` | Inverted — lower is better |
| Operational Stability | `operationalStability` | System health under load |

### Overall Score

```typescript
// Each dimension is rated 0-100
// The overallScore is a weighted average computed by the frontend/store
interface BuildRating {
  architectureQuality: number | null;   // 0-100
  runtimeStability: number | null;      // 0-100
  uiIntegrity: number | null;           // 0-100
  workflowQuality: number | null;       // 0-100
  verificationConfidence: number | null; // 0-100
  hallucinationRisk: number | null;     // 0-100 (lower = better)
  operationalStability: number | null;  // 0-100
  overallScore: number | null;          // computed aggregate
}
```

### API Endpoints

```bash
# Create a rating
POST /api/ratings
{
  "targetId": "wf_build_api",
  "targetType": "workflow",
  "architectureQuality": 85,
  "runtimeStability": 92,
  ...
}

# Get rating statistics
GET /api/ratings/stats?workspaceId=ws_123
```
