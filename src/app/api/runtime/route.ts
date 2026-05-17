import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/runtime — List all runtime providers
export async function GET() {
  try {
    const providers = await db.runtimeProvider.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        healthLogs: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    return NextResponse.json({ success: true, data: providers })
  } catch (error) {
    console.error('[GET /api/runtime]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch runtime providers' },
      { status: 500 }
    )
  }
}

// POST /api/runtime — Add a runtime provider
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, name, type, apiKey, baseUrl, modelId, status, role, config } = body

    if (!workspaceId || !name || !type) {
      return NextResponse.json(
        { success: false, error: 'workspaceId, name, and type are required' },
        { status: 400 }
      )
    }

    const provider = await db.runtimeProvider.create({
      data: {
        workspaceId,
        name,
        type,
        ...(apiKey && { apiKey }),
        ...(baseUrl && { baseUrl }),
        ...(modelId && { modelId }),
        ...(status && { status }),
        ...(role && { role }),
        ...(config && { config: typeof config === 'string' ? config : JSON.stringify(config) }),
      },
    })

    return NextResponse.json({ success: true, data: provider }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/runtime]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create runtime provider' },
      { status: 500 }
    )
  }
}

// PUT /api/runtime — Update a runtime provider
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, type, apiKey, baseUrl, modelId, status, role, rating, config } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.runtimeProvider.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Runtime provider not found' },
        { status: 404 }
      )
    }

    const updated = await db.runtimeProvider.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(apiKey !== undefined && { apiKey }),
        ...(baseUrl !== undefined && { baseUrl }),
        ...(modelId !== undefined && { modelId }),
        ...(status !== undefined && { status }),
        ...(role !== undefined && { role }),
        ...(rating !== undefined && { rating }),
        ...(config !== undefined && { config: typeof config === 'string' ? config : JSON.stringify(config) }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('[PUT /api/runtime]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update runtime provider' },
      { status: 500 }
    )
  }
}

// DELETE /api/runtime — Remove a runtime provider
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

    const existing = await db.runtimeProvider.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Runtime provider not found' },
        { status: 404 }
      )
    }

    await db.runtimeProvider.delete({ where: { id } })

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    console.error('[DELETE /api/runtime]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete runtime provider' },
      { status: 500 }
    )
  }
}
