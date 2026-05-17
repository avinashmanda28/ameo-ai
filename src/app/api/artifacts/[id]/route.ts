import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/artifacts/[id] — Get single artifact
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const artifact = await db.artifact.findUnique({
      where: { id },
    })

    if (!artifact) {
      return NextResponse.json(
        { success: false, error: 'Artifact not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: artifact })
  } catch (error) {
    console.error('[GET /api/artifacts/[id]]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch artifact' },
      { status: 500 }
    )
  }
}

// PUT /api/artifacts/[id] — Update artifact content/title/status (increments version on content update)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, content, status, summary, language, metadata } = body

    const existing = await db.artifact.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Artifact not found' },
        { status: 404 }
      )
    }

    // Determine if content is being updated — increment version
    const contentChanged = content !== undefined && content !== existing.content

    const updated = await db.artifact.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(status !== undefined && { status }),
        ...(summary !== undefined && { summary }),
        ...(language !== undefined && { language }),
        ...(metadata !== undefined && { metadata: typeof metadata === 'string' ? metadata : JSON.stringify(metadata) }),
        ...(contentChanged && { version: { increment: 1 } }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('[PUT /api/artifacts/[id]]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update artifact' },
      { status: 500 }
    )
  }
}

// DELETE /api/artifacts/[id] — Delete artifact
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.artifact.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Artifact not found' },
        { status: 404 }
      )
    }

    await db.artifact.delete({ where: { id } })

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    console.error('[DELETE /api/artifacts/[id]]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete artifact' },
      { status: 500 }
    )
  }
}
