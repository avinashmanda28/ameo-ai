// ═══════════════════════════════════════════════════════════════
// AMEO AI — System Health Monitor (Phase 1.7)
// Whole-system operational monitoring. Records health metrics
// for all subsystems, calculates aggregate scores, detects
// degradation, and generates alerts.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  SystemHealthMetric,
  SystemHealthSummary,
  HealthSeverity,
  EventLevel,
} from '@/lib/types';

// ─── Types ───

/** Monitored subsystem identifiers */
export type HealthSubsystem = 'queue' | 'runtime' | 'workflow' | 'verification' | 'recovery' | 'agent' | 'event_bus';

/** Metric types tracked per subsystem */
export type HealthMetricType = 'pressure' | 'latency' | 'failure_rate' | 'throughput' | 'congestion' | 'health_score';

/** Parameters for recording a health metric */
export interface RecordMetricParams {
  workspaceId: string;
  subsystem: HealthSubsystem;
  metricType: HealthMetricType;
  value: number;
  unit?: string;
  threshold?: number;
  metadata?: Record<string, unknown> | null;
  sourceEventId?: string | null;
}

/** Time range for metric queries */
export interface MetricTimeRange {
  since: Date;
  until?: Date;
}

/** Degradation detection result */
export interface DegradationResult {
  isDegrading: boolean;
  severity: HealthSeverity;
  currentScore: number;
  previousScore: number;
  trend: 'improving' | 'stable' | 'degrading';
  details: string;
}

/** Alert entry from health monitoring */
export interface HealthAlert {
  id: string;
  subsystem: string;
  metricType: string;
  value: number;
  severity: HealthSeverity;
  threshold: number | null;
  createdAt: string;
  message: string;
}

// ─── Threshold defaults per metric type ───
// These define when a metric transitions from normal to warning/degraded/critical.

const DEFAULT_THRESHOLDS: Record<HealthMetricType, { warning: number; degraded: number; critical: number }> = {
  pressure: { warning: 60, degraded: 80, critical: 95 },
  latency: { warning: 5000, degraded: 15000, critical: 30000 },    // ms
  failure_rate: { warning: 10, degraded: 25, critical: 50 },       // percent
  throughput: { warning: 5, degraded: 2, critical: 0 },           // events/sec (lower = worse)
  congestion: { warning: 50, degraded: 75, critical: 90 },
  health_score: { warning: 70, degraded: 50, critical: 30 },      // score (lower = worse)
};

// ─── HealthMonitor Class ───

class HealthMonitor {
  /**
   * Record a health metric. Auto-classifies severity based on thresholds.
   */
  async recordMetric(params: RecordMetricParams): Promise<SystemHealthMetric> {
    const thresholds = DEFAULT_THRESHOLDS[params.metricType] ?? DEFAULT_THRESHOLDS.health_score;
    const userThreshold = params.threshold;

    let severity: HealthSeverity = 'normal';

    if (params.metricType === 'health_score' || params.metricType === 'throughput') {
      // Lower values are worse
      const effectiveThreshold = userThreshold ?? thresholds.warning;
      const criticalThreshold = userThreshold ? userThreshold * 0.5 : thresholds.critical;
      const degradedThreshold = userThreshold ? userThreshold * 0.7 : thresholds.degraded;

      if (params.value <= criticalThreshold) severity = 'critical';
      else if (params.value <= degradedThreshold) severity = 'degraded';
      else if (params.value <= effectiveThreshold) severity = 'warning';
    } else {
      // Higher values are worse (pressure, latency, failure_rate, congestion)
      const effectiveThreshold = userThreshold ?? thresholds.warning;
      const criticalThreshold = userThreshold ? userThreshold * 2 : thresholds.critical;
      const degradedThreshold = userThreshold ? userThreshold * 1.5 : thresholds.degraded;

      if (params.value >= criticalThreshold) severity = 'critical';
      else if (params.value >= degradedThreshold) severity = 'degraded';
      else if (params.value >= effectiveThreshold) severity = 'warning';
    }

    const metric = await db.systemHealthMetric.create({
      data: {
        workspaceId: params.workspaceId,
        subsystem: params.subsystem,
        metricType: params.metricType,
        value: params.value,
        unit: params.unit ?? null,
        severity,
        threshold: userThreshold ?? thresholds.warning,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        sourceEventId: params.sourceEventId ?? null,
      },
    });

    return metric as unknown as SystemHealthMetric;
  }

  /**
   * Query health metrics with filtering by subsystem, type, and time range.
   */
  async getMetrics(
    subsystem?: HealthSubsystem,
    metricType?: HealthMetricType,
    timeRange?: MetricTimeRange,
    limit: number = 100,
  ): Promise<SystemHealthMetric[]> {
    const where: Record<string, unknown> = {};

    if (subsystem) where.subsystem = subsystem;
    if (metricType) where.metricType = metricType;

    if (timeRange) {
      const createdAt: Record<string, unknown> = { gte: timeRange.since };
      if (timeRange.until) createdAt.lte = timeRange.until;
      where.createdAt = createdAt;
    }

    const metrics = await db.systemHealthMetric.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return metrics as unknown as SystemHealthMetric[];
  }

  /**
   * Calculate a composite health score (0-100) for a subsystem.
   * Weights recent metrics by severity and recency.
   */
  async calculateHealthScore(subsystem: HealthSubsystem): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const metrics = await db.systemHealthMetric.findMany({
      where: {
        subsystem,
        createdAt: { gte: oneHourAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (metrics.length === 0) return 100; // No data = assume healthy

    // Weight-based scoring
    const severityWeights: Record<string, number> = {
      normal: 100,
      warning: 70,
      degraded: 40,
      critical: 10,
    };

    let totalWeight = 0;
    let weightedSum = 0;

    // More recent metrics weigh more (exponential decay)
    const now = Date.now();
    for (const metric of metrics) {
      const ageMs = now - metric.createdAt.getTime();
      const recencyWeight = Math.exp(-ageMs / (30 * 60 * 1000)); // 30-min half-life
      const severityWeight = severityWeights[metric.severity] ?? 50;
      const weight = recencyWeight * severityWeight;

      totalWeight += weight;
      weightedSum += weight * severityWeight;
    }

    if (totalWeight === 0) return 100;

    return Math.round(weightedSum / totalWeight);
  }

  /**
   * Get a full system health summary across all subsystems.
   * Returns per-subsystem scores, severities, and an overall score.
   */
  async getSystemHealthSummary(workspaceId: string): Promise<SystemHealthSummary> {
    const subsystems: HealthSubsystem[] = [
      'queue', 'runtime', 'workflow', 'verification', 'recovery', 'agent', 'event_bus',
    ];

    const subsystemResults: SystemHealthSummary['subsystems'] = {} as SystemHealthSummary['subsystems'];
    let totalScore = 0;

    for (const sub of subsystems) {
      const score = await this.calculateHealthScore(sub);

      // Get the latest metric for details
      const latestMetrics = await db.systemHealthMetric.findMany({
        where: { subsystem: sub, workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      const latestMetric = latestMetrics[0];
      const severity = this.scoreToSeverity(score);

      // Build details string
      let details = 'No recent data';
      if (latestMetrics.length > 0) {
        const issues = latestMetrics.filter((m) => m.severity !== 'normal');
        if (issues.length > 0) {
          const issueTypes = [...new Set(issues.map((m) => m.metricType))].join(', ');
          details = `${issues.length} warning(s) in: ${issueTypes}`;
        } else {
          details = `${latestMetrics.length} recent metrics, all normal`;
        }
      }

      subsystemResults[sub] = { score, severity, details };
      totalScore += score;
    }

    // Map event_bus to match the type key
    const subsystemsData: SystemHealthSummary['subsystems'] = {
      queue: subsystemResults['queue'],
      runtime: subsystemResults['runtime'],
      workflow: subsystemResults['workflow'],
      verification: subsystemResults['verification'],
      recovery: subsystemResults['recovery'],
      agent: subsystemResults['agent'],
      eventBus: subsystemResults['event_bus'],
    };

    const overallScore = Math.round(totalScore / subsystems.length);

    return {
      overallScore,
      subsystems: subsystemsData,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  /**
   * Check if a subsystem is degrading by comparing recent scores.
   */
  async detectDegradation(subsystem: HealthSubsystem): Promise<DegradationResult> {
    const now = new Date();
    const recentStart = new Date(now.getTime() - 15 * 60 * 1000); // last 15 min
    const previousStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago to 15 min ago

    const [recentMetrics, previousMetrics] = await Promise.all([
      db.systemHealthMetric.findMany({
        where: { subsystem, createdAt: { gte: recentStart } },
      }),
      db.systemHealthMetric.findMany({
        where: { subsystem, createdAt: { gte: previousStart, lt: recentStart } },
      }),
    ]);

    const currentScore = this.computeWeightedScore(recentMetrics);
    const previousScore = this.computeWeightedScore(previousMetrics);

    const scoreDelta = currentScore - previousScore;
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';

    if (scoreDelta > 5) trend = 'improving';
    else if (scoreDelta < -10) trend = 'degrading';

    const isDegrading = trend === 'degrading' && currentScore < 60;
    const severity = this.scoreToSeverity(currentScore);

    return {
      isDegrading,
      severity,
      currentScore,
      previousScore,
      trend,
      details: isDegrading
        ? `${subsystem} is degrading: score dropped from ${previousScore} to ${currentScore} (${scoreDelta.toFixed(1)} points)`
        : `${subsystem} is ${trend}: ${previousScore} → ${currentScore}`,
    };
  }

  /**
   * Get all alerts — metrics with warning, degraded, or critical severity.
   */
  async getAlerts(workspaceId: string): Promise<HealthAlert[]> {
    const metrics = await db.systemHealthMetric.findMany({
      where: {
        workspaceId,
        severity: { in: ['warning', 'degraded', 'critical'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return metrics.map((m) => ({
      id: m.id,
      subsystem: m.subsystem,
      metricType: m.metricType,
      value: m.value,
      severity: m.severity as HealthSeverity,
      threshold: m.threshold,
      createdAt: m.createdAt.toISOString(),
      message: `${m.subsystem} ${m.metricType}: ${m.value}${m.unit ? ` ${m.unit}` : ''} (severity: ${m.severity}${m.threshold ? `, threshold: ${m.threshold}` : ''})`,
    }));
  }

  /**
   * Derive health metrics from a system event.
   * Maps event properties to appropriate health metrics.
   */
  async recordHealthFromEvent(event: {
    workspaceId: string;
    eventType: string;
    source: string | null;
    level: string;
    payload?: Record<string, unknown> | null;
  }): Promise<SystemHealthMetric | null> {
    const subsystem = event.source as HealthSubsystem | null;
    if (!subsystem || !Object.values(DEFAULT_THRESHOLDS).length) return null;

    // Map event types to health metrics
    let metricType: HealthMetricType | null = null;
    let value: number | null = null;
    let unit: string | undefined;

    // Failure events → failure_rate
    if (event.eventType.endsWith('.failed')) {
      metricType = 'failure_rate';
      value = event.level === 'critical' ? 80 : event.level === 'error' ? 50 : 20;
      unit = 'percent';
    }

    // Timeout events → latency
    if (event.eventType.endsWith('.timed_out')) {
      metricType = 'latency';
      const payload = event.payload ?? {};
      value = (payload.durationMs as number) ?? 30000;
      unit = 'ms';
    }

    // Queue events → congestion/pressure
    if (event.eventType.startsWith('queue.')) {
      if (event.eventType === 'queue.enqueued' || event.eventType === 'queue.retrying') {
        metricType = 'congestion';
        value = 30; // moderate
        unit = 'percent';
      }
    }

    // System health change events
    if (event.eventType === 'system.health_change') {
      metricType = 'health_score';
      const payload = event.payload ?? {};
      value = (payload.score as number) ?? 50;
      unit = 'score';
    }

    // Consistency drift → subsystem pressure
    if (event.eventType === 'system.consistency_drift') {
      metricType = 'pressure';
      value = 70;
      unit = 'percent';
    }

    if (metricType === null || value === null) return null;

    return this.recordMetric({
      workspaceId: event.workspaceId,
      subsystem,
      metricType,
      value,
      unit,
      metadata: { sourceEvent: event.eventType, eventLevel: event.level },
    });
  }

  /**
   * Purge old health metrics. Default: older than 7 days.
   */
  async purgeOldMetrics(olderThanMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMs);

    const result = await db.systemHealthMetric.deleteMany({
      where: {
        createdAt: { lt: cutoff },
      },
    });

    return result.count;
  }

  // ─── Private helpers ───

  /** Compute weighted score from metrics */
  private computeWeightedScore(metrics: { severity: string; createdAt: Date }[]): number {
    if (metrics.length === 0) return 100;

    const severityWeights: Record<string, number> = {
      normal: 100,
      warning: 70,
      degraded: 40,
      critical: 10,
    };

    let totalWeight = 0;
    let weightedSum = 0;
    const now = Date.now();

    for (const metric of metrics) {
      const ageMs = now - metric.createdAt.getTime();
      const recencyWeight = Math.exp(-ageMs / (30 * 60 * 1000));
      const weight = recencyWeight;
      const score = severityWeights[metric.severity] ?? 50;

      totalWeight += weight;
      weightedSum += weight * score;
    }

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 100;
  }

  /** Convert a numeric score to a HealthSeverity */
  private scoreToSeverity(score: number): HealthSeverity {
    if (score >= 80) return 'normal';
    if (score >= 60) return 'warning';
    if (score >= 40) return 'degraded';
    return 'critical';
  }
}

// ─── Singleton ───

let instance: HealthMonitor | null = null;

/**
 * Get the singleton HealthMonitor instance.
 */
export function getHealthMonitor(): HealthMonitor {
  if (!instance) {
    instance = new HealthMonitor();
  }
  return instance;
}
