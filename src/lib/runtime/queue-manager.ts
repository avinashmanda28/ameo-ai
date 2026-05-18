// ═══════════════════════════════════════════════════════════════
// AMEO AI — Execution Queue Manager
// Manages concurrent execution with prioritization, retry scheduling,
// and exponential backoff. Persists queue state to the database.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

// ─── Types ───────────────────────────────────────────────────

export interface EnqueueParams {
  workspaceId: string;
  executionId?: string;
  priority?: number;
  providerId?: string;
  agentId?: string;
  workflowId?: string;
  requestType?: string;
  prompt?: string;
  systemPrompt?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface QueueItemConfig {
  queueId: string;
  executionId: string | null;
  workspaceId: string;
  providerId: string | null;
  agentId: string | null;
  workflowId: string | null;
  requestType: string | null;
  prompt: string | null;
  systemPrompt: string | null;
  modelId: string | null;
  temperature: number | null;
  maxTokens: number | null;
}

export interface QueueStats {
  pending: number;
  running: number;
  retrying: number;
  failed: number;
  completed: number;
  cancelled: number;
  total: number;
  activeConcurrency: number;
  maxConcurrency: number;
}

// ─── Execution Queue Manager ─────────────────────────────────

export class ExecutionQueueManager {
  private maxConcurrency: number;

  constructor(maxConcurrency = 3) {
    this.maxConcurrency = maxConcurrency;
  }

  // ═══════════════════════════════════════════════════════════
  // ENQUEUE — Add a new item to the execution queue
  // ═══════════════════════════════════════════════════════════

  async enqueue(params: EnqueueParams): Promise<string> {
    const queueItem = await db.executionQueue.create({
      data: {
        workspaceId: params.workspaceId,
        executionId: params.executionId || null,
        status: 'pending',
        priority: params.priority ?? 0,
        providerId: params.providerId || null,
        agentId: params.agentId || null,
        workflowId: params.workflowId || null,
        requestType: params.requestType || null,
        prompt: params.prompt || null,
        systemPrompt: params.systemPrompt || null,
        modelId: params.modelId || null,
        temperature: params.temperature ?? null,
        maxTokens: params.maxTokens ?? null,
        maxRetries: params.maxRetries ?? 3,
        retryDelayMs: params.retryDelayMs ?? 1000,
        retryCount: 0,
        scheduledAt: new Date(),
      },
    });

    return queueItem.id;
  }

  // ═══════════════════════════════════════════════════════════
  // PROCESS NEXT — Pop highest priority item ready for execution
  // ═══════════════════════════════════════════════════════════

  async processNext(): Promise<QueueItemConfig | null> {
    // Check current concurrency by counting running items
    const runningCount = await db.executionQueue.count({
      where: { status: 'running' },
    });

    if (runningCount >= this.maxConcurrency) {
      return null;
    }

    // Find the highest priority pending item (or retrying item whose nextRetryAt has passed)
    const now = new Date();
    const nextItem = await db.executionQueue.findFirst({
      where: {
        OR: [
          { status: 'pending' },
          {
            status: 'retrying',
            nextRetryAt: { lte: now },
          },
        ],
      },
      orderBy: [
        { priority: 'desc' },
        { scheduledAt: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    if (!nextItem) {
      return null;
    }

    // Mark as running
    await db.executionQueue.update({
      where: { id: nextItem.id },
      data: {
        status: 'running',
        startedAt: now,
      },
    });

    return {
      queueId: nextItem.id,
      executionId: nextItem.executionId,
      workspaceId: nextItem.workspaceId,
      providerId: nextItem.providerId,
      agentId: nextItem.agentId,
      workflowId: nextItem.workflowId,
      requestType: nextItem.requestType,
      prompt: nextItem.prompt,
      systemPrompt: nextItem.systemPrompt,
      modelId: nextItem.modelId,
      temperature: nextItem.temperature,
      maxTokens: nextItem.maxTokens,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // COMPLETE — Mark a queue item as completed
  // ═══════════════════════════════════════════════════════════

  async complete(queueId: string, result: string): Promise<void> {
    await db.executionQueue.update({
      where: { id: queueId },
      data: {
        status: 'completed',
        result,
        completedAt: new Date(),
      },
    });
  }

  // ═══════════════════════════════════════════════════════════
  // FAIL — Mark a queue item as failed and schedule retry if eligible
  // ═══════════════════════════════════════════════════════════

  async fail(queueId: string, error: unknown, failureType?: string, failureSeverity?: string): Promise<void> {
    const item = await db.executionQueue.findUnique({
      where: { id: queueId },
    });

    if (!item) {
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const newRetryCount = item.retryCount + 1;
    const canRetry = newRetryCount <= item.maxRetries;

    // Exponential backoff: delay = retryDelayMs * 2^retryCount
    const backoffDelay = item.retryDelayMs * Math.pow(2, newRetryCount);
    const nextRetryAt = canRetry ? new Date(Date.now() + backoffDelay) : null;

    await db.executionQueue.update({
      where: { id: queueId },
      data: {
        status: canRetry ? 'retrying' : 'failed',
        retryCount: newRetryCount,
        lastError: errorMessage,
        failureType: failureType || null,
        failureSeverity: failureSeverity || null,
        nextRetryAt,
        completedAt: canRetry ? null : new Date(),
        result: canRetry ? null : errorMessage,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════
  // GET QUEUE STATS — Count items by status
  // ═══════════════════════════════════════════════════════════

  async getQueueStats(workspaceId?: string): Promise<QueueStats> {
    const where = workspaceId ? { workspaceId } : {};

    const [pending, running, retrying, failed, completed, cancelled, total] =
      await Promise.all([
        db.executionQueue.count({ where: { ...where, status: 'pending' } }),
        db.executionQueue.count({ where: { ...where, status: 'running' } }),
        db.executionQueue.count({ where: { ...where, status: 'retrying' } }),
        db.executionQueue.count({ where: { ...where, status: 'failed' } }),
        db.executionQueue.count({ where: { ...where, status: 'completed' } }),
        db.executionQueue.count({ where: { ...where, status: 'cancelled' } }),
        db.executionQueue.count({ where }),
      ]);

    return {
      pending,
      running,
      retrying,
      failed,
      completed,
      cancelled,
      total,
      activeConcurrency: running,
      maxConcurrency: this.maxConcurrency,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // CANCEL — Cancel a pending or retrying queue item
  // ═══════════════════════════════════════════════════════════

  async cancel(queueId: string): Promise<boolean> {
    const item = await db.executionQueue.findUnique({
      where: { id: queueId },
    });

    if (!item) {
      return false;
    }

    // Only allow cancelling pending or retrying items
    if (item.status !== 'pending' && item.status !== 'retrying') {
      return false;
    }

    await db.executionQueue.update({
      where: { id: queueId },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
      },
    });

    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // RETRY — Manually retry a failed item with exponential backoff
  // ═══════════════════════════════════════════════════════════

  async retry(queueId: string): Promise<boolean> {
    const item = await db.executionQueue.findUnique({
      where: { id: queueId },
    });

    if (!item) {
      return false;
    }

    // Only allow retrying failed items
    if (item.status !== 'failed') {
      return false;
    }

    // Exponential backoff: delay = retryDelayMs * 2^retryCount
    const backoffDelay = item.retryDelayMs * Math.pow(2, item.retryCount);
    const nextRetryAt = new Date(Date.now() + backoffDelay);

    await db.executionQueue.update({
      where: { id: queueId },
      data: {
        status: 'retrying',
        nextRetryAt,
        completedAt: null,
        result: null,
      },
    });

    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // GET ITEMS — Fetch queue items with optional filtering
  // ═══════════════════════════════════════════════════════════

  async getItems(params: {
    workspaceId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<Array<{
    id: string;
    workspaceId: string;
    executionId: string | null;
    status: string;
    priority: number;
    retryCount: number;
    maxRetries: number;
    lastError: string | null;
    failureType: string | null;
    createdAt: Date;
    completedAt: Date | null;
  }>> {
    const where: Record<string, unknown> = {};
    if (params.workspaceId) where.workspaceId = params.workspaceId;
    if (params.status) where.status = params.status;

    return db.executionQueue.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
      take: params.limit ?? 50,
      skip: params.offset ?? 0,
      select: {
        id: true,
        workspaceId: true,
        executionId: true,
        status: true,
        priority: true,
        retryCount: true,
        maxRetries: true,
        lastError: true,
        failureType: true,
        createdAt: true,
        completedAt: true,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════
  // PURGE COMPLETED — Remove old completed/cancelled items
  // ═══════════════════════════════════════════════════════════

  async purgeCompleted(olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMs);

    const result = await db.executionQueue.deleteMany({
      where: {
        status: { in: ['completed', 'cancelled'] },
        completedAt: { lte: cutoff },
      },
    });

    return result.count;
  }

  // ═══════════════════════════════════════════════════════════
  // UPDATE MAX CONCURRENCY
  // ═══════════════════════════════════════════════════════════

  setMaxConcurrency(value: number): void {
    this.maxConcurrency = Math.max(1, Math.min(value, 20));
  }

  getMaxConcurrency(): number {
    return this.maxConcurrency;
  }
}

// ═══════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════

let queueManagerInstance: ExecutionQueueManager | null = null;

export function getQueueManager(): ExecutionQueueManager {
  if (!queueManagerInstance) {
    queueManagerInstance = new ExecutionQueueManager();
  }
  return queueManagerInstance;
}
