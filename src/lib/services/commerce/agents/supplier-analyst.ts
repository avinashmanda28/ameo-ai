// ═══════════════════════════════════════════════════════════════
// AMEO AI — Supplier Analyst Agent
// Supplier intelligence with trust scoring, shipping, pricing, risk
// ═══════════════════════════════════════════════════════════════

import { BaseCommerceAgent, type AgentContext } from './base-agent';
import type { AgentExecutionResult } from './types';
import { db } from '@/lib/db';

export class SupplierAnalystAgent extends BaseCommerceAgent {
  constructor() {
    super('supplier-analyst', 'Supplier Analyst');
  }

  async execute(ctx: AgentContext): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    const { workspaceId, input } = ctx;
    const artifacts: AgentExecutionResult['artifacts'] = [];

    try {
      const productId = (input.productId as string) || '';
      const productName = (input.productName as string) || '';
      const supplierIds = (input.supplierIds as string[]) || [];
      const maxPrice = (input.maxPrice as number) || 0;

      await this.emitEvent(workspaceId, 'agent.supplier-analyst.start', {
        productId, productName, supplierCount: supplierIds.length,
      });

      // If supplier IDs provided, analyze those specific suppliers
      let suppliers: Record<string, unknown>[] = [];

      if (supplierIds.length > 0) {
        for (const sid of supplierIds) {
          const dbSupplier = await db.supplier.findUnique({ where: { id: sid } });
          if (dbSupplier) {
            suppliers.push({
              id: dbSupplier.id,
              name: dbSupplier.name,
              type: dbSupplier.platform,
              trustScore: dbSupplier.trustScore,
              shippingReliability: this.calculateShippingScore(dbSupplier),
              pricingScore: this.calculatePricingScore(dbSupplier),
              riskScore: this.calculateRiskScore(dbSupplier),
              moqAnalysis: dbSupplier.moqDetails,
              fulfillmentReliability: dbSupplier.reliabilityScore,
              shippingMethods: dbSupplier.shippingMethods,
            });
          }
        }
      }

      // If no suppliers, use AI to generate supplier intelligence
      if (suppliers.length === 0) {
        const analysisPrompt = productName
          ? `You are a supplier intelligence expert. For the product "${productName}", generate a supplier analysis.

Provide a JSON array of 5-8 potential suppliers with:
- name (string)
- type: "alibaba" | "aliexpress" | "other"
- location (country)
- trustScore (0-100)
- shippingScore (0-100) — based on typical shipping times/reliability
- pricingScore (0-100) — competitive pricing assessment
- riskScore (0-100) — supplier risk (higher = riskier)
- minOrderQuantity (string)
- estimatedUnitPrice (string)
- typicalShippingDays (string)
- reliability (string)
- pros (string array)
- cons (string array)`
          : `Analyze typical supplier patterns for trending ecommerce products.

Provide 5 supplier archetypes with scoring metrics as JSON array:
- name, type, trustScore, shippingScore, pricingScore, riskScore
- minOrderQuantity, estimatedUnitPrice, typicalShippingDays`;

        const raw = await this.runPrompt(analysisPrompt);
        try {
          const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          suppliers = JSON.parse(cleaned);
        } catch {
          throw new Error('Failed to parse AI supplier analysis');
        }
      }

      // Build comparison matrix
      const comparison = suppliers.map((s) => ({
        name: s.name,
        type: s.type,
        trustScore: s.trustScore,
        shippingScore: s.shippingScore || s.shippingReliability,
        pricingScore: s.pricingScore,
        riskScore: s.riskScore,
        overallScore: Math.round(
          ((s.trustScore as number || 0) * 0.30) +
          ((s.shippingScore as number || 0) * 0.20) +
          ((s.pricingScore as number || 0) * 0.25) +
          ((100 - (s.riskScore as number || 0)) * 0.25)
        ),
        recommendation: (s.trustScore as number || 0) >= 70 && (s.riskScore as number || 0) <= 30
          ? 'highly_recommended'
          : (s.trustScore as number || 0) >= 50
            ? 'recommended'
            : 'caution',
      }));

      const recommended = comparison
        .filter((s) => s.recommendation === 'highly_recommended')
        .sort((a, b) => b.overallScore - a.overallScore);

      artifacts.push({
        type: 'analysis',
        title: `Supplier Analysis - ${productName || 'Products'}`,
        content: JSON.stringify({ suppliers: comparison, recommended }, null, 2),
        metadata: { totalSuppliers: comparison.length, recommended: recommended.length },
      });

      await this.createArtifact(workspaceId, ctx.taskId, artifacts[0]);

      const durationMs = Date.now() - startTime;

      await this.emitEvent(workspaceId, 'agent.supplier-analyst.complete', {
        suppliersAnalyzed: comparison.length,
        recommendedCount: recommended.length,
        durationMs,
      });

      return {
        success: true,
        taskId: ctx.taskId,
        agentType: this.agentType,
        output: {
          suppliers: comparison,
          recommended,
          recommendations: {
            topSupplier: recommended[0] || null,
            alternatives: recommended.slice(1, 4),
            riskySuppliers: comparison.filter((s) => s.recommendation === 'caution'),
          },
        },
        confidence: comparison.length > 0 ? 0.82 : 0.1,
        error: null,
        durationMs,
        artifacts,
        events: ['agent.supplier-analyst.complete'],
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
        events: ['agent.supplier-analyst.error'],
      };
    }
  }

  private calculateShippingScore(supplier: any): number {
    const baseScore = supplier.trustScore ? Math.round(supplier.trustScore * 0.7) : 50;
    return Math.min(100, baseScore + (supplier.fulfillmentReliability ? 10 : 0));
  }

  private calculatePricingScore(supplier: any): number {
    return supplier.trustScore ? Math.round(supplier.trustScore * 0.8) : 50;
  }

  private calculateRiskScore(supplier: any): number {
    const base = 100 - (supplier.trustScore || 50);
    return Math.max(0, Math.min(100, base));
  }
}
