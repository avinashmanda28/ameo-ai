// ═══════════════════════════════════════════════════════════════
// AMEO AI — AGI Agent Swarm Orchestrator
// Coordinates 10 specialized commerce agents with real orchestration
// ═══════════════════════════════════════════════════════════════

import { getEventBus } from '@/lib/services/event-bus';
import { getAgentCoordinator } from '@/lib/services/agent-coordinator';
import { getRuntimeEngine } from '@/lib/engine/engine';
import { db } from '@/lib/db';
import type {
  CommerceAgentType,
  AgentExecutionResult,
  SwarmTask,
  SwarmAgentTrace,
  AgentMetrics,
} from './types';
import { AGENT_NAMES, AGENT_CAPABILITIES } from './types';
import { BaseCommerceAgent, type AgentContext } from './base-agent';
import { ProductHunterAgent } from './product-hunter';
import { TrendAnalystAgent } from './trend-analyst';
import { SupplierAnalystAgent } from './supplier-analyst';
import { PricingAgent } from './pricing-agent';
import { SEOAgent } from './seo-agent';
import { StoreBuilderAgent } from './store-builder';
import { AdCreativeAgent } from './ad-creative-agent';
import { AnalyticsAgent } from './analytics-agent';
import { FulfillmentAgent } from './fulfillment-agent';
import { VerificationAgent } from './verification-agent';

// ─── Agent Registry ───

class AgentRegistry {
  private agents = new Map<CommerceAgentType, BaseCommerceAgent>();

  constructor() {
    this.register(new ProductHunterAgent());
    this.register(new TrendAnalystAgent());
    this.register(new SupplierAnalystAgent());
    this.register(new PricingAgent());
    this.register(new SEOAgent());
    this.register(new StoreBuilderAgent());
    this.register(new AdCreativeAgent());
    this.register(new AnalyticsAgent());
    this.register(new FulfillmentAgent());
    this.register(new VerificationAgent());
  }

  private register(agent: BaseCommerceAgent): void {
    this.agents.set(agent.agentType, agent);
  }

  get(type: CommerceAgentType): BaseCommerceAgent | undefined {
    return this.agents.get(type);
  }

  getAll(): BaseCommerceAgent[] {
    return Array.from(this.agents.values());
  }

  getTypes(): CommerceAgentType[] {
    return Array.from(this.agents.keys());
  }
}

// ─── Singleton Registry ───

let agentRegistry: AgentRegistry | null = null;

function getAgentRegistry(): AgentRegistry {
  if (!agentRegistry) {
    agentRegistry = new AgentRegistry();
  }
  return agentRegistry;
}

// ─── Swarm Orchestrator ───

class SwarmOrchestrator {
  /**
   * Execute an agent task with full orchestration.
   */
  async executeAgentTask(params: {
    workspaceId: string;
    agentType: CommerceAgentType;
    taskId: string;
    input: Record<string, unknown>;
    traceId?: string | null;
    correlationId?: string | null;
  }): Promise<AgentExecutionResult> {
    const { workspaceId, agentType, taskId, input } = params;
    const agent = getAgentRegistry().get(agentType);

    if (!agent) {
      throw new Error(`Agent type not found: ${agentType}`);
    }

    // Claim coordination task to prevent duplicate work
    const resourceId = (input.resourceId as string) || taskId;
    const resourceType = (input.resourceType as string) || 'commerce_task';

    try {
      await getAgentCoordinator().claimTask({
        workspaceId,
        taskId,
        taskType: 'execute',
        agentId: `${agentType}_${workspaceId}`,
        agentType,
        description: `${AGENT_NAMES[agentType]} executing task ${taskId}`,
        resourceType,
        resourceId,
        traceId: params.traceId ?? null,
        correlationId: params.correlationId ?? null,
      });
    } catch (error) {
      // If coordination fails, log and proceed
      await getEventBus().emit({
        workspaceId,
        eventType: 'swarm.coordination.warning',
        source: 'agent',
        level: 'warn',
        payload: { taskId, agentType, error: String(error) },
      });
    }

    // Execute the agent
    const ctx: AgentContext = {
      workspaceId,
      agentId: `${agentType}_${workspaceId}`,
      taskId,
      traceId: params.traceId ?? null,
      correlationId: params.correlationId ?? null,
      input,
    };

    const result = await agent.execute(ctx);

    // Release coordination lock
    try {
      if (result.success) {
        await getAgentCoordinator().completeTask(taskId, { result: result.output });
      } else {
        await getAgentCoordinator().failTask(taskId, { error: result.error });
      }
    } catch {
      // Non-critical
    }

    return result;
  }

  /**
   * Execute a multi-agent workflow — chain multiple agents together.
   */
  async executeMultiAgentWorkflow(params: {
    workspaceId: string;
    workflowId: string;
    agents: Array<{
      agentType: CommerceAgentType;
      input: Record<string, unknown>;
    }>;
    traceId?: string | null;
  }): Promise<{
    results: Array<{ agentType: CommerceAgentType; result: AgentExecutionResult }>;
    overallSuccess: boolean;
    totalDurationMs: number;
  }> {
    const startTime = Date.now();
    const results: Array<{ agentType: CommerceAgentType; result: AgentExecutionResult }> = [];
    const correlationId = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await getEventBus().emit({
      workspaceId: params.workspaceId,
      eventType: 'swarm.workflow.start',
      source: 'agent',
      payload: { workflowId: params.workflowId, agentCount: params.agents.length, correlationId },
      correlationId,
    });

    // Execute agents sequentially (some depend on previous results)
    let previousResult: Record<string, unknown> = {};

    for (let i = 0; i < params.agents.length; i++) {
      const { agentType, input } = params.agents[i];
      const taskId = `${params.workflowId}_${agentType}_${i}`;

      // Merge previous outputs into next agent's input
      const mergedInput: Record<string, unknown> = { ...input, previousResult };
      if (Object.keys(previousResult).length > 0) {
        mergedInput._workflowContext = previousResult;
      }

      try {
        const result = await this.executeAgentTask({
          workspaceId: params.workspaceId,
          agentType,
          taskId,
          input: mergedInput,
          traceId: params.traceId ?? null,
          correlationId,
        });

        results.push({ agentType, result });
        previousResult = result.output;
      } catch (error) {
        results.push({
          agentType,
          result: {
            success: false,
            taskId,
            agentType,
            output: {},
            confidence: 0,
            error: error instanceof Error ? error.message : 'Workflow execution failed',
            durationMs: 0,
            artifacts: [],
            events: [],
          },
        });
      }
    }

    const totalDurationMs = Date.now() - startTime;
    const overallSuccess = results.every((r) => r.result.success);

    await getEventBus().emit({
      workspaceId: params.workspaceId,
      eventType: 'swarm.workflow.complete',
      source: 'agent',
      payload: {
        workflowId: params.workflowId,
        agentCount: params.agents.length,
        overallSuccess,
        totalDurationMs,
        results: results.map((r) => ({
          agentType: r.agentType,
          success: r.result.success,
          confidence: r.result.confidence,
        })),
      },
      correlationId,
    });

    return { results, overallSuccess, totalDurationMs };
  }

  /**
   * Execute a goal-driven autonomous swarm task.
   */
  async executeSwarmGoal(params: {
    workspaceId: string;
    goal: string;
    preferredAgent?: CommerceAgentType;
    priority?: number;
    traceId?: string | null;
  }): Promise<SwarmTask> {
    const startTime = Date.now();
    const { workspaceId, goal, preferredAgent } = params;
    const taskId = `swarm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const correlationId = taskId;

    await getEventBus().emit({
      workspaceId,
      eventType: 'swarm.goal.start',
      source: 'agent',
      payload: { taskId, goal, preferredAgent },
      correlationId,
    });

    // Determine which agents to use based on the goal
    const selectedAgents = this.routeGoalToAgents(goal, preferredAgent);
    const traces: SwarmAgentTrace[] = selectedAgents.map((type) => ({
      agentType: type,
      status: 'pending',
      startedAt: null,
      completedAt: null,
      result: null,
      error: null,
    }));

    // Execute each agent
    let previousOutput: Record<string, unknown> = {};

    for (let i = 0; i < selectedAgents.length; i++) {
      const agentType = selectedAgents[i];
      traces[i] = { ...traces[i], status: 'running', startedAt: new Date().toISOString() };

      const agentInput: Record<string, unknown> = {
        goal,
        ...previousOutput,
      };
      if (Object.keys(previousOutput).length > 0) {
        agentInput._workflowContext = previousOutput;
      }

      try {
        const result = await this.executeAgentTask({
          workspaceId,
          agentType,
          taskId: `${taskId}_${agentType}`,
          input: agentInput,
          traceId: params.traceId ?? null,
          correlationId,
        });

        traces[i] = {
          ...traces[i],
          status: result.success ? 'completed' : 'failed',
          completedAt: new Date().toISOString(),
          result: result.output,
          error: result.error,
        };

        previousOutput = result.output;
      } catch (error) {
        traces[i] = {
          ...traces[i],
          status: 'failed',
          completedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    const allSuccess = traces.every((t) => t.status === 'completed');
    const completedAt = new Date().toISOString();

    await getEventBus().emit({
      workspaceId,
      eventType: 'swarm.goal.complete',
      source: 'agent',
      payload: { taskId, goal, allSuccess, durationMs: Date.now() - startTime },
      correlationId,
    });

    return {
      id: taskId,
      workspaceId,
      goal,
      status: allSuccess ? 'completed' : 'failed',
      assignedAgentType: preferredAgent || selectedAgents[0],
      priority: params.priority ?? 0,
      input: { goal },
      result: allSuccess ? previousOutput : null,
      error: allSuccess ? null : 'Some agents failed',
      agentTraces: traces,
      createdAt: new Date(startTime).toISOString(),
      completedAt,
    };
  }

  /**
   * Get agent metrics for a workspace.
   */
  async getAgentMetrics(workspaceId: string): Promise<Record<CommerceAgentType, AgentMetrics>> {
    const agentTypes = getAgentRegistry().getTypes();
    const metrics: Record<string, AgentMetrics> = {};

    for (const agentType of agentTypes) {
      // Count tasks from event bus
      const recentEvents = await getEventBus().query({
        workspaceId,
        eventType: `agent.${agentType}.complete`,
        limit: 100,
      });

      const errorEvents = await getEventBus().query({
        workspaceId,
        eventType: `agent.${agentType}.error`,
        limit: 100,
      });

      const totalTasks = recentEvents.total;
      const failedTasks = errorEvents.total;
      const successRate = totalTasks > 0
        ? Math.round(((totalTasks - failedTasks) / totalTasks) * 100)
        : 0;

      // Compute average duration from event payloads
      let totalDurationMs = 0;
      for (const event of recentEvents.events) {
        const payload = event.payload ? JSON.parse(event.payload) : {};
        totalDurationMs += payload.durationMs || 0;
      }

      const metricsEntry: AgentMetrics = {
        agentType,
        workspaceId,
        tasksCompleted: totalTasks,
        tasksFailed: failedTasks,
        avgDurationMs: totalTasks > 0 ? Math.round(totalDurationMs / totalTasks) : 0,
        totalDurationMs,
        successRate,
        lastActiveAt: recentEvents.events[0]?.createdAt || null,
        lastError: errorEvents.events[0]?.payload
          ? (JSON.parse(errorEvents.events[0].payload as string) as Record<string, unknown>).error as string || null
          : null,
      };

      metrics[agentType] = metricsEntry;
    }

    return metrics as Record<CommerceAgentType, AgentMetrics>;
  }

  /**
   * Route a natural language goal to the appropriate agents.
   */
  private routeGoalToAgents(
    goal: string,
    preferredAgent?: CommerceAgentType,
  ): CommerceAgentType[] {
    if (preferredAgent) {
      // Route to preferred agent first, then verification
      return [preferredAgent, 'verification-agent'];
    }

    const lowerGoal = goal.toLowerCase();

    // Route based on goal content
    if (lowerGoal.includes('product') || lowerGoal.includes('find') || lowerGoal.includes('hunt') || lowerGoal.includes('winning')) {
      return ['product-hunter', 'pricing-agent', 'verification-agent'];
    }
    if (lowerGoal.includes('trend') || lowerGoal.includes('viral') || lowerGoal.includes('momentum')) {
      return ['trend-analyst', 'analytics-agent', 'verification-agent'];
    }
    if (lowerGoal.includes('supplier') || lowerGoal.includes('source') || lowerGoal.includes('manufacturer')) {
      return ['supplier-analyst', 'verification-agent'];
    }
    if (lowerGoal.includes('price') || lowerGoal.includes('margin') || lowerGoal.includes('profit')) {
      return ['pricing-agent', 'product-hunter', 'verification-agent'];
    }
    if (lowerGoal.includes('seo') || lowerGoal.includes('listing') || lowerGoal.includes('optimize')) {
      return ['seo-agent', 'verification-agent'];
    }
    if (lowerGoal.includes('store') || lowerGoal.includes('shop') || lowerGoal.includes('import')) {
      return ['store-builder', 'seo-agent', 'pricing-agent', 'verification-agent'];
    }
    if (lowerGoal.includes('ad') || lowerGoal.includes('creative') || lowerGoal.includes('campaign') || lowerGoal.includes('marketing')) {
      return ['ad-creative-agent', 'analytics-agent', 'verification-agent'];
    }
    if (lowerGoal.includes('analysis') || lowerGoal.includes('report') || lowerGoal.includes('dashboard') || lowerGoal.includes('metric')) {
      return ['analytics-agent', 'verification-agent'];
    }
    if (lowerGoal.includes('fulfill') || lowerGoal.includes('order') || lowerGoal.includes('ship') || lowerGoal.includes('delivery')) {
      return ['fulfillment-agent', 'analytics-agent', 'verification-agent'];
    }
    if (lowerGoal.includes('verify') || lowerGoal.includes('validate') || lowerGoal.includes('check')) {
      return ['verification-agent'];
    }

    // Default: comprehensive analysis
    return ['product-hunter', 'trend-analyst', 'supplier-analyst', 'analytics-agent', 'verification-agent'];
  }

  /**
   * Get all available agent types with metadata.
   */
  getAgentInfo(): Array<{
    type: CommerceAgentType;
    name: string;
    description: string;
    capabilities: string;
  }> {
    return getAgentRegistry().getTypes().map((type) => ({
      type,
      name: AGENT_NAMES[type],
      description: AGENT_CAPABILITIES[type],
      capabilities: AGENT_CAPABILITIES[type],
    }));
  }
}

// ─── Singleton ───

let swarmInstance: SwarmOrchestrator | null = null;

export function getSwarmOrchestrator(): SwarmOrchestrator {
  if (!swarmInstance) {
    swarmInstance = new SwarmOrchestrator();
  }
  return swarmInstance;
}
