import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/agents — List agents with latest 10 logs each
export async function GET() {
  try {
    const agents = await db.agent.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        logs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    return NextResponse.json({ success: true, data: agents })
  } catch (error) {
    console.error('[GET /api/agents]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch agents' },
      { status: 500 }
    )
  }
}

// POST /api/agents — Create an agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, name, type, description, status, config, capabilities } = body

    if (!workspaceId || !name || !type) {
      return NextResponse.json(
        { success: false, error: 'workspaceId, name, and type are required' },
        { status: 400 }
      )
    }

    const validTypes = ['head', 'builder', 'qa', 'verification', 'terminal', 'governance']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const agent = await db.agent.create({
      data: {
        workspaceId,
        name,
        type,
        ...(description && { description }),
        ...(status && { status }),
        ...(config && { config: typeof config === 'string' ? config : JSON.stringify(config) }),
        ...(capabilities && { capabilities: typeof capabilities === 'string' ? capabilities : JSON.stringify(capabilities) }),
      },
    })

    return NextResponse.json({ success: true, data: agent }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/agents]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create agent' },
      { status: 500 }
    )
  }
}

// PUT /api/agents — Update an agent
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, type, description, status, config, capabilities } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.agent.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      )
    }

    const updated = await db.agent.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(config !== undefined && { config: typeof config === 'string' ? config : JSON.stringify(config) }),
        ...(capabilities !== undefined && { capabilities: typeof capabilities === 'string' ? capabilities : JSON.stringify(capabilities) }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('[PUT /api/agents]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update agent' },
      { status: 500 }
    )
  }
}

// DELETE /api/agents — Delete an agent
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id query parameter is required' },
        { status: 400 }
      )
    }

    const existing = await db.agent.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      )
    }

    await db.agent.delete({ where: { id } })

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    console.error('[DELETE /api/agents]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete agent' },
      { status: 500 }
    )
  }
}
