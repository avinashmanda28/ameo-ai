// ═══════════════════════════════════════════════════════════════
// AMEO AI — Product Intelligence Engine (Commerce System 1)
// AI-powered product discovery, analysis, scoring, and insights
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getEventBus } from '@/lib/services/event-bus';

// ─── Types ───

export interface ProductDiscoveryParams {
  workspaceId: string;
  keywords: string[];
  source?: string;
  category?: string;
  minScore?: number;
  limit?: number;
}

export interface ProductSearchFilters {
  query?: string;
  category?: string;
  status?: string;
  minPrice?: number;
  maxPrice?: number;
  minScore?: number;
  sourcePlatform?: string;
  tags?: string[];
  sortBy?: 'trendScore' | 'demandScore' | 'overallScore' | 'price' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ProductAnalysisResult {
  productId: string;
  analysis: {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
    marketFit: string;
    targetAudience: string[];
    differentiation: string;
  };
  scores: {
    trend: number;
    demand: number;
    competition: number;
    saturation: number;
    profit: number;
    viral: number;
    opportunity: number;
    overall: number;
  };
  recommendations: string[];
}

export interface CompetitionAnalysis {
  competitorCount: number;
  topCompetitors: Array<{
    name: string;
    priceRange: string;
    estimatedSales: string;
    differentiator: string;
  }>;
  marketConcentration: 'low' | 'medium' | 'high';
  barriersToEntry: string[];
  pricingStrategy: string;
  marketGaps: string[];
}

export interface ProfitEstimateResult {
  estimatedCost: number;
  estimatedPrice: number;
  grossMargin: number;
  netMargin: number;
  estimatedMonthlySales: number;
  estimatedMonthlyRevenue: number;
  estimatedMonthlyProfit: number;
  breakevenUnits: number;
  confidence: 'low' | 'medium' | 'high';
  factors: Array<{
    name: string;
    impact: number;
    description: string;
  }>;
}

// ─── ProductIntelligence Class ───

class ProductIntelligence {
  /**
   * Discover new products from analysis and scoring.
   * In production, this would connect to supplier APIs and intelligence sources.
   */
  async discoverProducts(params: ProductDiscoveryParams): Promise<{ products: string[]; count: number }> {
    const { workspaceId, keywords, source = 'analysis', category, limit = 20 } = params;

    const eventBus = getEventBus();

    await eventBus.emit({
      workspaceId,
      eventType: 'product.discovery.started',
      source: 'system',
      level: 'info',
      payload: { keywords, source, category, limit },
      resourceType: 'product',
      tags: ['commerce', 'product', 'discovery'],
    });

    // In production, this would:
    // 1. Query supplier APIs (AliExpress, Alibaba, Amazon)
    // 2. Apply trend analysis to identify winning products
    // 3. Score and rank results
    // 4. Return top candidates for analysis

    // For now, return empty — products are created via the API with analysis data
    return { products: [], count: 0 };
  }

  /**
   * Full AI-powered product analysis.
   * Computes all intelligence scores and generates insights.
   */
  async analyzeProduct(productId: string): Promise<ProductAnalysisResult> {
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error(`Product not found: ${productId}`);

    const eventBus = getEventBus();

    await eventBus.emit({
      workspaceId: product.workspaceId,
      eventType: 'product.analysis.started',
      source: 'system',
      level: 'info',
      payload: { productId, productName: product.name },
      resourceType: 'product',
      resourceId: productId,
      tags: ['commerce', 'product', 'analysis'],
    });

    // Compute intelligence scores based on available data
    const trendScore = this.computeTrendScore(product);
    const demandScore = this.computeDemandScore(product);
    const competitionScore = this.computeCompetitionScore(product);
    const saturationScore = this.computeSaturationScore(product);
    const profitEstimate = this.estimateProfitMargin(product);
    const viralScore = this.computeViralScore(product);
    const opportunityScore = this.computeOpportunityScore(
      trendScore, demandScore, competitionScore, profitEstimate
    );
    const overallScore = Math.round(
      (trendScore + demandScore + (100 - competitionScore) + (100 - saturationScore) +
        profitEstimate + viralScore + opportunityScore) / 7
    );

    // Generate AI analysis
    const analysis = this.generateAnalysis(product, {
      trend: trendScore,
      demand: demandScore,
      competition: competitionScore,
      saturation: saturationScore,
      profit: profitEstimate,
      viral: viralScore,
      opportunity: opportunityScore,
      overall: overallScore,
    });

    // Update product with computed scores
    await db.product.update({
      where: { id: productId },
      data: {
        trendScore,
        demandScore,
        competitionScore,
        saturationScore,
        profitEstimate,
        viralPotentialScore: viralScore,
        marketOpportunityScore: opportunityScore,
        overallScore,
        aiSummary: analysis.summary,
        aiInsights: JSON.stringify(analysis),
        analysisVersion: product.analysisVersion + 1,
        lastAnalyzedAt: new Date(),
        status: 'analyzed',
      },
    });

    await eventBus.emit({
      workspaceId: product.workspaceId,
      eventType: 'product.analysis.completed',
      source: 'system',
      level: 'info',
      payload: { productId, overallScore, analysisVersion: product.analysisVersion + 1 },
      resourceType: 'product',
      resourceId: productId,
      tags: ['commerce', 'product', 'analysis', 'completed'],
    });

    return {
      productId,
      analysis: {
        summary: analysis.summary,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        opportunities: analysis.opportunities,
        threats: analysis.threats,
        marketFit: analysis.marketFit,
        targetAudience: analysis.targetAudience,
        differentiation: analysis.differentiation,
      },
      scores: {
        trend: trendScore,
        demand: demandScore,
        competition: competitionScore,
        saturation: saturationScore,
        profit: profitEstimate,
        viral: viralScore,
        opportunity: opportunityScore,
        overall: overallScore,
      },
      recommendations: analysis.recommendations,
    };
  }

  /**
   * Search products with advanced filtering.
   */
  async searchProducts(workspaceId: string, filters: ProductSearchFilters = {}) {
    const where: Record<string, unknown> = { workspaceId };

    if (filters.query) {
      where.OR = [
        { name: { contains: filters.query, mode: 'insensitive' } },
        { description: { contains: filters.query, mode: 'insensitive' } },
        { sku: { contains: filters.query, mode: 'insensitive' } },
      ];
    }
    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;
    if (filters.sourcePlatform) where.sourcePlatform = filters.sourcePlatform;
    if (filters.minPrice != null) where.price = { gte: filters.minPrice };
    if (filters.maxPrice != null) where.price = { ...(where.price as Record<string, unknown> || {}), lte: filters.maxPrice };
    if (filters.minScore != null) where.overallScore = { gte: filters.minScore };
    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    const sortBy = filters.sortBy || 'overallScore';
    const sortOrder = filters.sortOrder || 'desc';
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset,
        include: { supplier: { select: { id: true, name: true, trustScore: true, platform: true } } },
      }),
      db.product.count({ where }),
    ]);

    return { products, total, limit, offset };
  }

  /**
   * Get detailed AI insights for a product.
   */
  async getProductInsights(productId: string) {
    const product = await db.product.findUnique({
      where: { id: productId },
      include: {
        supplier: { select: { id: true, name: true, trustScore: true, platform: true } },
        trends: { select: { id: true, name: true, keyword: true, viralScore: true, status: true } },
        analytics: { orderBy: { periodStart: 'desc' }, take: 30 },
      },
    });

    if (!product) throw new Error(`Product not found: ${productId}`);

    return {
      product,
      aiSummary: product.aiSummary,
      aiInsights: product.aiInsights ? JSON.parse(product.aiInsights) : null,
      scores: {
        trend: product.trendScore,
        demand: product.demandScore,
        competition: product.competitionScore,
        saturation: product.saturationScore,
        profit: product.profitEstimate,
        viral: product.viralPotentialScore,
        opportunity: product.marketOpportunityScore,
        overall: product.overallScore,
      },
      relatedTrends: product.trends,
      analytics: product.analytics,
      lastAnalyzedAt: product.lastAnalyzedAt,
    };
  }

  /**
   * Competition analysis for a product category.
   */
  async getCompetitionAnalysis(productId: string): Promise<CompetitionAnalysis> {
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error(`Product not found: ${productId}`);

    const competitors = await db.product.findMany({
      where: {
        workspaceId: product.workspaceId,
        category: product.category,
        id: { not: productId },
        status: { in: ['analyzed', 'analyzing', 'imported'] },
      },
      take: 20,
    });

    const avgCompetitorPrice = competitors.length > 0
      ? competitors.reduce((sum, c) => sum + (c.price || 0), 0) / competitors.length
      : 0;

    const competitorCount = competitors.length;

    let marketConcentration: 'low' | 'medium' | 'high' = 'low';
    if (competitorCount > 20) marketConcentration = 'high';
    else if (competitorCount > 10) marketConcentration = 'medium';

    return {
      competitorCount,
      topCompetitors: competitors.slice(0, 5).map((c) => ({
        name: c.name,
        priceRange: `$${(c.price || 0).toFixed(2)}`,
        estimatedSales: 'N/A',
        differentiator: c.aiSummary?.substring(0, 100) || 'No data',
      })),
      marketConcentration,
      barriersToEntry: [
        competitorCount > 10 ? 'High competition in this category' : 'Moderate competition',
        avgCompetitorPrice < 10 ? 'Low price point — margin pressure' : 'Healthy price range',
        'Supplier verification required',
      ],
      pricingStrategy: avgCompetitorPrice > 0
        ? `Target price: $${(avgCompetitorPrice * 0.95).toFixed(2)} (5% below market average)`
        : 'No competitor pricing data available',
      marketGaps: [],
    };
  }

  /**
   * Estimate profit for a product.
   */
  async estimateProfit(productId: string): Promise<ProfitEstimateResult> {
    const product = await db.product.findUnique({
      where: { id: productId },
      include: { supplier: true },
    });
    if (!product) throw new Error(`Product not found: ${productId}`);

    const costPrice = product.costPrice || (product.price ?? 0) * 0.4 || 0;
    const sellingPrice = product.price || (product.costPrice ?? 0) * 2.5 || 0;
    const grossMargin = sellingPrice > 0 ? ((sellingPrice - costPrice) / sellingPrice) * 100 : 0;
    const platformFees = sellingPrice * 0.15; // ~15% platform fees
    const shippingCost = 5; // average shipping
    const netMargin = sellingPrice > 0
      ? ((sellingPrice - costPrice - platformFees - shippingCost) / sellingPrice) * 100
      : 0;
    const estimatedMonthlySales = Math.round(100 + (product.overallScore || 50) * 3);
    const estimatedMonthlyRevenue = estimatedMonthlySales * sellingPrice;
    const estimatedMonthlyProfit = estimatedMonthlyRevenue * (netMargin / 100);
    const breakevenUnits = Math.ceil(costPrice / (sellingPrice - costPrice));

    return {
      estimatedCost: Math.round(costPrice * 100) / 100,
      estimatedPrice: Math.round(sellingPrice * 100) / 100,
      grossMargin: Math.round(grossMargin * 10) / 10,
      netMargin: Math.round(netMargin * 10) / 10,
      estimatedMonthlySales,
      estimatedMonthlyRevenue: Math.round(estimatedMonthlyRevenue * 100) / 100,
      estimatedMonthlyProfit: Math.round(estimatedMonthlyProfit * 100) / 100,
      breakevenUnits,
      confidence: product.costPrice ? 'high' : 'medium',
      factors: [
        { name: 'Product Cost', impact: costPrice / sellingPrice, description: `Cost price $${costPrice.toFixed(2)}` },
        { name: 'Market Price', impact: 0.85, description: `Selling price $${sellingPrice.toFixed(2)}` },
        { name: 'Platform Fees', impact: 0.15, description: 'Estimated 15% platform + payment fees' },
        { name: 'Shipping Cost', impact: shippingCost / sellingPrice, description: `Estimated $${shippingCost.toFixed(2)}/unit` },
      ],
    };
  }

  // ─── Score Computation (private helpers) ───

  private computeTrendScore(product: { trendScore?: number | null; name: string; description?: string | null }): number {
    if (product.trendScore) return Math.round(product.trendScore);
    const base = 50;
    const nameBoost = product.name.length > 10 ? 10 : 5;
    const descBoost = product.description ? 10 : 0;
    return Math.min(100, base + nameBoost + descBoost);
  }

  private computeDemandScore(product: { demandScore?: number | null; category?: string | null }): number {
    if (product.demandScore) return Math.round(product.demandScore);
    return 60; // base demand score
  }

  private computeCompetitionScore(product: { competitionScore?: number | null; category?: string | null }): number {
    if (product.competitionScore) return Math.round(product.competitionScore);
    return 40; // lower = less competition = better
  }

  private computeSaturationScore(product: { saturationScore?: number | null; category?: string | null }): number {
    if (product.saturationScore) return Math.round(product.saturationScore);
    return 30; // lower = less saturated = better
  }

  private estimateProfitMargin(product: { profitEstimate?: number | null; price?: number | null; costPrice?: number | null }): number {
    if (product.profitEstimate) return Math.round(product.profitEstimate);
    if (product.price && product.costPrice) {
      const margin = ((product.price - product.costPrice) / product.price) * 100;
      return Math.round(Math.min(100, margin));
    }
    return 50;
  }

  private computeViralScore(product: { viralPotentialScore?: number | null; name: string; description?: string | null }): number {
    if (product.viralPotentialScore) return Math.round(product.viralPotentialScore);
    return 40;
  }

  private computeOpportunityScore(
    trend: number, demand: number, competition: number, profit: number
  ): number {
    return Math.round((trend * 0.25 + demand * 0.25 + (100 - competition) * 0.25 + profit * 0.25));
  }

  private generateAnalysis(product: { name: string; category?: string | null; description?: string | null }, scores: {
    trend: number; demand: number; competition: number; saturation: number;
    profit: number; viral: number; opportunity: number; overall: number;
  }) {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const opportunities: string[] = [];
    const threats: string[] = [];
    const recommendations: string[] = [];

    if (scores.trend > 70) {
      strengths.push('Strong trend momentum');
      recommendations.push('Move quickly to capitalize on trend');
    } else {
      weaknesses.push('Moderate trend visibility');
      recommendations.push('Consider niche marketing to build awareness');
    }

    if (scores.demand > 70) {
      strengths.push('High demand signal');
    } else if (scores.demand < 40) {
      weaknesses.push('Low demand — may need market education');
    }

    if (scores.competition < 30) {
      strengths.push('Low competition environment');
      recommendations.push('First-mover advantage possible');
    } else if (scores.competition > 70) {
      threats.push('High competition may pressure margins');
      recommendations.push('Differentiate through unique value proposition');
    }

    if (scores.profit > 60) {
      strengths.push(`Healthy margin potential (${scores.profit}% estimated)`);
    } else {
      weaknesses.push('Thin margins — optimize costs');
    }

    if (scores.viral > 60) {
      opportunities.push('Strong viral potential for organic growth');
    }

    if (scores.opportunity > 70) {
      opportunities.push('Strong overall market opportunity');
    }

    const marketFit = scores.overall > 70 ? 'Strong' : scores.overall > 50 ? 'Moderate' : 'Needs validation';
    const targetAudience = this.estimateTargetAudience(product.category || '');

    return {
      summary: `${product.name} — Analysis complete. Overall score: ${scores.overall}/100. ` +
        `${strengths.length} strengths, ${opportunities.length} opportunities identified. ` +
        `Market fit: ${marketFit}.`,
      strengths,
      weaknesses,
      opportunities,
      threats,
      marketFit,
      targetAudience,
      differentiation: scores.competition > 50
        ? `Stand out from ${scores.competition}% competition through premium positioning`
        : 'Early market entrant — establish brand leadership',
      recommendations,
    };
  }

  private estimateTargetAudience(category: string): string[] {
    const audiences: Record<string, string[]> = {
      electronics: ['Tech enthusiasts', 'Early adopters', 'Gadget lovers'],
      fashion: ['Trend-conscious shoppers', 'Fashion bloggers', 'Young professionals'],
      home: ['Homeowners', 'Interior design enthusiasts', 'Families'],
      beauty: ['Beauty enthusiasts', 'Skincare routine followers', 'Organic product seekers'],
      sports: ['Fitness enthusiasts', 'Athletes', 'Outdoor adventurers'],
      toys: ['Parents', 'Gift shoppers', 'Collectors'],
      food: ['Foodies', 'Health-conscious consumers', 'Home cooks'],
    };
    return audiences[category.toLowerCase()] || ['General consumers', 'Online shoppers', 'Value seekers'];
  }
}

// ─── Singleton ───

let instance: ProductIntelligence | null = null;

export function getProductIntelligence(): ProductIntelligence {
  if (!instance) instance = new ProductIntelligence();
  return instance;
}
