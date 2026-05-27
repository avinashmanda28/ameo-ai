// ═══════════════════════════════════════════════════════════════
// AMEO AI — AGI Marketplace Service (System 1)
// Complete marketplace ecosystem for AI agents, templates, workflows,
// packs, and operational tools with ratings, pricing, and versions.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getEventBus } from '@/lib/services/event-bus';

// ─── Types ───

export interface MarketplaceListingData {
  id: string;
  workspaceId: string;
  creatorId?: string | null;
  name: string;
  description?: string | null;
  shortDescription?: string | null;
  category: string;
  type: string;
  price?: number | null;
  currency: string;
  salePrice?: number | null;
  revenueShare?: number | null;
  iconUrl?: string | null;
  imageUrls?: string[] | null;
  demoUrl?: string | null;
  documentationUrl?: string | null;
  contentId?: string | null;
  contentType?: string | null;
  contentData?: string | null;
  version: string;
  latestVersion: string;
  changelog?: string | null;
  status: string;
  featured: boolean;
  verified: boolean;
  downloadCount: number;
  viewCount: number;
  averageRating?: number | null;
  reviewCount: number;
  tags?: string[] | null;
  requirements?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date | null;
}

export interface MarketplaceReviewData {
  id: string;
  listingId: string;
  workspaceId: string;
  userId?: string | null;
  rating: number;
  title?: string | null;
  content?: string | null;
  pros?: string[] | null;
  cons?: string[] | null;
  verified: boolean;
  helpfulCount: number;
  status: string;
  createdAt: Date;
}

export interface MarketplaceCreatorData {
  id: string;
  workspaceId: string;
  name: string;
  handle?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  websiteUrl?: string | null;
  verified: boolean;
  verificationType?: string | null;
  totalListings: number;
  totalDownloads: number;
  averageRating?: number | null;
  totalRevenue?: number | null;
  payoutMethod?: string | null;
  payoutAccount?: string | null;
  payoutEmail?: string | null;
  status: string;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketplaceStats {
  totalListings: number;
  publishedListings: number;
  totalDownloads: number;
  totalReviews: number;
  averageRating: number;
  featuredCount: number;
  byCategory: Record<string, number>;
  topListings: MarketplaceListingData[];
}

// ─── Marketplace Service ───

export class MarketplaceService {
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  // ─── Listings CRUD ───

  async listListings(params?: {
    category?: string;
    type?: string;
    status?: string;
    featured?: boolean;
    verified?: boolean;
    search?: string;
    tags?: string[];
    sortBy?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ listings: MarketplaceListingData[]; total: number }> {
    const where: Record<string, unknown> = { workspaceId: this.workspaceId };

    if (params?.category) where.category = params.category;
    if (params?.type) where.type = params.type;
    if (params?.status) where.status = params.status;
    if (params?.featured !== undefined) where.featured = params.featured;
    if (params?.verified !== undefined) where.verified = params.verified;
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (params?.tags?.length) {
      where.tags = { hasSome: params.tags };
    }

    const orderBy: Record<string, string> = {};
    if (params?.sortBy === 'downloads') orderBy.downloadCount = 'desc';
    else if (params?.sortBy === 'rating') orderBy.averageRating = 'desc';
    else if (params?.sortBy === 'price') orderBy.price = 'asc';
    else if (params?.sortBy === 'newest') orderBy.createdAt = 'desc';
    else orderBy.createdAt = 'desc';

    const limit = params?.limit ?? 20;
    const offset = params?.offset ?? 0;

    const [listings, total] = await Promise.all([
      db.marketplaceListing.findMany({ where, orderBy, take: limit, skip: offset }),
      db.marketplaceListing.count({ where }),
    ]);

    return { listings: listings as unknown as MarketplaceListingData[], total };
  }

  async getListing(id: string): Promise<MarketplaceListingData | null> {
    const listing = await db.marketplaceListing.findFirst({
      where: { id, workspaceId: this.workspaceId },
    });
    if (!listing) return null;

    // Increment view count
    await db.marketplaceListing.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    return listing as unknown as MarketplaceListingData;
  }

  async createListing(data: {
    name: string;
    category: string;
    type: string;
    description?: string;
    shortDescription?: string;
    price?: number;
    currency?: string;
    salePrice?: number;
    revenueShare?: number;
    iconUrl?: string;
    imageUrls?: string[];
    demoUrl?: string;
    documentationUrl?: string;
    contentId?: string;
    contentType?: string;
    contentData?: string;
    tags?: string[];
    requirements?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    creatorId?: string;
  }): Promise<MarketplaceListingData> {
    const listing = await db.marketplaceListing.create({
      data: {
        workspaceId: this.workspaceId,
        creatorId: data.creatorId || null,
        name: data.name,
        description: data.description || null,
        shortDescription: data.shortDescription || null,
        category: data.category,
        type: data.type,
        price: data.price ?? 0,
        currency: data.currency || 'USD',
        salePrice: data.salePrice || null,
        revenueShare: data.revenueShare ?? 0.8,
        iconUrl: data.iconUrl || null,
        imageUrls: data.imageUrls ? JSON.stringify(data.imageUrls) : null,
        demoUrl: data.demoUrl || null,
        documentationUrl: data.documentationUrl || null,
        contentId: data.contentId || null,
        contentType: data.contentType || null,
        contentData: data.contentData || null,
        version: '1.0.0',
        latestVersion: '1.0.0',
        tags: data.tags ? JSON.stringify(data.tags) : null,
        requirements: data.requirements ? JSON.stringify(data.requirements) : null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        status: 'draft',
      },
    });

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'marketplace.listing.created',
      source: 'marketplace',
      level: 'info',
      payload: { listingId: listing.id, name: data.name, category: data.category },
      resourceType: 'marketplace_listing',
      resourceId: listing.id,
    });

    return listing as unknown as MarketplaceListingData;
  }

  async updateListing(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      shortDescription: string;
      category: string;
      type: string;
      price: number;
      currency: string;
      salePrice: number;
      iconUrl: string;
      imageUrls: string[];
      demoUrl: string;
      documentationUrl: string;
      tags: string[];
      requirements: Record<string, unknown>;
      metadata: Record<string, unknown>;
      featured: boolean;
      verified: boolean;
    }>
  ): Promise<MarketplaceListingData | null> {
    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.shortDescription !== undefined) updateData.shortDescription = data.shortDescription;
    if (data.category) updateData.category = data.category;
    if (data.type) updateData.type = data.type;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.currency) updateData.currency = data.currency;
    if (data.salePrice !== undefined) updateData.salePrice = data.salePrice;
    if (data.iconUrl !== undefined) updateData.iconUrl = data.iconUrl;
    if (data.imageUrls) updateData.imageUrls = JSON.stringify(data.imageUrls);
    if (data.demoUrl !== undefined) updateData.demoUrl = data.demoUrl;
    if (data.documentationUrl !== undefined) updateData.documentationUrl = data.documentationUrl;
    if (data.tags) updateData.tags = JSON.stringify(data.tags);
    if (data.requirements) updateData.requirements = JSON.stringify(data.requirements);
    if (data.metadata) updateData.metadata = JSON.stringify(data.metadata);
    if (data.featured !== undefined) updateData.featured = data.featured;
    if (data.verified !== undefined) updateData.verified = data.verified;

    const listing = await db.marketplaceListing.update({
      where: { id, workspaceId: this.workspaceId },
      data: updateData,
    });
    return listing as unknown as MarketplaceListingData;
  }

  async publishListing(id: string): Promise<MarketplaceListingData | null> {
    const listing = await db.marketplaceListing.update({
      where: { id, workspaceId: this.workspaceId },
      data: { status: 'published', publishedAt: new Date() },
    });

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'marketplace.listing.published',
      source: 'marketplace',
      level: 'info',
      payload: { listingId: id, name: listing.name },
      resourceType: 'marketplace_listing',
      resourceId: id,
    });

    return listing as unknown as MarketplaceListingData;
  }

  async archiveListing(id: string): Promise<void> {
    await db.marketplaceListing.update({
      where: { id, workspaceId: this.workspaceId },
      data: { status: 'archived' },
    });
  }

  async deleteListing(id: string): Promise<void> {
    await db.marketplaceListing.delete({
      where: { id, workspaceId: this.workspaceId },
    });
  }

  // ─── Version Management ───

  async publishVersion(
    id: string,
    version: string,
    data: { changelog?: string; contentData?: string }
  ): Promise<MarketplaceListingData | null> {
    const listing = await db.marketplaceListing.update({
      where: { id, workspaceId: this.workspaceId },
      data: {
        version,
        latestVersion: version,
        changelog: data.changelog || null,
        contentData: data.contentData || undefined,
        status: 'published',
      },
    });
    return listing as unknown as MarketplaceListingData;
  }

  // ─── Reviews ───

  async getReviews(listingId: string): Promise<MarketplaceReviewData[]> {
    const reviews = await db.marketplaceReview.findMany({
      where: { listingId, workspaceId: this.workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return reviews as unknown as MarketplaceReviewData[];
  }

  async createReview(data: {
    listingId: string;
    rating: number;
    title?: string;
    content?: string;
    pros?: string[];
    cons?: string[];
    userId?: string;
  }): Promise<MarketplaceReviewData> {
    const review = await db.marketplaceReview.create({
      data: {
        listingId: data.listingId,
        workspaceId: this.workspaceId,
        userId: data.userId || null,
        rating: data.rating,
        title: data.title || null,
        content: data.content || null,
        pros: data.pros ? JSON.stringify(data.pros) : null,
        cons: data.cons ? JSON.stringify(data.cons) : null,
      },
    });

    // Update listing average rating
    const allReviews = await db.marketplaceReview.findMany({
      where: { listingId: data.listingId, status: 'published' },
    });
    const avgRating =
      allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        : data.rating;

    await db.marketplaceListing.update({
      where: { id: data.listingId },
      data: {
        averageRating: avgRating,
        reviewCount: allReviews.length,
      },
    });

    return review as unknown as MarketplaceReviewData;
  }

  // ─── Downloads ───

  async recordDownload(listingId: string, version?: string): Promise<void> {
    await db.marketplaceDownload.create({
      data: {
        listingId,
        workspaceId: this.workspaceId,
        version: version || '1.0.0',
      },
    });

    await db.marketplaceListing.update({
      where: { id: listingId },
      data: { downloadCount: { increment: 1 } },
    });
  }

  // ─── Creator Management ───

  async getOrCreateCreator(data: {
    name: string;
    handle?: string;
    bio?: string;
    avatarUrl?: string;
    websiteUrl?: string;
  }): Promise<MarketplaceCreatorData> {
    const existing = await db.marketplaceCreator.findFirst({
      where: { workspaceId: this.workspaceId },
    });

    if (existing) {
      return existing as unknown as MarketplaceCreatorData;
    }

    const creator = await db.marketplaceCreator.create({
      data: {
        workspaceId: this.workspaceId,
        name: data.name,
        handle: data.handle || null,
        bio: data.bio || null,
        avatarUrl: data.avatarUrl || null,
        websiteUrl: data.websiteUrl || null,
      },
    });
    return creator as unknown as MarketplaceCreatorData;
  }

  async getCreator(creatorId: string): Promise<MarketplaceCreatorData | null> {
    const creator = await db.marketplaceCreator.findFirst({
      where: { id: creatorId, workspaceId: this.workspaceId },
    });
    return creator as unknown as MarketplaceCreatorData | null;
  }

  async getCreatorListings(creatorId: string): Promise<MarketplaceListingData[]> {
    const listings = await db.marketplaceListing.findMany({
      where: { creatorId, workspaceId: this.workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return listings as unknown as MarketplaceListingData[];
  }

  // ─── Stats ───

  async getStats(): Promise<MarketplaceStats> {
    const listings = await db.marketplaceListing.findMany({
      where: { workspaceId: this.workspaceId },
    });

    const published = listings.filter((l) => l.status === 'published');
    const byCategory: Record<string, number> = {};

    for (const l of listings) {
      byCategory[l.category] = (byCategory[l.category] || 0) + 1;
    }

    const totalDownloads = listings.reduce((sum, l) => sum + l.downloadCount, 0);
    const avgRating =
      published.length > 0
        ? published.reduce((sum, l) => sum + (l.averageRating || 0), 0) / published.length
        : 0;

    const topListings = [...listings]
      .sort((a, b) => b.downloadCount - a.downloadCount)
      .slice(0, 10) as unknown as MarketplaceListingData[];

    return {
      totalListings: listings.length,
      publishedListings: published.length,
      totalDownloads,
      totalReviews: listings.reduce((sum, l) => sum + l.reviewCount, 0),
      averageRating: Math.round(avgRating * 10) / 10,
      featuredCount: listings.filter((l) => l.featured).length,
      byCategory,
      topListings,
    };
  }
}

// ─── Singleton Factory ───

const marketplaceInstances = new Map<string, MarketplaceService>();

export function getMarketplaceService(workspaceId: string): MarketplaceService {
  let instance = marketplaceInstances.get(workspaceId);
  if (!instance) {
    instance = new MarketplaceService(workspaceId);
    marketplaceInstances.set(workspaceId, instance);
  }
  return instance;
}
