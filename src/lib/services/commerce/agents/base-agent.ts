// ═══════════════════════════════════════════════════════════════
// AMEO AI — Base Commerce Agent
// Abstract base for all 10 specialized commerce agents
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getEventBus } from '@/lib/services/event-bus';
import { getRuntimeEngine } from '@/lib/engine/engine';
import { getAgentCoordinator } from '@/lib/services/agent-coordinator';
import type { CommerceAgentType, AgentExecutionResult, AgentArtifact, AgentMemoryEntry } from './types';

// ─── Base Agent Context ───

export interface AgentContext {
  workspaceId: string;
  agentId: string;
  taskId: string;
  traceId: string | null;
  correlationId: string | null;
  input: Record<string, unknown>;
}

// ─── Base Agent Class ───

export abstract class BaseCommerceAgent {
  public readonly agentType: CommerceAgentType;
  public readonly displayName: string;

  constructor(agentType: CommerceAgentType, displayName: string) {
    this.agentType = agentType;
    this.displayName = displayName;
  }

  /**
   * Execute agent logic. Each agent implements this with its specific intelligence.
   */
  abstract execute(ctx: AgentContext): Promise<AgentExecutionResult>;

  /**
   * Run a prompt through the runtime engine with real AI inference.
   */
  protected async runPrompt(
    prompt: string,
    systemPrompt: string = 'You are a helpful AI assistant.',
    temperature: number = 0.3,
    maxTokens: number = 4096,
  ): Promise<string> {
    const response = await getRuntimeEngine().executeDirect({
      prompt,
      systemPrompt,
      temperature,
      maxTokens,
    });
    return response.response ?? '';
  }

  /**
   * Store data in agent memory (key-value with TTL).
   */
  protected async storeMemory(
    workspaceId: string,
    key: string,
    value: string,
    memoryType: string = 'general',
    ttlMs: number | null = null,
  ): Promise<AgentMemoryEntry> {
    const record = await db.agentMemory.create({
      data: {
        agentId: `${this.agentType}_${workspaceId}`,
        agentType: this.agentType,
        workspaceId,
        memoryType,
        key,
        value,
        ttl: ttlMs ? new Date(Date.now() + ttlMs) : null,
      },
    });
    return record as unknown as AgentMemoryEntry;
  }

  /**
   * Retrieve data from agent memory.
   */
  protected async recallMemory(
    workspaceId: string,
    key: string,
    memoryType: string = 'general',
  ): Promise<string | null> {
    const record = await db.agentMemory.findFirst({
      where: {
        agentType: this.agentType,
        workspaceId,
        memoryType,
        key,
        OR: [
          { ttl: null },
          { ttl: { gt: new Date() } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    return record?.value ?? null;
  }

  /**
   * Find multiple memory entries by type and key pattern.
   */
  protected async searchMemory(
    workspaceId: string,
    memoryType: string,
    keyContains?: string,
    limit: number = 20,
  ): Promise<AgentMemoryEntry[]> {
    const records = await db.agentMemory.findMany({
      where: {
        workspaceId,
        memoryType,
        agentType: this.agentType,
        ...(keyContains ? { key: { contains: keyContains } } : {}),
        OR: [
          { ttl: null },
          { ttl: { gt: new Date() } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return records as unknown as AgentMemoryEntry[];
  }

  /**
   * Clear memory entries by type.
   */
  protected async clearMemory(
    workspaceId: string,
    memoryType: string,
  ): Promise<number> {
    const result = await db.agentMemory.deleteMany({
      where: {
        workspaceId,
        memoryType,
        agentType: this.agentType,
      },
    });
    return result.count;
  }

  /**
   * Emit an event to the system event bus.
   */
  protected async emitEvent(
    workspaceId: string,
    eventType: string,
    payload: Record<string, unknown>,
    level: 'info' | 'warn' | 'error' = 'info',
  ): Promise<void> {
    await getEventBus().emit({
      workspaceId,
      eventType,
      source: 'agent',
      level,
      payload,
      actorId: `${this.agentType}`,
      actorType: 'commerce_agent',
      tags: [this.agentType, 'commerce'],
    });
  }

  /**
   * Create an artifact (output from agent execution).
   */
  protected async createArtifact(
    workspaceId: string,
    taskId: string,
    artifact: AgentArtifact,
  ): Promise<void> {
    await db.artifact.create({
      data: {
        workspaceId,
        executionId: taskId,
        title: artifact.title,
        type: artifact.type,
        content: artifact.content,
        metadata: artifact.metadata ? JSON.stringify(artifact.metadata) : null,
        status: 'draft',
        version: 1,
      },
    });
  }

  /**
   * Claim a coordination task to prevent duplicate work on the same resource.
   */
  protected async claimTask(
    workspaceId: string,
    taskType: string,
    resourceType: string,
    resourceId: string,
  ): Promise<boolean> {
    try {
      await getAgentCoordinator().claimTask({
        workspaceId,
        taskId: `${resourceType}:${resourceId}:${this.agentType}`,
        taskType: 'execute',
        agentId: `${this.agentType}_${workspaceId}`,
        agentType: this.agentType,
        description: `${this.displayName} processing ${taskType} on ${resourceType}:${resourceId}`,
        resourceType,
        resourceId,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Score a result with confidence metrics.
   */
  protected scoreResult(
    success: boolean,
    confidence: number,
    output: Record<string, unknown>,
    error: string | null = null,
  ): AgentExecutionResult {
    return {
      success,
      taskId: '',
      agentType: this.agentType,
      output,
      confidence: Math.max(0, Math.min(1, confidence)),
      error,
      durationMs: 0,
      artifacts: [],
      events: [],
    };
  }
}
