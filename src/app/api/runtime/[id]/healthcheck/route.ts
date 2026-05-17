import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/runtime/[id]/healthcheck — Trigger a health check for a runtime provider
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const provider = await db.runtimeProvider.findUnique({ where: { id } })
    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Runtime provider not found' },
        { status: 404 }
      )
    }

    // Perform a simulated health check
    const startTime = Date.now()
    let status: 'healthy' | 'degraded' | 'error' | 'unknown' = 'unknown'
    let latencyMs: number | null = null
    let errorMessage: string | null = null

    try {
      if (provider.baseUrl) {
        // Attempt to reach the provider's base URL
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(provider.baseUrl, {
          method: 'GET',
          signal: controller.signal,
          headers: provider.apiKey
            ? { Authorization: `Bearer ${provider.apiKey}` }
            : undefined,
        }).catch(() => null)

        clearTimeout(timeout)
        latencyMs = Date.now() - startTime

        if (response && response.ok) {
          status = latencyMs < 500 ? 'healthy' : 'degraded'
        } else {
          status = 'error'
          errorMessage = response
            ? `HTTP ${response.status}: ${response.statusText}`
            : 'No response received'
        }
      } else {
        // No base URL configured — mark as unknown
        latencyMs = null
        errorMessage = 'No baseUrl configured for health check'
      }
    } catch (err) {
      latencyMs = Date.now() - startTime
      status = 'error'
      errorMessage = err instanceof Error ? err.message : 'Unknown error during health check'
    }

    // Calculate health score based on status and latency
    let healthScore = 0
    switch (status) {
      case 'healthy':
        healthScore = latencyMs !== null && latencyMs < 200 ? 100 : latencyMs !== null && latencyMs < 500 ? 85 : 70
        break
      case 'degraded':
        healthScore = 40
        break
      case 'error':
        healthScore = 10
        break
      default:
        healthScore = 0
    }

    // Create health log entry
    const healthLog = await db.runtimeHealthLog.create({
      data: {
        providerId: id,
        status,
        latencyMs,
        errorMessage,
      },
    })

    // Update provider with new health data
    const updatedProvider = await db.runtimeProvider.update({
      where: { id },
      data: {
        healthScore,
        lastHealthCheck: new Date(),
        status: status === 'healthy' ? 'active' : status === 'error' ? 'error' : provider.status,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        healthLog,
        provider: updatedProvider,
      },
    })
  } catch (error) {
    console.error('[POST /api/runtime/[id]/healthcheck]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to perform health check' },
      { status: 500 }
    )
  }
}
