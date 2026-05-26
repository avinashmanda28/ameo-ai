import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const db = new PrismaClient()

async function main() {
  console.log("🌱 Seeding database...")

  // ── Default Admin User ──────────────────────────────────────
  const adminEmail = "admin@ameo.ai"
  const adminPassword = "Admin123!"

  let adminUser = await db.user.findUnique({ where: { email: adminEmail } })

  if (!adminUser) {
    const hashedPassword = await bcrypt.hash(adminPassword, 12)
    adminUser = await db.user.create({
      data: {
        email: adminEmail,
        name: "Admin",
        hashedPassword,
      },
    })
    console.log(`  ✓ Created admin user: ${adminEmail} / ${adminPassword}`)
  } else {
    console.log(`  ✓ Admin user already exists: ${adminEmail}`)
  }

  // ── Default Workspace ───────────────────────────────────────
  let workspace = await db.workspace.findFirst({
    where: { userId: adminUser.id },
  })

  if (!workspace) {
    workspace = await db.workspace.create({
      data: {
        userId: adminUser.id,
        name: "Main Workspace",
        description: "Default workspace for Ameo AI operations",
        mode: "builder",
        status: "active",
      },
    })
    console.log(`  ✓ Created workspace: ${workspace.name}`)
  } else {
    console.log(`  ✓ Workspace already exists: ${workspace.name}`)
  }

  // ── Sample Runtime Providers ────────────────────────────────
  const providers = [
    { name: "OpenRouter", type: "openrouter", role: "primary", modelId: "anthropic/claude-3.5-sonnet" },
    { name: "Groq", type: "groq", role: "secondary", modelId: "llama3-70b-8192" },
    { name: "Gemini", type: "gemini", role: "fallback", modelId: "gemini-2.0-flash" },
    { name: "Ollama (Local)", type: "ollama", role: "secondary", baseUrl: "http://localhost:11434", modelId: "llama3" },
  ]

  for (const provider of providers) {
    const exists = await db.runtimeProvider.findFirst({
      where: { workspaceId: workspace.id, name: provider.name },
    })
    if (!exists) {
      await db.runtimeProvider.create({
        data: {
          workspaceId: workspace.id,
          name: provider.name,
          type: provider.type,
          role: provider.role,
          modelId: provider.modelId ?? null,
          baseUrl: "baseUrl" in provider ? provider.baseUrl : null,
          status: "inactive",
          healthScore: 0,
          rating: 0,
        },
      })
      console.log(`  ✓ Created provider: ${provider.name}`)
    }
  }

  // ── Sample Workflow ─────────────────────────────────────────
  const workflowName = "Hello World Workflow"
  let workflow = await db.workflow.findFirst({
    where: { workspaceId: workspace.id, name: workflowName },
  })

  if (!workflow) {
    workflow = await db.workflow.create({
      data: {
        workspaceId: workspace.id,
        name: workflowName,
        description: "A simple hello world workflow to demonstrate the Ameo engine",
        type: "basic",
        state: "draft",
        priority: 0,
        definition: JSON.stringify({
          steps: [
            {
              id: "step-1",
              name: "Generate Greeting",
              type: "llm",
              prompt: "Say hello in a creative way.",
              provider: "openrouter",
            },
          ],
        }),
      },
    })
    console.log(`  ✓ Created workflow: ${workflowName}`)
  } else {
    console.log(`  ✓ Workflow already exists: ${workflowName}`)
  }

  // ── Sample Governance Rule ──────────────────────────────────
  const ruleName = "Runtime Approval Gate"
  const rule = await db.governanceRule.findFirst({
    where: { workspaceId: workspace.id, name: ruleName },
  })

  if (!rule) {
    await db.governanceRule.create({
      data: {
        workspaceId: workspace.id,
        name: ruleName,
        type: "approval_required",
        description: "Requires approval for all runtime AI executions",
        config: JSON.stringify({
          scope: "all",
          autoApproveFor: ["primary"],
          severity: "medium",
        }),
        enabled: true,
        severity: "medium",
      },
    })
    console.log(`  ✓ Created governance rule: ${ruleName}`)
  }

  console.log("\n✅ Seeding complete!")
  console.log("  Login with: admin@ameo.ai / Admin123!")
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
