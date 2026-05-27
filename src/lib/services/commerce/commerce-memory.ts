// ═══════════════════════════════════════════════════════════════
// AMEO AI — Commerce Memory System (System 7)
// Persistent AGI operational memory with vector-ready architecture,
// searchable knowledge base, and agent-accessible retrieval.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getEventBus } from '@/lib/services/event-bus';

// ─── Types ───

export type MemoryType = 'knowledge' | 'state' | 'preference' | 'result' | 'decision';
export type AgentType =
  | 'product_hunter'
  | 'trend_analyst'
  | 'supplier_analyst'
  | 'pricing_agent'
  | 'seo_agent'
  | 'store_builder'
  | 'ad_creative'
  | 'analytics_agent'
  | 'fulfillment_agent'
  | 'verification_agent';

export interface MemoryEntry {
  id: string;
  agentId: string;
  agentType: string;
  memoryType: MemoryType;
  key: string;
  value: string;
  resourceType?: string | null;
  resourceId?: string | null;
  confidence: number;
  version: number;
  tags?: string[] | null;
  ttl?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryQuery {
  agentId?: string;
  agentType?: string;
  memoryType?: MemoryType;
  key?: string;
  resourceType?: string;
  resourceId?: string;
  searchText?: string;
  tags?: string[];
  minConfidence?: number;
  limit?: number;
  offset?: number;
}

// ─── Commerce Memory Service ───

export class CommerceMemorySystem {
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  // ─── Store Memory ───

  async remember(
    agentId: string,
    agentType: string,
    key: string,
    value: unknown,
    options?: {
      memoryType?: MemoryType;
      resourceType?: string;
      resourceId?: string;
      confidence?: number;
      tags?: string[];
      ttlMinutes?: number;
    }
  ): Promise<MemoryEntry> {
    const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);

    const existing = await db.agentMemory.findUnique({
      where: {
        agentId_key: { agentId, key },
      },
    });

    let memory;
    if (existing) {
      memory = await db.agentMemory.update({
        where: { id: existing.id },
        data: {
          value: serializedValue,
          memoryType: options?.memoryType || existing.memoryType,
          resourceType: options?.resourceType ?? existing.resourceType,
          resourceId: options?.resourceId ?? existing.resourceId,
          confidence: options?.confidence ?? existing.confidence,
          version: { increment: 1 },
          tags: options?.tags ? JSON.stringify(options.tags) : existing.tags,
          ttl: options?.ttlMinutes
            ? new Date(Date.now() + options.ttlMinutes * 60 * 1000)
            : existing.ttl,
        },
      });
    } else {
      memory = await db.agentMemory.create({
        data: {
          workspaceId: this.workspaceId,
          agentId,
          agentType,
          key,
          value: serializedValue,
          memoryType: options?.memoryType || 'knowledge',
          resourceType: options?.resourceType || null,
          resourceId: options?.resourceId || null,
          confidence: options?.confidence ?? 1.0,
          tags: options?.tags ? JSON.stringify(options.tags) : null,
          ttl: options?.ttlMinutes
            ? new Date(Date.now() + options.ttlMinutes * 60 * 1000)
            : null,
        },
      });
    }

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'memory.stored',
      source: 'commerce-memory',
      level: 'info',
      payload: {
        agentId,
        agentType,
        key,
        memoryType: options?.memoryType || 'knowledge',
        resourceType: options?.resourceType,
        resourceId: options?.resourceId,
      },
      resourceType: 'memory',
      resourceId: memory.id,
    });

    return this.toMemoryEntry(memory);
  }

  // ─── Recall Memory ───

  async recall(agentId: string, key: string): Promise<MemoryEntry | null> {
    const memory = await db.agentMemory.findUnique({
      where: { agentId_key: { agentId, key } },
    });

    if (!memory) return null;

    // Check TTL
    if (memory.ttl && memory.ttl < new Date()) {
      await db.agentMemory.delete({ where: { id: memory.id } });
      return null;
    }

    return this.toMemoryEntry(memory);
  }

  async recallByResource(
    agentId: string,
    resourceType: string,
    resourceId: string
  ): Promise<MemoryEntry[]> {
    const memories = await db.agentMemory.findMany({
      where: {
        workspaceId: this.workspaceId,
        agentId,
        resourceType,
        resourceId,
        OR: [{ ttl: null }, { ttl: { gt: new Date() } }],
      },
      orderBy: { updatedAt: 'desc' },
    });
    return memories.map((m) => this.toMemoryEntry(m));
  }

  // ─── Search Memory ───

  async search(query: MemoryQuery): Promise<MemoryEntry[]> {
    const where: Record<string, unknown> = { workspaceId: this.workspaceId };

    if (query.agentId) where.agentId = query.agentId;
    if (query.agentType) where.agentType = query.agentType;
    if (query.memoryType) where.memoryType = query.memoryType;
    if (query.key) where.key = { contains: query.key, mode: 'insensitive' };
    if (query.resourceType) where.resourceType = query.resourceType;
    if (query.resourceId) where.resourceId = query.resourceId;
    if (query.tags && query.tags.length > 0) {
      where.tags = { in: query.tags.map((t) => `%${t}%`) };
    }
    if (query.minConfidence !== undefined) {
      where.confidence = { gte: query.minConfidence };
    }

    // Text search on value field
    if (query.searchText) {
      where.value = { contains: query.searchText, mode: 'insensitive' };
    }

    // Exclude expired entries
    where.OR = [{ ttl: null }, { ttl: { gt: new Date() } }];

    const memories = await db.agentMemory.findMany({
      where,
      orderBy: [{ confidence: 'desc' }, { updatedAt: 'desc' }],
      take: query.limit || 50,
      skip: query.offset || 0,
    });

    return memories.map((m) => this.toMemoryEntry(m));
  }

  // ─── Forget Memory ───

  async forget(agentId: string, key: string): Promise<void> {
    await db.agentMemory.deleteMany({
      where: { workspaceId: this.workspaceId, agentId, key },
    });
  }

  async forgetByAgent(agentId: string): Promise<number> {
    const result = await db.agentMemory.deleteMany({
      where: { workspaceId: this.workspaceId, agentId },
    });
    return result.count;
  }

  async forgetByResource(resourceType: string, resourceId: string): Promise<number> {
    const result = await db.agentMemory.deleteMany({
      where: { workspaceId: this.workspaceId, resourceType, resourceId },
    });
    return result.count;
  }

  async clearExpired(): Promise<number> {
    const result = await db.agentMemory.deleteMany({
      where: {
        workspaceId: this.workspaceId,
        ttl: { not: null, lt: new Date() },
      },
    });
    return result.count;
  }

  // ─── Agent-Specific Operations ───

  async getAgentState(agentId: string): Promise<Record<string, unknown>> {
    const memories = await db.agentMemory.findMany({
      where: {
        workspaceId: this.workspaceId,
        agentId,
        memoryType: 'state',
        OR: [{ ttl: null }, { ttl: { gt: new Date() } }],
      },
    });

    const state: Record<string, unknown> = {};
    for (const memory of memories) {
      try {
        state[memory.key] = JSON.parse(memory.value);
      } catch {
        state[memory.key] = memory.value;
      }
    }
    return state;
  }

  async getAgentDecisions(
    agentId: string,
    limit = 20
  ): Promise<MemoryEntry[]> {
    const memories = await db.agentMemory.findMany({
      where: {
        workspaceId: this.workspaceId,
        agentId,
        memoryType: 'decision',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return memories.map((m) => this.toMemoryEntry(m));
  }

  // ─── Stats ───

  async getStats(): Promise<{
    totalMemories: number;
    byType: Record<string, number>;
    byAgent: Record<string, number>;
    expiredCount: number;
  }> {
    const memories = await db.agentMemory.findMany({
      where: { workspaceId: this.workspaceId },
    });

    const byType: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    let expiredCount = 0;

    for (const m of memories) {
      byType[m.memoryType] = (byType[m.memoryType] || 0) + 1;
      byAgent[m.agentType] = (byAgent[m.agentType] || 0) + 1;
      if (m.ttl && m.ttl < new Date()) expiredCount++;
    }

    return {
      totalMemories: memories.length,
      byType,
      byAgent,
      expiredCount,
    };
  }

  // ─── Helpers ───

  private toMemoryEntry(memory: {
    id: string;
    agentId: string;
    agentType: string;
    memoryType: string;
    key: string;
    value: string;
    resourceType: string | null;
    resourceId: string | null;
    confidence: number | null;
    version: number;
    tags: string | null;
    ttl: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): MemoryEntry {
    return {
      id: memory.id,
      agentId: memory.agentId,
      agentType: memory.agentType,
      memoryType: memory.memoryType as MemoryType,
      key: memory.key,
      value: memory.value,
      resourceType: memory.resourceType,
      resourceId: memory.resourceId,
      confidence: memory.confidence ?? 1.0,
      version: memory.version,
      tags: memory.tags ? JSON.parse(memory.tags) : null,
      ttl: memory.ttl,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    };
  }

  // ─── Vector-Ready Extensions ───

  /**
   * Prepares memory for vector embedding by extracting text content
   * that would be used for semantic search.
   * This architecture is ready for pgvector or similar extensions.
   */
  getVectorizableContent(memory: MemoryEntry): string {
    const parts = [memory.key, memory.value];
    if (memory.resourceType) parts.push(`resource: ${memory.resourceType}`);
    if (memory.tags?.length) parts.push(`tags: ${memory.tags.join(', ')}`);
    return parts.join(' | ');
  }
}

// ─── Singleton Factory ───

const memoryInstances = new Map<string, CommerceMemorySystem>();

export function getCommerceMemorySystem(workspaceId: string): CommerceMemorySystem {
  let instance = memoryInstances.get(workspaceId);
  if (!instance) {
    instance = new CommerceMemorySystem(workspaceId);
    memoryInstances.set(workspaceId, instance);
  }
  return instance;
}
