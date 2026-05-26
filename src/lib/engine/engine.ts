// ═══════════════════════════════════════════════════════════════
// AMEO AI — Runtime Execution Engine
// The central orchestrator that routes, executes, governs, and
// audits all AI provider calls across the Ameo AI platform.
// ═══════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';
import type { RuntimeRequest, RuntimeResponse, ProviderAdapter, RuntimeError } from './types';
import { DEFAULT_TIMEOUT_MS, ARTIFACT_MIN_LENGTH } from './types';
import { OpenRouterAdapter } from './adapter-openrouter';
import { GroqAdapter } from './adapter-groq';
import { GeminiAdapter } from './adapter-gemini';
import { OllamaAdapter } from './adapter-ollama';
import { RuntimeRouter } from './router';

export class RuntimeEngine {
  private adapters: Map<string, ProviderAdapter>;
  private router: RuntimeRouter;

  constructor() {
    this.adapters = new Map();
    this.adapters.set('openrouter', new OpenRouterAdapter());
    this.adapters.set('groq', new GroqAdapter());
    this.adapters.set('gemini', new GeminiAdapter());
    this.adapters.set('ollama', new OllamaAdapter());
    this.router = new RuntimeRouter();
  }

  // ═══════════════════════════════════════════════════════════
  // MAIN EXECUTE — Full lifecycle of a runtime execution
  // ═══════════════════════════════════════════════════════════

  async execute(
    params: RuntimeRequest & { db: PrismaClient }
  ): Promise<RuntimeResponse> {
    const { db, workspaceId, providerId, agentId, workflowId, requestType, prompt, systemPrompt, modelId, temperature, maxTokens, skipApproval } = params;

    // ── Step 1: Create the RuntimeExecution record ──
    const execution = await db.runtimeExecution.create({
      data: {
        workspaceId,
        providerId: providerId || null,
        agentId: agentId || null,
        workflowId: workflowId || null,
        requestType,
        prompt,
        systemPrompt: systemPrompt || null,
        modelId: modelId || null,
        temperature: temperature ?? null,
        maxTokens: maxTokens ?? null,
        status: 'pending',
        startedAt: new Date(),
      },
    });

    const executionId = execution.id;

    try {
      // ── Step 2: Get all active providers for the workspace ──
      const providers = await db.runtimeProvider.findMany({
        where: { workspaceId, status: 'active' },
      });

      if (providers.length === 0) {
        await db.runtimeExecution.update({
          where: { id: executionId },
          data: {
            status: 'failed',
            errorMessage: 'No active AI providers configured for this workspace',
            completedAt: new Date(),
          },
        });

        await this.auditLog(db, workspaceId, agentId, 'runtime_execute_failed', {
          executionId,
          reason: 'no_provider',
          error: 'No active AI providers configured',
        });

        return {
          success: false,
          executionId,
          error: 'No active AI providers configured for this workspace',
        };
      }

      // ── Step 3: Route to best provider ──
      const routeResult = await this.router.route(providers, { providerId });

      if (!routeResult) {
        await db.runtimeExecution.update({
          where: { id: executionId },
          data: {
            status: 'failed',
            errorMessage: 'No eligible provider found for routing',
            completedAt: new Date(),
          },
        });

        await this.auditLog(db, workspaceId, agentId, 'runtime_execute_failed', {
          executionId,
          reason: 'routing_failed',
          error: 'No eligible provider found',
        });

        return {
          success: false,
          executionId,
          error: 'No eligible AI provider available. Check provider configuration and API keys.',
        };
      }

      // ── Step 4: Update execution with selected provider ──
      await db.runtimeExecution.update({
        where: { id: executionId },
        data: {
          providerId: routeResult.providerId,
          modelId: modelId || routeResult.modelId,
          status: 'approved',
        },
      });

      // ── Step 5: Check governance rules for approval requirements ──
      if (!skipApproval) {
        const approvalRequired = await this.checkApprovalRequired(db, workspaceId, {
          providerType: routeResult.providerType,
          prompt,
        });

        if (approvalRequired) {
          const approvalRequest = await db.approvalRequest.create({
            data: {
              workspaceId,
              executionId,
              requestType: 'runtime_execution',
              providerName: routeResult.providerName,
              providerType: routeResult.providerType,
              promptPreview: prompt.slice(0, 500),
              dataSize: prompt.length,
              status: 'pending',
              expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
              metadata: JSON.stringify({ modelId: routeResult.modelId, requestType }),
            },
          });

          await db.runtimeExecution.update({
            where: { id: executionId },
            data: {
              status: 'awaiting_approval',
              approvalId: approvalRequest.id,
            },
          });

          await this.auditLog(db, workspaceId, agentId, 'runtime_approval_required', {
            executionId,
            approvalId: approvalRequest.id,
            provider: routeResult.providerName,
          });

          return {
            success: false,
            executionId,
            approvalRequired: true,
            approvalId: approvalRequest.id,
            error: 'Governance approval required before execution',
          };
        }
      }

      // ── Step 6: Get provider details ──
      const provider = providers.find((p) => p.id === routeResult.providerId);
      if (!provider?.apiKey) {
        throw {
          type: 'auth_failed',
          message: `Provider "${routeResult.providerName}" has no API key configured`,
          providerType: routeResult.providerType,
          retryable: false,
        } satisfies RuntimeError;
      }

      // ── Step 7: Execute with the adapter ──
      const startTime = Date.now();
      await db.runtimeExecution.update({
        where: { id: executionId },
        data: { status: 'executing' },
      });

      const adapter = this.adapters.get(routeResult.providerType);
      if (!adapter) {
        throw {
          type: 'provider_unavailable',
          message: `No adapter registered for provider type: ${routeResult.providerType}`,
          providerType: routeResult.providerType,
          retryable: false,
        } satisfies RuntimeError;
      }

      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), DEFAULT_TIMEOUT_MS);

      let result: { content: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } };

      try {
        result = await adapter.execute({
          apiKey: provider.apiKey,
          baseUrl: provider.baseUrl || undefined,
          modelId: modelId || routeResult.modelId,
          prompt,
          systemPrompt,
          temperature,
          maxTokens,
          signal: timeoutController.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const latencyMs = Date.now() - startTime;

      // ── Step 8: Run hallucination detection ──
      const { hallucinationDetected, verificationResult, verificationNotes } = this.detectHallucinations(result.content);

      // ── Step 9: Create Artifact if output is substantial ──
      let artifactId: string | undefined;
      if (result.content.length >= ARTIFACT_MIN_LENGTH) {
        const artifact = await db.artifact.create({
          data: {
            workspaceId,
            executionId,
            workflowId: workflowId || null,
            agentId: agentId || null,
            title: this.generateArtifactTitle(prompt, result.content),
            type: this.classifyArtifactType(prompt, result.content),
            content: result.content,
            summary: result.content.slice(0, 300),
            metadata: JSON.stringify({
              providerType: routeResult.providerType,
              providerName: routeResult.providerName,
              modelId: modelId || routeResult.modelId,
              latencyMs,
              tokenUsage: result.usage,
            }),
            status: hallucinationDetected ? 'draft' : 'verified',
            verificationResult: verificationResult,
            verificationNotes: verificationNotes,
          },
        });
        artifactId = artifact.id;
      }

      // ── Step 10: Update execution with results ──
      await db.runtimeExecution.update({
        where: { id: executionId },
        data: {
          status: 'completed',
          response: result.content,
          tokenUsage: result.usage ? JSON.stringify(result.usage) : null,
          latencyMs,
          artifactId: artifactId || null,
          hallucinationDetected,
          verificationResult,
          verificationNotes,
          completedAt: new Date(),
        },
      });

      // ── Step 11: Update provider health score (simple moving average) ──
      await this.updateProviderHealth(db, provider.id, latencyMs, !hallucinationDetected);

      // ── Step 12: Audit log ──
      await this.auditLog(db, workspaceId, agentId, 'runtime_execute_success', {
        executionId,
        provider: routeResult.providerName,
        providerType: routeResult.providerType,
        modelId: modelId || routeResult.modelId,
        latencyMs,
        tokenUsage: result.usage,
        artifactCreated: !!artifactId,
        hallucinationDetected,
      });

      return {
        success: true,
        executionId,
        response: result.content,
        tokenUsage: result.usage,
        latencyMs,
        artifactId,
        verificationResult,
      };
    } catch (err) {
      // ── Error handling ──
      const runtimeError = this.normalizeError(err);
      const latencyMs = execution.startedAt
        ? Date.now() - execution.startedAt.getTime()
        : undefined;

      await db.runtimeExecution.update({
        where: { id: executionId },
        data: {
          status: runtimeError.type === 'timeout' ? 'timed_out' : 'failed',
          errorMessage: runtimeError.message,
          timedOut: runtimeError.type === 'timeout',
          completedAt: new Date(),
          latencyMs,
        },
      });

      await this.auditLog(db, workspaceId, agentId, 'runtime_execute_error', {
        executionId,
        errorType: runtimeError.type,
        errorMessage: runtimeError.message,
        providerType: runtimeError.providerType,
        retryable: runtimeError.retryable,
      });

      return {
        success: false,
        executionId,
        error: runtimeError.message,
        latencyMs,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // RESUME AFTER APPROVAL — Re-execute a previously held request
  // ═══════════════════════════════════════════════════════════

  async resumeAfterApproval(
    executionId: string,
    approved: boolean,
    db: PrismaClient
  ): Promise<RuntimeResponse> {
    // Get the execution record
    const execution = await db.runtimeExecution.findUnique({
      where: { id: executionId },
      include: {
        approval: true,
        provider: true,
      },
    });

    if (!execution) {
      return {
        success: false,
        executionId,
        error: `Runtime execution ${executionId} not found`,
      };
    }

    if (execution.status !== 'awaiting_approval') {
      return {
        success: false,
        executionId,
        error: `Execution is not awaiting approval (current status: ${execution.status})`,
      };
    }

    // Resolve the approval request
    if (execution.approvalId) {
      await db.approvalRequest.update({
        where: { id: execution.approvalId },
        data: {
          status: approved ? 'approved' : 'rejected',
          resolvedAt: new Date(),
          resolvedBy: 'user',
          reason: approved ? undefined : 'Rejected by user',
        },
      });
    }

    // If rejected, fail the execution
    if (!approved) {
      await db.runtimeExecution.update({
        where: { id: executionId },
        data: {
          status: 'rejected',
          errorMessage: 'Execution rejected by governance approval',
          completedAt: new Date(),
        },
      });

      return {
        success: false,
        executionId,
        error: 'Execution rejected by governance approval',
      };
    }

    // Re-execute with skipApproval = true
    return this.execute({
      db,
      workspaceId: execution.workspaceId,
      providerId: execution.providerId || undefined,
      agentId: execution.agentId || undefined,
      workflowId: execution.workflowId || undefined,
      requestType: execution.requestType as 'chat' | 'completion' | 'embedding',
      prompt: execution.prompt,
      systemPrompt: execution.systemPrompt || undefined,
      modelId: execution.modelId || undefined,
      temperature: execution.temperature ?? undefined,
      maxTokens: execution.maxTokens ?? undefined,
      skipApproval: true,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // VERIFY — Run verification on a completed execution
  // ═══════════════════════════════════════════════════════════

  async verify(
    executionId: string,
    db: PrismaClient
  ): Promise<{ result: string; notes: string }> {
    const execution = await db.runtimeExecution.findUnique({
      where: { id: executionId },
    });

    if (!execution) {
      return { result: 'fail', notes: `Execution ${executionId} not found` };
    }

    if (!execution.response) {
      return { result: 'fail', notes: 'Execution has no response to verify' };
    }

    // Run hallucination and quality checks
    const { hallucinationDetected, verificationResult, verificationNotes } =
      this.detectHallucinations(execution.response);

    // Update execution record
    await db.runtimeExecution.update({
      where: { id: executionId },
      data: {
        verificationResult,
        verificationNotes,
        hallucinationDetected,
      },
    });

    // Update linked artifact if exists
    if (execution.artifactId) {
      await db.artifact.update({
        where: { id: execution.artifactId },
        data: {
          verificationResult,
          verificationNotes,
          status: hallucinationDetected ? 'draft' : 'verified',
        },
      });
    }

    return { result: verificationResult, notes: verificationNotes };
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════

  /**
   * Check if governance rules require approval for this execution
   */
  private async checkApprovalRequired(
    db: PrismaClient,
    workspaceId: string,
    context: { providerType: string; prompt: string }
  ): Promise<boolean> {
    const rules = await db.governanceRule.findMany({
      where: {
        workspaceId,
        type: 'approval',
        enabled: true,
      },
    });

    // If no approval rules exist, no approval is required
    if (rules.length === 0) {
      return false;
    }

    for (const rule of rules) {
      try {
        const config = rule.config ? JSON.parse(rule.config) : {};
        // Check if rule applies to all providers or specific ones
        if (config.providerTypes && Array.isArray(config.providerTypes)) {
          if (!config.providerTypes.includes(context.providerType)) {
            continue;
          }
        }
        // Check if rule applies to prompts above a certain length
        if (config.minPromptLength && context.prompt.length < config.minPromptLength) {
          continue;
        }
        // If we reach here, an approval rule matches
        return true;
      } catch {
        // Invalid JSON config, skip this rule
        continue;
      }
    }

    return false;
  }

  /**
   * Basic hallucination and quality detection on the response.
   * Checks for:
   *  - Empty or whitespace-only responses
   *  - Error-like patterns in the response
   *  - Known hallucination indicators
   */
  private detectHallucinations(content: string): {
    hallucinationDetected: boolean;
    verificationResult: string;
    verificationNotes: string;
  } {
    const trimmed = content.trim();

    // Empty response
    if (!trimmed) {
      return {
        hallucinationDetected: true,
        verificationResult: 'fail',
        verificationNotes: 'Response is empty',
      };
    }

    // Very short response (likely an error or non-answer)
    if (trimmed.length < 10) {
      return {
        hallucinationDetected: false,
        verificationResult: 'warning',
        verificationNotes: 'Response is very short, may be incomplete',
      };
    }

    // Check for error patterns
    const errorPatterns = [
      /error:\s*(invalid|unauthorized|forbidden|not found)/i,
      /i cannot (fulfill|process|complete|answer)/i,
      /i'm (sorry|unable)/i,
      /as an ai/i,
      /i don't have (access|information|knowledge)/i,
    ];

    const detectedPatterns: string[] = [];
    for (const pattern of errorPatterns) {
      if (pattern.test(trimmed)) {
        detectedPatterns.push(pattern.source);
      }
    }

    if (detectedPatterns.length > 0) {
      return {
        hallucinationDetected: false,
        verificationResult: 'warning',
        verificationNotes: `Response contains potential refusal/error patterns: ${detectedPatterns.join(', ')}`,
      };
    }

    // Check for repetitive content (common hallucination sign)
    const sentences = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    if (sentences.length >= 3) {
      const uniqueSentences = new Set(sentences.map((s) => s.trim().toLowerCase()));
      if (uniqueSentences.size < sentences.length * 0.6) {
        return {
          hallucinationDetected: true,
          verificationResult: 'warning',
          verificationNotes: 'Response contains significant repetitive content, possible hallucination',
        };
      }
    }

    return {
      hallucinationDetected: false,
      verificationResult: 'pass',
      verificationNotes: 'Response passed basic quality checks',
    };
  }

  /**
   * Generate a title for an artifact based on the prompt and response
   */
  private generateArtifactTitle(prompt: string, _response: string): string {
    // Use first line or first 80 chars of prompt as title
    const firstLine = prompt.split('\n')[0].trim();
    const title = firstLine.length > 80 ? firstLine.slice(0, 77) + '...' : firstLine;
    return title || 'Untitled Artifact';
  }

  /**
   * Classify the artifact type based on prompt and response content
   */
  private classifyArtifactType(prompt: string, response: string): string {
    const combined = (prompt + ' ' + response).toLowerCase();

    // Code detection
    const codeIndicators = ['```', 'function ', 'class ', 'import ', 'const ', 'def ', 'public ', 'async '];
    if (codeIndicators.some((indicator) => combined.includes(indicator))) {
      return 'code';
    }

    // Architecture detection
    const archIndicators = ['architecture', 'design', 'component', 'module', 'service', 'microservice'];
    if (archIndicators.some((indicator) => combined.includes(indicator))) {
      return 'architecture';
    }

    // Plan detection
    const planIndicators = ['plan', 'roadmap', 'milestone', 'step', 'phase', 'timeline'];
    if (planIndicators.some((indicator) => combined.includes(indicator))) {
      return 'plan';
    }

    // Report detection
    const reportIndicators = ['report', 'analysis', 'summary', 'metric', 'data', 'finding'];
    if (reportIndicators.some((indicator) => combined.includes(indicator))) {
      return 'report';
    }

    // Spec detection
    const specIndicators = ['spec', 'requirement', 'specification', 'feature', 'user story'];
    if (specIndicators.some((indicator) => combined.includes(indicator))) {
      return 'spec';
    }

    return 'general';
  }

  /**
   * Normalize any thrown error into a RuntimeError
   */
  private normalizeError(err: unknown): RuntimeError {
    // Already a structured error
    if (
      err &&
      typeof err === 'object' &&
      'type' in err &&
      'message' in err &&
      'retryable' in err
    ) {
      return err as RuntimeError;
    }

    // DOMException (AbortError / timeout)
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        type: 'timeout',
        message: `Request timed out after ${DEFAULT_TIMEOUT_MS}ms`,
        retryable: true,
      };
    }

    // Standard Error
    if (err instanceof Error) {
      const message = err.message.toLowerCase();
      if (message.includes('econnrefused') || message.includes('fetch failed')) {
        return {
          type: 'connection_refused',
          message: err.message,
          retryable: true,
        };
      }
      return {
        type: 'unknown',
        message: err.message,
        retryable: false,
      };
    }

    // Fallback
    return {
      type: 'unknown',
      message: String(err),
      retryable: false,
    };
  }

  /**
   * Update provider health score with a simple exponential moving average
   */
  private async updateProviderHealth(
    db: PrismaClient,
    providerId: string,
    latencyMs: number,
    success: boolean
  ): Promise<void> {
    const provider = await db.runtimeProvider.findUnique({
      where: { id: providerId },
      select: { healthScore: true },
    });

    if (!provider) return;

    // Calculate new health score:
    // - Success increases health slightly
    // - Latency penalizes if > 10s
    // - Success with low latency gives best score
    let delta: number;
    if (success) {
      if (latencyMs < 5000) {
        delta = 0.05; // fast + success
      } else if (latencyMs < 15000) {
        delta = 0.02; // moderate + success
      } else {
        delta = 0; // slow but still success
      }
    } else {
      delta = -0.1; // failure
    }

    const newHealth = Math.max(0, Math.min(100, provider.healthScore + delta));

    await db.runtimeProvider.update({
      where: { id: providerId },
      data: {
        healthScore: newHealth,
        lastHealthCheck: new Date(),
      },
    });
  }

  /**
   * Create an audit log entry
   */
  private async auditLog(
    db: PrismaClient,
    workspaceId: string,
    agentId: string | undefined,
    action: string,
    details: Record<string, unknown>
  ): Promise<void> {
    await db.auditLog.create({
      data: {
        workspaceId,
        agentId: agentId || null,
        action,
        severity: action.includes('error') || action.includes('failed') ? 'error' : 'info',
        resource: 'runtime_execution',
        details: JSON.stringify(details),
      },
    });
  }
}

// ═══════════════════════════════════════════════════════════
// SINGLETON EXPORT — Use this throughout the application
// ═══════════════════════════════════════════════════════════

let engineInstance: RuntimeEngine | null = null;

export function getRuntimeEngine(): RuntimeEngine {
  if (!engineInstance) {
    engineInstance = new RuntimeEngine();
  }
  return engineInstance;
}
