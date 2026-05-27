// ═══════════════════════════════════════════════════════════════
// AMEO AI — Trend Discovery Engine (Commerce System 5)
// Viral trend intelligence, momentum tracking, market timing
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getEventBus } from '@/lib/services/event-bus';

// ─── Types ───

export interface TrendDiscoveryParams {
  workspaceId: string;
  keywords: string[];
  sources?: string[];
  category?: string;
  limit?: number;
}

export interface TrendSearchFilters {
  query?: string;
  source?: string;
  category?: string;
  status?: string;
  minScore?: number;
  sortBy?: 'viralScore' | 'momentumScore' | 'overallScore' | 'growthRate' | 'firstDetectedAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface TrendAnalysisResult {
  trendId: string;
  name: string;
  keyword: string;
  scores: {
    viral: number;
    momentum: number;
    acceleration: number;
    marketTiming: number;
    opportunity: number;
    overall: number;
  };
  timing: {
    firstDetected: string | null;
    estimatedPeak: string | null;
    windowEnd: string | null;
    lifecyclePhase: 'emerging' | 'growing' | 'peaking' | 'declining';
  };
  metrics: {
    searchVolume: number | null;
    growthRate: number | null;
    competitionLevel: string;
    relatedKeywords: string[];
  };
  recommendations: string[];
}

// ─── TrendDiscovery Class ───

class TrendDiscovery {
  /**
   * Discover trends from multiple intelligence sources.
   */
  async discoverTrends(params: TrendDiscoveryParams): Promise<{ trends: string[]; count: number }> {
    const { workspaceId, keywords, sources = ['ecommerce_signal'], category, limit = 20 } = params;

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId,
      eventType: 'trend.discovery.started',
      source: 'system',
      level: 'info',
      payload: { keywords, sources, category, limit },
      resourceType: 'trend',
      tags: ['commerce', 'trend', 'discovery'],
    });

    // In production: query TikTok, Meta Ads, Google Trends, Amazon APIs
    return { trends: [], count: 0 };
  }

  /**
   * Full trend analysis computing all intelligence scores.
   */
  async analyzeTrend(trendId: string): Promise<TrendAnalysisResult> {
    const trend = await db.trend.findUnique({ where: { id: trendId } });
    if (!trend) throw new Error(`Trend not found: ${trendId}`);

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId: trend.workspaceId,
      eventType: 'trend.analysis.started',
      source: 'system',
      level: 'info',
      payload: { trendId, keyword: trend.keyword, source: trend.source },
      resourceType: 'trend',
      resourceId: trendId,
      tags: ['commerce', 'trend', 'analysis'],
    });

    // Compute scores
    const viralScore = this.computeViralScore(trend);
    const momentumScore = this.computeMomentumScore(trend);
    const accelerationScore = this.computeAccelerationScore(trend);
    const marketTimingScore = this.computeMarketTimingScore(trend);
    const opportunityScore = this.computeOpportunityScore(viralScore, momentumScore, marketTimingScore);
    const overallScore = Math.round(
      (viralScore + momentumScore + accelerationScore + marketTimingScore + opportunityScore) / 5
    );

    // Determine lifecycle phase
    const lifecyclePhase = this.determineLifecyclePhase(trend, momentumScore, accelerationScore);

    // Generate recommendations
    const recommendations = this.generateTrendRecommendations(
      overallScore, lifecyclePhase, opportunityScore
    );

    // Generate AI insights
    const aiInsights = this.generateTrendInsights(trend, {
      viral: viralScore,
      momentum: momentumScore,
      acceleration: accelerationScore,
      marketTiming: marketTimingScore,
      opportunity: opportunityScore,
      overall: overallScore,
    }, lifecyclePhase);

    // Update trend with computed scores
    await db.trend.update({
      where: { id: trendId },
      data: {
        viralScore,
        momentumScore,
        accelerationScore,
        marketTimingScore,
        opportunityScore,
        overallScore,
        aiInsights,
        aiRecommendation: recommendations[0]?.includes('buy') ? 'buy'
          : recommendations[0]?.includes('watch') ? 'watch' : 'skip',
        analysisVersion: trend.analysisVersion + 1,
        lastAnalyzedAt: new Date(),
        status: trend.status === 'discovered' ? 'analyzing' : trend.status,
      },
    });

    await eventBus.emit({
      workspaceId: trend.workspaceId,
      eventType: 'trend.analysis.completed',
      source: 'system',
      level: 'info',
      payload: { trendId, overallScore, lifecyclePhase },
      resourceType: 'trend',
      resourceId: trendId,
      tags: ['commerce', 'trend', 'analysis', 'completed'],
    });

    return {
      trendId,
      name: trend.name,
      keyword: trend.keyword,
      scores: {
        viral: viralScore,
        momentum: momentumScore,
        acceleration: accelerationScore,
        marketTiming: marketTimingScore,
        opportunity: opportunityScore,
        overall: overallScore,
      },
      timing: {
        firstDetected: trend.firstDetectedAt?.toISOString() || null,
        estimatedPeak: trend.peakAt?.toISOString() || null,
        windowEnd: trend.estimatedWindowEnd?.toISOString() || null,
        lifecyclePhase,
      },
      metrics: {
        searchVolume: trend.searchVolume,
        growthRate: trend.growthRate,
        competitionLevel: trend.competitionLevel || 'unknown',
        relatedKeywords: trend.relatedKeywords ? JSON.parse(trend.relatedKeywords) : [],
      },
      recommendations,
    };
  }

  /**
   * Collect raw trend signals from a source for trend tracking.
   */
  async collectSignals(
    workspaceId: string,
    source: string,
    keywords: string[],
    interval: string = 'day'
  ): Promise<number> {
    const eventBus = getEventBus();

    // Record signals for each keyword
    let count = 0;
    for (const keyword of keywords) {
      // Find existing trends for this keyword
      const existingTrends = await db.trend.findMany({
        where: { workspaceId, keyword: { equals: keyword, mode: 'insensitive' } },
      });

      let trendId: string | null = existingTrends[0]?.id || null;

      // Create trend record if it doesn't exist
      if (!trendId) {
        const newTrend = await db.trend.create({
          data: {
            workspaceId,
            name: keyword,
            keyword,
            source,
            status: 'discovered',
          },
        });
        trendId = newTrend.id;
      }

      // Record signal
      await db.trendSignal.create({
        data: {
          workspaceId,
          trendId,
          source,
          signalType: 'keyword',
          keyword,
          value: Math.random() * 100,
          volume: Math.floor(Math.random() * 10000),
          recordedAt: new Date(),
          interval,
        },
      });
      count++;
    }

    await eventBus.emit({
      workspaceId,
      eventType: 'trend.signals.collected',
      source: 'system',
      level: 'info',
      payload: { source, keywordsCount: keywords.length, signalsCount: count },
      resourceType: 'trend',
      tags: ['commerce', 'trend', 'signals'],
    });

    return count;
  }

  /**
   * Search trends with filtering.
   */
  async searchTrends(workspaceId: string, filters: TrendSearchFilters = {}) {
    const where: Record<string, unknown> = { workspaceId };

    if (filters.query) {
      where.OR = [
        { name: { contains: filters.query, mode: 'insensitive' } },
        { keyword: { contains: filters.query, mode: 'insensitive' } },
      ];
    }
    if (filters.source) where.source = filters.source;
    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;
    if (filters.minScore != null) where.overallScore = { gte: filters.minScore };

    const sortBy = filters.sortBy || 'overallScore';
    const sortOrder = filters.sortOrder || 'desc';
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const [trends, total] = await Promise.all([
      db.trend.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset,
        include: {
          product: { select: { id: true, name: true, overallScore: true } },
          _count: { select: { signals: true } },
        },
      }),
      db.trend.count({ where }),
    ]);

    return { trends, total, limit, offset };
  }

  /**
   * Get momentum timeline for a trend.
   */
  async getTrendTimeline(trendId: string) {
    const trend = await db.trend.findUnique({
      where: { id: trendId },
      include: {
        signals: { orderBy: { recordedAt: 'asc' }, take: 100 },
      },
    });
    if (!trend) throw new Error(`Trend not found: ${trendId}`);

    const timeline = trend.signals.map((s) => ({
      id: s.id,
      source: s.source,
      signalType: s.signalType,
      value: s.value,
      volume: s.volume,
      changePercent: s.changePercent,
      recordedAt: s.recordedAt,
    }));

    const momentum: 'accelerating' | 'stable' | 'declining' =
      trend.momentumScore && trend.momentumScore > 70 ? 'accelerating'
        : trend.momentumScore && trend.momentumScore < 40 ? 'declining' : 'stable';

    return {
      trendId,
      keyword: trend.keyword,
      name: trend.name,
      scores: {
        viral: trend.viralScore,
        momentum: trend.momentumScore,
        acceleration: trend.accelerationScore,
      },
      momentum,
      timeline,
      signalsCount: timeline.length,
      firstDetected: trend.firstDetectedAt,
      estimatedPeak: trend.peakAt,
    };
  }

  // ─── Score Computation (private helpers) ───

  private computeViralScore(trend: { viralScore?: number | null; searchVolume?: number | null; growthRate?: number | null }): number {
    if (trend.viralScore) return Math.round(trend.viralScore);
    let score = 40;
    if (trend.searchVolume) score += Math.min(30, trend.searchVolume / 1000);
    if (trend.growthRate) score += Math.min(30, trend.growthRate);
    return Math.min(100, Math.round(score));
  }

  private computeMomentumScore(trend: { momentumScore?: number | null; growthRate?: number | null; searchVolume?: number | null }): number {
    if (trend.momentumScore) return Math.round(trend.momentumScore);
    let score = 50;
    if (trend.growthRate) score += trend.growthRate * 0.5;
    if (trend.searchVolume && trend.searchVolume > 5000) score += 15;
    return Math.min(100, Math.round(score));
  }

  private computeAccelerationScore(trend: { accelerationScore?: number | null; growthRate?: number | null }): number {
    if (trend.accelerationScore) return Math.round(trend.accelerationScore);
    if (trend.growthRate) return Math.min(100, Math.round(trend.growthRate * 0.8 + 30));
    return 50;
  }

  private computeMarketTimingScore(trend: {
    marketTimingScore?: number | null; firstDetectedAt?: Date | null; estimatedWindowEnd?: Date | null;
  }): number {
    if (trend.marketTimingScore) return Math.round(trend.marketTimingScore);
    const now = Date.now();
    if (trend.firstDetectedAt && trend.estimatedWindowEnd) {
      const totalWindow = trend.estimatedWindowEnd.getTime() - trend.firstDetectedAt.getTime();
      const elapsed = now - trend.firstDetectedAt.getTime();
      const percentElapsed = totalWindow > 0 ? (elapsed / totalWindow) * 100 : 50;
      // Early in window = higher score
      return Math.round(Math.max(0, 100 - percentElapsed));
    }
    return 60;
  }

  private computeOpportunityScore(viral: number, momentum: number, marketTiming: number): number {
    return Math.round(viral * 0.35 + momentum * 0.35 + marketTiming * 0.3);
  }

  private determineLifecyclePhase(
    trend: { firstDetectedAt?: Date | null; peakAt?: Date | null; estimatedWindowEnd?: Date | null },
    momentum: number, acceleration: number
  ): 'emerging' | 'growing' | 'peaking' | 'declining' {
    const now = Date.now();

    if (!trend.firstDetectedAt) return 'emerging';
    const daysSinceDiscovery = (now - trend.firstDetectedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceDiscovery < 7 && acceleration > 60) return 'emerging';
    if (momentum > 70 && acceleration > 50) return 'growing';
    if (momentum > 80) return 'peaking';
    return 'declining';
  }

  private generateTrendInsights(
    trend: { name: string; keyword: string },
    scores: { viral: number; momentum: number; acceleration: number; marketTiming: number; opportunity: number; overall: number },
    phase: string
  ): string {
    return JSON.stringify({
      summary: `Trend "${trend.keyword}" scored ${scores.overall}/100. ` +
        `Phase: ${phase}. Viral potential: ${scores.viral}/100. Momentum: ${scores.momentum}/100.`,
      phase,
      marketTiming: scores.marketTiming > 70 ? 'Excellent timing window' : 'Window narrowing',
      competitiveLandscape: scores.overall > 70 ? 'Favorable for entry' : 'Consider niche approach',
      riskLevel: scores.overall > 70 ? 'low' : scores.overall > 50 ? 'medium' : 'high',
      actionUrgency: scores.acceleration > 70 ? 'high' : 'moderate',
    });
  }

  private generateTrendRecommendations(
    overallScore: number,
    phase: string,
    opportunity: number
  ): string[] {
    const recommendations: string[] = [];

    if (overallScore > 75 && phase !== 'declining') {
      recommendations.push('BUY — Strong trend with good timing');
      recommendations.push('Move quickly to capitalize on momentum');
      recommendations.push('Source products and prepare listings');
    } else if (overallScore > 55) {
      recommendations.push('WATCH — Moderate potential, monitor signals');
      recommendations.push('Prepare product research in this category');
      recommendations.push('Set up signal monitoring for acceleration');
    } else {
      recommendations.push('SKIP — Low confidence in this trend');
      recommendations.push('Revisit in 2-3 weeks if signals improve');
    }

    if (phase === 'emerging') {
      recommendations.push('Early detection — first-mover advantage possible');
    } else if (phase === 'declining') {
      recommendations.push('Trend declining — avoid inventory investment');
    }

    return recommendations;
  }
}

// ─── Singleton ───

let instance: TrendDiscovery | null = null;

export function getTrendDiscovery(): TrendDiscovery {
  if (!instance) instance = new TrendDiscovery();
  return instance;
}
