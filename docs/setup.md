# Ameo AI — Setup Guide

This guide covers installing, configuring, and running the Ameo AI platform locally for development.

---

## Prerequisites

| Requirement | Minimum Version | Recommended |
|-------------|----------------|-------------|
| Node.js | 18.x | 20.x LTS |
| Bun | 1.0+ | Latest stable |
| Git | 2.30+ | Latest |
| OS | Any (Linux, macOS, Windows WSL) | Linux/macOS |

> **Note:** Bun is used as the preferred package manager and runtime for production. Node.js is required for Next.js development tooling.

---

## Clone & Install

```bash
# Clone the repository
git clone <repository-url> ameo-ai
cd ameo-ai

# Install dependencies
bun install
```

This installs all dependencies defined in `package.json`, including:

- **Next.js 16** — Full-stack React framework
- **Prisma 6** — Database ORM with SQLite provider
- **React 19** — UI library
- **Radix UI** — Accessible component primitives
- **Zustand** — State management
- **TanStack Query** — Server state management
- **Tailwind CSS 4** — Utility-first CSS
- **Zod** — Schema validation
- **next-auth** — Authentication

---

## Environment Variables

Copy the example environment file and configure your values:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# ─── Database ───────────────────────────────────────
DATABASE_URL="file:./db/custom.db"

# ─── NextAuth ───────────────────────────────────────
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-here"

# ─── AI Provider API Keys (configure at least one) ──
OPENROUTER_API_KEY="sk-or-v1-your-key-here"
GROQ_API_KEY="gsk_your-key-here"
GEMINI_API_KEY="AIza-your-key-here"
# OLLAMA_BASE_URL="http://localhost:11434"

# ─── Environment ────────────────────────────────────
NODE_ENV="development"
```

### Key Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite database path (relative to `prisma/`) |
| `NEXTAUTH_URL` | Yes | Public URL of your application |
| `NEXTAUTH_SECRET` | Yes | Generate with `openssl rand -base64 32` |
| `OPENROUTER_API_KEY` | No | API key for OpenRouter AI gateway |
| `GROQ_API_KEY` | No | API key for Groq (fast LLM inference) |
| `GEMINI_API_KEY` | No | API key for Google Gemini models |
| `OLLAMA_BASE_URL` | No | Local Ollama server URL (no key needed) |

> **Tip:** You only need to configure at least one AI provider to start using the runtime engine. Multiple providers enable intelligent routing and failover.

---

## Database Setup

Ameo AI uses SQLite with Prisma as the ORM. No external database server is needed.

```bash
# Generate the Prisma client
bun run db:generate

# Push the schema to create/update tables
bun run db:push
```

This creates the SQLite database at the path specified in `DATABASE_URL` (default: `prisma/db/custom.db`) and initializes all tables including:

- Workspace, Company, Agent models
- RuntimeProvider and health tracking
- Workflow engine with full lifecycle
- Governance rules and audit logs
- Execution queue and failure records
- Event bus, lineage tracking, health metrics

### Database Commands Reference

```bash
bun run db:push       # Apply schema changes (no migration files)
bun run db:generate   # Regenerate Prisma client
bun run db:migrate    # Create and apply migrations (development)
bun run db:reset      # Reset database (destroys all data)
```

---

## Running the Development Server

```bash
bun run dev
```

This starts the Next.js development server on **http://localhost:3000** with:

- Hot module replacement (HMR)
- TypeScript type checking
- Development logging (output to `dev.log`)

### First-Time Workspace Initialization

When you first access the application:

1. **Create a workspace** — The UI will prompt you to create your first workspace. Choose a mode:
   - **Builder** — Build, create, and implement systems
   - **Operations** — Monitor, manage, and optimize operations
   - **Strategy** — Plan, analyze, and decide strategically
   - **Governance** — Enforce rules, audit, and secure the system

2. **Configure AI providers** — Navigate to the Runtime Hub and add at least one provider:
   - Enter your API key
   - Select a model ID (e.g., `anthropic/claude-3.5-sonnet` for OpenRouter)
   - Set the provider role (primary, secondary, or fallback)
   - The health check will verify connectivity

3. **Create agents** — Add agents to your workspace. Agent types include:
   - **Agent Head** — Orchestrates all agents
   - **Builder** — Executes build tasks
   - **QA** — Quality assurance and testing
   - **Verification** — Reality verification and hallucination detection
   - **Terminal** — Observes runtime logs
   - **Governance** — Security enforcement

4. **Set governance rules** — Optionally configure approval rules to require human review before runtime executions.

---

## Running the Production Build

```bash
# Build the application
bun run build

# Start the production server
bun run start
```

The build process:

1. Runs `next build` with standalone output
2. Copies static assets into the standalone directory
3. Copies the `public/` folder for static file serving
4. Outputs logs to `server.log`

The production server runs on port **3000** (configurable via `PORT` environment variable).

---

## Project Structure Overview

```
ameo-ai/
├── prisma/
│   ├── schema.prisma       # Database schema (all models)
│   └── db/                  # SQLite database files
├── src/
│   ├── app/
│   │   ├── page.tsx         # Root page
│   │   ├── layout.tsx       # App layout
│   │   └── api/             # API route handlers (30+ routes)
│   ├── components/
│   │   ├── ui/              # Base UI components (Radix/shadcn)
│   │   ├── workspace/       # Workspace shell & navigation
│   │   ├── runtime/         # Runtime hub panel
│   │   ├── workflows/       # Workflow engine panels
│   │   ├── execution/       # Queue, failures, metrics
│   │   ├── agents/          # Agent management
│   │   ├── governance/      # Rules & audit
│   │   ├── approvals/       # Approval banners
│   │   ├── artifacts/       # Artifact viewer
│   │   ├── company/         # Company graph
│   │   ├── operational/     # Console & observability
│   │   └── reports/         # Terminal & reports
│   ├── lib/
│   │   ├── runtime/         # Runtime engine, adapters, router, queue
│   │   ├── operational/     # Event bus, health, coordination, etc.
│   │   ├── store/           # Zustand stores
│   │   ├── types/           # TypeScript type definitions
│   │   ├── db.ts            # Prisma client singleton
│   │   └── utils.ts         # Utility functions
│   └── hooks/               # React hooks
├── public/                  # Static assets
├── docs/                    # Documentation
├── .env.example             # Environment template
├── next.config.ts           # Next.js configuration
├── tailwind.config.ts       # Tailwind CSS configuration
├── package.json             # Dependencies and scripts
└── tsconfig.json            # TypeScript configuration
```

---

## Troubleshooting

### Database errors

```bash
# If you see schema mismatch errors
bun run db:push

# If the database is corrupted
rm -f prisma/db/custom.db
bun run db:push
```

### Port already in use

```bash
# Kill processes on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
bun run dev -- -p 3001
```

### Prisma client not generated

```bash
# Regenerate after schema changes
bun run db:generate
```

### API key errors in Runtime Hub

- Verify your API key is correct for the provider
- Check that the provider's service is available
- For Ollama, ensure the local server is running: `ollama serve`
- Use the health check button in the Runtime Hub to diagnose connectivity
