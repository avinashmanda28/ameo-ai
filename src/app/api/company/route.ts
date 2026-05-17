import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/company — List all companies, optionally filter by ?type=xxx or ?parentId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const parentId = searchParams.get('parentId')

    const companies = await db.company.findMany({
      where: {
        ...(type && { type }),
        ...(parentId !== null && { parentId }),
      },
      orderBy: { createdAt: 'asc' },
      include: {
        children: true,
      },
    })

    return NextResponse.json({ success: true, data: companies })
  } catch (error) {
    console.error('[GET /api/company]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch companies' },
      { status: 500 }
    )
  }
}

// POST /api/company — Create a new company node
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, name, type, parentId, metadata, status } = body

    if (!workspaceId || !name || !type) {
      return NextResponse.json(
        { success: false, error: 'workspaceId, name, and type are required' },
        { status: 400 }
      )
    }

    const company = await db.company.create({
      data: {
        workspaceId,
        name,
        type,
        ...(parentId && { parentId }),
        ...(metadata && { metadata: typeof metadata === 'string' ? metadata : JSON.stringify(metadata) }),
        ...(status && { status }),
      },
    })

    return NextResponse.json({ success: true, data: company }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/company]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create company' },
      { status: 500 }
    )
  }
}

// PUT /api/company — Update a company
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, type, parentId, metadata, status } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.company.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      )
    }

    const updated = await db.company.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(parentId !== undefined && { parentId }),
        ...(metadata !== undefined && { metadata: typeof metadata === 'string' ? metadata : JSON.stringify(metadata) }),
        ...(status !== undefined && { status }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('[PUT /api/company]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update company' },
      { status: 500 }
    )
  }
}

// DELETE /api/company — Remove a company
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

    const existing = await db.company.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      )
    }

    await db.company.delete({ where: { id } })

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    console.error('[DELETE /api/company]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete company' },
      { status: 500 }
    )
  }
}
