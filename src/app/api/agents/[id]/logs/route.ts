import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/agents/[id]/logs — List logs for a specific agent
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const agent = await db.agent.findUnique({ where: { id } })
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const level = searchParams.get('level')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const logs = await db.agentLog.findMany({
      where: {
        agentId: id,
        ...(level && { level }),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    })

    return NextResponse.json({ success: true, data: logs })
  } catch (error) {
    console.error('[GET /api/agents/[id]/logs]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch agent logs' },
      { status: 500 }
    )
  }
}

// POST /api/agents/[id]/logs — Create a new agent log entry
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { level, message, metadata } = body

    const agent = await db.agent.findUnique({ where: { id } })
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      )
    }

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'message is required' },
        { status: 400 }
      )
    }

    const validLevels = ['debug', 'info', 'warn', 'error']
    if (level && !validLevels.includes(level)) {
      return NextResponse.json(
        { success: false, error: `Invalid level. Must be one of: ${validLevels.join(', ')}` },
        { status: 400 }
      )
    }

    const log = await db.agentLog.create({
      data: {
        agentId: id,
        message,
        ...(level && { level }),
        ...(metadata && { metadata: typeof metadata === 'string' ? metadata : JSON.stringify(metadata) }),
      },
    })

    return NextResponse.json({ success: true, data: log }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/agents/[id]/logs]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create agent log' },
      { status: 500 }
    )
  }
}
