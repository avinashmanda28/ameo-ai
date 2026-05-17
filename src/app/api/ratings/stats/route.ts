import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/ratings/stats — Aggregate rating statistics
export async function GET() {
  try {
    const allRatings = await db.buildRating.findMany({
      orderBy: { createdAt: 'desc' },
    })

    if (allRatings.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalRatings: 0,
          averageOverallScore: null,
          dimensions: {},
          ratingsByTargetType: {},
        },
      })
    }

    // Calculate dimension averages
    const dimensions = {
      architectureQuality: { avg: 0, min: Infinity, max: -Infinity, count: 0 },
      runtimeStability: { avg: 0, min: Infinity, max: -Infinity, count: 0 },
      uiIntegrity: { avg: 0, min: Infinity, max: -Infinity, count: 0 },
      workflowQuality: { avg: 0, min: Infinity, max: -Infinity, count: 0 },
      verificationConfidence: { avg: 0, min: Infinity, max: -Infinity, count: 0 },
      hallucinationRisk: { avg: 0, min: Infinity, max: -Infinity, count: 0 },
      operationalStability: { avg: 0, min: Infinity, max: -Infinity, count: 0 },
    } as Record<string, { avg: number; min: number; max: number; count: number }>

    let overallSum = 0
    let overallCount = 0
    const ratingsByTargetType: Record<string, number> = {}

    for (const rating of allRatings) {
      // Count by target type
      ratingsByTargetType[rating.targetType] = (ratingsByTargetType[rating.targetType] || 0) + 1

      // Calculate overall score average
      if (rating.overallScore !== null && rating.overallScore !== undefined) {
        overallSum += rating.overallScore
        overallCount++
      }

      // Calculate per-dimension stats
      for (const dim of Object.keys(dimensions)) {
        const value = rating[dim as keyof typeof rating]
        if (value !== null && value !== undefined && typeof value === 'number') {
          dimensions[dim].avg += value
          dimensions[dim].min = Math.min(dimensions[dim].min, value)
          dimensions[dim].max = Math.max(dimensions[dim].max, value)
          dimensions[dim].count++
        }
      }
    }

    // Finalize dimension averages
    for (const dim of Object.keys(dimensions)) {
      if (dimensions[dim].count > 0) {
        dimensions[dim].avg = parseFloat((dimensions[dim].avg / dimensions[dim].count).toFixed(2))
        dimensions[dim].min = parseFloat(dimensions[dim].min.toFixed(2))
        dimensions[dim].max = parseFloat(dimensions[dim].max.toFixed(2))
      } else {
        dimensions[dim].avg = 0
        dimensions[dim].min = 0
        dimensions[dim].max = 0
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalRatings: allRatings.length,
        averageOverallScore: overallCount > 0 ? parseFloat((overallSum / overallCount).toFixed(2)) : null,
        dimensions,
        ratingsByTargetType,
      },
    })
  } catch (error) {
    console.error('[GET /api/ratings/stats]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rating stats' },
      { status: 500 }
    )
  }
}
