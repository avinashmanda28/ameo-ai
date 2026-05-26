<div align="center">

```
     ___      .__   __.   _______  __    __       _______.     ___      .______
    /   \     |  \ |  |  /  _____||  |  |  |     /       |    /   \     |   _  \
   /  ^  \    |   \|  | |  |  __  |  |  |  |    |   (----`   /  ^  \    |  |_)  |
  /  /_\  \   |  . `  | |  | |_ | |  |  |  |     \   \      /  /_\  \   |      /
 /  _____  \  |  |\   | |  |__| | |  `--'  | .----)   |    /  _____  \  |  |\  \----.
/__/     \__\ |__| \__|  \______|  \______/  |_______/    /__/     \__\ | _| `._____|
```

### Governed AI-Native Operational Platform

**Ameo AI** is an open-source platform that brings governance, observability, and coordination
to AI-powered operations. Run workflows, manage agents, and execute AI calls across multiple
providers — all within a unified, auditable runtime.

[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-1-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-22C55E)](./LICENSE)

---

</div>

## Overview

Ameo AI provides a complete operational layer for AI workloads. Instead of treating AI calls
as isolated requests, Ameo wraps them in a governed runtime with workflow lifecycle management,
approval gates, execution queuing, failure recovery, and full lineage tracking — so every
action is traceable, recoverable, and auditable.

## Features

- 🧠 **Runtime AI Execution Engine** — Multi-provider AI execution via OpenRouter, Groq, Gemini, and Ollama with automatic routing, load balancing, and health scoring
- ⚙️ **Workflow Engine** — State machine lifecycle management with draft → active → running → completed/error states, checkpoints, and dependency graphs
- 🛡️ **Governance Kernel** — Approval gates, audit logging, configurable rules engine with severity tracking, and policy enforcement for all runtime operations
- 🤝 **Agent Coordination System** — Multi-agent task management with authority scopes, permission sets, conflict prevention, distributed locking, and handoff protocols
- 📋 **Execution Queue & Recovery** — Prioritized queue with exponential backoff retry logic, failure classification (timeout, rate-limited, auth, etc.), and automated fallback strategies
- 📡 **Operational Event Bus** — Correlated event system with causation chains, trace IDs, and event replay for full operational awareness
- 🔗 **Execution Lineage Tracking** — End-to-end traceability from workflow definition → execution → verification → artifact, with input/output snapshots at each step
- 📊 **System Health Monitoring** — Real-time metrics collection across all subsystems with severity thresholds, congestion detection, and alert propagation
- ⭐ **Build Rating Engine** — Multi-dimensional quality scoring across architecture, runtime stability, UI integrity, hallucination risk, and verification confidence
- 🏢 **Company Graph** — Hierarchical entity management with parent-child relationships for organizational modeling

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          WORKSPACE SHELL                            │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────────────┐ │
│  │  Sidebar  │ │  Header   │ │  Content   │ │   Approval Banner    │ │
│  └────┬─────┘ └──────────┘ └─────┬─────┘ └──────────────────────┘ │
│       │                             │                                │
│  ─────┼─────────────────────────────┼─────────────────────────────  │
│       │         PANEL LAYER         │                                │
│  ┌────┴─────┐ ┌────────┐ ┌─────────┴──┐ ┌──────────┐ ┌─────────┐  │
│  │ Runtime   │ │ Workflow│ │ Governance │ │  Agents  │ │ Execution│  │
│  │ Hub       │ │ Engine  │ │ Panel      │ │  Fleet   │ │ Queue    │  │
│  └────┬─────┘ └───┬────┘ └─────┬──────┘ └────┬─────┘ └────┬────┘  │
│       │             │            │               │             │      │
│  ─────┼─────────────┼────────────┼───────────────┼─────────────┼───  │
│       │            SERVICES LAYER                │             │      │
│  ┌────┴─────────────┴────────────┴───────────────┴─────────────┴──┐ │
│  │  Event Bus · Lineage Tracker · Health Monitor · Coordinator     │ │
│  │  Failure Classifier · Sandbox Manager · Graph Analyzer          │ │
│  └──────────────────────────┬─────────────────────────────────────┘ │
│                             │                                       │
│  ┌──────────────────────────┴─────────────────────────────────────┐ │
│  │                      RUNTIME ENGINE                             │ │
│  │  ┌──────────┐ ┌────────┐ ┌────────┐ ┌───────┐ ┌──────────┐   │ │
│  │  │ OpenRouter│ │ Groq   │ │ Gemini │ │Ollama │ │  Router   │   │ │
│  │  │  Adapter  │ │Adapter │ │Adapter │ │Adapter│ │ Verifier  │   │ │
│  │  └──────────┘ └────────┘ └────────┘ └───────┘ └──────────┘   │ │
│  └──────────────────────────┬─────────────────────────────────────┘ │
│                             │                                       │
│  ┌──────────────────────────┴─────────────────────────────────────┐ │
│  │                    PERSISTENCE LAYER                            │ │
│  │              Prisma ORM  ·  PostgreSQL / Supabase              │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ or [Bun](https://bun.sh/)
- A package manager (npm, yarn, pnpm, or bun)
- Access to a [Supabase](https://supabase.com) PostgreSQL database (or any PostgreSQL instance)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/ameo-ai.git
cd ameo-ai

# Install dependencies
bun install
# or: npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your configuration (see Environment Variables below)

# Generate Prisma client
bun run db:generate

# Push schema to database
bun run db:push

# Start the development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the platform.

## Environment Variables

Create a `.env` file from the provided template:

```bash
cp .env.example .env
```

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase or your own) | Yes |
| `NEXTAUTH_URL` | Application URL for NextAuth | Yes |
| `NEXTAUTH_SECRET` | Secret for NextAuth sessions (generate with `openssl rand -base64 32`) | Yes |
| `OPENROUTER_API_KEY` | OpenRouter API key | At least one provider |
| `GROQ_API_KEY` | Groq API key | At least one provider |
| `GEMINI_API_KEY` | Google Gemini API key | At least one provider |
| `OLLAMA_BASE_URL` | Ollama base URL (default: `http://localhost:11434`) | No |
| `NODE_ENV` | Node environment (`development` / `production`) | No |

See [`.env.example`](.env.example) for the full reference.

## CI/CD Pipeline

This project includes a GitHub Actions CI workflow (`.github/workflows/ci.yml`) that runs on every push to `main` and on pull requests:

- ✅ TypeScript type checking (`tsc --noEmit`)
- ✅ ESLint linting
- ✅ Production build (`next build`)

### Setup: GitHub Secrets

The CI pipeline needs certain environment variables to build successfully.
Configure these in your GitHub repository under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `DATABASE_URL` | Your PostgreSQL connection string (transaction pooler) |
| `DIRECT_URL` | Your PostgreSQL connection string (session pooler, for migrations) |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` to generate one |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (e.g., `https://xxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anonymous publishable key |

To add these secrets:

1. Go to **GitHub → Your Repository → Settings → Secrets and variables → Actions**
2. Click **New repository secret** for each variable above
3. Use the same values from your local `.env` file

### Running Migrations in CI

For automated database migrations in CI, add a dedicated migration job (requires setting up a Supabase connection in CI):

```yaml
jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          DIRECT_URL: ${{ secrets.DIRECT_URL }}
```

## Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Auth pages (login, signup)
│   ├── api/                    # 39 API route handlers
│   │   ├── execution/          # Runtime execution, verification
│   │   ├── workflows/          # Workflow lifecycle, recovery, transitions
│   │   ├── queue/              # Execution queue, retry, processing
│   │   ├── governance/         # Governance rules, audit logs
│   │   ├── approvals/          # Approval request management
│   │   ├── agents/             # Agent management, logs
│   │   ├── auth/               # NextAuth authentication
│   │   ├── register/           # User registration
│   │   ├── artifacts/          # Artifact CRUD
│   │   ├── events/             # Event bus queries
│   │   ├── traces/             # Execution lineage
│   │   ├── ratings/            # Build rating engine
│   │   ├── company/            # Company graph management
│   │   ├── runtime/            # AI provider management, health checks
│   │   └── ...                 # Health, coordination, workspace, etc.
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Home page (workspace shell)
│   ├── loading.tsx             # Loading state
│   ├── error.tsx               # Error boundary
│   ├── not-found.tsx           # 404 page
│   ├── providers.tsx           # SessionProvider, ThemeProvider, Toaster
│   └── globals.css             # Global styles + theme variables
├── components/
│   ├── ui/                     # 50+ shadcn/ui primitives
│   ├── workspace/              # Shell, sidebar, header, content, overview
│   └── features/               # Feature-specific panels
│       ├── agents/             # Agent fleet panel
│       ├── approvals/          # Approval banner
│       ├── artifacts/          # Artifact viewer panel
│       ├── company/            # Company graph panel
│       ├── execution/          # Execution, queue, failures, metrics
│       ├── governance/         # Governance panel
│       ├── monitoring/         # Developer console, observability, reports, terminal
│       ├── runtime/            # Runtime hub panel
│       └── workflows/          # Workflow engine, recovery panels
├── config/                     # Application configuration
│   ├── auth.ts                 # NextAuth v4 configuration
│   └── supabase.ts             # Supabase client setup
├── database/                   # Data layer
│   └── client.ts               # Prisma client singleton
├── engine/                     # Runtime execution engine
│   ├── engine.ts               # Core engine orchestration
│   ├── router.ts               # Multi-provider routing
│   ├── verifier.ts             # Response verification
│   ├── failure-classifier.ts   # Failure classification
│   ├── queue-manager.ts        # Execution queue management
│   ├── types.ts                # Runtime type definitions
│   └── adapters/               # AI provider adapters
│       ├── openrouter.ts
│       ├── groq.ts
│       ├── gemini.ts
│       └── ollama.ts
├── services/                   # Operational services
│   ├── event-bus.ts            # Correlated event system
│   ├── agent-coordinator.ts    # Multi-agent coordination
│   ├── lineage-tracker.ts      # Execution lineage tracking
│   ├── health-monitor.ts       # System health metrics
│   ├── sandbox-manager.ts      # Sandbox management
│   ├── graph-analyzer.ts       # Company graph analysis
│   └── state-consistency.ts    # State drift detection
├── stores/                     # Zustand state management
│   ├── workspace-store.ts
│   ├── execution-store.ts
│   └── operational-store.ts
├── types/                      # Shared type definitions
│   ├── index.ts                # Master type definitions
│   └── next-auth.d.ts          # NextAuth type augmentation
├── utils/                      # Utility functions
│   └── helpers.ts              # cn(), and other helpers
├── hooks/                      # Custom React hooks
│   ├── use-toast.ts
│   └── use-mobile.ts
└── middleware.ts               # Route protection middleware
```

## API Routes

### Execution

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/execution` | Create a new runtime execution |
| `GET` | `/api/execution` | List executions with filters |
| `GET` | `/api/execution/[id]` | Get execution details |
| `POST` | `/api/execution/[id]/verify` | Verify an execution's output |

### Workflows

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/workflows` | Create a workflow |
| `GET` | `/api/workflows` | List workflows |
| `POST` | `/api/workflows/[id]/transition` | Transition workflow state |
| `GET` | `/api/workflows/[id]/executions` | Get workflow executions |
| `POST` | `/api/workflows/[id]/recover` | Recover a failed workflow |

### Execution Queue

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/queue` | Enqueue an execution |
| `GET` | `/api/queue` | List queued items |
| `GET` | `/api/queue/[id]` | Get queue item details |
| `POST` | `/api/queue/process` | Process next queue item |
| `POST` | `/api/queue/retry` | Retry a failed queue item |

### Governance

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/governance` | List governance rules |
| `GET` | `/api/governance/audit` | Query audit logs |

### Approvals

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/approvals` | Create an approval request |
| `GET` | `/api/approvals` | List pending approvals |
| `PATCH` | `/api/approvals/[id]` | Approve or reject a request |

### Agents

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/agents` | Register an agent |
| `GET` | `/api/agents` | List agents |
| `GET` | `/api/agents/[id]/logs` | Get agent logs |

### Events & Traces

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/events` | Emit a system event |
| `GET` | `/api/events` | Query events |
| `GET` | `/api/events/[id]` | Get event details |
| `POST` | `/api/traces` | Create an execution trace |
| `GET` | `/api/traces` | Query traces |
| `GET` | `/api/traces/[id]` | Get trace details |

### Additional Routes

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/runtime` | List AI providers |
| `POST` | `/api/runtime/[id]/healthcheck` | Run provider health check |
| `GET` | `/api/observability` | System observability data |
| `GET` | `/api/ratings` | Build ratings |
| `GET` | `/api/ratings/stats` | Rating statistics |
| `POST` | `/api/company` | Manage company graph |
| `POST` | `/api/artifacts` | Create artifact |
| `GET` | `/api/artifacts/[id]` | Get artifact |
| `GET` | `/api/failures` | List failure records |
| `POST` | `/api/coordination` | Agent coordination |
| `POST` | `/api/graph-analysis` | Analyze company graph |
| `GET` | `/api/snapshots` | State snapshots |
| `GET` | `/api/health` | System health check |
| `GET` | `/api/workspace` | Workspace info |
| `POST` | `/api/register` | Create a new user account |

## Database Schema

Ameo AI uses **25 Prisma models** organized into functional domains:

### Authentication

| Model | Description |
|---|---|
| `User` | Platform user with credentials and profile |
| `Account` | OAuth provider accounts |
| `Session` | User session management |

### Workspace & Company

| Model | Description |
|---|---|
| `Workspace` | Top-level operational container with mode and status |
| `Company` | Hierarchical entity graph with parent-child self-references |

### Runtime Engine

| Model | Description |
|---|---|
| `RuntimeProvider` | AI provider configuration (OpenRouter, Groq, Gemini, Ollama) with health scoring |
| `RuntimeHealthLog` | Provider health check history with latency tracking |
| `RuntimeExecution` | Full AI execution record with request/response data, token usage, verification, and approval linkage |

### Workflow Engine

| Model | Description |
|---|---|
| `Workflow` | State machine workflow with priority, config, and definition |
| `WorkflowExecution` | Individual workflow run with step tracking and retry count |
| `WorkflowCheckpoint` | State snapshots at workflow milestones |
| `WorkflowLog` | Structured workflow event log |
| `WorkflowDependency` | Directed dependency graph between workflows |

### Governance

| Model | Description |
|---|---|
| `GovernanceRule` | Configurable governance rules with severity levels |
| `AuditLog` | Comprehensive audit trail for all governed actions |
| `ApprovalRequest` | Approval gates for runtime execution, deployment, and sensitive actions |

### Agent System

| Model | Description |
|---|---|
| `Agent` | Registered AI agent with capabilities and configuration |
| `AgentLog` | Agent activity log with structured metadata |

### Execution Infrastructure

| Model | Description |
|---|---|
| `ExecutionQueue` | Prioritized execution queue with retry logic and failure classification |
| `FailureRecord` | Classified failures for pattern analysis and recovery tracking |
| `Artifact` | Persistent execution outputs (code, reports, plans, specs) with verification status |

### Operational Layer

| Model | Description |
|---|---|
| `SystemEvent` | Correlated event bus entries with causation chains and trace IDs |
| `ExecutionTrace` | Full lineage tracking from workflow through execution to artifact |
| `AgentCoordination` | Multi-agent task management with locking, permissions, and handoff |
| `StateSnapshot` | Periodic state consistency captures with drift detection |
| `SystemHealthMetric` | Real-time subsystem metrics with severity classification |

### Quality

| Model | Description |
|---|---|
| `BuildRating` | Multi-dimensional quality scores across architecture, stability, UI, and verification |

## Development

### Available Scripts

```bash
# Development
bun run dev            # Start dev server on port 3000
bun run build          # Production build with standalone output
bun run start          # Run production server

# Database
bun run db:push        # Push schema changes to database
bun run db:generate    # Generate Prisma client
bun run db:migrate     # Run migrations
bun run db:reset       # Reset database

# Quality
bun run lint           # Run ESLint
```

### Tech Stack Details

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Server Components) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| ORM | Prisma 6 (PostgreSQL via Supabase) |
| State | Zustand |
| Animations | Framer Motion |
| Auth | NextAuth v4 (Credentials + JWT) |
| Data Fetching | TanStack React Query |
| Forms | React Hook Form + Zod |
| Database | PostgreSQL 15 (Supabase) |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

---

<div align="center">

**Built with intention. Governed by design.**

</div>
