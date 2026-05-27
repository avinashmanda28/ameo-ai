// ═══════════════════════════════════════════════════════════════
// AMEO AI — Supplier Intelligence Layer (Commerce System 2)
// AI-powered supplier analysis, trust scoring, and comparison
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getEventBus } from '@/lib/services/event-bus';

// ─── Types ───

export interface SupplierDiscoveryParams {
  workspaceId: string;
  platform?: string;
  keywords?: string[];
  category?: string;
  country?: string;
  minRating?: number;
  limit?: number;
}

export interface SupplierSearchFilters {
  query?: string;
  platform?: string;
  status?: string;
  country?: string;
  minTrustScore?: number;
  verified?: boolean;
  sortBy?: 'trustScore' | 'rating' | 'overallScore' | 'pricingScore' | 'name';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface SupplierAnalysisResult {
  supplierId: string;
  trustScore: number;
  shippingScore: number;
  qualityScore: number;
  pricingScore: number;
  reliabilityScore: number;
  overallScore: number;
  riskScore: number;
  riskFactors: Array<{ factor: string; severity: string; description: string }>;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  estimatedDelivery: string;
}

export interface SupplierComparison {
  suppliers: Array<{
    id: string;
    name: string;
    platform: string;
    overallScore: number;
    trustScore: number;
    pricingScore: number;
    shippingScore: number;
    qualityScore: number;
    rating: number;
    moqMin: number;
    estimatedDelivery: string;
  }>;
  recommendations: string[];
}

// ─── SupplierIntelligence Class ───

class SupplierIntelligence {
  /**
   * Discover suppliers from analysis and scoring.
   * In production, connects to supplier platform APIs.
   */
  async discoverSuppliers(params: SupplierDiscoveryParams): Promise<{ suppliers: string[]; count: number }> {
    const { workspaceId, platform, keywords, category, country, minRating, limit = 20 } = params;

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId,
      eventType: 'supplier.discovery.started',
      source: 'system',
      level: 'info',
      payload: { platform, keywords, category, country, minRating, limit },
      resourceType: 'supplier',
      tags: ['commerce', 'supplier', 'discovery'],
    });

    // In production: query supplier platforms (Alibaba, AliExpress APIs)
    return { suppliers: [], count: 0 };
  }

  /**
   * Full supplier analysis computing all intelligence scores.
   */
  async analyzeSupplier(supplierId: string): Promise<SupplierAnalysisResult> {
    const supplier = await db.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new Error(`Supplier not found: ${supplierId}`);

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId: supplier.workspaceId,
      eventType: 'supplier.analysis.started',
      source: 'system',
      level: 'info',
      payload: { supplierId, supplierName: supplier.name },
      resourceType: 'supplier',
      resourceId: supplierId,
      tags: ['commerce', 'supplier', 'analysis'],
    });

    // Compute scores based on available supplier data
    const trustScore = this.computeTrustScore(supplier);
    const shippingScore = this.computeShippingScore(supplier);
    const qualityScore = this.computeQualityScore(supplier);
    const pricingScore = this.computePricingScore(supplier);
    const reliabilityScore = this.computeReliabilityScore(supplier);
    const overallScore = Math.round(
      (trustScore + shippingScore + qualityScore + pricingScore + reliabilityScore) / 5
    );
    const riskScore = this.computeRiskScore(supplier);

    // Risk factor analysis
    const riskFactors = this.analyzeRiskFactors(supplier, riskScore);
    const strengths = this.identifyStrengths(supplier, trustScore, shippingScore, qualityScore, pricingScore);
    const weaknesses = this.identifyWeaknesses(supplier, trustScore, shippingScore, qualityScore, pricingScore);

    // Update supplier with computed scores
    await db.supplier.update({
      where: { id: supplierId },
      data: {
        trustScore,
        shippingScore,
        qualityScore,
        pricingScore,
        reliabilityScore,
        overallScore,
        riskScore,
        riskFactors: JSON.stringify(riskFactors),
        status: supplier.status === 'discovered' ? 'verified' : supplier.status,
      },
    });

    await eventBus.emit({
      workspaceId: supplier.workspaceId,
      eventType: 'supplier.analysis.completed',
      source: 'system',
      level: 'info',
      payload: { supplierId, overallScore, riskScore },
      resourceType: 'supplier',
      resourceId: supplierId,
      tags: ['commerce', 'supplier', 'analysis', 'completed'],
    });

    return {
      supplierId,
      trustScore,
      shippingScore,
      qualityScore,
      pricingScore,
      reliabilityScore,
      overallScore,
      riskScore,
      riskFactors,
      strengths,
      weaknesses,
      recommendations: this.generateRecommendations(supplier, strengths, weaknesses),
      estimatedDelivery: supplier.estimatedDelivery || '7-15 days',
    };
  }

  /**
   * Compare multiple suppliers side by side.
   */
  async compareSuppliers(workspaceId: string, supplierIds: string[]): Promise<SupplierComparison> {
    const suppliers = await db.supplier.findMany({
      where: { id: { in: supplierIds }, workspaceId },
      include: {
        products: { select: { id: true, name: true, price: true } },
        prices: { orderBy: { recordedAt: 'desc' }, take: 1 },
      },
    });

    if (suppliers.length === 0) {
      throw new Error('No suppliers found for comparison');
    }

    // Ensure all suppliers have been analyzed
    const analyzedSuppliers: Array<{
      id: string; name: string; platform: string; overallScore: number;
      trustScore: number; pricingScore: number; shippingScore: number;
      qualityScore: number; rating: number; moqMin: number; estimatedDelivery: string;
    }> = [];

    for (const s of suppliers) {
      if (!s.overallScore || s.overallScore === 0) {
        await this.analyzeSupplier(s.id);
      }
      analyzedSuppliers.push({
        id: s.id,
        name: s.name,
        platform: s.platform,
        overallScore: s.overallScore || 0,
        trustScore: s.trustScore || 0,
        pricingScore: s.pricingScore || 0,
        shippingScore: s.shippingScore || 0,
        qualityScore: s.qualityScore || 0,
        rating: s.rating || 0,
        moqMin: s.moqMin || 1,
        estimatedDelivery: s.estimatedDelivery || 'N/A',
      });
    }

    // Sort by overall score descending
    analyzedSuppliers.sort((a, b) => b.overallScore - a.overallScore);

    const bestSupplier = analyzedSuppliers[0];
    const recommendations: string[] = [];

    recommendations.push(`Top supplier: ${bestSupplier.name} (Score: ${bestSupplier.overallScore}/100)`);

    if (analyzedSuppliers.length > 1) {
      const second = analyzedSuppliers[1];
      const diff = bestSupplier.overallScore - second.overallScore;
      if (diff > 10) {
        recommendations.push(`${bestSupplier.name} significantly outperforms ${second.name}`);
      } else {
        recommendations.push(`${bestSupplier.name} and ${second.name} are closely matched`);
      }
    }

    const allTrustScores = analyzedSuppliers.map((s) => s.trustScore);
    const avgTrust = allTrustScores.reduce((a, b) => a + b, 0) / allTrustScores.length;
    if (avgTrust < 60) {
      recommendations.push('Average trust score is low — verify suppliers thoroughly');
    }

    return { suppliers: analyzedSuppliers, recommendations };
  }

  /**
   * Get shipping analysis for a supplier.
   */
  async getShippingAnalysis(supplierId: string) {
    const supplier = await db.supplier.findUnique({
      where: { id: supplierId },
      include: {
        prices: { orderBy: { recordedAt: 'desc' }, take: 10 },
      },
    });
    if (!supplier) throw new Error(`Supplier not found: ${supplierId}`);

    const shippingMethods = supplier.shippingMethods ? JSON.parse(supplier.shippingMethods) : [];

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      estimatedDelivery: supplier.estimatedDelivery || 'Unknown',
      shippingScore: supplier.shippingScore || 0,
      freeShippingMoa: supplier.freeShippingMoa,
      shippingMethods: Array.isArray(shippingMethods) ? shippingMethods : [],
      pricingHistory: supplier.prices.map((p) => ({
        price: p.price,
        shippingCost: p.shippingCost,
        method: p.shippingMethod,
        days: p.estimatedDays,
        recordedAt: p.recordedAt,
      })),
    };
  }

  /**
   * Get risk analysis for a supplier.
   */
  async getRiskAnalysis(supplierId: string) {
    const supplier = await db.supplier.findUnique({
      where: { id: supplierId },
      include: { products: { select: { id: true, name: true, status: true } } },
    });
    if (!supplier) throw new Error(`Supplier not found: ${supplierId}`);

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      riskScore: supplier.riskScore || 0,
      riskFactors: supplier.riskFactors ? JSON.parse(supplier.riskFactors) : [],
      verified: supplier.verifiedBadge,
      verifiedAt: supplier.verifiedAt,
      responseRate: supplier.responseRate,
      responseTime: supplier.responseTime,
      totalProducts: supplier.products.length,
      trustScore: supplier.trustScore,
      moqDetails: supplier.moqDetails,
      assessment: supplier.riskScore && supplier.riskScore > 60
        ? 'HIGH RISK — Proceed with caution'
        : supplier.riskScore && supplier.riskScore > 30
          ? 'MODERATE RISK — Standard due diligence recommended'
          : 'LOW RISK — Supplier appears reliable',
    };
  }

  /**
   * Search suppliers with advanced filtering.
   */
  async searchSuppliers(workspaceId: string, filters: SupplierSearchFilters = {}) {
    const where: Record<string, unknown> = { workspaceId };

    if (filters.query) {
      where.OR = [
        { name: { contains: filters.query, mode: 'insensitive' } },
        { description: { contains: filters.query, mode: 'insensitive' } },
      ];
    }
    if (filters.platform) where.platform = filters.platform;
    if (filters.status) where.status = filters.status;
    if (filters.country) where.country = filters.country;
    if (filters.minTrustScore != null) where.trustScore = { gte: filters.minTrustScore };
    if (filters.verified != null) where.verifiedBadge = filters.verified;

    const sortBy = filters.sortBy || 'overallScore';
    const sortOrder = filters.sortOrder || 'desc';
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const [suppliers, total] = await Promise.all([
      db.supplier.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset,
        include: {
          _count: { select: { products: true } },
        },
      }),
      db.supplier.count({ where }),
    ]);

    return { suppliers, total, limit, offset };
  }

  // ─── Score Computation (private helpers) ───

  private computeTrustScore(supplier: {
    rating?: number | null; reviewCount?: number | null; orderCount?: number | null;
    responseRate?: number | null; verifiedBadge: boolean; trustScore?: number | null;
  }): number {
    if (supplier.trustScore) return Math.round(supplier.trustScore);
    let score = 50;
    if (supplier.rating) score += supplier.rating * 8; // 0-5 → 0-40
    if (supplier.reviewCount) score += Math.min(10, supplier.reviewCount / 10);
    if (supplier.orderCount) score += Math.min(10, supplier.orderCount / 50);
    if (supplier.responseRate) score += supplier.responseRate * 0.2; // 0-100 → 0-20
    if (supplier.verifiedBadge) score += 15;
    return Math.min(100, Math.round(score));
  }

  private computeShippingScore(supplier: {
    shippingScore?: number | null; estimatedDelivery?: string | null; freeShippingMoa?: number | null;
  }): number {
    if (supplier.shippingScore) return Math.round(supplier.shippingScore);
    let score = 60;
    if (supplier.freeShippingMoa) score += 15; // offers free shipping
    if (supplier.estimatedDelivery) {
      const days = parseInt(supplier.estimatedDelivery);
      if (!isNaN(days)) {
        if (days <= 7) score += 20;
        else if (days <= 15) score += 10;
        else score -= 10;
      }
    }
    return Math.min(100, Math.max(0, Math.round(score)));
  }

  private computeQualityScore(supplier: {
    qualityScore?: number | null; rating?: number | null; reviewCount?: number | null;
  }): number {
    if (supplier.qualityScore) return Math.round(supplier.qualityScore);
    let score = 55;
    if (supplier.rating) score += supplier.rating * 6;
    if (supplier.reviewCount && supplier.reviewCount > 100) score += 15;
    return Math.min(100, Math.round(score));
  }

  private computePricingScore(supplier: {
    pricingScore?: number | null; moqMin?: number | null; freeShippingMoa?: number | null;
  }): number {
    if (supplier.pricingScore) return Math.round(supplier.pricingScore);
    let score = 60;
    if (supplier.moqMin && supplier.moqMin <= 10) score += 20; // low MOQ is good
    if (supplier.moqMin && supplier.moqMin > 100) score -= 15; // high MOQ is bad
    if (supplier.freeShippingMoa && supplier.freeShippingMoa < 50) score += 10;
    return Math.min(100, Math.max(0, Math.round(score)));
  }

  private computeReliabilityScore(supplier: {
    reliabilityScore?: number | null; orderCount?: number | null; responseRate?: number | null;
    responseTime?: string | null;
  }): number {
    if (supplier.reliabilityScore) return Math.round(supplier.reliabilityScore);
    let score = 55;
    if (supplier.orderCount && supplier.orderCount > 1000) score += 20;
    if (supplier.responseRate && supplier.responseRate > 90) score += 15;
    if (supplier.responseTime && supplier.responseTime.includes('hour')) score += 10;
    return Math.min(100, Math.round(score));
  }

  private computeRiskScore(supplier: {
    riskScore?: number | null; verifiedBadge: boolean; rating?: number | null;
    reviewCount?: number | null; responseRate?: number | null;
  }): number {
    if (supplier.riskScore) return Math.round(supplier.riskScore);
    let risk = 20; // base risk
    if (!supplier.verifiedBadge) risk += 25;
    if (!supplier.rating || supplier.rating < 3) risk += 20;
    if (!supplier.reviewCount || supplier.reviewCount < 10) risk += 15;
    if (!supplier.responseRate || supplier.responseRate < 70) risk += 20;
    return Math.min(100, risk);
  }

  private analyzeRiskFactors(supplier: {
    name: string; verifiedBadge: boolean; rating?: number | null;
    reviewCount?: number | null; responseRate?: number | null; country?: string | null;
  }, riskScore: number) {
    const factors: Array<{ factor: string; severity: string; description: string }> = [];

    if (!supplier.verifiedBadge) {
      factors.push({
        factor: 'Unverified Supplier',
        severity: 'high',
        description: 'Supplier has not completed platform verification',
      });
    }
    if (!supplier.rating || supplier.rating < 3.5) {
      factors.push({
        factor: 'Low Rating',
        severity: supplier.rating && supplier.rating < 2 ? 'critical' : 'medium',
        description: `Supplier rating: ${supplier.rating || 'N/A'}/5`,
      });
    }
    if (!supplier.reviewCount || supplier.reviewCount < 25) {
      factors.push({
        factor: 'Limited Reviews',
        severity: 'medium',
        description: `Only ${supplier.reviewCount || 0} reviews — limited social proof`,
      });
    }
    if (!supplier.responseRate || supplier.responseRate < 80) {
      factors.push({
        factor: 'Slow Response',
        severity: 'low',
        description: `Response rate: ${supplier.responseRate || 'N/A'}%`,
      });
    }

    if (factors.length === 0) {
      factors.push({
        factor: 'Supplier appears reliable',
        severity: 'low',
        description: 'No significant risk factors detected',
      });
    }

    return factors;
  }

  private identifyStrengths(
    supplier: { verifiedBadge: boolean; rating?: number | null; responseRate?: number | null },
    trustScore: number, shippingScore: number, qualityScore: number, pricingScore: number
  ): string[] {
    const strengths: string[] = [];
    if (trustScore > 70) strengths.push('High trust score — reliable supplier');
    if (shippingScore > 70) strengths.push('Strong shipping performance');
    if (qualityScore > 70) strengths.push('Consistent quality ratings');
    if (pricingScore > 70) strengths.push('Competitive pricing');
    if (supplier.verifiedBadge) strengths.push('Platform-verified supplier');
    if (supplier.rating && supplier.rating > 4) strengths.push(`Excellent rating: ${supplier.rating}/5`);
    if (supplier.responseRate && supplier.responseRate > 95) strengths.push('Fast response time');
    if (strengths.length === 0) strengths.push('Adequate supplier — monitoring recommended');
    return strengths;
  }

  private identifyWeaknesses(
    supplier: { verifiedBadge: boolean; rating?: number | null; responseRate?: number | null },
    trustScore: number, shippingScore: number, qualityScore: number, pricingScore: number
  ): string[] {
    const weaknesses: string[] = [];
    if (trustScore < 50) weaknesses.push('Low trust score — verify credentials');
    if (shippingScore < 50) weaknesses.push('Poor shipping performance');
    if (qualityScore < 50) weaknesses.push('Quality concerns');
    if (pricingScore < 50) weaknesses.push('Premium pricing — negotiate');
    if (!supplier.verifiedBadge) weaknesses.push('Not platform-verified');
    if (supplier.rating && supplier.rating < 3) weaknesses.push(`Below-average rating: ${supplier.rating}/5`);
    return weaknesses;
  }

  private generateRecommendations(
    supplier: { verifiedBadge: boolean },
    strengths: string[], weaknesses: string[]
  ): string[] {
    const recommendations: string[] = [];
    if (strengths.length > weaknesses.length) {
      recommendations.push('Proceed with standard due diligence');
    } else {
      recommendations.push('Conduct thorough verification before ordering');
    }
    if (!supplier.verifiedBadge) {
      recommendations.push('Request verification documents and samples');
    }
    if (weaknesses.length > 2) {
      recommendations.push('Consider backup suppliers as alternatives');
    }
    recommendations.push('Start with small test order to validate quality');
    return recommendations;
  }
}

// ─── Singleton ───

let instance: SupplierIntelligence | null = null;

export function getSupplierIntelligence(): SupplierIntelligence {
  if (!instance) instance = new SupplierIntelligence();
  return instance;
}
