import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/workflows — List all workflows, optionally filter by ?state=xxx
// Include latest 5 executions per workflow
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const state = searchParams.get('state')

    const workflows = await db.workflow.findMany({
      where: {
        ...(state && { state }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        executions: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    return NextResponse.json({ success: true, data: workflows })
  } catch (error) {
    console.error('[GET /api/workflows]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch workflows' },
      { status: 500 }
    )
  }
}

// POST /api/workflows — Create workflow
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, name, description, type, definition, config, priority } = body

    if (!workspaceId || !name) {
      return NextResponse.json(
        { success: false, error: 'workspaceId and name are required' },
        { status: 400 }
      )
    }

    const workflow = await db.workflow.create({
      data: {
        workspaceId,
        name,
        ...(description && { description }),
        ...(type && { type }),
        ...(definition && { definition: typeof definition === 'string' ? definition : JSON.stringify(definition) }),
        ...(config && { config: typeof config === 'string' ? config : JSON.stringify(config) }),
        ...(priority !== undefined && { priority }),
      },
    })

    return NextResponse.json({ success: true, data: workflow }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/workflows]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create workflow' },
      { status: 500 }
    )
  }
}

// PUT /api/workflows — Update a workflow
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, description, type, definition, config, priority } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.workflow.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      )
    }

    const updated = await db.workflow.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(type !== undefined && { type }),
        ...(definition !== undefined && { definition: typeof definition === 'string' ? definition : JSON.stringify(definition) }),
        ...(config !== undefined && { config: typeof config === 'string' ? config : JSON.stringify(config) }),
        ...(priority !== undefined && { priority }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('[PUT /api/workflows]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update workflow' },
      { status: 500 }
    )
  }
}

// DELETE /api/workflows — Remove a workflow
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

    const existing = await db.workflow.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      )
    }

    await db.workflow.delete({ where: { id } })

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    console.error('[DELETE /api/workflows]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete workflow' },
      { status: 500 }
    )
  }
}
