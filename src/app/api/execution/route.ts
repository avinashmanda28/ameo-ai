import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/execution — Execute a runtime request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      workspaceId,
      providerId,
      agentId,
      workflowId,
      requestType,
      prompt,
      systemPrompt,
      modelId,
      temperature,
      maxTokens,
      skipApproval,
    } = body

    // Validate required fields
    if (!workspaceId || !requestType || !prompt) {
      return NextResponse.json(
        { success: false, error: 'workspaceId, requestType, and prompt are required' },
        { status: 400 }
      )
    }

    const validRequestTypes = ['chat', 'completion', 'embedding']
    if (!validRequestTypes.includes(requestType)) {
      return NextResponse.json(
        { success: false, error: `Invalid requestType. Must be one of: ${validRequestTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Try to use RuntimeEngine if available
    let engineResult
    try {
      const { RuntimeEngine } = await import('@/lib/engine/engine')
      const engine = new RuntimeEngine()
      engineResult = await engine.execute({
        db,
        workspaceId,
        providerId,
        agentId,
        workflowId,
        requestType,
        prompt,
        systemPrompt,
        modelId,
        temperature,
        maxTokens,
        skipApproval,
      })
    } catch (engineError) {
      // Engine not yet connected — create a pending execution and return gracefully
      console.warn('[POST /api/execution] RuntimeEngine not available, creating pending execution:', engineError)

      const execution = await db.runtimeExecution.create({
        data: {
          workspaceId,
          providerId: providerId || null,
          agentId: agentId || null,
          workflowId: workflowId || null,
          requestType,
          prompt,
          systemPrompt: systemPrompt || null,
          modelId: modelId || null,
          temperature: temperature ?? null,
          maxTokens: maxTokens ?? null,
          status: 'pending',
        },
      })

      return NextResponse.json({
        success: true,
        data: {
          executionId: execution.id,
          approvalRequired: false,
          response: 'Engine not yet connected — execution queued as pending',
        },
      }, { status: 202 })
    }

    return NextResponse.json({ success: true, data: engineResult }, { status: 200 })
  } catch (error) {
    console.error('[POST /api/execution]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to execute runtime request' },
      { status: 500 }
    )
  }
}

// GET /api/execution — List runtime executions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const providerId = searchParams.get('providerId') || undefined
    const agentId = searchParams.get('agentId') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (providerId) where.providerId = providerId
    if (agentId) where.agentId = agentId

    const [executions, total] = await Promise.all([
      db.runtimeExecution.findMany({
        where,
        include: {
          provider: {
            select: { id: true, name: true, type: true },
          },
          agent: {
            select: { id: true, name: true, type: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.runtimeExecution.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: executions,
      meta: { total, limit, offset },
    })
  } catch (error) {
    console.error('[GET /api/execution]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch executions' },
      { status: 500 }
    )
  }
}
