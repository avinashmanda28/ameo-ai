import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/events/[id] — Get single event or event chain by correlationId
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const chain = searchParams.get('chain') === 'true'

    // ?chain=true — return all events sharing the same correlationId
    if (chain) {
      const event = await db.systemEvent.findUnique({
        where: { id },
        select: { correlationId: true },
      })

      if (!event) {
        return NextResponse.json(
          { success: false, error: 'Event not found' },
          { status: 404 }
        )
      }

      if (!event.correlationId) {
        // No correlationId — just return the single event
        const single = await db.systemEvent.findUnique({ where: { id } })
        if (!single) {
          return NextResponse.json(
            { success: false, error: 'Event not found' },
            { status: 404 }
          )
        }
        return NextResponse.json({
          success: true,
          data: [
            {
              ...single,
              createdAt: single.createdAt.toISOString(),
            },
          ],
          meta: { chain: false, reason: 'no_correlation_id' },
        })
      }

      const chainEvents = await db.systemEvent.findMany({
        where: { correlationId: event.correlationId },
        orderBy: { createdAt: 'asc' },
      })

      return NextResponse.json({
        success: true,
        data: chainEvents.map((e) => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
        })),
        meta: {
          chain: true,
          correlationId: event.correlationId,
          total: chainEvents.length,
        },
      })
    }

    // Default: return single event by ID
    const event = await db.systemEvent.findUnique({ where: { id } })

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        ...event,
        createdAt: event.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('[GET /api/events/[id]]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch event' },
      { status: 500 }
    )
  }
}
