// ═══════════════════════════════════════════════════════════════
// AMEO AI — AI Content Operations Service (System 6)
// Large-scale content infrastructure with blog generation,
// SEO articles, versioning, approval workflows, and publishing pipelines.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getEventBus } from '@/lib/services/event-bus';

// ─── Types ───

export interface ContentArticleData {
  id: string;
  workspaceId: string;
  title: string;
  slug?: string | null;
  description?: string | null;
  content?: string | null;
  excerpt?: string | null;
  type: string;
  category?: string | null;
  tags?: string[] | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string[] | null;
  canonicalUrl?: string | null;
  featuredImageUrl?: string | null;
  authorId?: string | null;
  authorType?: string | null;
  generationPrompt?: string | null;
  aiModel?: string | null;
  wordCount?: number | null;
  status: string;
  publishedAt?: Date | null;
  publishedUrl?: string | null;
  viewCount?: number | null;
  readTime?: number | null;
  score?: number | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentVersionData {
  id: string;
  articleId: string;
  workspaceId: string;
  versionNumber: number;
  title: string;
  content?: string | null;
  description?: string | null;
  changeSummary?: string | null;
  editedBy?: string | null;
  editorType?: string | null;
  status: string;
  createdAt: Date;
}

export interface PublishingPipelineData {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  type: string;
  stages?: Record<string, unknown>[] | null;
  currentStage?: string | null;
  status: string;
  contentIds?: string[] | null;
  requiresApproval: boolean;
  autoPublish: boolean;
  autoPublishDelay?: number | null;
  scheduleType?: string | null;
  scheduledAt?: Date | null;
  lastRunAt?: Date | null;
  config?: Record<string, unknown> | null;
  createdAt: Date;
}

export interface ContentOpsStats {
  totalArticles: number;
  publishedArticles: number;
  draftArticles: number;
  totalViews: number;
  averageScore: number;
  byType: Record<string, number>;
  pipelines: number;
  versions: number;
}

// ─── Content Operations Service ───

export class ContentOperationsService {
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  // ─── Articles ───

  async listArticles(params?: {
    type?: string;
    status?: string;
    category?: string;
    search?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ articles: ContentArticleData[]; total: number }> {
    const where: Record<string, unknown> = { workspaceId: this.workspaceId };
    if (params?.type) where.type = params.type;
    if (params?.status) where.status = params.status;
    if (params?.category) where.category = params.category;
    if (params?.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (params?.tags?.length) where.tags = { hasSome: params.tags };

    const limit = params?.limit ?? 20;
    const offset = params?.offset ?? 0;

    const [articles, total] = await Promise.all([
      db.contentArticle.findMany({ where, orderBy: { updatedAt: 'desc' }, take: limit, skip: offset }),
      db.contentArticle.count({ where }),
    ]);
    return { articles: articles as unknown as ContentArticleData[], total };
  }

  async getArticle(id: string): Promise<ContentArticleData | null> {
    const article = await db.contentArticle.findFirst({
      where: { id, workspaceId: this.workspaceId },
    });
    if (article) {
      await db.contentArticle.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      });
    }
    return article as unknown as ContentArticleData | null;
  }

  async createArticle(data: {
    title: string;
    slug?: string;
    description?: string;
    content?: string;
    excerpt?: string;
    type: string;
    category?: string;
    tags?: string[];
    seoTitle?: string;
    seoDescription?: string;
    seoKeywords?: string[];
    featuredImageUrl?: string;
    authorId?: string;
    authorType?: string;
    generationPrompt?: string;
    aiModel?: string;
    score?: number;
  }): Promise<ContentArticleData> {
    const slug = data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const wordCount = data.content ? data.content.split(/\s+/).length : 0;
    const readTime = Math.ceil(wordCount / 200); // ~200 words per minute

    const article = await db.contentArticle.create({
      data: {
        workspaceId: this.workspaceId,
        title: data.title,
        slug,
        description: data.description || null,
        content: data.content || null,
        excerpt: data.excerpt || null,
        type: data.type,
        category: data.category || null,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        seoTitle: data.seoTitle || null,
        seoDescription: data.seoDescription || null,
        seoKeywords: data.seoKeywords ? JSON.stringify(data.seoKeywords) : null,
        featuredImageUrl: data.featuredImageUrl || null,
        authorId: data.authorId || null,
        authorType: data.authorType || null,
        generationPrompt: data.generationPrompt || null,
        aiModel: data.aiModel || null,
        wordCount,
        readTime,
        score: data.score || null,
      },
    });

    // Create initial version
    await db.contentVersion.create({
      data: {
        articleId: article.id,
        workspaceId: this.workspaceId,
        versionNumber: 1,
        title: data.title,
        content: data.content || null,
        description: data.description || null,
        editorType: data.authorType || 'ai',
        changeSummary: 'Initial version',
      },
    });

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'content.article.created',
      source: 'content-operations',
      level: 'info',
      payload: { articleId: article.id, title: data.title, type: data.type },
      resourceType: 'content_article',
      resourceId: article.id,
    });

    return article as unknown as ContentArticleData;
  }

  async updateArticle(
    id: string,
    data: Partial<{
      title: string;
      description: string;
      content: string;
      excerpt: string;
      category: string;
      tags: string[];
      seoTitle: string;
      seoDescription: string;
      seoKeywords: string[];
      featuredImageUrl: string;
      score: number;
      status: string;
    }>
  ): Promise<ContentArticleData | null> {
    const updateData: Record<string, unknown> = {};
    if (data.title) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.content !== undefined) {
      updateData.content = data.content;
      updateData.wordCount = data.content.split(/\s+/).length;
      updateData.readTime = Math.ceil(data.content.split(/\s+/).length / 200);
    }
    if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.tags) updateData.tags = JSON.stringify(data.tags);
    if (data.seoTitle !== undefined) updateData.seoTitle = data.seoTitle;
    if (data.seoDescription !== undefined) updateData.seoDescription = data.seoDescription;
    if (data.seoKeywords) updateData.seoKeywords = JSON.stringify(data.seoKeywords);
    if (data.featuredImageUrl !== undefined) updateData.featuredImageUrl = data.featuredImageUrl;
    if (data.score !== undefined) updateData.score = data.score;
    if (data.status) updateData.status = data.status;

    if (data.status === 'published') {
      updateData.publishedAt = new Date();
    }

    const article = await db.contentArticle.update({
      where: { id, workspaceId: this.workspaceId },
      data: { ...updateData, version: { increment: 1 } },
    });

    // Create version snapshot
    if (data.content || data.title) {
      await db.contentVersion.create({
        data: {
          articleId: id,
          workspaceId: this.workspaceId,
          versionNumber: article.version,
          title: data.title || article.title,
          content: data.content || article.content,
          description: data.description || article.description,
          editorType: 'ai',
          changeSummary: `Version ${article.version} update`,
        },
      });
    }

    return article as unknown as ContentArticleData;
  }

  async publishArticle(id: string, url?: string): Promise<ContentArticleData | null> {
    const article = await db.contentArticle.update({
      where: { id, workspaceId: this.workspaceId },
      data: { status: 'published', publishedAt: new Date(), publishedUrl: url || null },
    });

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'content.article.published',
      source: 'content-operations',
      level: 'info',
      payload: { articleId: id, title: article.title, type: article.type },
      resourceType: 'content_article',
      resourceId: id,
    });

    return article as unknown as ContentArticleData;
  }

  async archiveArticle(id: string): Promise<void> {
    await db.contentArticle.update({
      where: { id, workspaceId: this.workspaceId },
      data: { status: 'archived' },
    });
  }

  async deleteArticle(id: string): Promise<void> {
    await db.contentVersion.deleteMany({ where: { articleId: id, workspaceId: this.workspaceId } });
    await db.contentArticle.delete({ where: { id, workspaceId: this.workspaceId } });
  }

  // ─── Versions ───

  async getArticleVersions(articleId: string): Promise<ContentVersionData[]> {
    const versions = await db.contentVersion.findMany({
      where: { articleId, workspaceId: this.workspaceId },
      orderBy: { versionNumber: 'desc' },
    });
    return versions as unknown as ContentVersionData[];
  }

  async restoreVersion(articleId: string, versionNumber: number): Promise<ContentArticleData | null> {
    const version = await db.contentVersion.findUnique({
      where: { articleId_versionNumber: { articleId, versionNumber } },
    });
    if (!version) return null;

    const article = await db.contentArticle.update({
      where: { id: articleId, workspaceId: this.workspaceId },
      data: {
        title: version.title,
        content: version.content,
        description: version.description,
        version: { increment: 1 },
      },
    });
    return article as unknown as ContentArticleData;
  }

  // ─── Publishing Pipelines ───

  async listPipelines(): Promise<PublishingPipelineData[]> {
    const pipelines = await db.publishingPipeline.findMany({
      where: { workspaceId: this.workspaceId },
      orderBy: { updatedAt: 'desc' },
    });
    return pipelines as unknown as PublishingPipelineData[];
  }

  async createPipeline(data: {
    name: string;
    type: string;
    description?: string;
    stages?: Record<string, unknown>[];
    requiresApproval?: boolean;
    autoPublish?: boolean;
    autoPublishDelay?: number;
    scheduleType?: string;
    config?: Record<string, unknown>;
  }): Promise<PublishingPipelineData> {
    const pipeline = await db.publishingPipeline.create({
      data: {
        workspaceId: this.workspaceId,
        name: data.name,
        type: data.type,
        description: data.description || null,
        stages: data.stages ? JSON.stringify(data.stages) : null,
        requiresApproval: data.requiresApproval ?? false,
        autoPublish: data.autoPublish ?? false,
        autoPublishDelay: data.autoPublishDelay || null,
        scheduleType: data.scheduleType || 'manual',
        config: data.config ? JSON.stringify(data.config) : null,
      },
    });
    return pipeline as unknown as PublishingPipelineData;
  }

  async runPipeline(id: string, contentIds: string[]): Promise<PublishingPipelineData | null> {
    const pipeline = await db.publishingPipeline.update({
      where: { id, workspaceId: this.workspaceId },
      data: {
        status: 'running',
        contentIds: JSON.stringify(contentIds),
        currentStage: 'starting',
        lastRunAt: new Date(),
      },
    });
    return pipeline as unknown as PublishingPipelineData;
  }

  // ─── Stats ───

  async getStats(): Promise<ContentOpsStats> {
    const articles = await db.contentArticle.findMany({
      where: { workspaceId: this.workspaceId },
    });

    const published = articles.filter((a) => a.status === 'published').length;
    const drafts = articles.filter((a) => a.status === 'draft').length;
    const totalViews = articles.reduce((s, a) => s + (a.viewCount || 0), 0);
    const scored = articles.filter((a) => a.score);
    const averageScore =
      scored.length > 0
        ? scored.reduce((s, a) => s + (a.score || 0), 0) / scored.length
        : 0;

    const byType: Record<string, number> = {};
    for (const a of articles) {
      byType[a.type] = (byType[a.type] || 0) + 1;
    }

    const pipelines = await db.publishingPipeline.count({ where: { workspaceId: this.workspaceId } });
    const versions = await db.contentVersion.count({ where: { workspaceId: this.workspaceId } });

    return {
      totalArticles: articles.length,
      publishedArticles: published,
      draftArticles: drafts,
      totalViews,
      averageScore: Math.round(averageScore * 10) / 10,
      byType,
      pipelines,
      versions,
    };
  }
}

// ─── Singleton Factory ───

const contentOpsInstances = new Map<string, ContentOperationsService>();

export function getContentOperationsService(workspaceId: string): ContentOperationsService {
  let instance = contentOpsInstances.get(workspaceId);
  if (!instance) {
    instance = new ContentOperationsService(workspaceId);
    contentOpsInstances.set(workspaceId, instance);
  }
  return instance;
}
