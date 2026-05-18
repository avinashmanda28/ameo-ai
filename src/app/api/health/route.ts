import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/health — List system health metrics with optional summary
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || undefined;
    const subsystem = searchParams.get('subsystem') || undefined;
    const severity = searchParams.get('severity') || undefined;
    const summary = searchParams.get('summary') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    const where: Record<string, unknown> = {};
    if (workspaceId) where.workspaceId = workspaceId;
    if (subsystem) where.subsystem = subsystem;
    if (severity) where.severity = severity;

    // Summary mode: aggregate latest health per subsystem
    if (summary) {
      const subsystems = ['queue', 'runtime', 'workflow', 'verification', 'recovery', 'agent', 'event_bus'];
      const subsystemHealth: Record<string, { score: number; severity: string; details: string }> = {};

      for (const sub of subsystems) {
        // Get the latest metrics for this subsystem
        const latestMetrics = await db.systemHealthMetric.findMany({
          where: { subsystem: sub, ...(workspaceId ? { workspaceId } : {}) },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });

        if (latestMetrics.length === 0) {
          subsystemHealth[sub] = { score: 100, severity: 'normal', details: 'No metrics recorded' };
          continue;
        }

        // Calculate severity from latest metrics
        const severities = latestMetrics.map((m) => m.severity);
        const hasCritical = severities.includes('critical');
        const hasDegraded = severities.includes('degraded');
        const hasWarning = severities.includes('warning');

        let sev: string = 'normal';
        let score = 100;
        if (hasCritical) { sev = 'critical'; score = 20; }
        else if (hasDegraded) { sev = 'degraded'; score = 50; }
        else if (hasWarning) { sev = 'warning'; score = 75; }

        // Average value across latest metrics
        const avgValue = latestMetrics.reduce((sum, m) => sum + m.value, 0) / latestMetrics.length;
        const metricTypes = [...new Set(latestMetrics.map((m) => m.metricType))].join(', ');

        subsystemHealth[sub] = {
          score: Math.round(score),
          severity: sev,
          details: `${metricTypes || 'No metrics'} — avg: ${avgValue.toFixed(1)}`,
        };
      }

      // Overall score
      const scores = Object.values(subsystemHealth).map((h) => h.score);
      const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

      return NextResponse.json({
        success: true,
        data: {
          overallScore,
          subsystems: subsystemHealth,
          lastUpdatedAt: new Date().toISOString(),
        },
      });
    }

    const [metrics, total] = await Promise.all([
      db.systemHealthMetric.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      db.systemHealthMetric.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: metrics,
      meta: { total, limit },
    });
  } catch (error) {
    console.error('[GET /api/health]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch health metrics' },
      { status: 500 }
    );
  }
}

// POST /api/health — Record a new health metric
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, subsystem, metricType, value, unit, severity, threshold, metadata } = body;

    if (!workspaceId || !subsystem || !metricType) {
      return NextResponse.json(
        { success: false, error: 'workspaceId, subsystem, and metricType are required' },
        { status: 400 }
      );
    }

    const metric = await db.systemHealthMetric.create({
      data: {
        workspaceId,
        subsystem,
        metricType,
        value: value ?? 0,
        unit: unit || null,
        severity: severity || 'normal',
        threshold: threshold ?? null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    return NextResponse.json({ success: true, data: metric });
  } catch (error) {
    console.error('[POST /api/health]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record health metric' },
      { status: 500 }
    );
  }
}
