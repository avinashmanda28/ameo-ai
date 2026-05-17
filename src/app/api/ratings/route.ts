import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Dimension fields for build ratings
const RATING_DIMENSIONS = [
  'architectureQuality',
  'runtimeStability',
  'uiIntegrity',
  'workflowQuality',
  'verificationConfidence',
  'hallucinationRisk',
  'operationalStability',
] as const

// GET /api/ratings — List all build ratings, optionally filter by ?targetType=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const targetType = searchParams.get('targetType')

    const ratings = await db.buildRating.findMany({
      where: {
        ...(targetType && { targetType }),
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: ratings })
  } catch (error) {
    console.error('[GET /api/ratings]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch build ratings' },
      { status: 500 }
    )
  }
}

// POST /api/ratings — Create a build rating (auto-calculate overallScore)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      workspaceId,
      targetId,
      targetType,
      architectureQuality,
      runtimeStability,
      uiIntegrity,
      workflowQuality,
      verificationConfidence,
      hallucinationRisk,
      operationalStability,
      notes,
    } = body

    if (!workspaceId || !targetId || !targetType) {
      return NextResponse.json(
        { success: false, error: 'workspaceId, targetId, and targetType are required' },
        { status: 400 }
      )
    }

    const validTargetTypes = ['workflow', 'agent', 'runtime', 'build']
    if (!validTargetTypes.includes(targetType)) {
      return NextResponse.json(
        { success: false, error: `Invalid targetType. Must be one of: ${validTargetTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Collect all numeric dimension values
    const dimensionValues: number[] = []
    const dimensionData: Record<string, number | null> = {}

    for (const dim of RATING_DIMENSIONS) {
      const value = body[dim]
      const numericValue = value !== null && value !== undefined ? Number(value) : null
      dimensionData[dim] = numericValue
      if (numericValue !== null && !isNaN(numericValue)) {
        dimensionValues.push(numericValue)
      }
    }

    // Auto-calculate overallScore as average of all provided numeric dimensions
    const overallScore =
      dimensionValues.length > 0
        ? dimensionValues.reduce((sum, v) => sum + v, 0) / dimensionValues.length
        : null

    const rating = await db.buildRating.create({
      data: {
        workspaceId,
        targetId,
        targetType,
        ...dimensionData,
        overallScore,
        ...(notes && { notes }),
      },
    })

    return NextResponse.json({ success: true, data: rating }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/ratings]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create build rating' },
      { status: 500 }
    )
  }
}
