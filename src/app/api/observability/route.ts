import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/observability — Comprehensive observability data for the dashboard
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: 'workspaceId is required' },
        { status: 400 }
      )
    }

    const baseWhere = { workspaceId }

    // Fire all queries in parallel for maximum performance
    const [
      recentEvents,
      recentTracesRaw,
      healthSummaryRaw,
      activeCoordinations,
      recentSnapshots,
      workflows,
      workflowDeps,
    ] = await Promise.all([
      // 1. Last 20 events
      db.systemEvent.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),

      // 2. Last 10 trace chains (distinct traceId, ordered by most recent step)
      db.executionTrace.findMany({
        where: baseWhere,
        orderBy: { startedAt: 'desc' },
        take: 50, // fetch more to get distinct chains
      }),

      // 3. Health summary data
      db.systemHealthMetric.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),

      // 4. Active agent coordination records
      db.agentCoordination.findMany({
        where: { ...baseWhere, status: { in: ['claimed', 'active'] } },
        orderBy: { createdAt: 'desc' },
      }),

      // 5. Last 5 state snapshots
      db.stateSnapshot.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),

      // 6. All workflows for graph analysis
      db.workflow.findMany({
        where: baseWhere,
      }),

      // 7. All workflow dependencies
      db.workflowDependency.findMany({
        where: {
          source: { workspaceId },
        },
        include: {
          source: { select: { id: true, name: true, state: true } },
          target: { select: { id: true, name: true, state: true } },
        },
      }),
    ])

    // === Process recentEvents ===
    const events = recentEvents.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    }))

    // === Process recentTraces (group into chains) ===
    const traceChainMap = new Map<string, (typeof recentTracesRaw)[number][]>()
    for (const t of recentTracesRaw) {
      const existing = traceChainMap.get(t.traceId)
      if (!existing) {
        traceChainMap.set(t.traceId, [t])
      } else {
        existing.push(t)
      }
    }
    const traceChains = Array.from(traceChainMap.entries())
      .slice(0, 10)
      .map(([traceId, steps]) => ({
        traceId,
        steps: steps
          .sort((a, b) => a.stepOrder - b.stepOrder)
          .map((s) => ({
            id: s.id,
            operation: s.operation,
            subsystem: s.subsystem,
            status: s.status,
            stepOrder: s.stepOrder,
            durationMs: s.durationMs,
            startedAt: s.startedAt.toISOString(),
            completedAt: s.completedAt?.toISOString() || null,
          })),
        totalSteps: steps.length,
        overallStatus: steps.some((s) => s.status === 'failed')
          ? 'failed'
          : steps.every((s) => s.status === 'completed')
            ? 'completed'
            : 'running',
      }))

    // === Process healthSummary ===
    const severityCounts: Record<string, number> = {}
    const subsystemLatest: Record<string, { value: number; metricType: string; severity: string; unit: string | null; timestamp: string }> = {}
    for (const m of healthSummaryRaw) {
      severityCounts[m.severity] = (severityCounts[m.severity] || 0) + 1
      if (!subsystemLatest[m.subsystem] || m.createdAt > new Date(subsystemLatest[m.subsystem].timestamp)) {
        subsystemLatest[m.subsystem] = {
          value: m.value,
          metricType: m.metricType,
          severity: m.severity,
          unit: m.unit,
          timestamp: m.createdAt.toISOString(),
        }
      }
    }
    const hasCritical = (severityCounts['critical'] || 0) > 0
    const hasDegraded = (severityCounts['degraded'] || 0) > 0
    const hasWarning = (severityCounts['warning'] || 0) > 0
    const healthSummary = {
      overallStatus: hasCritical ? 'critical' : hasDegraded ? 'degraded' : hasWarning ? 'warning' : 'healthy',
      bySeverity: severityCounts,
      subsystemLatest,
    }

    // === Process activeCoordinations ===
    const coordinations = activeCoordinations.map((c) => ({
      id: c.id,
      taskId: c.taskId,
      taskType: c.taskType,
      description: c.description,
      ownerAgentId: c.ownerAgentId,
      ownerAgentType: c.ownerAgentType,
      status: c.status,
      lockedAt: c.lockedAt?.toISOString() || null,
      lockExpiresAt: c.lockExpiresAt?.toISOString() || null,
      createdAt: c.createdAt.toISOString(),
    }))

    // === Process recentSnapshots ===
    const snapshots = recentSnapshots.map((s) => ({
      id: s.id,
      subsystem: s.subsystem,
      resourceType: s.resourceType,
      resourceId: s.resourceId,
      stateHash: s.stateHash,
      consistencyStatus: s.consistencyStatus,
      driftDetected: s.driftDetected,
      snapshotReason: s.snapshotReason,
      createdAt: s.createdAt.toISOString(),
    }))

    // === Process graphAnalysis ===
    const graphAnalysis = buildGraphAnalysis(workflows, workflowDeps)

    return NextResponse.json({
      success: true,
      data: {
        recentEvents: events,
        recentTraces: traceChains,
        healthSummary,
        activeCoordinations: coordinations,
        recentSnapshots: snapshots,
        graphAnalysis,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[GET /api/observability]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch observability data' },
      { status: 500 }
    )
  }
}

// --- Graph Analysis Helper ---

interface GraphAnalysisResult {
  isValid: boolean
  issues: Array<{ type: string; severity: string; message: string; workflowId?: string }>
  nodeCount: number
  edgeCount: number
  executionPlan: string[][]
  integrityScore: number
}

function buildGraphAnalysis(
  workflows: Array<{ id: string; name: string; state: string }>,
  deps: Array<{
    id: string
    sourceId: string
    targetId: string
    type: string
    source: { id: string; name: string; state: string }
    target: { id: string; name: string; state: string }
  }>
): GraphAnalysisResult {
  const issues: GraphAnalysisResult['issues'] = []
  const nodeCount = workflows.length
  const edgeCount = deps.length

  // Build adjacency list (sourceId -> targetId[])
  const adjacency = new Map<string, string[]>()
  for (const w of workflows) {
    adjacency.set(w.id, [])
  }
  for (const d of deps) {
    const targets = adjacency.get(d.sourceId) || []
    targets.push(d.targetId)
    adjacency.set(d.sourceId, targets)
  }

  // 1. Check for self-references
  for (const d of deps) {
    if (d.sourceId === d.targetId) {
      issues.push({
        type: 'self_reference',
        severity: 'error',
        message: `Workflow "${d.source.name}" (${d.sourceId}) has a self-referencing dependency`,
        workflowId: d.sourceId,
      })
    }
  }

  // 2. Find orphan workflows (no incoming or outgoing dependencies)
  const involvedIds = new Set<string>()
  for (const d of deps) {
    involvedIds.add(d.sourceId)
    involvedIds.add(d.targetId)
  }
  for (const w of workflows) {
    if (!involvedIds.has(w.id)) {
      issues.push({
        type: 'orphan',
        severity: 'warning',
        message: `Workflow "${w.name}" (${w.id}) has no dependencies at all`,
        workflowId: w.id,
      })
    }
  }

  // 3. Cycle detection (DFS)
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const cycleDetected = { value: false }

  function dfs(nodeId: string, path: string[]): void {
    visited.add(nodeId)
    recursionStack.add(nodeId)
    path.push(nodeId)

    for (const neighbor of adjacency.get(nodeId) || []) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, path)
      } else if (recursionStack.has(neighbor)) {
        cycleDetected.value = true
        const cycleStart = path.indexOf(neighbor)
        const cyclePath = path.slice(cycleStart).concat(neighbor)
        issues.push({
          type: 'cycle',
          severity: 'error',
          message: `Circular dependency detected: ${cyclePath.map((id) => {
            const wf = workflows.find((w) => w.id === id)
            return wf ? wf.name : id
          }).join(' → ')}`,
        })
      }
    }

    path.pop()
    recursionStack.delete(nodeId)
  }

  for (const w of workflows) {
    if (!visited.has(w.id)) {
      dfs(w.id, [])
    }
  }

  // 4. Check for broken dependency references
  const workflowIds = new Set(workflows.map((w) => w.id))
  for (const d of deps) {
    if (!workflowIds.has(d.sourceId)) {
      issues.push({
        type: 'broken_reference',
        severity: 'error',
        message: `Dependency source "${d.sourceId}" does not exist`,
      })
    }
    if (!workflowIds.has(d.targetId)) {
      issues.push({
        type: 'broken_reference',
        severity: 'error',
        message: `Dependency target "${d.targetId}" does not exist`,
      })
    }
  }

  // 5. Generate topological execution plan (if no cycles)
  const executionPlan: string[][] = []
  if (!cycleDetected.value) {
    const inDegree = new Map<string, number>()
    for (const w of workflows) {
      inDegree.set(w.id, 0)
    }
    for (const d of deps) {
      inDegree.set(d.targetId, (inDegree.get(d.targetId) || 0) + 1)
    }

    let queue = Array.from(inDegree.entries())
      .filter(([, deg]) => deg === 0)
      .map(([id]) => id)

    while (queue.length > 0) {
      executionPlan.push([...queue])
      const nextQueue: string[] = []
      for (const nodeId of queue) {
        for (const neighbor of adjacency.get(nodeId) || []) {
          const newDeg = (inDegree.get(neighbor) || 1) - 1
          inDegree.set(neighbor, newDeg)
          if (newDeg === 0) {
            nextQueue.push(neighbor)
          }
        }
      }
      queue = nextQueue
    }
  }

  // 6. Calculate integrity score
  let integrityScore = 100
  for (const issue of issues) {
    if (issue.severity === 'error') integrityScore -= 20
    else if (issue.severity === 'warning') integrityScore -= 5
  }
  integrityScore = Math.max(0, Math.min(100, integrityScore))

  // Resolve workflow names for execution plan
  const nameMap = new Map(workflows.map((w) => [w.id, w.name]))

  return {
    isValid: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
    nodeCount,
    edgeCount,
    executionPlan: executionPlan.map((level) =>
      level.map((id) => nameMap.get(id) || id)
    ),
    integrityScore,
  }
}
