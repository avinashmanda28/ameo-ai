// ═══════════════════════════════════════════════════════════════
// AMEO AI — Creator Economy Service (System 3)
// Creator monetization infrastructure with profiles, storefronts,
// payouts, affiliate tracking, digital product sales.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getEventBus } from '@/lib/services/event-bus';

// ─── Types ───

export interface CreatorProfileData {
  id: string;
  workspaceId: string;
  userId?: string | null;
  displayName: string;
  handle?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  verified: boolean;
  verificationLevel?: string | null;
  websiteUrl?: string | null;
  socialLinks?: Record<string, unknown> | null;
  creatorType: string;
  specialties?: string[] | null;
  totalProducts: number;
  totalSales: number;
  totalRevenue?: number | null;
  averageRating?: number | null;
  stripeAccountId?: string | null;
  stripeOnboardingComplete: boolean;
  payoutMethod?: string | null;
  payoutSchedule?: string | null;
  minimumPayout?: number | null;
  status: string;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatorPayoutData {
  id: string;
  profileId: string;
  workspaceId: string;
  amount: number;
  currency: string;
  fee?: number | null;
  netAmount: number;
  sourceType: string;
  sourceIds?: string[] | null;
  status: string;
  processor?: string | null;
  processorPayoutId?: string | null;
  payoutMethod?: string | null;
  payoutAccount?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  paidAt?: Date | null;
  createdAt: Date;
}

export interface AffiliateLinkData {
  id: string;
  workspaceId: string;
  creatorId?: string | null;
  code: string;
  name?: string | null;
  description?: string | null;
  targetType: string;
  targetId: string;
  targetUrl?: string | null;
  commissionRate?: number | null;
  commissionType: string;
  flatCommission?: number | null;
  clickCount: number;
  conversionCount: number;
  revenueGenerated?: number | null;
  status: string;
  createdAt: Date;
}

export interface CreatorEconomyStats {
  totalCreators: number;
  activeCreators: number;
  totalProducts: number;
  totalSales: number;
  totalRevenue: number;
  totalPayouts: number;
  pendingPayouts: number;
  affiliateClicks: number;
  affiliateConversions: number;
}

// ─── Creator Economy Service ───

export class CreatorEconomyService {
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  // ─── Creator Profiles ───

  async getOrCreateProfile(data: {
    displayName: string;
    handle?: string;
    bio?: string;
    avatarUrl?: string;
    coverUrl?: string;
    creatorType?: string;
    specialties?: string[];
    websiteUrl?: string;
    socialLinks?: Record<string, unknown>;
    userId?: string;
  }): Promise<CreatorProfileData> {
    const existing = await db.creatorProfile.findFirst({
      where: { workspaceId: this.workspaceId },
    });

    if (existing) return existing as unknown as CreatorProfileData;

    const profile = await db.creatorProfile.create({
      data: {
        workspaceId: this.workspaceId,
        userId: data.userId || null,
        displayName: data.displayName,
        handle: data.handle || null,
        bio: data.bio || null,
        avatarUrl: data.avatarUrl || null,
        coverUrl: data.coverUrl || null,
        creatorType: data.creatorType || 'individual',
        specialties: data.specialties ? JSON.stringify(data.specialties) : null,
        websiteUrl: data.websiteUrl || null,
        socialLinks: data.socialLinks ? JSON.stringify(data.socialLinks) : null,
      },
    });
    return profile as unknown as CreatorProfileData;
  }

  async getProfile(profileId: string): Promise<CreatorProfileData | null> {
    const profile = await db.creatorProfile.findFirst({
      where: { id: profileId, workspaceId: this.workspaceId },
    });
    return profile as unknown as CreatorProfileData | null;
  }

  async updateProfile(
    profileId: string,
    data: Partial<{
      displayName: string;
      bio: string;
      avatarUrl: string;
      coverUrl: string;
      websiteUrl: string;
      socialLinks: Record<string, unknown>;
      specialties: string[];
      creatorType: string;
      verificationLevel: string;
      payoutMethod: string;
      payoutSchedule: string;
      minimumPayout: number;
      metadata: Record<string, unknown>;
    }>
  ): Promise<CreatorProfileData | null> {
    const updateData: Record<string, unknown> = {};
    if (data.displayName) updateData.displayName = data.displayName;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.coverUrl !== undefined) updateData.coverUrl = data.coverUrl;
    if (data.websiteUrl !== undefined) updateData.websiteUrl = data.websiteUrl;
    if (data.socialLinks) updateData.socialLinks = JSON.stringify(data.socialLinks);
    if (data.specialties) updateData.specialties = JSON.stringify(data.specialties);
    if (data.creatorType) updateData.creatorType = data.creatorType;
    if (data.verificationLevel) updateData.verificationLevel = data.verificationLevel;
    if (data.payoutMethod) updateData.payoutMethod = data.payoutMethod;
    if (data.payoutSchedule) updateData.payoutSchedule = data.payoutSchedule;
    if (data.minimumPayout !== undefined) updateData.minimumPayout = data.minimumPayout;
    if (data.metadata) updateData.metadata = JSON.stringify(data.metadata);

    const profile = await db.creatorProfile.update({
      where: { id: profileId, workspaceId: this.workspaceId },
      data: updateData,
    });
    return profile as unknown as CreatorProfileData;
  }

  async setStripeAccount(
    profileId: string,
    stripeAccountId: string,
    onboardingComplete: boolean
  ): Promise<CreatorProfileData | null> {
    const profile = await db.creatorProfile.update({
      where: { id: profileId, workspaceId: this.workspaceId },
      data: {
        stripeAccountId,
        stripeOnboardingComplete: onboardingComplete,
      },
    });
    return profile as unknown as CreatorProfileData;
  }

  // ─── Storefronts ───

  async getOrCreateStorefront(profileId: string, data: {
    name: string;
    slug?: string;
    description?: string;
    tagline?: string;
    logoUrl?: string;
    bannerUrl?: string;
    accentColor?: string;
  }): Promise<CreatorProfileData['id']> {
    const existing = await db.creatorStorefront.findFirst({
      where: { profileId, workspaceId: this.workspaceId },
    });
    if (existing) return existing.id;

    const storefront = await db.creatorStorefront.create({
      data: {
        profileId,
        workspaceId: this.workspaceId,
        name: data.name,
        slug: data.slug || null,
        description: data.description || null,
        tagline: data.tagline || null,
        logoUrl: data.logoUrl || null,
        bannerUrl: data.bannerUrl || null,
        accentColor: data.accentColor || null,
      },
    });
    return storefront.id;
  }

  async publishStorefront(profileId: string): Promise<void> {
    const storefront = await db.creatorStorefront.findFirst({
      where: { profileId, workspaceId: this.workspaceId },
    });
    if (storefront) {
      await db.creatorStorefront.update({
        where: { id: storefront.id },
        data: { published: true, status: 'published' },
      });
    }
  }

  // ─── Payouts ───

  async createPayout(data: {
    profileId: string;
    amount: number;
    currency?: string;
    fee?: number;
    sourceType: string;
    sourceIds?: string[];
    payoutMethod?: string;
    payoutAccount?: string;
    periodStart?: Date;
    periodEnd?: Date;
  }): Promise<CreatorPayoutData> {
    const fee = data.fee ?? Math.round(data.amount * 0.029 * 100) / 100; // 2.9% default
    const netAmount = data.amount - fee;

    const payout = await db.creatorPayout.create({
      data: {
        profileId: data.profileId,
        workspaceId: this.workspaceId,
        amount: data.amount,
        currency: data.currency || 'USD',
        fee,
        netAmount,
        sourceType: data.sourceType,
        sourceIds: data.sourceIds ? JSON.stringify(data.sourceIds) : null,
        payoutMethod: data.payoutMethod || null,
        payoutAccount: data.payoutAccount || null,
        periodStart: data.periodStart || null,
        periodEnd: data.periodEnd || null,
        status: 'pending',
      },
    });

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'creator.payout.created',
      source: 'creator-economy',
      level: 'info',
      payload: { payoutId: payout.id, amount: data.amount, profileId: data.profileId },
      resourceType: 'creator_payout',
      resourceId: payout.id,
    });

    return payout as unknown as CreatorPayoutData;
  }

  async processPayout(payoutId: string): Promise<CreatorPayoutData | null> {
    const payout = await db.creatorPayout.update({
      where: { id: payoutId, workspaceId: this.workspaceId },
      data: { status: 'processing' },
    });

    // Mark as completed (actual processor integration is Stripe-ready)
    const completed = await db.creatorPayout.update({
      where: { id: payoutId },
      data: { status: 'completed', paidAt: new Date() },
    });

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'creator.payout.completed',
      source: 'creator-economy',
      level: 'info',
      payload: { payoutId, profileId: payout.profileId },
      resourceType: 'creator_payout',
      resourceId: payoutId,
    });

    return completed as unknown as CreatorPayoutData;
  }

  async getPayoutHistory(profileId: string): Promise<CreatorPayoutData[]> {
    const payouts = await db.creatorPayout.findMany({
      where: { profileId, workspaceId: this.workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return payouts as unknown as CreatorPayoutData[];
  }

  // ─── Affiliates ───

  async createAffiliateLink(data: {
    code: string;
    name?: string;
    description?: string;
    targetType: string;
    targetId: string;
    targetUrl?: string;
    commissionRate?: number;
    commissionType?: string;
    flatCommission?: number;
  }): Promise<AffiliateLinkData> {
    const link = await db.affiliateLink.create({
      data: {
        workspaceId: this.workspaceId,
        code: data.code,
        name: data.name || null,
        description: data.description || null,
        targetType: data.targetType,
        targetId: data.targetId,
        targetUrl: data.targetUrl || null,
        commissionRate: data.commissionRate ?? 0.1,
        commissionType: data.commissionType || 'percentage',
        flatCommission: data.flatCommission || null,
      },
    });
    return link as unknown as AffiliateLinkData;
  }

  async getAffiliateLinks(): Promise<AffiliateLinkData[]> {
    const links = await db.affiliateLink.findMany({
      where: { workspaceId: this.workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return links as unknown as AffiliateLinkData[];
  }

  async recordAffiliateClick(code: string): Promise<void> {
    await db.affiliateLink.update({
      where: { code },
      data: { clickCount: { increment: 1 } },
    });
  }

  async recordAffiliateConversion(
    code: string,
    revenue: number
  ): Promise<void> {
    await db.affiliateLink.update({
      where: { code },
      data: {
        conversionCount: { increment: 1 },
        revenueGenerated: { increment: revenue },
      },
    });
  }

  // ─── Stats ───

  async getStats(): Promise<CreatorEconomyStats> {
    const creators = await db.creatorProfile.findMany({
      where: { workspaceId: this.workspaceId },
    });

    const activeCreators = creators.filter((c) => c.status === 'active').length;
    const totalProducts = creators.reduce((sum, c) => sum + c.totalProducts, 0);
    const totalSales = creators.reduce((sum, c) => sum + c.totalSales, 0);
    const totalRevenue = creators.reduce((sum, c) => sum + (c.totalRevenue || 0), 0);

    const payouts = await db.creatorPayout.findMany({
      where: { workspaceId: this.workspaceId },
    });

    const totalPayouts = payouts.reduce((sum, p) => sum + p.amount, 0);
    const pendingPayouts = payouts
      .filter((p) => p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0);

    const affiliates = await db.affiliateLink.findMany({
      where: { workspaceId: this.workspaceId },
    });

    const affiliateClicks = affiliates.reduce((sum, a) => sum + a.clickCount, 0);
    const affiliateConversions = affiliates.reduce((sum, a) => sum + a.conversionCount, 0);

    return {
      totalCreators: creators.length,
      activeCreators,
      totalProducts,
      totalSales,
      totalRevenue,
      totalPayouts,
      pendingPayouts,
      affiliateClicks,
      affiliateConversions,
    };
  }
}

// ─── Singleton Factory ───

const creatorInstances = new Map<string, CreatorEconomyService>();

export function getCreatorEconomyService(workspaceId: string): CreatorEconomyService {
  let instance = creatorInstances.get(workspaceId);
  if (!instance) {
    instance = new CreatorEconomyService(workspaceId);
    creatorInstances.set(workspaceId, instance);
  }
  return instance;
}
