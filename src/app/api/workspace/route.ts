import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/workspace — Return existing workspace or create a default one
export async function GET() {
  try {
    let workspace = await db.workspace.findFirst()

    if (!workspace) {
      workspace = await db.workspace.create({
        data: {
          name: 'Nexus OS Workspace',
          mode: 'builder',
          status: 'active',
        },
      })
    }

    return NextResponse.json({ success: true, data: workspace })
  } catch (error) {
    console.error('[GET /api/workspace]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch workspace' },
      { status: 500 }
    )
  }
}

// PUT /api/workspace — Update workspace
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, mode } = body

    const workspace = await db.workspace.findFirst()
    if (!workspace) {
      return NextResponse.json(
        { success: false, error: 'No workspace found' },
        { status: 404 }
      )
    }

    const updated = await db.workspace.update({
      where: { id: workspace.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(mode !== undefined && { mode }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('[PUT /api/workspace]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update workspace' },
      { status: 500 }
    )
  }
}
