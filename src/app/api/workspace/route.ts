import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/workspace — Return existing workspace or create a default one
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id

    let workspace: Awaited<ReturnType<typeof db.workspace.findFirst>> | null = null

    if (userId) {
      workspace = await db.workspace.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      })
    }

    if (!workspace) {
      const data: Parameters<typeof db.workspace.create>[0]['data'] = {
        name: 'Ameo AI Workspace',
        mode: 'builder',
        status: 'active',
      }
      if (userId) {
        data.user = { connect: { id: userId } }
      }
      workspace = await db.workspace.create({ data })
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

    const session = await getServerSession(authOptions)
    const userId = session?.user?.id

    const where = userId ? { userId } : {}
    const workspace = await db.workspace.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
    })

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
