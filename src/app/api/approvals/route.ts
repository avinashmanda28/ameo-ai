import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/approvals — List approval requests (pending first)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    // Fetch pending first, then sort by createdAt desc within each status group
    const approvals = await db.approvalRequest.findMany({
      where,
      orderBy: [
        { status: 'asc' },  // 'approved' < 'expired' < 'pending' < 'rejected' alphabetically
        { createdAt: 'desc' },
      ],
      take: limit,
    })

    // Re-sort manually: pending first, then by createdAt desc
    const sorted = approvals.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1
      if (a.status !== 'pending' && b.status === 'pending') return 1
      return b.createdAt.getTime() - a.createdAt.getTime()
    })

    const total = await db.approvalRequest.count({ where })

    return NextResponse.json({
      success: true,
      data: sorted,
      meta: { total, limit },
    })
  } catch (error) {
    console.error('[GET /api/approvals]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch approval requests' },
      { status: 500 }
    )
  }
}
