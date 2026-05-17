import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/governance — List governance rules
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const enabled = searchParams.get('enabled')

    const rules = await db.governanceRule.findMany({
      where: {
        ...(type && { type }),
        ...(enabled !== null && { enabled: enabled === 'true' }),
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: rules })
  } catch (error) {
    console.error('[GET /api/governance]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch governance rules' },
      { status: 500 }
    )
  }
}

// POST /api/governance — Create a governance rule
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, name, type, description, config, enabled, severity } = body

    if (!workspaceId || !name || !type) {
      return NextResponse.json(
        { success: false, error: 'workspaceId, name, and type are required' },
        { status: 400 }
      )
    }

    const validTypes = ['permission', 'approval', 'rate_limit', 'security', 'compliance']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const validSeverities = ['low', 'medium', 'high', 'critical']
    if (severity && !validSeverities.includes(severity)) {
      return NextResponse.json(
        { success: false, error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
        { status: 400 }
      )
    }

    const rule = await db.governanceRule.create({
      data: {
        workspaceId,
        name,
        type,
        ...(description && { description }),
        ...(config && { config: typeof config === 'string' ? config : JSON.stringify(config) }),
        ...(enabled !== undefined && { enabled }),
        ...(severity && { severity }),
      },
    })

    return NextResponse.json({ success: true, data: rule }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/governance]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create governance rule' },
      { status: 500 }
    )
  }
}

// PUT /api/governance — Update a governance rule
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, type, description, config, enabled, severity } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.governanceRule.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Governance rule not found' },
        { status: 404 }
      )
    }

    const updated = await db.governanceRule.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description }),
        ...(config !== undefined && { config: typeof config === 'string' ? config : JSON.stringify(config) }),
        ...(enabled !== undefined && { enabled }),
        ...(severity !== undefined && { severity }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('[PUT /api/governance]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update governance rule' },
      { status: 500 }
    )
  }
}

// DELETE /api/governance — Delete a governance rule
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

    const existing = await db.governanceRule.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Governance rule not found' },
        { status: 404 }
      )
    }

    await db.governanceRule.delete({ where: { id } })

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    console.error('[DELETE /api/governance]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete governance rule' },
      { status: 500 }
    )
  }
}
