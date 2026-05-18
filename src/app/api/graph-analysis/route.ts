import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/graph-analysis — Run workflow graph analysis
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

    // 1. Fetch all workflows and dependencies for this workspace
    const [workflows, deps] = await Promise.all([
      db.workflow.findMany({
        where: { workspaceId },
      }),
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

    // 2. Build adjacency list
    const adjacency = new Map<string, string[]>()
    for (const w of workflows) {
      adjacency.set(w.id, [])
    }
    for (const d of deps) {
      const targets = adjacency.get(d.sourceId) || []
      targets.push(d.targetId)
      adjacency.set(d.sourceId, targets)
    }

    const issues: Array<{ type: string; severity: string; message: string; workflowId?: string }> = []
    const nodeCount = workflows.length
    const edgeCount = deps.length

    // 3. Check for self-references
    for (const d of deps) {
      if (d.sourceId === d.targetId) {
        issues.push({
          type: 'self_reference',
          severity: 'error',
          message: `Workflow "${d.source.name}" (${d.sourceId}) references itself`,
          workflowId: d.sourceId,
        })
      }
    }

    // 4. Find orphan workflows (no dependencies at all)
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
          message: `Workflow "${w.name}" (${w.id}) has no dependencies`,
          workflowId: w.id,
        })
      }
    }

    // 5. Cycle detection (DFS)
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    let cycleDetected = false

    function dfs(nodeId: string, path: string[]): void {
      visited.add(nodeId)
      recursionStack.add(nodeId)
      path.push(nodeId)

      for (const neighbor of adjacency.get(nodeId) || []) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, path)
        } else if (recursionStack.has(neighbor)) {
          cycleDetected = true
          const cycleStart = path.indexOf(neighbor)
          const cyclePath = path.slice(cycleStart).concat(neighbor)
          issues.push({
            type: 'cycle',
            severity: 'error',
            message: `Circular dependency: ${cyclePath.map((id) => {
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

    // 6. Check for broken dependency references
    const workflowIds = new Set(workflows.map((w) => w.id))
    for (const d of deps) {
      if (!workflowIds.has(d.sourceId)) {
        issues.push({
          type: 'broken_reference',
          severity: 'error',
          message: `Dependency source "${d.sourceId}" does not reference a valid workflow`,
        })
      }
      if (!workflowIds.has(d.targetId)) {
        issues.push({
          type: 'broken_reference',
          severity: 'error',
          message: `Dependency target "${d.targetId}" does not reference a valid workflow`,
        })
      }
    }

    // 7. Generate topological execution plan (Kahn's algorithm)
    const executionPlan: string[][] = []
    if (!cycleDetected) {
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

    // 8. Calculate integrity score
    let integrityScore = 100
    for (const issue of issues) {
      if (issue.severity === 'error') integrityScore -= 20
      else if (issue.severity === 'warning') integrityScore -= 5
    }
    integrityScore = Math.max(0, Math.min(100, integrityScore))

    const nameMap = new Map(workflows.map((w) => [w.id, w.name]))

    const analysisResult = {
      isValid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
      nodeCount,
      edgeCount,
      executionPlan: executionPlan.map((level) =>
        level.map((id) => nameMap.get(id) || id)
      ),
      integrityScore,
      analyzedAt: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      data: analysisResult,
    })
  } catch (error) {
    console.error('[GET /api/graph-analysis]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to run graph analysis' },
      { status: 500 }
    )
  }
}
