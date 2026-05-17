import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/artifacts — Create artifact
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      workspaceId,
      executionId,
      workflowId,
      agentId,
      title,
      type,
      language,
      content,
      summary,
      metadata,
    } = body

    // Validate required fields
    if (!workspaceId || !title || !type || !content) {
      return NextResponse.json(
        { success: false, error: 'workspaceId, title, type, and content are required' },
        { status: 400 }
      )
    }

    const validTypes = ['code', 'report', 'plan', 'spec', 'analysis', 'architecture', 'general']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const artifact = await db.artifact.create({
      data: {
        workspaceId,
        executionId: executionId || null,
        workflowId: workflowId || null,
        agentId: agentId || null,
        title,
        type,
        language: language || null,
        content,
        summary: summary || null,
        metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null,
        version: 1,
      },
    })

    return NextResponse.json({ success: true, data: artifact }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/artifacts]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create artifact' },
      { status: 500 }
    )
  }
}

// GET /api/artifacts — List artifacts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || undefined
    const status = searchParams.get('status') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const where: Record<string, unknown> = {}
    if (type) where.type = type
    if (status) where.status = status

    const [artifacts, total] = await Promise.all([
      db.artifact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.artifact.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: artifacts,
      meta: { total, limit, offset },
    })
  } catch (error) {
    console.error('[GET /api/artifacts]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch artifacts' },
      { status: 500 }
    )
  }
}
