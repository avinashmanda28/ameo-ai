// ═══════════════════════════════════════════════════════════════
// AMEO AI — Unified Event Bus (Phase 1.7)
// The nervous system of Ameo AI. All systems communicate
// through structured events with full correlation and lineage.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { EventLevel, EventSource, SystemEvent } from '@/lib/types';

// ─── Types ───

/** Parameters for emitting a new event */
export interface EmitParams {
  workspaceId: string;
  eventType: string;
  source?: EventSource | null;
  level?: EventLevel;
  correlationId?: string | null;
  causationId?: string | null;
  traceId?: string | null;
  payload?: Record<string, unknown> | null;
  resourceType?: string | null;
  resourceId?: string | null;
  actorId?: string | null;
  actorType?: string | null;
  tags?: string[] | null;
}

/** Parameters for querying events */
export interface EventQueryParams {
  workspaceId: string;
  eventType?: string;
  source?: EventSource;
  level?: EventLevel;
  correlationId?: string;
  traceId?: string;
  resourceType?: string;
  resourceId?: string;
  actorId?: string;
  tags?: string[];
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}

/** Parameters for replaying past events */
export interface ReplayParams {
  workspaceId: string;
  eventType?: string;
  correlationId?: string;
  since?: Date;
  until?: Date;
  limit?: number;
}

/** Statistics about events in a workspace */
export interface EventStats {
  total: number;
  byType: Record<string, number>;
  byLevel: Record<string, number>;
  bySource: Record<string, number>;
  recentCounts: {
    lastHour: number;
    last24Hours: number;
    last7Days: number;
  };
}

/** Callback type for event subscriptions */
type EventCallback = (event: SystemEvent) => void;

// ─── In-memory subscription store ───

const subscribers = new Map<string, Set<EventCallback>>();

// ─── EventBus Class ───

class EventBus {
  /**
   * Emit a new system event. Persists to the database and notifies subscribers.
   * Auto-generates a correlationId if not provided.
   */
  async emit(params: EmitParams): Promise<SystemEvent> {
    const now = new Date();

    const event = await db.systemEvent.create({
      data: {
        workspaceId: params.workspaceId,
        eventType: params.eventType,
        source: params.source ?? null,
        level: params.level ?? 'info',
        correlationId: params.correlationId ?? this.generateId(),
        causationId: params.causationId ?? null,
        traceId: params.traceId ?? null,
        payload: params.payload ? JSON.stringify(params.payload) : null,
        resourceType: params.resourceType ?? null,
        resourceId: params.resourceId ?? null,
        actorId: params.actorId ?? null,
        actorType: params.actorType ?? null,
        tags: params.tags ? JSON.stringify(params.tags) : null,
        version: 1,
        createdAt: now,
      },
    });

    // Notify in-memory subscribers
    this.notifySubscribers(params.eventType, event);
    // Also notify wildcard subscribers
    this.notifySubscribers('*', event);

    return event as unknown as SystemEvent;
  }

  /**
   * Query events with filtering. Supports pagination.
   */
  async query(params: EventQueryParams): Promise<{ events: SystemEvent[]; total: number }> {
    const where: Record<string, unknown> = { workspaceId: params.workspaceId };

    if (params.eventType) where.eventType = params.eventType;
    if (params.source) where.source = params.source;
    if (params.level) where.level = params.level;
    if (params.correlationId) where.correlationId = params.correlationId;
    if (params.traceId) where.traceId = params.traceId;
    if (params.resourceType) where.resourceType = params.resourceType;
    if (params.resourceId) where.resourceId = params.resourceId;
    if (params.actorId) where.actorId = params.actorId;

    // Time range
    if (params.since || params.until) {
      const createdAt: Record<string, unknown> = {};
      if (params.since) createdAt.gte = params.since;
      if (params.until) createdAt.lte = params.until;
      where.createdAt = createdAt;
    }

    // Tag filtering (JSON array contains)
    if (params.tags && params.tags.length > 0) {
      // For each tag, check if it appears in the JSON tags array
      const tagConditions = params.tags.map((tag) => ({
        tags: { contains: tag },
      }));
      (where as Record<string, unknown>).OR = tagConditions;
    }

    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const [events, total] = await Promise.all([
      db.systemEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.systemEvent.count({ where }),
    ]);

    return {
      events: events as unknown as SystemEvent[],
      total,
    };
  }

  /**
   * Get all events sharing a correlationId (event chain).
   * Returns events ordered chronologically.
   */
  async getEventChain(correlationId: string): Promise<SystemEvent[]> {
    const events = await db.systemEvent.findMany({
      where: { correlationId },
      orderBy: { createdAt: 'asc' },
    });

    return events as unknown as SystemEvent[];
  }

  /**
   * Get the causation chain — follow causationId back to the root event.
   * Returns the chain from root to the specified event.
   */
  async getEventLineage(eventId: string): Promise<SystemEvent[]> {
    const chain: SystemEvent[] = [];
    let currentId: string | null = eventId;
    const visited = new Set<string>();
    const maxDepth = 50; // prevent infinite loops

    while (currentId && visited.size < maxDepth) {
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const event = await db.systemEvent.findUnique({
        where: { id: currentId },
      });

      if (!event) break;

      chain.unshift(event as unknown as SystemEvent);
      currentId = event.causationId;
    }

    return chain;
  }

  /**
   * Re-dispatch past events. Useful for recovery scenarios and testing.
   * Re-emits historical events as new events with updated metadata.
   */
  async replay(params: ReplayParams): Promise<SystemEvent[]> {
    const where: Record<string, unknown> = { workspaceId: params.workspaceId };

    if (params.eventType) where.eventType = params.eventType;
    if (params.correlationId) where.correlationId = params.correlationId;

    if (params.since || params.until) {
      const createdAt: Record<string, unknown> = {};
      if (params.since) createdAt.gte = params.since;
      if (params.until) createdAt.lte = params.until;
      where.createdAt = createdAt;
    }

    const originalEvents = await db.systemEvent.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: params.limit ?? 100,
    });

    const replayedEvents: SystemEvent[] = [];

    for (const original of originalEvents) {
      const payload = original.payload ? JSON.parse(original.payload) : null;
      const tags = original.tags ? JSON.parse(original.tags) : null;

      // Re-emit as a new event with replay metadata
      const replayed = await this.emit({
        workspaceId: params.workspaceId,
        eventType: `${original.eventType}.replayed`,
        source: (original.source as EventSource) ?? null,
        level: original.level as EventLevel,
        correlationId: original.correlationId ?? undefined,
        traceId: original.traceId ?? undefined,
        payload: {
          ...payload,
          __replay: {
            originalEventId: original.id,
            originalTimestamp: original.createdAt.toISOString(),
            replayedAt: new Date().toISOString(),
          },
        },
        resourceType: original.resourceType,
        resourceId: original.resourceId,
        tags: tags ? [...tags, 'replayed'] : ['replayed'],
      });

      replayedEvents.push(replayed);
    }

    return replayedEvents;
  }

  /**
   * Subscribe to events of a specific type in memory.
   * Use '*' to subscribe to all events.
   * Returns an unsubscribe function.
   */
  subscribe(eventType: string, callback: EventCallback): () => void {
    if (!subscribers.has(eventType)) {
      subscribers.set(eventType, new Set());
    }

    subscribers.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      const subs = subscribers.get(eventType);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          subscribers.delete(eventType);
        }
      }
    };
  }

  /**
   * Get event statistics for a workspace.
   * Returns counts grouped by type, level, source, and time periods.
   */
  async getStats(workspaceId: string): Promise<EventStats> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [total, events] = await Promise.all([
      db.systemEvent.count({ where: { workspaceId } }),
      db.systemEvent.findMany({ where: { workspaceId } }),
    ]);

    const byType: Record<string, number> = {};
    const byLevel: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    let lastHour = 0;
    let last24Hours = 0;
    let last7Days = 0;

    for (const event of events) {
      byType[event.eventType] = (byType[event.eventType] || 0) + 1;
      byLevel[event.level] = (byLevel[event.level] || 0) + 1;
      if (event.source) {
        bySource[event.source] = (bySource[event.source] || 0) + 1;
      }

      const ts = event.createdAt.getTime();
      if (ts >= oneHourAgo.getTime()) lastHour++;
      if (ts >= oneDayAgo.getTime()) last24Hours++;
      if (ts >= sevenDaysAgo.getTime()) last7Days++;
    }

    return { total, byType, byLevel, bySource, recentCounts: { lastHour, last24Hours, last7Days } };
  }

  // ─── Private helpers ───

  /** Notify all subscribers for a given event type */
  private notifySubscribers(eventType: string, event: SystemEvent): void {
    const subs = subscribers.get(eventType);
    if (subs) {
      for (const cb of subs) {
        try {
          cb(event);
        } catch {
          // Subscriber errors must not break the event bus
        }
      }
    }
  }

  /** Generate a simple unique ID for correlation */
  private generateId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }
}

// ─── Singleton ───

let instance: EventBus | null = null;

/**
 * Get the singleton EventBus instance.
 * All event operations should go through this getter.
 */
export function getEventBus(): EventBus {
  if (!instance) {
    instance = new EventBus();
  }
  return instance;
}
