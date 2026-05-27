// ═══════════════════════════════════════════════════════════════
// AMEO AI — AGI Business Copilot Service (System 4)
// Conversational commerce assistant with memory-aware reasoning,
// recommendations, and execution integration.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getEventBus } from '@/lib/services/event-bus';

// ─── Types ───

export interface CopilotMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export interface CopilotConversationData {
  id: string;
  workspaceId: string;
  userId?: string | null;
  title?: string | null;
  topic?: string | null;
  contextIds?: string[] | null;
  metadata?: Record<string, unknown> | null;
  messages: CopilotMessage[];
  status: string;
  messageCount: number;
  tokenCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date | null;
}

export interface CopilotRecommendationData {
  id: string;
  conversationId: string;
  workspaceId: string;
  type: string;
  title: string;
  description?: string | null;
  confidence?: number | null;
  reasoning?: string | null;
  dataPoints?: Record<string, unknown> | null;
  alternatives?: unknown[] | null;
  actionType?: string | null;
  actionPayload?: Record<string, unknown> | null;
  executed: boolean;
  executedAt?: Date | null;
  executionResult?: string | null;
  feedbackRating?: number | null;
  feedbackComment?: string | null;
  applied: boolean;
  createdAt: Date;
}

export interface BusinessCopilotStats {
  totalConversations: number;
  activeConversations: number;
  totalMessages: number;
  totalRecommendations: number;
  appliedRecommendations: number;
  averageFeedback: number;
  byTopic: Record<string, number>;
}

// ─── Business Copilot Service ───

export class BusinessCopilotService {
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  // ─── Conversations ───

  async listConversations(params?: {
    status?: string;
    topic?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ conversations: CopilotConversationData[]; total: number }> {
    const where: Record<string, unknown> = { workspaceId: this.workspaceId };
    if (params?.status) where.status = params.status;
    if (params?.topic) where.topic = params.topic;

    const limit = params?.limit ?? 20;
    const offset = params?.offset ?? 0;

    const [conversations, total] = await Promise.all([
      db.copilotConversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.copilotConversation.count({ where }),
    ]);
    return { conversations: conversations as unknown as CopilotConversationData[], total };
  }

  async getConversation(id: string): Promise<CopilotConversationData | null> {
    const conversation = await db.copilotConversation.findFirst({
      where: { id, workspaceId: this.workspaceId },
    });
    return conversation as unknown as CopilotConversationData | null;
  }

  async createConversation(data: {
    title?: string;
    topic?: string;
    contextIds?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<CopilotConversationData> {
    const conversation = await db.copilotConversation.create({
      data: {
        workspaceId: this.workspaceId,
        title: data.title || null,
        topic: data.topic || null,
        contextIds: data.contextIds ? JSON.stringify(data.contextIds) : null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        messages: '[]',
      },
    });

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'copilot.conversation.created',
      source: 'business-copilot',
      level: 'info',
      payload: { conversationId: conversation.id, topic: data.topic },
      resourceType: 'copilot_conversation',
      resourceId: conversation.id,
    });

    return conversation as unknown as CopilotConversationData;
  }

  async addMessage(
    conversationId: string,
    message: CopilotMessage
  ): Promise<CopilotConversationData | null> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) return null;

    const messages = conversation.messages || [];
    messages.push({
      ...message,
      timestamp: new Date().toISOString(),
    });

    const tokenCount = (conversation.tokenCount || 0) + message.content.length;

    const updated = await db.copilotConversation.update({
      where: { id: conversationId },
      data: {
        messages: JSON.stringify(messages),
        messageCount: { increment: 1 },
        tokenCount,
        status: 'active',
        lastMessageAt: new Date(),
      },
    });

    return updated as unknown as CopilotConversationData;
  }

  async archiveConversation(id: string): Promise<void> {
    await db.copilotConversation.update({
      where: { id, workspaceId: this.workspaceId },
      data: { status: 'archived' },
    });
  }

  async deleteConversation(id: string): Promise<void> {
    await db.copilotRecommendation.deleteMany({
      where: { conversationId: id, workspaceId: this.workspaceId },
    });
    await db.copilotConversation.delete({
      where: { id, workspaceId: this.workspaceId },
    });
  }

  // ─── System Prompts & Context ───

  getSystemPrompt(): string {
    return `You are Ameo AI's Business Copilot — an expert AGI commerce assistant.
Your role is to help users build and scale AI-powered commerce businesses.

Capabilities:
- Business planning and strategy
- Product research and recommendations
- Supplier evaluation and sourcing
- Trend analysis and timing
- Operational optimization
- Pricing and margin analysis
- Scaling guidance
- Automation planning
- Revenue intelligence

Guidelines:
- Always base recommendations on data from the workspace
- Cite specific products, trends, or suppliers when relevant
- Provide actionable steps, not just analysis
- Be concise and operational
- Offer to execute actions when appropriate`;
  }

  async getWorkspaceContext(): Promise<Record<string, unknown>> {
    const [productCount, trendCount, supplierCount, storeCount, orderCount] = await Promise.all([
      db.product.count({ where: { workspaceId: this.workspaceId } }),
      db.trend.count({ where: { workspaceId: this.workspaceId } }),
      db.supplier.count({ where: { workspaceId: this.workspaceId } }),
      db.store.count({ where: { workspaceId: this.workspaceId } }),
      db.order.count({ where: { workspaceId: this.workspaceId } }),
    ]);

    return {
      workspaceId: this.workspaceId,
      products: productCount,
      trends: trendCount,
      suppliers: supplierCount,
      stores: storeCount,
      orders: orderCount,
    };
  }

  // ─── Recommendations ───

  async createRecommendation(data: {
    conversationId: string;
    type: string;
    title: string;
    description?: string;
    confidence?: number;
    reasoning?: string;
    dataPoints?: Record<string, unknown>;
    alternatives?: unknown[];
    actionType?: string;
    actionPayload?: Record<string, unknown>;
  }): Promise<CopilotRecommendationData> {
    const recommendation = await db.copilotRecommendation.create({
      data: {
        conversationId: data.conversationId,
        workspaceId: this.workspaceId,
        type: data.type,
        title: data.title,
        description: data.description || null,
        confidence: data.confidence ?? null,
        reasoning: data.reasoning || null,
        dataPoints: data.dataPoints ? JSON.stringify(data.dataPoints) : null,
        alternatives: data.alternatives ? JSON.stringify(data.alternatives) : null,
        actionType: data.actionType || null,
        actionPayload: data.actionPayload ? JSON.stringify(data.actionPayload) : null,
      },
    });

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'copilot.recommendation.created',
      source: 'business-copilot',
      level: 'info',
      payload: {
        recommendationId: recommendation.id,
        type: data.type,
        title: data.title,
        confidence: data.confidence,
      },
      resourceType: 'copilot_recommendation',
      resourceId: recommendation.id,
    });

    return recommendation as unknown as CopilotRecommendationData;
  }

  async getRecommendations(conversationId: string): Promise<CopilotRecommendationData[]> {
    const recommendations = await db.copilotRecommendation.findMany({
      where: { conversationId, workspaceId: this.workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return recommendations as unknown as CopilotRecommendationData[];
  }

  async executeRecommendation(id: string): Promise<CopilotRecommendationData | null> {
    const recommendation = await db.copilotRecommendation.update({
      where: { id, workspaceId: this.workspaceId },
      data: { executed: true, executedAt: new Date(), executionResult: 'pending' },
    });
    return recommendation as unknown as CopilotRecommendationData;
  }

  async recordRecommendationFeedback(data: {
    recommendationId: string;
    rating: number;
    comment?: string;
    applied?: boolean;
  }): Promise<CopilotRecommendationData | null> {
    const recommendation = await db.copilotRecommendation.update({
      where: { id: data.recommendationId, workspaceId: this.workspaceId },
      data: {
        feedbackRating: data.rating,
        feedbackComment: data.comment || null,
        applied: data.applied ?? false,
      },
    });
    return recommendation as unknown as CopilotRecommendationData;
  }

  // ─── Stats ───

  async getStats(): Promise<BusinessCopilotStats> {
    const conversations = await db.copilotConversation.findMany({
      where: { workspaceId: this.workspaceId },
    });

    const activeConversations = conversations.filter((c) => c.status === 'active').length;
    const totalMessages = conversations.reduce((sum, c) => sum + c.messageCount, 0);

    const byTopic: Record<string, number> = {};
    for (const c of conversations) {
      if (c.topic) byTopic[c.topic] = (byTopic[c.topic] || 0) + 1;
    }

    const recommendations = await db.copilotRecommendation.findMany({
      where: { workspaceId: this.workspaceId },
    });

    const totalRecs = recommendations.length;
    const appliedRecs = recommendations.filter((r) => r.applied).length;
    const avgFeedback =
      recommendations.filter((r) => r.feedbackRating).length > 0
        ? recommendations
            .filter((r) => r.feedbackRating)
            .reduce((sum, r) => sum + (r.feedbackRating || 0), 0) /
          recommendations.filter((r) => r.feedbackRating).length
        : 0;

    return {
      totalConversations: conversations.length,
      activeConversations,
      totalMessages,
      totalRecommendations: totalRecs,
      appliedRecommendations: appliedRecs,
      averageFeedback: Math.round(avgFeedback * 10) / 10,
      byTopic,
    };
  }
}

// ─── Singleton Factory ───

const copilotInstances = new Map<string, BusinessCopilotService>();

export function getBusinessCopilotService(workspaceId: string): BusinessCopilotService {
  let instance = copilotInstances.get(workspaceId);
  if (!instance) {
    instance = new BusinessCopilotService(workspaceId);
    copilotInstances.set(workspaceId, instance);
  }
  return instance;
}
