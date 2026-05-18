// ═══════════════════════════════════════════════════════════════
// AMEO AI — Execution Lineage Tracker (Phase 1.7)
// Complete operational traceability. Every execution is tracked
// with full lineage — from workflow → queue → execution →
// verification → artifact → audit.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  ExecutionTrace,
  TraceOperation,
  TraceStatus,
} from '@/lib/types';

// ─── Types ───

/** Parameters for starting a new trace chain */
export interface StartTraceParams {
  workspaceId: string;
  operation: TraceOperation;
  subsystem: string;
  workflowId?: string | null;
  executionId?: string | null;
  queueId?: string | null;
  agentId?: string | null;
  artifactId?: string | null;
  eventId?: string | null;
  inputSnapshot?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

/** Parameters for adding a child step to a trace */
export interface AddStepParams {
  workspaceId: string;
  traceId: string;
  parentId?: string | null;
  operation: TraceOperation;
  subsystem: string;
  workflowId?: string | null;
  executionId?: string | null;
  queueId?: string | null;
  agentId?: string | null;
  artifactId?: string | null;
  eventId?: string | null;
  inputSnapshot?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

/** A single timeline entry for trace visualization */
export interface TraceTimelineEntry {
  step: ExecutionTrace;
  durationLabel: string;
  statusLabel: string;
  operationLabel: string;
  children: TraceTimelineEntry[];
}

/** Full lineage for a runtime execution */
export interface ExecutionLineage {
  execution: ExecutionTrace | null;
  queue: ExecutionTrace | null;
  workflow: ExecutionTrace | null;
  verification: ExecutionTrace | null;
  artifact: ExecutionTrace | null;
  audit: ExecutionTrace[];
}

// ─── Labels ───

const OPERATION_LABELS: Record<TraceOperation, string> = {
  execute: 'Execute',
  verify: 'Verify',
  approve: 'Approve',
  queue: 'Queue',
  retry: 'Retry',
  recover: 'Recover',
  checkpoint: 'Checkpoint',
  coordinate: 'Coordinate',
  snapshot: 'Snapshot',
};

const STATUS_LABELS: Record<TraceStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  skipped: 'Skipped',
};

// ─── LineageTracker Class ───

class LineageTracker {
  /**
   * Begin a new trace chain. Returns the generated traceId.
   * The traceId groups all related trace steps for one logical operation.
   */
  async startTrace(params: StartTraceParams): Promise<string> {
    const traceId = this.generateTraceId();

    const trace = await db.executionTrace.create({
      data: {
        workspaceId: params.workspaceId,
        traceId,
        parentId: null,
        rootId: null, // self-reference set below
        operation: params.operation,
        subsystem: params.subsystem,
        status: 'running',
        stepOrder: 0,
        workflowId: params.workflowId ?? null,
        executionId: params.executionId ?? null,
        queueId: params.queueId ?? null,
        agentId: params.agentId ?? null,
        artifactId: params.artifactId ?? null,
        eventId: params.eventId ?? null,
        inputSnapshot: params.inputSnapshot ? JSON.stringify(params.inputSnapshot) : null,
        outputSnapshot: null,
        errorSnapshot: null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        durationMs: null,
        startedAt: new Date(),
        completedAt: null,
      },
    });

    // Set rootId to self (the root of the chain)
    await db.executionTrace.update({
      where: { id: trace.id },
      data: { rootId: trace.id },
    });

    return traceId;
  }

  /**
   * Add a child step to a trace chain. Auto-increments stepOrder.
   * If parentId is not provided, the step is added at the top level of the trace chain.
   */
  async addStep(params: AddStepParams): Promise<ExecutionTrace> {
    // Find the max stepOrder for this trace
    const existingSteps = await db.executionTrace.findMany({
      where: { traceId: params.traceId },
      orderBy: { stepOrder: 'desc' },
      take: 1,
    });

    const nextStepOrder = existingSteps.length > 0 ? (existingSteps[0].stepOrder + 1) : 1;

    // Find the root of this trace chain
    const rootStep = await db.executionTrace.findFirst({
      where: { traceId: params.traceId },
      orderBy: { stepOrder: 'asc' },
    });

    const trace = await db.executionTrace.create({
      data: {
        workspaceId: params.workspaceId,
        traceId: params.traceId,
        parentId: params.parentId ?? null,
        rootId: rootStep?.id ?? null,
        operation: params.operation,
        subsystem: params.subsystem,
        status: 'pending',
        stepOrder: nextStepOrder,
        workflowId: params.workflowId ?? null,
        executionId: params.executionId ?? null,
        queueId: params.queueId ?? null,
        agentId: params.agentId ?? null,
        artifactId: params.artifactId ?? null,
        eventId: params.eventId ?? null,
        inputSnapshot: params.inputSnapshot ? JSON.stringify(params.inputSnapshot) : null,
        outputSnapshot: null,
        errorSnapshot: null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        durationMs: null,
        startedAt: new Date(),
        completedAt: null,
      },
    });

    return trace as unknown as ExecutionTrace;
  }

  /**
   * Mark a step as completed or failed.
   * Calculates duration from startedAt to now.
   */
  async completeStep(
    traceId: string,
    stepId: string,
    output?: Record<string, unknown> | string | null,
    error?: Record<string, unknown> | string | null,
  ): Promise<ExecutionTrace> {
    const step = await db.executionTrace.findUnique({
      where: { id: stepId },
    });

    if (!step) {
      throw new Error(`Trace step not found: ${stepId}`);
    }

    const now = new Date();
    const durationMs = step.startedAt
      ? Math.round(now.getTime() - step.startedAt.getTime())
      : null;

    const status: TraceStatus = error ? 'failed' : 'completed';

    const updated = await db.executionTrace.update({
      where: { id: stepId },
      data: {
        status,
        outputSnapshot: output
          ? JSON.stringify(typeof output === 'string' ? { result: output } : output)
          : null,
        errorSnapshot: error
          ? JSON.stringify(typeof error === 'string' ? { message: error } : error)
          : null,
        durationMs,
        completedAt: now,
      },
    });

    return updated as unknown as ExecutionTrace;
  }

  /**
   * Get all steps for a trace chain, ordered by stepOrder.
   */
  async getTraceChain(traceId: string): Promise<ExecutionTrace[]> {
    const steps = await db.executionTrace.findMany({
      where: { traceId },
      orderBy: { stepOrder: 'asc' },
    });

    return steps as unknown as ExecutionTrace[];
  }

  /**
   * Get the full execution lineage for a runtime execution.
   * Follows the chain: execution → queue → workflow → verification → artifact → audit.
   */
  async getExecutionLineage(executionId: string): Promise<ExecutionLineage> {
    // Find all traces that reference this execution
    const allTraces = await db.executionTrace.findMany({
      where: { executionId },
      orderBy: { stepOrder: 'asc' },
    });

    // Categorize traces by subsystem
    const execution = allTraces.find((t) => t.subsystem === 'runtime') as ExecutionTrace | undefined;
    const queue = allTraces.find((t) => t.subsystem === 'queue') as ExecutionTrace | undefined;
    const workflow = allTraces.find((t) => t.subsystem === 'workflow') as ExecutionTrace | undefined;
    const verification = allTraces.find((t) => t.subsystem === 'governance' && t.operation === 'verify') as ExecutionTrace | undefined;
    const artifact = allTraces.find((t) => t.subsystem === 'artifact') as ExecutionTrace | undefined;
    const audit = allTraces.filter((t) => t.subsystem === 'governance' && t.operation !== 'verify') as ExecutionTrace[];

    return {
      execution: execution ?? null,
      queue: queue ?? null,
      workflow: workflow ?? null,
      verification: verification ?? null,
      artifact: artifact ?? null,
      audit,
    };
  }

  /**
   * Get all traces that touch a specific resource.
   * Searches across workflowId, executionId, queueId, agentId, and artifactId.
   */
  async getRelatedTraces(resourceId: string): Promise<ExecutionTrace[]> {
    const traces = await db.executionTrace.findMany({
      where: {
        OR: [
          { workflowId: resourceId },
          { executionId: resourceId },
          { queueId: resourceId },
          { agentId: resourceId },
          { artifactId: resourceId },
          { eventId: resourceId },
        ],
      },
      orderBy: { startedAt: 'desc' },
    });

    return traces as unknown as ExecutionTrace[];
  }

  /**
   * Build a timeline representation of a trace chain.
   * Returns a tree structure with nested children and formatted labels.
   */
  async getTraceTimeline(traceId: string): Promise<TraceTimelineEntry[]> {
    const steps = await this.getTraceChain(traceId);

    // Build parent → children map
    const childrenMap = new Map<string | null, ExecutionTrace[]>();
    for (const step of steps) {
      const parentKey = step.parentId ?? null;
      if (!childrenMap.has(parentKey)) {
        childrenMap.set(parentKey, []);
      }
      childrenMap.get(parentKey)!.push(step);
    }

    // Recursively build timeline
    const rootChildren = childrenMap.get(null) ?? [];
    return rootChildren.map((step) => this.buildTimelineEntry(step, childrenMap));
  }

  // ─── Private helpers ───

  /** Recursively build a timeline entry with children */
  private buildTimelineEntry(
    step: ExecutionTrace,
    childrenMap: Map<string | null, ExecutionTrace[]>,
  ): TraceTimelineEntry {
    const children = childrenMap.get(step.id) ?? [];

    const durationMs = step.durationMs;
    let durationLabel = '—';
    if (durationMs !== null && durationMs !== undefined) {
      if (durationMs < 1000) {
        durationLabel = `${durationMs}ms`;
      } else if (durationMs < 60000) {
        durationLabel = `${(durationMs / 1000).toFixed(1)}s`;
      } else {
        durationLabel = `${(durationMs / 60000).toFixed(1)}m`;
      }
    }

    return {
      step,
      durationLabel,
      statusLabel: STATUS_LABELS[step.status as TraceStatus] ?? step.status,
      operationLabel: OPERATION_LABELS[step.operation as TraceOperation] ?? step.operation,
      children: children.map((child) => this.buildTimelineEntry(child, childrenMap)),
    };
  }

  /** Generate a unique trace ID */
  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }
}

// ─── Singleton ───

let instance: LineageTracker | null = null;

/**
 * Get the singleton LineageTracker instance.
 */
export function getLineageTracker(): LineageTracker {
  if (!instance) {
    instance = new LineageTracker();
  }
  return instance;
}
