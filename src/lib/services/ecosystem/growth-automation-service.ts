// ═══════════════════════════════════════════════════════════════
// AMEO AI — Growth Automation Engine (System 5)
// Automated growth systems with campaign orchestration,
// email automation, content scheduling, and trend-triggered campaigns.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getEventBus } from '@/lib/services/event-bus';

// ─── Types ───

export interface GrowthCampaignData {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  type: string;
  channels?: string[] | null;
  status: string;
  startDate?: Date | null;
  endDate?: Date | null;
  timezone: string;
  triggerType?: string | null;
  triggerConfig?: Record<string, unknown> | null;
  budget?: number | null;
  dailyBudget?: number | null;
  currency: string;
  impressions?: number | null;
  clicks?: number | null;
  conversions?: number | null;
  revenue?: number | null;
  spend?: number | null;
  roi?: number | null;
  autoOptimize: boolean;
  optimizationRules?: Record<string, unknown> | null;
  config?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailTemplateData {
  id: string;
  workspaceId: string;
  name: string;
  subject: string;
  previewText?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  category?: string | null;
  variables?: string[] | null;
  sendCount: number;
  openRate?: number | null;
  clickRate?: number | null;
  bounceRate?: number | null;
  status: string;
  createdAt: Date;
}

export interface ContentScheduleData {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  contentId: string;
  contentType: string;
  scheduledAt: Date;
  publishedAt?: Date | null;
  timezone: string;
  recurrence?: string | null;
  cronExpression?: string | null;
  channels?: string[] | null;
  status: string;
  createdAt: Date;
}

export interface GrowthAutomationStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  averageRoi: number;
  emailTemplates: number;
  scheduledItems: number;
}

// ─── Growth Automation Service ───

export class GrowthAutomationService {
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  // ─── Campaigns ───

  async listCampaigns(params?: {
    type?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ campaigns: GrowthCampaignData[]; total: number }> {
    const where: Record<string, unknown> = { workspaceId: this.workspaceId };
    if (params?.type) where.type = params.type;
    if (params?.status) where.status = params.status;
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const limit = params?.limit ?? 20;
    const offset = params?.offset ?? 0;

    const [campaigns, total] = await Promise.all([
      db.growthCampaign.findMany({ where, orderBy: { updatedAt: 'desc' }, take: limit, skip: offset }),
      db.growthCampaign.count({ where }),
    ]);
    return { campaigns: campaigns as unknown as GrowthCampaignData[], total };
  }

  async getCampaign(id: string): Promise<GrowthCampaignData | null> {
    const campaign = await db.growthCampaign.findFirst({
      where: { id, workspaceId: this.workspaceId },
    });
    return campaign as unknown as GrowthCampaignData | null;
  }

  async createCampaign(data: {
    name: string;
    type: string;
    description?: string;
    channels?: string[];
    triggerType?: string;
    triggerConfig?: Record<string, unknown>;
    startDate?: Date;
    endDate?: Date;
    budget?: number;
    dailyBudget?: number;
    targetAudience?: Record<string, unknown>;
    config?: Record<string, unknown>;
  }): Promise<GrowthCampaignData> {
    const campaign = await db.growthCampaign.create({
      data: {
        workspaceId: this.workspaceId,
        name: data.name,
        type: data.type,
        description: data.description || null,
        channels: data.channels ? JSON.stringify(data.channels) : null,
        triggerType: data.triggerType || null,
        triggerConfig: data.triggerConfig ? JSON.stringify(data.triggerConfig) : null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        budget: data.budget ?? 0,
        dailyBudget: data.dailyBudget || null,
        config: data.config ? JSON.stringify(data.config) : null,
      },
    });

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'growth.campaign.created',
      source: 'growth-automation',
      level: 'info',
      payload: { campaignId: campaign.id, name: data.name, type: data.type },
      resourceType: 'growth_campaign',
      resourceId: campaign.id,
    });

    return campaign as unknown as GrowthCampaignData;
  }

  async updateCampaign(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      type: string;
      channels: string[];
      status: string;
      triggerType: string;
      triggerConfig: Record<string, unknown>;
      startDate: Date;
      endDate: Date;
      budget: number;
      dailyBudget: number;
      targetAudience: Record<string, unknown>;
      config: Record<string, unknown>;
      autoOptimize: boolean;
    }>
  ): Promise<GrowthCampaignData | null> {
    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type) updateData.type = data.type;
    if (data.channels) updateData.channels = JSON.stringify(data.channels);
    if (data.status) updateData.status = data.status;
    if (data.triggerType) updateData.triggerType = data.triggerType;
    if (data.triggerConfig) updateData.triggerConfig = JSON.stringify(data.triggerConfig);
    if (data.startDate) updateData.startDate = data.startDate;
    if (data.endDate) updateData.endDate = data.endDate;
    if (data.budget !== undefined) updateData.budget = data.budget;
    if (data.dailyBudget !== undefined) updateData.dailyBudget = data.dailyBudget;
    if (data.autoOptimize !== undefined) updateData.autoOptimize = data.autoOptimize;
    if (data.config) updateData.config = JSON.stringify(data.config);

    const campaign = await db.growthCampaign.update({
      where: { id, workspaceId: this.workspaceId },
      data: updateData,
    });
    return campaign as unknown as GrowthCampaignData;
  }

  async launchCampaign(id: string): Promise<GrowthCampaignData | null> {
    const campaign = await db.growthCampaign.update({
      where: { id, workspaceId: this.workspaceId },
      data: { status: 'active', startDate: new Date() },
    });

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'growth.campaign.launched',
      source: 'growth-automation',
      level: 'info',
      payload: { campaignId: id, name: campaign.name },
      resourceType: 'growth_campaign',
      resourceId: id,
    });

    return campaign as unknown as GrowthCampaignData;
  }

  async pauseCampaign(id: string): Promise<GrowthCampaignData | null> {
    const campaign = await db.growthCampaign.update({
      where: { id, workspaceId: this.workspaceId },
      data: { status: 'paused' },
    });
    return campaign as unknown as GrowthCampaignData;
  }

  async completeCampaign(id: string): Promise<GrowthCampaignData | null> {
    const campaign = await db.growthCampaign.update({
      where: { id, workspaceId: this.workspaceId },
      data: { status: 'completed', endDate: new Date() },
    });
    return campaign as unknown as GrowthCampaignData;
  }

  async archiveCampaign(id: string): Promise<void> {
    await db.growthCampaign.update({
      where: { id, workspaceId: this.workspaceId },
      data: { status: 'archived' },
    });
  }

  async deleteCampaign(id: string): Promise<void> {
    await db.growthCampaign.delete({ where: { id, workspaceId: this.workspaceId } });
  }

  // ─── Email Templates ───

  async listEmailTemplates(): Promise<EmailTemplateData[]> {
    const templates = await db.emailTemplate.findMany({
      where: { workspaceId: this.workspaceId },
      orderBy: { updatedAt: 'desc' },
    });
    return templates as unknown as EmailTemplateData[];
  }

  async createEmailTemplate(data: {
    name: string;
    subject: string;
    previewText?: string;
    bodyHtml?: string;
    bodyText?: string;
    category?: string;
    variables?: string[];
  }): Promise<EmailTemplateData> {
    const template = await db.emailTemplate.create({
      data: {
        workspaceId: this.workspaceId,
        name: data.name,
        subject: data.subject,
        previewText: data.previewText || null,
        bodyHtml: data.bodyHtml || null,
        bodyText: data.bodyText || null,
        category: data.category || null,
        variables: data.variables ? JSON.stringify(data.variables) : null,
      },
    });
    return template as unknown as EmailTemplateData;
  }

  async updateEmailTemplate(
    id: string,
    data: Partial<{
      name: string;
      subject: string;
      previewText: string;
      bodyHtml: string;
      bodyText: string;
      category: string;
      variables: string[];
      status: string;
    }>
  ): Promise<EmailTemplateData | null> {
    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.subject) updateData.subject = data.subject;
    if (data.previewText !== undefined) updateData.previewText = data.previewText;
    if (data.bodyHtml !== undefined) updateData.bodyHtml = data.bodyHtml;
    if (data.bodyText !== undefined) updateData.bodyText = data.bodyText;
    if (data.category) updateData.category = data.category;
    if (data.variables) updateData.variables = JSON.stringify(data.variables);
    if (data.status) updateData.status = data.status;

    const template = await db.emailTemplate.update({
      where: { id, workspaceId: this.workspaceId },
      data: updateData,
    });
    return template as unknown as EmailTemplateData;
  }

  async deleteEmailTemplate(id: string): Promise<void> {
    await db.emailTemplate.delete({ where: { id, workspaceId: this.workspaceId } });
  }

  // ─── Content Scheduling ───

  async listScheduledItems(params?: {
    status?: string;
    contentType?: string;
    limit?: number;
  }): Promise<ContentScheduleData[]> {
    const where: Record<string, unknown> = { workspaceId: this.workspaceId };
    if (params?.status) where.status = params.status;
    if (params?.contentType) where.contentType = params.contentType;

    const items = await db.contentSchedule.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      take: params?.limit ?? 50,
    });
    return items as unknown as ContentScheduleData[];
  }

  async scheduleContent(data: {
    name: string;
    description?: string;
    contentId: string;
    contentType: string;
    scheduledAt: Date;
    timezone?: string;
    recurrence?: string;
    cronExpression?: string;
    channels?: string[];
  }): Promise<ContentScheduleData> {
    const item = await db.contentSchedule.create({
      data: {
        workspaceId: this.workspaceId,
        name: data.name,
        description: data.description || null,
        contentId: data.contentId,
        contentType: data.contentType,
        scheduledAt: data.scheduledAt,
        timezone: data.timezone || 'UTC',
        recurrence: data.recurrence || null,
        cronExpression: data.cronExpression || null,
        channels: data.channels ? JSON.stringify(data.channels) : null,
      },
    });
    return item as unknown as ContentScheduleData;
  }

  async cancelSchedule(id: string): Promise<void> {
    await db.contentSchedule.update({
      where: { id, workspaceId: this.workspaceId },
      data: { status: 'cancelled' },
    });
  }

  async markPublished(id: string): Promise<void> {
    await db.contentSchedule.update({
      where: { id, workspaceId: this.workspaceId },
      data: { status: 'published', publishedAt: new Date() },
    });
  }

  // ─── Stats ───

  async getStats(): Promise<GrowthAutomationStats> {
    const campaigns = await db.growthCampaign.findMany({
      where: { workspaceId: this.workspaceId },
    });

    const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;
    const totalImpressions = campaigns.reduce((s, c) => s + (c.impressions || 0), 0);
    const totalClicks = campaigns.reduce((s, c) => s + (c.clicks || 0), 0);
    const totalConversions = campaigns.reduce((s, c) => s + (c.conversions || 0), 0);
    const totalRevenue = campaigns.reduce((s, c) => s + (c.revenue || 0), 0);
    const campaignsWithRoi = campaigns.filter((c) => c.roi);
    const averageRoi =
      campaignsWithRoi.length > 0
        ? campaignsWithRoi.reduce((s, c) => s + (c.roi || 0), 0) / campaignsWithRoi.length
        : 0;

    const emailTemplates = await db.emailTemplate.count({ where: { workspaceId: this.workspaceId } });
    const scheduledItems = await db.contentSchedule.count({
      where: { workspaceId: this.workspaceId, status: 'scheduled' },
    });

    return {
      totalCampaigns: campaigns.length,
      activeCampaigns,
      totalImpressions,
      totalClicks,
      totalConversions,
      totalRevenue,
      averageRoi: Math.round(averageRoi * 100) / 100,
      emailTemplates,
      scheduledItems,
    };
  }
}

// ─── Singleton Factory ───

const growthInstances = new Map<string, GrowthAutomationService>();

export function getGrowthAutomationService(workspaceId: string): GrowthAutomationService {
  let instance = growthInstances.get(workspaceId);
  if (!instance) {
    instance = new GrowthAutomationService(workspaceId);
    growthInstances.set(workspaceId, instance);
  }
  return instance;
}
