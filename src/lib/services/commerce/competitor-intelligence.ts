// ═══════════════════════════════════════════════════════════════
// AMEO AI — Competitor Intelligence (System 8)
// Competitive analysis infrastructure with competitor tracking,
// pricing comparison, trend overlap analysis, market saturation,
// product comparison, and opportunity scoring.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getEventBus } from '@/lib/services/event-bus';

// ─── Types ───

export interface CompetitorProfile {
  id: string;
  name: string;
  domain?: string | null;
  platform?: string | null;
  estimatedRevenue?: string | null;
  marketShare?: number | null;
  pricePosition?: string | null;
  threatLevel: string;
  overallScore: number;
  products: number;
  productsUndercut?: number;
  lastCheckedAt?: Date | null;
}

export interface PriceComparison {
  productId: string;
  productName: string;
  ourPrice: number;
  competitorCount: number;
  averageCompetitorPrice: number;
  lowestPrice: number;
  highestPrice: number;
  ourPosition: string; // below_average | average | above_average | premium
  priceGap: number;
  opportunityScore: number;
}

export interface MarketAnalysis {
  category: string;
  totalCompetitors: number;
  totalProducts: number;
  averagePrice: number;
  priceRange: { min: number; max: number };
  saturationLevel: 'low' | 'medium' | 'high';
  opportunityScore: number;
  topCompetitors: Array<{ name: string; marketShare: number; score: number }>;
  recommendations: string[];
}

// ─── Competitor Intelligence Service ───

export class CompetitorIntelligence {
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  // ─── Competitor CRUD ───

  async addCompetitor(data: {
    name: string;
    domain?: string;
    platform?: string;
    platformUrl?: string;
    description?: string;
  }): Promise<Record<string, unknown>> {
    const existing = await db.competitor.findFirst({
      where: { workspaceId: this.workspaceId, name: data.name },
    });
    if (existing) throw new Error(`Competitor "${data.name}" already exists`);

    const competitor = await db.competitor.create({
      data: {
        workspaceId: this.workspaceId,
        ...data,
        status: 'tracking',
        trackingSince: new Date(),
      },
    });

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'competitor.added',
      source: 'competitor-intelligence',
      level: 'info',
      payload: { competitorId: competitor.id, name: data.name },
      resourceType: 'competitor',
      resourceId: competitor.id,
    });

    return competitor as unknown as Record<string, unknown>;
  }

  async listCompetitors(): Promise<CompetitorProfile[]> {
    const competitors = await db.competitor.findMany({
      where: { workspaceId: this.workspaceId, status: 'tracking' },
      include: { products: true },
      orderBy: { overallScore: 'desc' },
    });

    return competitors.map((c) => ({
      id: c.id,
      name: c.name,
      domain: c.domain,
      platform: c.platform,
      estimatedRevenue: c.estimatedRevenue,
      marketShare: c.marketShare,
      pricePosition: c.pricePosition,
      threatLevel: c.threatLevel || 'low',
      overallScore: c.overallScore || 0,
      products: c.products.length,
      lastCheckedAt: c.lastCheckedAt,
    }));
  }

  // ─── Track Competitor Product ───

  async trackCompetitorProduct(data: {
    competitorId: string;
    name: string;
    productUrl?: string;
    currentPrice?: number;
    category?: string;
    sku?: string;
  }): Promise<Record<string, unknown>> {
    const product = await db.competitorProduct.create({
      data: {
        competitorId: data.competitorId,
        workspaceId: this.workspaceId,
        name: data.name,
        productUrl: data.productUrl || null,
        currentPrice: data.currentPrice || null,
        category: data.category || null,
        sku: data.sku || null,
        firstDetectedAt: new Date(),
        lastCheckedAt: new Date(),
      },
    });

    return product as unknown as Record<string, unknown>;
  }

  // ─── Price Comparison ───

  async comparePrices(productId: string): Promise<PriceComparison | null> {
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product?.price) return null;

    const category = product.category;
    if (!category) return null;

    // Find competitor products in the same category
    const competitorProducts = await db.competitorProduct.findMany({
      where: {
        workspaceId: this.workspaceId,
        category: { contains: category, mode: 'insensitive' },
        currentPrice: { not: null },
      },
    });

    const prices = competitorProducts
      .map((cp) => cp.currentPrice!)
      .filter((p) => p > 0);

    if (prices.length === 0) {
      return {
        productId,
        productName: product.name,
        ourPrice: product.price,
        competitorCount: 0,
        averageCompetitorPrice: 0,
        lowestPrice: 0,
        highestPrice: 0,
        ourPosition: 'unknown',
        priceGap: 0,
        opportunityScore: 50,
      };
    }

    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    const ourPrice = product.price;
    let ourPosition: string;
    if (ourPrice < avgPrice * 0.9) ourPosition = 'below_average';
    else if (ourPrice > avgPrice * 1.1) ourPosition = 'above_average';
    else if (ourPrice > avgPrice * 1.3) ourPosition = 'premium';
    else ourPosition = 'average';

    const priceGap = ourPrice - avgPrice;
    const opportunityScore = Math.round(
      ourPrice < avgPrice
        ? Math.min(100, 50 + ((avgPrice - ourPrice) / avgPrice) * 100)
        : Math.max(0, 50 - ((ourPrice - avgPrice) / avgPrice) * 50)
    );

    return {
      productId,
      productName: product.name,
      ourPrice,
      competitorCount: prices.length,
      averageCompetitorPrice: Math.round(avgPrice * 100) / 100,
      lowestPrice: minPrice,
      highestPrice: maxPrice,
      ourPosition,
      priceGap: Math.round(priceGap * 100) / 100,
      opportunityScore,
    };
  }

  async bulkComparePrices(): Promise<PriceComparison[]> {
    const products = await db.product.findMany({
      where: {
        workspaceId: this.workspaceId,
        price: { not: null },
        category: { not: null },
      },
      take: 100,
    });

    const results: PriceComparison[] = [];
    for (const product of products) {
      const comparison = await this.comparePrices(product.id);
      if (comparison) results.push(comparison);
    }

    return results.sort((a, b) => b.opportunityScore - a.opportunityScore);
  }

  // ─── Market Analysis ───

  async analyzeMarket(category: string): Promise<MarketAnalysis> {
    const competitors = await db.competitor.findMany({
      where: { workspaceId: this.workspaceId, status: 'tracking' },
    });

    const competitorProducts = await db.competitorProduct.findMany({
      where: {
        workspaceId: this.workspaceId,
        category: { contains: category, mode: 'insensitive' },
        currentPrice: { not: null },
      },
    });

    const ourProducts = await db.product.findMany({
      where: {
        workspaceId: this.workspaceId,
        category: { contains: category, mode: 'insensitive' },
        price: { not: null },
      },
    });

    const prices = competitorProducts.map((cp) => cp.currentPrice!);
    const avgPrice =
      prices.length > 0
        ? prices.reduce((sum, p) => sum + p, 0) / prices.length
        : 0;

    const totalMarketPlayers = competitors.length + 1; // +1 for us
    const saturationLevel: 'low' | 'medium' | 'high' =
      totalMarketPlayers <= 3 ? 'low' : totalMarketPlayers <= 7 ? 'medium' : 'high';

    const opportunityScore = Math.round(
      (saturationLevel === 'low' ? 80 : saturationLevel === 'medium' ? 50 : 20) *
        (ourProducts.length > competitorProducts.length / 2 ? 0.7 : 1.0)
    );

    // Top competitors by score
    const scoredCompetitors = competitors
      .map((c) => ({
        name: c.name,
        marketShare: c.marketShare || 0,
        score: c.overallScore || 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // Generate recommendations
    const recommendations: string[] = [];
    if (saturationLevel === 'high') {
      recommendations.push('Market is saturated — focus on product differentiation and niche targeting');
      recommendations.push('Consider premium positioning to avoid price competition');
    } else if (saturationLevel === 'medium') {
      recommendations.push('Moderate competition — leverage AI optimization for competitive advantage');
      recommendations.push('Focus on SEO and content marketing to capture search traffic');
    } else {
      recommendations.push('Low competition — first-mover advantage available');
      recommendations.push('Aggressively capture market share with competitive pricing');
    }

    if (ourProducts.length === 0) {
      recommendations.push(`No products yet in "${category}" — opportunity to enter with optimized listings`);
    } else if (ourProducts.length > 0 && avgPrice > 0) {
      const ourAvgPrice =
        ourProducts.reduce((sum, p) => sum + (p.price || 0), 0) / ourProducts.length;
      if (ourAvgPrice > avgPrice * 1.2) {
        recommendations.push('Your pricing is above market average — consider adjusting for competitiveness');
      } else if (ourAvgPrice < avgPrice * 0.8) {
        recommendations.push('Your pricing is below market average — room for margin improvement');
      }
    }

    return {
      category,
      totalCompetitors: competitors.length,
      totalProducts: competitorProducts.length + ourProducts.length,
      averagePrice: Math.round(avgPrice * 100) / 100,
      priceRange: {
        min: prices.length > 0 ? Math.min(...prices) : 0,
        max: prices.length > 0 ? Math.max(...prices) : 0,
      },
      saturationLevel,
      opportunityScore,
      topCompetitors: scoredCompetitors,
      recommendations,
    };
  }

  // ─── Threat Assessment ───

  async assessThreats(): Promise<Array<{
    competitorId: string;
    name: string;
    threatLevel: string;
    priceOverlap: number;
    productOverlap: number;
    recommendation: string;
  }>> {
    const competitors = await db.competitor.findMany({
      where: { workspaceId: this.workspaceId, status: 'tracking' },
      include: { products: true },
    });

    const ourProducts = await db.product.findMany({
      where: { workspaceId: this.workspaceId, price: { not: null } },
    });

    return competitors.map((c) => {
      // Calculate product overlap
      const ourCategories = new Set(ourProducts.map((p) => p.category).filter(Boolean));
      const competitorCategories = new Set(c.products.map((p) => p.category).filter(Boolean));
      const overlap = [...ourCategories].filter((cat) => competitorCategories.has(cat));
      const productOverlap = ourCategories.size > 0
        ? Math.round((overlap.length / ourCategories.size) * 100)
        : 0;

      // Calculate price overlap
      const ourPrices = ourProducts.map((p) => p.price!).filter(Boolean);
      const competitorPrices = c.products
        .map((p) => p.currentPrice)
        .filter((p): p is number => p !== null && p !== undefined);

      let priceOverlap = 0;
      if (ourPrices.length > 0 && competitorPrices.length > 0) {
        const overlapping = ourPrices.filter((ourP) =>
          competitorPrices.some(
            (compP) => Math.abs(ourP - compP) / ourP < 0.2
          )
        );
        priceOverlap = Math.round((overlapping.length / ourPrices.length) * 100);
      }

      // Compute threat level
      const threatScore = productOverlap * 0.4 + priceOverlap * 0.3 + (c.overallScore || 0) * 0.3;
      const threatLevel = threatScore > 70 ? 'high' : threatScore > 40 ? 'medium' : 'low';

      let recommendation: string;
      if (threatLevel === 'high') {
        recommendation = `High threat — ${c.name} directly competes in ${overlap.length} categories. Monitor pricing and differentiate product offering.`;
      } else if (threatLevel === 'medium') {
        recommendation = `Moderate threat from ${c.name}. Consider competitive analysis and targeted marketing.`;
      } else {
        recommendation = `Low threat — ${c.name} has minimal category overlap. Focus on your unique market position.`;
      }

      return {
        competitorId: c.id,
        name: c.name,
        threatLevel,
        priceOverlap,
        productOverlap,
        recommendation,
      };
    });
  }

  // ─── Opportunity Scoring ───

  async findOpportunities(): Promise<Array<{
    category: string;
    opportunityScore: number;
    competitorWeaknesses: string[];
    suggestedActions: string[];
    estimatedImpact: string;
  }>> {
    const competitors = await db.competitor.findMany({
      where: { workspaceId: this.workspaceId, status: 'tracking' },
      include: { products: true },
    });

    const categories = await db.product.findMany({
      where: { workspaceId: this.workspaceId },
      select: { category: true },
      distinct: ['category'],
    });

    const opportunities: Array<{
      category: string;
      opportunityScore: number;
      competitorWeaknesses: string[];
      suggestedActions: string[];
      estimatedImpact: string;
    }> = [];

    for (const { category } of categories) {
      if (!category) continue;

      const competitorInCat = competitors.filter((c) =>
        c.products.some((p) => p.category === category)
      );

      const ourProductsInCat = await db.product.count({
        where: { workspaceId: this.workspaceId, category },
      });

      const competitorCount = competitorInCat.length;
      const weaknessCount = competitorInCat.filter((c) => (c.overallScore || 0) < 50).length;

      // Score based on:
      // - Few competitors = more opportunity
      // - Many weak competitors = more opportunity
      // - Few of our products = more opportunity to expand
      const score = Math.round(
        (competitorCount <= 2 ? 40 : competitorCount <= 5 ? 25 : 10) +
          weaknessCount * 10 +
          (ourProductsInCat <= 3 ? 30 : 10)
      );

      if (score >= 40) {
        const weaknesses = competitorInCat
          .filter((c) => (c.overallScore || 0) < 50)
          .map((c) => `${c.name}: low overall score (${c.overallScore || 0}/100)`);

        const suggestedActions: string[] = [];
        if (competitorCount <= 2) suggestedActions.push('Enter market quickly with optimized products');
        if (weaknessCount > 0) suggestedActions.push('Differentiate from weak competitors with quality and AI optimization');
        if (ourProductsInCat <= 3) suggestedActions.push('Expand product range in this category');
        suggestedActions.push('Use competitive pricing strategy to capture market share');

        opportunities.push({
          category,
          opportunityScore: score,
          competitorWeaknesses: weaknesses.slice(0, 3),
          suggestedActions: suggestedActions.slice(0, 3),
          estimatedImpact: score >= 70 ? 'High' : score >= 50 ? 'Medium' : 'Moderate',
        });
      }
    }

    return opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);
  }

  // ─── Stats ───

  async getStats(): Promise<{
    totalCompetitors: number;
    trackedProducts: number;
    highThreat: number;
    opportunities: number;
    averageScore: number;
  }> {
    const competitors = await db.competitor.findMany({
      where: { workspaceId: this.workspaceId, status: 'tracking' },
    });
    const trackedProducts = await db.competitorProduct.count({
      where: { workspaceId: this.workspaceId },
    });

    return {
      totalCompetitors: competitors.length,
      trackedProducts,
      highThreat: competitors.filter((c) => c.threatLevel === 'high').length,
      opportunities: (await this.findOpportunities()).length,
      averageScore: competitors.length > 0
        ? Math.round(competitors.reduce((sum, c) => sum + (c.overallScore || 0), 0) / competitors.length)
        : 0,
    };
  }
}
