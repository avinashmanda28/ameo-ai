// ═══════════════════════════════════════════════════════════════
// AMEO AI — Agent Coordination Layer (Phase 1.7)
// Formal task management and conflict prevention.
// Ensures two agents never operate on the same resource
// simultaneously, and manages task lifecycle with locking.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  AgentCoordination,
  CoordinationTaskType,
} from '@/lib/types';

// ─── Types ───

/** Parameters for claiming a new task */
export interface ClaimTaskParams {
  workspaceId: string;
  taskId: string;
  taskType: CoordinationTaskType;
  agentId: string;
  agentType?: string | null;
  description?: string | null;
  authorityScope?: Record<string, unknown> | null;
  permissionSet?: string[] | null;
  priority?: number;
  resourceType?: string;
  resourceId?: string;
  lockDurationMs?: number; // default 30 minutes
  traceId?: string | null;
  correlationId?: string | null;
}

/** Result of a conflict check */
export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictingTasks: AgentCoordination[];
  conflictingAgentIds: string[];
  details: string;
}

/** Coordination status summary for a workspace */
export interface CoordinationStatus {
  workspaceId: string;
  totalTasks: number;
  activeTasks: number;
  lockedTasks: number;
  completedTasks: number;
  failedTasks: number;
  handedOffTasks: number;
  expiredTasks: number;
  activeAgents: number;
  agentsById: Record<string, {
    agentType: string | null;
    activeTaskCount: number;
    lockedTaskCount: number;
  }>;
}

/** Error thrown when a conflict is detected */
export class CoordinationConflictError extends Error {
  public readonly conflictingTasks: AgentCoordination[];

  constructor(message: string, conflictingTasks: AgentCoordination[]) {
    super(message);
    this.name = 'CoordinationConflictError';
    this.conflictingTasks = conflictingTasks;
  }
}

// ─── Default lock duration ───

const DEFAULT_LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// ─── AgentCoordinator Class ───

class AgentCoordinator {
  /**
   * Agent claims a task. Checks for conflicts and acquires a lock.
   * Throws CoordinationConflictError if a conflict is detected.
   */
  async claimTask(params: ClaimTaskParams): Promise<AgentCoordination> {
    // Prune expired locks first
    await this.pruneExpiredLocks();

    // Check if task already exists (prevent duplicate claims)
    const existingTask = await db.agentCoordination.findUnique({
      where: { taskId: params.taskId },
    });

    if (existingTask) {
      if (existingTask.status === 'completed' || existingTask.status === 'failed') {
        // Allow re-claiming completed/failed tasks
        await db.agentCoordination.delete({ where: { id: existingTask.id } });
      } else {
        throw new CoordinationConflictError(
          `Task ${params.taskId} already exists with status '${existingTask.status}' owned by ${existingTask.ownerAgentId}`,
          [existingTask as unknown as AgentCoordination],
        );
      }
    }

    // Build conflict check IDs from resource targeting
    const conflictCheckIds: string[] = [];
    if (params.resourceType && params.resourceId) {
      conflictCheckIds.push(`${params.resourceType}:${params.resourceId}`);
    }

    // Check for conflicts — other active tasks targeting the same resource
    if (params.resourceType && params.resourceId) {
      const conflictCheck = await this.checkConflict(
        params.agentId,
        params.resourceType,
        params.resourceId,
      );

      if (conflictCheck.hasConflict) {
        throw new CoordinationConflictError(
          conflictCheck.details,
          conflictCheck.conflictingTasks,
        );
      }
    }

    // Check if agent already has too many active tasks (soft limit: 10)
    const agentActiveTasks = await db.agentCoordination.count({
      where: {
        ownerAgentId: params.agentId,
        status: { in: ['claimed', 'active'] },
      },
    });

    if (agentActiveTasks >= 10) {
      throw new CoordinationConflictError(
        `Agent ${params.agentId} already has ${agentActiveTasks} active tasks (limit: 10)`,
        [],
      );
    }

    const now = new Date();
    const lockExpiresAt = new Date(now.getTime() + (params.lockDurationMs ?? DEFAULT_LOCK_DURATION_MS));

    const coordination = await db.agentCoordination.create({
      data: {
        workspaceId: params.workspaceId,
        taskId: params.taskId,
        taskType: params.taskType,
        description: params.description ?? null,
        ownerAgentId: params.agentId,
        ownerAgentType: params.agentType ?? null,
        authorityScope: params.authorityScope ? JSON.stringify(params.authorityScope) : null,
        permissionSet: params.permissionSet ? JSON.stringify(params.permissionSet) : null,
        status: 'claimed',
        priority: params.priority ?? 0,
        handedOffTo: null,
        handedOffAt: null,
        handoffReason: null,
        lockedAt: now,
        lockExpiresAt,
        isLocked: true,
        conflictCheckIds: conflictCheckIds.length > 0 ? JSON.stringify(conflictCheckIds) : null,
        traceId: params.traceId ?? null,
        correlationId: params.correlationId ?? null,
        completedAt: null,
      },
    });

    return coordination as unknown as AgentCoordination;
  }

  /**
   * Transfer task ownership from one agent to another.
   * Performs conflict check on the target agent before handoff.
   */
  async handoffTask(
    taskId: string,
    toAgentId: string,
    reason?: string,
  ): Promise<AgentCoordination> {
    const task = await db.agentCoordination.findUnique({
      where: { taskId },
    });

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (task.status === 'completed' || task.status === 'failed' || task.status === 'expired') {
      throw new Error(`Cannot handoff task in status '${task.status}'`);
    }

    // Check if the toAgent has conflicts with this task's resources
    const conflictCheckIds = task.conflictCheckIds
      ? JSON.parse(task.conflictCheckIds) as string[]
      : [];

    for (const checkId of conflictCheckIds) {
      const [resourceType, resourceId] = checkId.split(':');
      if (resourceType && resourceId) {
        const conflictCheck = await this.checkConflict(toAgentId, resourceType, resourceId);
        if (conflictCheck.hasConflict) {
          throw new CoordinationConflictError(
            `Target agent ${toAgentId} has conflicting tasks for ${checkId}. ${conflictCheck.details}`,
            conflictCheck.conflictingTasks,
          );
        }
      }
    }

    const updated = await db.agentCoordination.update({
      where: { taskId },
      data: {
        status: 'handed_off',
        handedOffTo: toAgentId,
        handedOffAt: new Date(),
        handoffReason: reason ?? null,
        isLocked: false,
        lockedAt: null,
        lockExpiresAt: null,
      },
    });

    // Create new coordination for the receiving agent
    const lockExpiresAt = new Date(Date.now() + DEFAULT_LOCK_DURATION_MS);
    await db.agentCoordination.create({
      data: {
        workspaceId: task.workspaceId,
        taskId: `${taskId}_handed_off_${Date.now()}`,
        taskType: task.taskType as CoordinationTaskType,
        description: task.description,
        ownerAgentId: toAgentId,
        ownerAgentType: null,
        authorityScope: task.authorityScope,
        permissionSet: task.permissionSet,
        status: 'claimed',
        priority: task.priority,
        conflictCheckIds: task.conflictCheckIds,
        traceId: task.traceId,
        correlationId: task.correlationId,
        lockedAt: new Date(),
        lockExpiresAt,
        isLocked: true,
      },
    });

    return updated as unknown as AgentCoordination;
  }

  /**
   * Mark a task as complete and release its lock.
   */
  async completeTask(
    taskId: string,
    result?: Record<string, unknown> | string | null,
  ): Promise<AgentCoordination> {
    const task = await db.agentCoordination.findUnique({
      where: { taskId },
    });

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const updated = await db.agentCoordination.update({
      where: { taskId },
      data: {
        status: 'completed',
        isLocked: false,
        lockedAt: null,
        lockExpiresAt: null,
        completedAt: new Date(),
      },
    });

    return updated as unknown as AgentCoordination;
  }

  /**
   * Mark a task as failed and release its lock.
   */
  async failTask(
    taskId: string,
    error?: Record<string, unknown> | string | null,
  ): Promise<AgentCoordination> {
    const task = await db.agentCoordination.findUnique({
      where: { taskId },
    });

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const updated = await db.agentCoordination.update({
      where: { taskId },
      data: {
        status: 'failed',
        isLocked: false,
        lockedAt: null,
        lockExpiresAt: null,
        completedAt: new Date(),
      },
    });

    return updated as unknown as AgentCoordination;
  }

  /**
   * Check if an agent would conflict with existing tasks for a given resource.
   * Two agents cannot own tasks targeting the same resource simultaneously.
   */
  async checkConflict(
    agentId: string,
    resourceType: string,
    resourceId: string,
  ): Promise<ConflictCheckResult> {
    const checkPattern = `${resourceType}:${resourceId}`;

    // Find all active tasks that target this resource
    const allActiveTasks = await db.agentCoordination.findMany({
      where: {
        status: { in: ['claimed', 'active'] },
        isLocked: true,
      },
    });

    const conflictingTasks: AgentCoordination[] = [];

    for (const task of allActiveTasks) {
      if (task.ownerAgentId === agentId) continue; // Same agent, no conflict

      const taskCheckIds = task.conflictCheckIds
        ? JSON.parse(task.conflictCheckIds) as string[]
        : [];

      for (const checkId of taskCheckIds) {
        if (checkId === checkPattern) {
          conflictingTasks.push(task as unknown as AgentCoordination);
          break;
        }
      }
    }

    const hasConflict = conflictingTasks.length > 0;
    const conflictingAgentIds = conflictingTasks.map((t) => t.ownerAgentId);

    return {
      hasConflict,
      conflictingTasks,
      conflictingAgentIds,
      details: hasConflict
        ? `Agent ${agentId} conflicts with agents [${conflictingAgentIds.join(', ')}] on resource ${checkPattern}`
        : 'No conflicts detected',
    };
  }

  /**
   * Get all tasks for a specific agent.
   */
  async getAgentTasks(agentId: string): Promise<AgentCoordination[]> {
    const tasks = await db.agentCoordination.findMany({
      where: { ownerAgentId: agentId },
      orderBy: { createdAt: 'desc' },
    });

    return tasks as unknown as AgentCoordination[];
  }

  /**
   * Get all currently locked tasks across all agents.
   */
  async getActiveLocks(): Promise<AgentCoordination[]> {
    // First prune expired
    await this.pruneExpiredLocks();

    const lockedTasks = await db.agentCoordination.findMany({
      where: {
        isLocked: true,
        lockExpiresAt: { gt: new Date() },
      },
      orderBy: { lockedAt: 'asc' },
    });

    return lockedTasks as unknown as AgentCoordination[];
  }

  /**
   * Release locks that have passed their expiry time.
   * Sets expired tasks to 'expired' status and releases the lock.
   */
  async pruneExpiredLocks(): Promise<number> {
    const now = new Date();

    // Find all locked tasks past their expiry
    const expiredTasks = await db.agentCoordination.findMany({
      where: {
        isLocked: true,
        lockExpiresAt: { lte: now },
      },
    });

    if (expiredTasks.length === 0) return 0;

    // Batch update all expired tasks
    for (const task of expiredTasks) {
      await db.agentCoordination.update({
        where: { id: task.id },
        data: {
          status: 'expired',
          isLocked: false,
          lockedAt: null,
          lockExpiresAt: null,
        },
      });
    }

    return expiredTasks.length;
  }

  /**
   * Get a comprehensive coordination status summary for a workspace.
   */
  async getCoordinationStatus(workspaceId: string): Promise<CoordinationStatus> {
    const allTasks = await db.agentCoordination.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });

    let activeTasks = 0;
    let lockedTasks = 0;
    let completedTasks = 0;
    let failedTasks = 0;
    let handedOffTasks = 0;
    let expiredTasks = 0;
    const agentsById: Record<string, {
    agentType: string | null;
    activeTaskCount: number;
    lockedTaskCount: number;
  }> = {};

    for (const task of allTasks) {
      switch (task.status) {
        case 'claimed':
        case 'active':
          activeTasks++;
          break;
        case 'completed':
          completedTasks++;
          break;
        case 'failed':
          failedTasks++;
          break;
        case 'handed_off':
          handedOffTasks++;
          break;
        case 'expired':
          expiredTasks++;
          break;
      }

      if (task.isLocked) lockedTasks++;

      // Aggregate by agent
      if (!agentsById[task.ownerAgentId]) {
        agentsById[task.ownerAgentId] = {
          agentType: task.ownerAgentType,
          activeTaskCount: 0,
          lockedTaskCount: 0,
        };
      }
      if (task.status === 'claimed' || task.status === 'active') {
        agentsById[task.ownerAgentId].activeTaskCount++;
      }
      if (task.isLocked) {
        agentsById[task.ownerAgentId].lockedTaskCount++;
      }
    }

    return {
      workspaceId,
      totalTasks: allTasks.length,
      activeTasks,
      lockedTasks,
      completedTasks,
      failedTasks,
      handedOffTasks,
      expiredTasks,
      activeAgents: Object.keys(agentsById).length,
      agentsById,
    };
  }
}

// ─── Singleton ───

let instance: AgentCoordinator | null = null;

/**
 * Get the singleton AgentCoordinator instance.
 */
export function getAgentCoordinator(): AgentCoordinator {
  if (!instance) {
    instance = new AgentCoordinator();
  }
  return instance;
}
