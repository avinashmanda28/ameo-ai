# Ameo AI — Architecture Documentation

Ameo AI is a governed AI-native operational platform that orchestrates AI agents, manages workflows, and provides intelligent runtime execution with full governance, observability, and recovery capabilities.

---

## High-Level System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Ameo AI Platform                      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Frontend    │  │   Backend     │  │     Database      │  │
│  │   (React 19)  │  │  (Next.js 16) │  │    (SQLite +      │  │
│  │               │  │              │  │     Prisma ORM)    │  │
│  │  ┌─────────┐  │  │  ┌────────┐  │  │                   │  │
│  │  │ Panels  │  │  │  │  API   │  │  │  ┌─────────────┐  │  │
│  │  │ & Views │◄─┼──┼──│ Routes │◄─┼──┼─►│  27 Models  │  │  │
│  │  └─────────┘  │  │  └────────┘  │  │  │  (Prisma)   │  │  │
│  │  ┌─────────┐  │  │  ┌────────┐  │  │  └─────────────┘  │  │
│  │  │  Stores │◄─┼──┼──│Runtime │  │  │                   │  │
│  │  │(Zustand)│  │  │  │Engine  │  │  │                   │  │
│  │  └─────────┘  │  │  └───┬────┘  │  │                   │  │
│  └──────────────┘  │      │        │  └──────────────────┘  │
│                     │  ┌───▼────┐  │                         │
│                     │  │AI Provs│  │                         │
│                     │  │(Adapts)│  │                         │
│                     │  └───┬────┘  │                         │
│                     └──────┼───────┘                         │
└────────────────────────────┼────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
         │OpenRoutr│   │  Groq   │   │ Gemini  │
         └─────────┘   └─────────┘   └─────────┘
              │              │              │
         ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
         │ Ollama  │   │ (local) │   │(self-hst)│
         └─────────┘   └─────────┘   └─────────┘
```

---

## 5-Layer Architecture

Ameo AI is organized into five interconnected layers, each with a distinct responsibility:

### Layer 1: Workspace (Container)

The top-level organizational boundary. Everything in Ameo AI exists within a workspace.

- **Workspace modes**: Builder, Operations, Strategy, Governance
- **Company graph**: Hierarchical entity structure (company → project → product → service → team → member)
- **Multi-tenancy isolation**: All resources scoped to a workspace ID

```
Workspace
├── Companies (entity hierarchy)
├── Runtime Providers (AI connections)
├── Agents (autonomous workers)
├── Workflows (automation pipelines)
├── Governance Rules (policies)
├── Artifacts (generated outputs)
└── Audit Logs (compliance trail)
```

### Layer 2: Runtime (AI Execution)

The AI execution engine that routes, executes, governs, and audits all AI provider calls.

- **Provider adapters**: OpenRouter, Groq, Gemini, Ollama
- **Intelligent routing**: Role-based, health-score-aware provider selection
- **Governance gates**: Approval flows before execution
- **Hallucination detection**: Post-execution quality verification
- **Artifact generation**: Automatic creation of persistent outputs

### Layer 3: Governance (Control)

The security and compliance layer that enforces policies and audits actions.

- **Governance rules**: Permission, approval, rate limit, security, compliance
- **Approval requests**: Human-in-the-loop gating for sensitive operations
- **Audit logging**: Full trail of all actions, decisions, and outcomes
- **Sandbox management**: Permission scopes for execution boundaries

### Layer 4: Operational (Cohesion)

The nervous system that connects all layers with events, health monitoring, and state consistency.

- **Event bus**: Centralized publish/subscribe with correlation and lineage
- **Health monitoring**: Per-subsystem health scores and degradation detection
- **State consistency**: Drift detection and reconciliation
- **Agent coordination**: Task locking, conflict prevention, and handoff
- **Lineage tracking**: Full execution traceability from workflow to artifact

### Layer 5: Intelligence (Analysis)

The analytical layer that provides insights, ratings, and graph intelligence.

- **Build rating engine**: Multi-dimensional quality scoring
- **Graph analysis**: Dependency graph validation, cycle detection, execution planning
- **Failure classification**: Typed error categorization with recovery actions
- **System health dashboard**: Aggregated operational health summary

---

## Frontend Architecture

### Component Hierarchy

```
App
├── WorkspaceShell
│   ├── WorkspaceHeader (mode switcher, status)
│   ├── WorkspaceSidebar (navigation)
│   └── WorkspaceContent (panel router)
│       ├── OverviewPanel (dashboard)
│       ├── RuntimeHubPanel (AI providers)
│       ├── WorkflowEnginePanel (workflows)
│       ├── AgentPanel (agent management)
│       ├── GovernancePanel (rules & audit)
│       ├── ExecutionPanel (runtime executions)
│       ├── QueuePanel (execution queue)
│       ├── FailuresPanel (failure analysis)
│       ├── RuntimeMetricsPanel (provider health)
│       ├── ArtifactPanel (generated outputs)
│       ├── CompanyGraphPanel (entity hierarchy)
│       ├── DeveloperConsolePanel (events & traces)
│       ├── ObservabilityPanel (health dashboard)
│       └── ReportsPanel (terminal & reports)
└── ApprovalBanner (governance overlay)
```

### State Management

| Store | File | Purpose |
|-------|------|---------|
| Workspace Store | `store/workspace-store.ts` | Workspace selection, mode, UI state |
| Execution Store | `store/execution-store.ts` | Runtime executions, queue state |
| Operational Store | `store/operational-store.ts` | Events, traces, health metrics |

Stores use **Zustand** for client-side state with **TanStack Query** for server state fetching.

### UI Components

- **Base layer**: 40+ Radix UI primitives (shadcn/ui pattern)
- **Layout**: Resizable panels via `react-resizable-panels`
- **Charts**: Recharts for data visualization
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Rich text**: MDX Editor
- **Drag & Drop**: dnd-kit

---

## Backend Architecture

### API Routes

The backend exposes **30+ API routes** organized by domain:

```
/api
├── workspace                    # Workspace CRUD
├── company                      # Company graph operations
├── agents                       # Agent management
│   └── [id]/logs               # Agent log retrieval
├── runtime                      # Runtime provider CRUD
│   └── [id]/healthcheck        # Provider health verification
├── execution                    # Runtime execution
│   └── [id]
│       ├── verify              # Post-execution verification
│       └── route.ts            # Execution details
├── workflows                    # Workflow management
│   └── [id]
│       ├── executions          # Workflow execution history
│       ├── transition          # State machine transitions
│       └── recover             # Recovery operations
├── queue                        # Execution queue
│   ├── [id]                    # Queue item details
│   ├── process                 # Process next item
│   └── retry                   # Manual retry
├── approvals                    # Approval requests
│   └── [id]                    # Approve/reject
├── events                       # Event bus queries
│   └── [id]                    # Event details
├── traces                       # Execution traces
│   └── [id]                    # Trace chain details
├── governance                   # Governance rules
│   └── audit                   # Audit log queries
├── artifacts                    # Artifact CRUD
│   └── [id]                    # Artifact details
├── ratings                      # Build ratings
│   └── stats                   # Rating statistics
├── failures                     # Failure records
├── coordination                 # Agent coordination
├── graph-analysis               # Workflow graph analysis
├── observability                # System health summary
├── snapshots                    # State snapshots
└── health                       # Health check endpoint
```

### Core Runtime Engine

```
┌─────────────────────────────────────────────────┐
│                  RuntimeEngine                   │
│                                                  │
│  1. Create RuntimeExecution record               │
│  2. Fetch active providers                       │
│  3. Route to best provider (RuntimeRouter)       │
│  4. Check governance rules (approval gate)       │
│  5. Execute via adapter (timeout: 30s)           │
│  6. Detect hallucinations                        │
│  7. Generate artifact if output is substantial   │
│  8. Update provider health score                 │
│  9. Create audit log                             │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐   │
│  │ OpenRoutr│ │  Groq    │ │  Gemini        │   │
│  │ Adapter  │ │ Adapter  │ │  Adapter       │   │
│  └──────────┘ └──────────┘ └────────────────┘   │
│  ┌──────────┐                                    │
│  │  Ollama  │                                    │
│  │ Adapter  │                                    │
│  └──────────┘                                    │
└─────────────────────────────────────────────────┘
```

### Database Schema (27 Models)

The Prisma schema defines the complete data model:

| Domain | Models |
|--------|--------|
| **Workspace** | `Workspace`, `Company` |
| **Runtime** | `RuntimeProvider`, `RuntimeHealthLog`, `RuntimeExecution`, `Artifact`, `ApprovalRequest` |
| **Workflow** | `Workflow`, `WorkflowExecution`, `WorkflowCheckpoint`, `WorkflowLog`, `WorkflowDependency` |
| **Governance** | `GovernanceRule`, `AuditLog` |
| **Agent** | `Agent`, `AgentLog` |
| **Queue** | `ExecutionQueue`, `FailureRecord` |
| **Operational** | `SystemEvent`, `ExecutionTrace`, `AgentCoordination`, `StateSnapshot`, `SystemHealthMetric` |
| **Rating** | `BuildRating` |

---

## Data Flow Diagrams

### Runtime Execution Flow

```
User/Agent              Backend                   AI Provider
    │                      │                          │
    │  POST /api/execution │                          │
    │─────────────────────►│                          │
    │                      │                          │
    │                      │  1. Create execution     │
    │                      │     record               │
    │                      │                          │
    │                      │  2. Route to provider    │
    │                      │     (health score, role) │
    │                      │                          │
    │                      │  3. Check governance     │
    │                      │     rules                │
    │                      │                          │
    │  ◄── approval req    │  (if approval required)  │
    │───────               │                          │
    │  approve             │                          │
    │─────────────────────►│                          │
    │                      │                          │
    │                      │  4. Execute via adapter  │
    │                      │─────────────────────────►│
    │                      │                          │
    │                      │  5. Response             │
    │                      │◄─────────────────────────│
    │                      │                          │
    │                      │  6. Hallucination check  │
    │                      │  7. Generate artifact    │
    │                      │  8. Update health score  │
    │                      │  9. Audit log            │
    │                      │                          │
    │  response + artifact │                          │
    │◄─────────────────────│                          │
```

### Event Flow (Operational Cohesion)

```
Runtime        EventBus       HealthMonitor    LineageTracker
  │                │                │                │
  │ emit(event)   │                │                │
  │───────────────►│                │                │
  │                │ persist to DB  │                │
  │                │───────────►    │                │
  │                │                │                │
  │                │ record health  │                │
  │                │───────────────►│                │
  │                │                │ detect drift   │
  │                │                │───────────►    │
  │                │                │                │
  │                │ add trace step │                │
  │                │────────────────────────────────►│
  │                │                │                │
  │                │ notify subs    │                │
  │                │──► (in-memory) │                │
```

### Governance Approval Flow

```
Runtime Engine          Governance           User
    │                      │                  │
    │ check approval rules │                  │
    │─────────────────────►│                  │
    │                      │                  │
    │ approval required    │                  │
    │◄─────────────────────│                  │
    │                      │                  │
    │ status:              │                  │
    │ awaiting_approval    │                  │
    │                      │                  │
    │                      │ show approval    │
    │                      │ banner           │
    │                      │─────────────────►│
    │                      │                  │
    │                      │   approve/reject │
    │                      │◄─────────────────│
    │                      │                  │
    │ resume after         │                  │
    │ approval (skip gate) │                  │
    │◄─────────────────────│                  │
```

---

## Key Design Decisions

### 1. SQLite over PostgreSQL

**Decision:** Use SQLite as the default database provider.

**Rationale:**
- Zero operational overhead (no database server to manage)
- Single-file deployment simplifies backups and migrations
- Sufficient for single-workspace deployments
- Prisma makes migration to PostgreSQL trivial if needed
- Performance is excellent for read-heavy workloads

### 2. Standalone Output Mode

**Decision:** Use Next.js `output: "standalone"` for production builds.

**Rationale:**
- Self-contained deployment without `node_modules`
- Minimal Docker image size
- Simple process management with systemd
- Compatible with Bun runtime

### 3. Singleton Pattern for Core Services

**Decision:** Use singleton instances for RuntimeEngine, EventBus, QueueManager, etc.

**Rationale:**
- Consistent state across API routes within a single process
- Shared health scores, routing state, and event subscriptions
- Memory-efficient (no duplicate instances)
- Appropriate for single-server deployment model

### 4. Provider Adapter Pattern

**Decision:** Abstract AI providers behind a `ProviderAdapter` interface.

**Rationale:**
- Uniform execution interface regardless of provider
- Easy to add new providers (implement `execute()`)
- Supports intelligent routing across providers
- Clean separation of concerns

### 5. Event-Sourced Audit Trail

**Decision:** Record all significant actions as `SystemEvent` entries with correlation IDs.

**Rationale:**
- Full traceability from workflow to individual execution
- Enables event replay for debugging and recovery
- Supports lineage tracking across subsystems
- Critical for governance compliance

### 6. Governance-First Runtime

**Decision:** Every runtime execution passes through governance checks before execution.

**Rationale:**
- Human-in-the-loop control over AI operations
- Prevents unauthorized or dangerous executions
- Configurable per-workspace rules
- Full audit trail of all decisions

---

## Technology Choices Rationale

| Technology | Role | Why |
|-----------|------|-----|
| **Next.js 16** | Framework | App router, API routes, React Server Components, standalone output |
| **React 19** | UI | Latest features, concurrent rendering, improved performance |
| **Bun** | Runtime | Fast startup, built-in TypeScript, native JSON handling |
| **Prisma 6** | ORM | Type-safe database access, migrations, schema-as-code |
| **SQLite** | Database | Zero-config, file-based, excellent for single-server |
| **Tailwind CSS 4** | Styling | Utility-first, dark mode, consistent design system |
| **Radix UI** | Components | Accessible, unstyled primitives for custom design |
| **Zustand** | State | Lightweight, no boilerplate, supports slices |
| **TanStack Query** | Server State | Caching, deduplication, background refetching |
| **Zod** | Validation | TypeScript-first schema validation |
| **Recharts** | Charts | React-native charting for health dashboards |
| **dnd-kit** | Drag & Drop | Accessible, performant drag and drop |
| **next-auth** | Auth | Flexible authentication with multiple providers |
