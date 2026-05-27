// ═══════════════════════════════════════════════════════════════
// AMEO AI — Trend Analyst Agent
// Viral trend intelligence with acceleration and momentum tracking
// ═══════════════════════════════════════════════════════════════

import { BaseCommerceAgent, type AgentContext } from './base-agent';
import type { AgentExecutionResult } from './types';
import { db } from '@/lib/db';

export class TrendAnalystAgent extends BaseCommerceAgent {
  constructor() {
    super('trend-analyst', 'Trend Analyst');
  }

  async execute(ctx: AgentContext): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    const { workspaceId, input } = ctx;
    const artifacts: AgentExecutionResult['artifacts'] = [];

    try {
      const niche = (input.niche as string) || '';
      const source = (input.source as string) || 'general ecommerce';
      const minMomentum = (input.minMomentum as number) || 30;
      const lookbackDays = (input.lookbackDays as number) || 14;

      await this.emitEvent(workspaceId, 'agent.trend-analyst.start', {
        niche, source, lookbackDays,
      });

      // Analyze current trending opportunities
      const trendPrompt = niche
        ? `Analyze current trending products and patterns in the "${niche}" niche for ${source}.

Identify 8-12 trending opportunities with:
- Trend name/description
- Viral score (0-100)
- Acceleration rate (0-100) — how fast is interest growing
- Momentum score (0-100)
- Market timing (early/growth/peak/saturation/decline)
- Estimated opportunity window (in weeks)
- Confidence level (0-100)
- Key signals driving this trend

Output as JSON array with fields: name, viralScore, accelerationRate, momentumScore, marketTiming, opportunityWeeks, confidence, keySignals`
        : `Analyze the current viral ecommerce landscape across all categories.

Identify 10 trending product opportunities with highest growth potential:
- Trend name/description
- Viral score (0-100)
- Acceleration rate (0-100)
- Momentum score (0-100)
- Market timing
- Opportunity window (weeks)
- Confidence (0-100)
- Key signals

Output as JSON array.`;

      const trendsRaw = await this.runPrompt(trendPrompt);
      let trends: Record<string, unknown>[] = [];
      try {
        const cleaned = trendsRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        trends = JSON.parse(cleaned);
      } catch {
        trends = [{ name: 'error', viralScore: 0, error: 'Parse failed' }];
      }

      // Score and rank
      const scoredTrends = trends
        .filter((t) => (t.momentumScore as number || 0) >= minMomentum)
        .map((t) => ({
          ...t,
          overallScore: Math.round(
            (t.viralScore as number || 0) * 0.35 +
            (t.accelerationRate as number || 0) * 0.25 +
            (t.momentumScore as number || 0) * 0.25 +
            (t.confidence as number || 0) * 0.15
          ),
        }))
        .sort((a, b) => (b.overallScore as number) - (a.overallScore as number));

      // Generate momentum heatmap data
      const topTrend = scoredTrends[0];
      const topTrendAny = topTrend as Record<string, unknown>;
      let analysis = '';
      if (topTrend) {
        const trendName = (topTrendAny.name as string) || 'unknown';
        const analysisPrompt = `Provide a concise analysis of the "${trendName}" trend:
- Why it's trending now
- Target demographic
- Estimated market size
- Key social signals driving acceleration
- Best platforms for capitalizing
- Risk factors

Keep under 300 words and be extremely specific.`;

        analysis = await this.runPrompt(analysisPrompt, 'You are a trend analysis expert.');
      }

      // Store top trends in memory
      await this.storeMemory(
        workspaceId,
        'latest_trends',
        JSON.stringify(scoredTrends.slice(0, 5)),
        'trend_analysis',
        7200000,
      );

      artifacts.push({
        type: 'analysis',
        title: `Trend Analysis - ${niche || 'All Categories'}`,
        content: JSON.stringify({ trends: scoredTrends, analysis }, null, 2),
        metadata: { trendCount: scoredTrends.length, topMomentum: topTrendAny.momentumScore as number || 0 },
      });

      await this.createArtifact(workspaceId, ctx.taskId, artifacts[0]);

      const durationMs = Date.now() - startTime;

      await this.emitEvent(workspaceId, 'agent.trend-analyst.complete', {
        trendsFound: scoredTrends.length,
        topTrend: topTrendAny.name as string || null,
        durationMs,
      });

      return {
        success: true,
        taskId: ctx.taskId,
        agentType: this.agentType,
        output: {
          trends: scoredTrends,
          analysis,
          source,
          niche,
          lookbackDays,
        },
        confidence: scoredTrends.length > 0 ? 0.8 : 0.1,
        error: null,
        durationMs,
        artifacts,
        events: ['agent.trend-analyst.complete'],
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      return {
        success: false,
        taskId: ctx.taskId,
        agentType: this.agentType,
        output: {},
        confidence: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs,
        artifacts,
        events: ['agent.trend-analyst.error'],
      };
    }
  }
}
