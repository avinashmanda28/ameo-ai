// ═══════════════════════════════════════════════════════════════
// AMEO AI — Product Hunter Agent
// Winning product discovery with demand/competition/profit analysis
// ═══════════════════════════════════════════════════════════════

import { BaseCommerceAgent, type AgentContext } from './base-agent';
import type { AgentExecutionResult } from './types';
import { getEventBus } from '@/lib/services/event-bus';
import { db } from '@/lib/db';

export class ProductHunterAgent extends BaseCommerceAgent {
  constructor() {
    super('product-hunter', 'Product Hunter');
  }

  async execute(ctx: AgentContext): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    const { workspaceId, input } = ctx;
    const artifacts: AgentExecutionResult['artifacts'] = [];

    try {
      // Extract search parameters
      const niche = (input.niche as string) || (input.category as string) || '';
      const keywords = (input.keywords as string[]) || [];
      const minDemandScore = (input.minDemandScore as number) || 50;
      const maxCompetition = (input.maxCompetition as number) || 80;

      await this.emitEvent(workspaceId, 'agent.product-hunter.start', {
        niche, keywords, minDemandScore, maxCompetition,
      });

      // Phase 1: Generate product hypotheses based on input
      const hypothesesPrompt = niche
        ? `Analyze the product niche "${niche}" and identify the top 10 winning product opportunities.
For each product, provide:
- Product name/category
- Estimated demand score (0-100)
- Competition level (0-100)
- Saturation score (0-100)
- Estimated profit margin (%)
- Viral potential score (0-100)
- Market opportunity score (0-100)
- Brief rationale

Output as JSON array with fields: name, demandScore, competitionLevel, saturationScore, profitMargin, viralPotential, marketOpportunity, rationale`
        : `Based on current ecommerce trends, identify the top 15 winning product opportunities for dropshipping.
For each product, provide:
- Product name/category
- Estimated demand score (0-100)
- Competition level (0-100)
- Saturation score (0-100)
- Estimated profit margin (%)
- Viral potential score (0-100)
- Market opportunity score (0-100)
- Brief rationale

Output as JSON array.`;

      const hypothesesRaw = await this.runPrompt(hypothesesPrompt);
      let hypotheses: Record<string, unknown>[] = [];
      try {
        const cleaned = hypothesesRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        hypotheses = JSON.parse(cleaned);
      } catch {
        hypotheses = [{ name: 'error', demandScore: 0, error: 'Failed to parse AI response' }];
      }

      // Phase 2: Score and rank each product opportunity
      const scoredProducts = hypotheses
        .filter((p) => (p.demandScore as number || 0) >= minDemandScore)
        .filter((p) => (p.competitionLevel as number || 100) <= maxCompetition)
        .map((p) => ({
          ...p,
          overallScore: Math.round(
            (p.demandScore as number || 0) * 0.30 +
            (100 - (p.competitionLevel as number || 0)) * 0.20 +
            (p.marketOpportunity as number || 0) * 0.20 +
            (p.profitMargin as number || 0) * 0.15 +
            (p.viralPotential as number || 0) * 0.15
          ),
        }))
        .sort((a, b) => (b.overallScore as number) - (a.overallScore as number))
        .slice(0, 10);

      // Phase 3: Generate detailed AI summary for top product
      const topProduct = scoredProducts[0];
      const topProductAny = topProduct as Record<string, unknown>;
      let summaryPrompt = '';
      if (topProduct) {
        const productName = (topProductAny.name as string) || 'top product';
        summaryPrompt = `Generate a comprehensive product intelligence summary for "${productName}".

Include:
- Target audience demographics
- Marketing angles
- Price range recommendations ($5-$50)
- Supplier sourcing tips
- Potential upsells/cross-sells
- Seasonal trends
- Estimated cost breakdown

Keep it actionable and specific.`;
      }

      let summary = '';
      if (summaryPrompt) {
        summary = await this.runPrompt(summaryPrompt, 'You are a product research expert.');
      }

      // Store results in memory
      await this.storeMemory(workspaceId, 'last_product_search', JSON.stringify({
        niche,
        timestamp: new Date().toISOString(),
        topProducts: scoredProducts.slice(0, 3),
      }), 'product_search', 3600000);

      // Create artifact
      const artifactContent = JSON.stringify({ products: scoredProducts, summary }, null, 2);
      artifacts.push({
        type: 'analysis',
        title: `Product Hunt Results - ${niche || 'General'}`,
        content: artifactContent,
        metadata: { productCount: scoredProducts.length, topScore: topProduct?.overallScore },
      });

      await this.createArtifact(workspaceId, ctx.taskId, artifacts[0]);

      const durationMs = Date.now() - startTime;

      await this.emitEvent(workspaceId, 'agent.product-hunter.complete', {
        productsFound: scoredProducts.length,
        durationMs,
        topProduct: topProductAny.name as string || null,
      });

      return {
        success: true,
        taskId: ctx.taskId,
        agentType: this.agentType,
        output: {
          products: scoredProducts,
          summary,
          searchParams: { niche, keywords, minDemandScore, maxCompetition },
          totalCandidates: hypotheses.length,
        },
        confidence: scoredProducts.length > 0 ? 0.85 : 0.1,
        error: null,
        durationMs,
        artifacts,
        events: ['agent.product-hunter.complete'],
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      await this.emitEvent(workspaceId, 'agent.product-hunter.error', {
        error: errorMsg,
        durationMs,
      }, 'error');

      return {
        success: false,
        taskId: ctx.taskId,
        agentType: this.agentType,
        output: {},
        confidence: 0,
        error: errorMsg,
        durationMs,
        artifacts,
        events: ['agent.product-hunter.error'],
      };
    }
  }
}
