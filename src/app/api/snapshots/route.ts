import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/snapshots — Query state snapshots
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId') || undefined
    const subsystem = searchParams.get('subsystem') || undefined
    const consistencyStatus = searchParams.get('consistencyStatus') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)

    const where: Record<string, unknown> = {}
    if (workspaceId) where.workspaceId = workspaceId
    if (subsystem) where.subsystem = subsystem
    if (consistencyStatus) where.consistencyStatus = consistencyStatus

    const [snapshots, total, subsystemCounts, driftCounts] = await Promise.all([
      db.stateSnapshot.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      db.stateSnapshot.count({ where }),
      db.stateSnapshot.groupBy({
        by: ['subsystem'],
        where: workspaceId ? { workspaceId } : undefined,
        _count: { subsystem: true },
      }),
      db.stateSnapshot.groupBy({
        by: ['consistencyStatus'],
        where: workspaceId ? { workspaceId } : undefined,
        _count: { consistencyStatus: true },
      }),
    ])

    const subsystemMap: Record<string, number> = {}
    for (const g of subsystemCounts) {
      subsystemMap[g.subsystem] = g._count.subsystem
    }

    const driftMap: Record<string, number> = {}
    for (const g of driftCounts) {
      driftMap[g.consistencyStatus] = g._count.consistencyStatus
    }

    return NextResponse.json({
      success: true,
      data: snapshots.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
      })),
      meta: {
        total,
        limit,
        aggregations: {
          bySubsystem: subsystemMap,
          byConsistencyStatus: driftMap,
        },
      },
    })
  } catch (error) {
    console.error('[GET /api/snapshots]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch state snapshots' },
      { status: 500 }
    )
  }
}

// POST /api/snapshots — Capture a new state snapshot
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      workspaceId,
      subsystem,
      resourceType,
      resourceId,
      snapshotReason,
    } = body

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: 'workspaceId is required' },
        { status: 400 }
      )
    }
    if (!subsystem) {
      return NextResponse.json(
        { success: false, error: 'subsystem is required' },
        { status: 400 }
      )
    }

    const validSubsystems = ['workflow', 'queue', 'runtime', 'agent', 'artifact', 'governance', 'system']
    if (!validSubsystems.includes(subsystem)) {
      return NextResponse.json(
        { success: false, error: `Invalid subsystem. Must be one of: ${validSubsystems.join(', ')}` },
        { status: 400 }
      )
    }

    // Fetch current state of the subsystem
    let stateData: Record<string, unknown> = {}
    let totalCount = 0

    switch (subsystem) {
      case 'workflow': {
        const [items, count] = await Promise.all([
          db.workflow.findMany({
            where: { workspaceId },
            select: {
              id: true,
              name: true,
              state: true,
              priority: true,
              updatedAt: true,
            },
            take: 1000,
          }),
          db.workflow.count({ where: { workspaceId } }),
        ])
        stateData = { workflows: items }
        totalCount = count
        break
      }
      case 'queue': {
        const [items, count] = await Promise.all([
          db.executionQueue.findMany({
            where: { workspaceId },
            select: {
              id: true,
              status: true,
              priority: true,
              retryCount: true,
              scheduledAt: true,
            },
            take: 1000,
          }),
          db.executionQueue.count({ where: { workspaceId } }),
        ])
        stateData = { queueItems: items }
        totalCount = count
        break
      }
      case 'runtime': {
        const [items, count] = await Promise.all([
          db.runtimeExecution.findMany({
            where: { workspaceId },
            select: {
              id: true,
              status: true,
              requestType: true,
              latencyMs: true,
              qualityScore: true,
              createdAt: true,
            },
            take: 1000,
          }),
          db.runtimeExecution.count({ where: { workspaceId } }),
        ])
        stateData = { executions: items }
        totalCount = count
        break
      }
      case 'agent': {
        const [items, count] = await Promise.all([
          db.agent.findMany({
            where: { workspaceId },
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
              updatedAt: true,
            },
          }),
          db.agent.count({ where: { workspaceId } }),
        ])
        stateData = { agents: items }
        totalCount = count
        break
      }
      case 'artifact': {
        const [items, count] = await Promise.all([
          db.artifact.findMany({
            where: { workspaceId },
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              version: true,
              updatedAt: true,
            },
            take: 1000,
          }),
          db.artifact.count({ where: { workspaceId } }),
        ])
        stateData = { artifacts: items }
        totalCount = count
        break
      }
      case 'governance': {
        const [items, count] = await Promise.all([
          db.governanceRule.findMany({
            where: { workspaceId },
            select: {
              id: true,
              name: true,
              type: true,
              enabled: true,
              severity: true,
            },
          }),
          db.governanceRule.count({ where: { workspaceId } }),
        ])
        stateData = { rules: items }
        totalCount = count
        break
      }
      case 'system': {
        const [queueCount, executionCount, workflowCount, agentCount, artifactCount, ruleCount, failureCount] =
          await Promise.all([
            db.executionQueue.count({ where: { workspaceId } }),
            db.runtimeExecution.count({ where: { workspaceId } }),
            db.workflow.count({ where: { workspaceId } }),
            db.agent.count({ where: { workspaceId } }),
            db.artifact.count({ where: { workspaceId } }),
            db.governanceRule.count({ where: { workspaceId } }),
            db.failureRecord.count({ where: { workspaceId } }),
          ])
        stateData = {
          totalQueues: queueCount,
          totalExecutions: executionCount,
          totalWorkflows: workflowCount,
          totalAgents: agentCount,
          totalArtifacts: artifactCount,
          totalRules: ruleCount,
          totalFailures: failureCount,
        }
        totalCount = queueCount + executionCount + workflowCount + agentCount + artifactCount + ruleCount
        break
      }
    }

    // Hash the state data
    const stateJson = JSON.stringify(stateData)
    const stateHash = await hashString(stateJson)

    // Find the previous snapshot for this subsystem (and optional resource)
    const prevSnapshotWhere: Record<string, unknown> = {
      workspaceId,
      subsystem,
    }
    if (resourceType) prevSnapshotWhere.resourceType = resourceType
    if (resourceId) prevSnapshotWhere.resourceId = resourceId

    const previousSnapshot = await db.stateSnapshot.findFirst({
      where: prevSnapshotWhere,
      orderBy: { createdAt: 'desc' },
    })

    // Compare with previous snapshot
    let consistencyStatus = 'consistent'
    let driftDetected = false
    let driftDetails: string | null = null

    if (previousSnapshot && previousSnapshot.stateHash !== stateHash) {
      consistencyStatus = 'drifted'
      driftDetected = true

      // Compute drift details by comparing previous and current state
      const prevData = previousSnapshot.stateData
        ? JSON.parse(previousSnapshot.stateData)
        : {}
      driftDetails = JSON.stringify({
        previousHash: previousSnapshot.stateHash,
        currentHash: stateHash,
        previousCount: previousSnapshot.stateData ? undefined : undefined,
        currentCount: totalCount,
        timestamp: new Date().toISOString(),
      })
    }

    // Create the snapshot
    const snapshot = await db.stateSnapshot.create({
      data: {
        workspaceId,
        subsystem,
        resourceType: resourceType || null,
        resourceId: resourceId || null,
        stateHash,
        stateData: stateJson,
        previousHash: previousSnapshot?.stateHash || null,
        consistencyStatus,
        driftDetected,
        driftDetails,
        capturedBy: 'system',
        snapshotReason: snapshotReason || 'manual',
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: snapshot.id,
          subsystem: snapshot.subsystem,
          stateHash: snapshot.stateHash,
          previousHash: snapshot.previousHash,
          consistencyStatus: snapshot.consistencyStatus,
          driftDetected: snapshot.driftDetected,
          driftDetails: snapshot.driftDetails ? JSON.parse(snapshot.driftDetails) : null,
          snapshotReason: snapshot.snapshotReason,
          itemCount: totalCount,
          createdAt: snapshot.createdAt.toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/snapshots]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to capture state snapshot' },
      { status: 500 }
    )
  }
}

// --- SHA-256 hash utility (using Web Crypto API, available in Node 18+) ---
async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
