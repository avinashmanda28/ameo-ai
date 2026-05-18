// ═══════════════════════════════════════════════════════════════
// AMEO AI — Failure Classification System
// Classifies runtime errors into typed categories, determines
// severity and recovery actions, and records failures to the
// database with recurring pattern detection.
// ═══════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';
import type { ExecutionQueue, FailureRecord } from '@prisma/client';

// ─── Types ───────────────────────────────────────────────────

export type FailureType =
  | 'timeout'
  | 'auth_failed'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'connection_refused'
  | 'validation_failed'
  | 'unknown';

export type FailureSeverity = 'low' | 'medium' | 'high' | 'critical';

export type FailureCategory = 'runtime' | 'workflow' | 'governance' | 'network' | 'system';

export type RecoveryAction = 'retry' | 'fallback' | 'abort' | 'manual_intervention';

export interface ClassifiedFailure {
  type: FailureType;
  severity: FailureSeverity;
  category: FailureCategory;
  message: string;
  recoveryAction: RecoveryAction;
  retryable: boolean;
}

export interface ClassificationContext {
  providerType?: string;
  modelId?: string;
  executionId?: string;
  workspaceId?: string;
}

export interface RecordFailureParams {
  workspaceId: string;
  executionId?: string;
  queueId?: string;
  providerId?: string;
  providerType?: string;
  modelId?: string;
  workflowId?: string;
  error: unknown;
}

// ─── HTTP Status Code Mappings ──────────────────────────────

const HTTP_STATUS_CLASSIFICATIONS: Record<number, Partial<ClassifiedFailure>> = {
  401: {
    type: 'auth_failed',
    severity: 'high',
    category: 'runtime',
    recoveryAction: 'abort',
    retryable: false,
    message: 'Authentication failed — API key is invalid or missing',
  },
  403: {
    type: 'auth_failed',
    severity: 'high',
    category: 'governance',
    recoveryAction: 'abort',
    retryable: false,
    message: 'Access forbidden — insufficient permissions for this resource',
  },
  429: {
    type: 'rate_limited',
    severity: 'medium',
    category: 'network',
    recoveryAction: 'retry',
    retryable: true,
    message: 'Rate limit exceeded — too many requests in a short period',
  },
  500: {
    type: 'provider_unavailable',
    severity: 'high',
    category: 'system',
    recoveryAction: 'retry',
    retryable: true,
    message: 'Internal server error from the AI provider',
  },
  502: {
    type: 'provider_unavailable',
    severity: 'high',
    category: 'network',
    recoveryAction: 'retry',
    retryable: true,
    message: 'Bad gateway — the AI provider returned an invalid response',
  },
  503: {
    type: 'provider_unavailable',
    severity: 'high',
    category: 'network',
    recoveryAction: 'retry',
    retryable: true,
    message: 'Service unavailable — the AI provider is temporarily down',
  },
};

// ─── Error Message Patterns ──────────────────────────────────

const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  classification: Partial<ClassifiedFailure>;
}> = [
  // Timeout patterns
  {
    pattern: /abort|timeout|timed? ?out/i,
    classification: {
      type: 'timeout',
      severity: 'high',
      category: 'runtime',
      recoveryAction: 'retry',
      retryable: true,
    },
  },
  {
    pattern: /deadline exceeded/i,
    classification: {
      type: 'timeout',
      severity: 'high',
      category: 'runtime',
      recoveryAction: 'retry',
      retryable: true,
    },
  },
  // Connection patterns
  {
    pattern: /econnrefused|econnreset|enotfound/i,
    classification: {
      type: 'connection_refused',
      severity: 'critical',
      category: 'network',
      recoveryAction: 'retry',
      retryable: true,
    },
  },
  {
    pattern: /fetch failed|network error|network request failed/i,
    classification: {
      type: 'connection_refused',
      severity: 'high',
      category: 'network',
      recoveryAction: 'retry',
      retryable: true,
    },
  },
  {
    pattern: /socket hang up|broken pipe/i,
    classification: {
      type: 'connection_refused',
      severity: 'high',
      category: 'network',
      recoveryAction: 'retry',
      retryable: true,
    },
  },
  // Auth patterns
  {
    pattern: /invalid api key|invalid api_key|unauthorized|authentication failed/i,
    classification: {
      type: 'auth_failed',
      severity: 'high',
      category: 'runtime',
      recoveryAction: 'abort',
      retryable: false,
    },
  },
  {
    pattern: /forbidden|access denied|insufficient (scope|permission)/i,
    classification: {
      type: 'auth_failed',
      severity: 'high',
      category: 'governance',
      recoveryAction: 'abort',
      retryable: false,
    },
  },
  // Rate limit patterns
  {
    pattern: /rate limit|too many requests|quota exceeded|throttl/i,
    classification: {
      type: 'rate_limited',
      severity: 'medium',
      category: 'network',
      recoveryAction: 'retry',
      retryable: true,
    },
  },
  // Provider errors
  {
    pattern: /internal server error|server error|5\d{2}/i,
    classification: {
      type: 'provider_unavailable',
      severity: 'high',
      category: 'system',
      recoveryAction: 'retry',
      retryable: true,
    },
  },
  {
    pattern: /service unavailable|overloaded|capacity/i,
    classification: {
      type: 'provider_unavailable',
      severity: 'high',
      category: 'system',
      recoveryAction: 'fallback',
      retryable: true,
    },
  },
  {
    pattern: /bad gateway|gateway timeout|proxy error/i,
    classification: {
      type: 'provider_unavailable',
      severity: 'high',
      category: 'network',
      recoveryAction: 'retry',
      retryable: true,
    },
  },
  // Empty response
  {
    pattern: /empty response|empty (body|content)|no response/i,
    classification: {
      type: 'validation_failed',
      severity: 'medium',
      category: 'runtime',
      recoveryAction: 'retry',
      retryable: true,
    },
  },
  {
    pattern: /content filter|safety filter|blocked by policy/i,
    classification: {
      type: 'validation_failed',
      severity: 'medium',
      category: 'governance',
      recoveryAction: 'fallback',
      retryable: true,
    },
  },
];

// ─── Failure Classifier ──────────────────────────────────────

export class FailureClassifier {
  // ═══════════════════════════════════════════════════════════
  // CLASSIFY — Determine failure type, severity, and recovery
  // ═══════════════════════════════════════════════════════════

  classify(error: unknown, context?: ClassificationContext): ClassifiedFailure {
    // Already a classified failure — return as-is
    if (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      'severity' in error &&
      'recoveryAction' in error
    ) {
      return error as ClassifiedFailure;
    }

    const errorMessage = this.extractErrorMessage(error);
    const statusCode = this.extractStatusCode(error);

    // 1. Check HTTP status code classifications
    if (statusCode && HTTP_STATUS_CLASSIFICATIONS[statusCode]) {
      const httpClass = HTTP_STATUS_CLASSIFICATIONS[statusCode];
      return {
        type: (httpClass.type as FailureType) || 'unknown',
        severity: (httpClass.severity as FailureSeverity) || 'medium',
        category: (httpClass.category as FailureCategory) || 'runtime',
        message: httpClass.message || errorMessage,
        recoveryAction: (httpClass.recoveryAction as RecoveryAction) || 'abort',
        retryable: httpClass.retryable ?? false,
      };
    }

    // 2. Check AbortError / timeout
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        type: 'timeout',
        severity: 'high',
        category: 'runtime',
        message: errorMessage || 'Request was aborted (timeout)',
        recoveryAction: 'retry',
        retryable: true,
      };
    }

    // 3. Check error message patterns
    for (const { pattern, classification } of ERROR_PATTERNS) {
      if (pattern.test(errorMessage)) {
        return {
          type: (classification.type as FailureType) || 'unknown',
          severity: (classification.severity as FailureSeverity) || 'medium',
          category: (classification.category as FailureCategory) || 'runtime',
          message: errorMessage,
          recoveryAction: (classification.recoveryAction as RecoveryAction) || 'abort',
          retryable: classification.retryable ?? false,
        };
      }
    }

    // 4. Check for structured error objects from adapters
    if (error && typeof error === 'object') {
      const obj = error as Record<string, unknown>;

      // Check for status code in the error body
      if (typeof obj.status === 'number' && HTTP_STATUS_CLASSIFICATIONS[obj.status]) {
        const httpClass = HTTP_STATUS_CLASSIFICATIONS[obj.status];
        return {
          type: (httpClass.type as FailureType) || 'unknown',
          severity: (httpClass.severity as FailureSeverity) || 'medium',
          category: (httpClass.category as FailureCategory) || 'runtime',
          message: httpClass.message || errorMessage,
          recoveryAction: (httpClass.recoveryAction as RecoveryAction) || 'abort',
          retryable: httpClass.retryable ?? false,
        };
      }

      // Check for type field (from RuntimeError)
      if (typeof obj.type === 'string' && this.isValidFailureType(obj.type)) {
        const severity = this.inferSeverity(obj.type, errorMessage);
        return {
          type: obj.type as FailureType,
          severity,
          category: this.inferCategory(obj.type as FailureType),
          message: errorMessage,
          recoveryAction: this.inferRecoveryAction(obj.type as FailureType),
          retryable: this.isRetryable(obj.type as FailureType),
        };
      }

      // Check for error.message inside nested error objects
      if (obj.error && typeof obj.error === 'object') {
        const nestedError = obj.error as Record<string, unknown>;
        if (typeof nestedError.message === 'string') {
          for (const { pattern, classification } of ERROR_PATTERNS) {
            if (pattern.test(nestedError.message)) {
              return {
                type: (classification.type as FailureType) || 'unknown',
                severity: (classification.severity as FailureSeverity) || 'medium',
                category: (classification.category as FailureCategory) || 'runtime',
                message: nestedError.message,
                recoveryAction: (classification.recoveryAction as RecoveryAction) || 'abort',
                retryable: classification.retryable ?? false,
              };
            }
          }
        }
      }
    }

    // 5. Fallback — unknown error
    return {
      type: 'unknown',
      severity: 'low',
      category: 'system',
      message: errorMessage || 'An unknown error occurred',
      recoveryAction: 'abort',
      retryable: false,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // RECORD FAILURE — Persist to DB with recurring pattern check
  // ═══════════════════════════════════════════════════════════

  async recordFailure(
    dbClient: PrismaClient,
    params: RecordFailureParams
  ): Promise<FailureRecord> {
    // Classify the error
    const classified = this.classify(params.error, {
      providerType: params.providerType,
      modelId: params.modelId,
      executionId: params.executionId,
      workspaceId: params.workspaceId,
    });

    const errorMessage = this.extractErrorMessage(params.error);
    const errorStack = this.extractErrorStack(params.error);

    // Check for recurring failures of the same type within the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentFailures = await dbClient.failureRecord.findMany({
      where: {
        workspaceId: params.workspaceId,
        failureType: classified.type,
        createdAt: { gte: oneHourAgo },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const isRecurring = recentFailures.length >= 3;
    const occurrenceCount = recentFailures.length + 1; // include this new one

    // If recurring, escalate severity and recovery action
    let finalSeverity = classified.severity;
    let finalRecoveryAction = classified.recoveryAction;

    if (isRecurring) {
      finalSeverity = this.escalateSeverity(classified.severity);
      finalRecoveryAction = 'manual_intervention';
    }

    // Create the failure record
    const record = await dbClient.failureRecord.create({
      data: {
        workspaceId: params.workspaceId,
        executionId: params.executionId || null,
        queueId: params.queueId || null,
        providerId: params.providerId || null,
        workflowId: params.workflowId || null,
        failureType: classified.type,
        failureSeverity: finalSeverity,
        category: classified.category,
        errorMessage,
        errorStack: errorStack || null,
        providerType: params.providerType || null,
        modelId: params.modelId || null,
        recoveryAction: finalRecoveryAction,
        isRecurring,
        occurrenceCount,
      },
    });

    // Update linked queue item if queueId is provided
    if (params.queueId) {
      try {
        await dbClient.executionQueue.update({
          where: { id: params.queueId },
          data: {
            failureType: classified.type,
            failureSeverity: finalSeverity,
          },
        });
      } catch {
        // Queue item might not exist — non-fatal
      }
    }

    return record;
  }

  // ═══════════════════════════════════════════════════════════
  // GET FAILURE HISTORY — For pattern analysis
  // ═══════════════════════════════════════════════════════════

  async getFailureHistory(
    dbClient: PrismaClient,
    params: {
      workspaceId: string;
      providerType?: string;
      failureType?: FailureType;
      since?: Date;
      limit?: number;
    }
  ): Promise<FailureRecord[]> {
    const where: Record<string, unknown> = {
      workspaceId: params.workspaceId,
    };

    if (params.providerType) {
      where.providerType = params.providerType;
    }
    if (params.failureType) {
      where.failureType = params.failureType;
    }
    if (params.since) {
      where.createdAt = { gte: params.since };
    }

    return dbClient.failureRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 50,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // GET FAILURE SUMMARY — Aggregate statistics
  // ═══════════════════════════════════════════════════════════

  async getFailureSummary(
    dbClient: PrismaClient,
    workspaceId: string,
    since?: Date
  ): Promise<{
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    recurring: number;
  }> {
    const where: Record<string, unknown> = { workspaceId };
    if (since) {
      where.createdAt = { gte: since };
    }

    const records = await dbClient.failureRecord.findMany({
      where,
      select: {
        failureType: true,
        failureSeverity: true,
        category: true,
        isRecurring: true,
      },
    });

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let recurring = 0;

    for (const record of records) {
      byType[record.failureType] = (byType[record.failureType] || 0) + 1;
      bySeverity[record.failureSeverity] = (bySeverity[record.failureSeverity] || 0) + 1;
      byCategory[record.category] = (byCategory[record.category] || 0) + 1;
      if (record.isRecurring) recurring++;
    }

    return {
      total: records.length,
      byType,
      bySeverity,
      byCategory,
      recurring,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (error && typeof error === 'object') {
      const obj = error as Record<string, unknown>;
      if (typeof obj.message === 'string') return obj.message;
      if (typeof obj.error === 'string') return obj.error;
      if (obj.error && typeof obj.error === 'object') {
        const nested = obj.error as Record<string, unknown>;
        if (typeof nested.message === 'string') return nested.message;
      }
    }
    if (typeof error === 'string') return error;
    return String(error);
  }

  private extractErrorStack(error: unknown): string | undefined {
    if (error instanceof Error && error.stack) {
      return error.stack;
    }
    if (error && typeof error === 'object') {
      const obj = error as Record<string, unknown>;
      if (typeof obj.stack === 'string') return obj.stack;
    }
    return undefined;
  }

  private extractStatusCode(error: unknown): number | undefined {
    if (error && typeof error === 'object') {
      const obj = error as Record<string, unknown>;
      if (typeof obj.statusCode === 'number') return obj.statusCode;
      if (typeof obj.status === 'number') return obj.status;
      if (typeof obj.code === 'number' && obj.code >= 400 && obj.code < 600) return obj.code;
    }
    return undefined;
  }

  private isValidFailureType(type: string): type is FailureType {
    const validTypes: FailureType[] = [
      'timeout',
      'auth_failed',
      'rate_limited',
      'provider_unavailable',
      'connection_refused',
      'validation_failed',
      'unknown',
    ];
    return validTypes.includes(type as FailureType);
  }

  private inferSeverity(type: FailureType, message: string): FailureSeverity {
    switch (type) {
      case 'connection_refused':
        return 'critical';
      case 'timeout':
      case 'auth_failed':
      case 'provider_unavailable':
        return 'high';
      case 'rate_limited':
      case 'validation_failed':
        return 'medium';
      case 'unknown':
      default:
        // Try to infer from message
        if (/critical|fatal|emergency/i.test(message)) return 'critical';
        if (/error|fail/i.test(message)) return 'high';
        if (/warn/i.test(message)) return 'medium';
        return 'low';
    }
  }

  private inferCategory(type: FailureType): FailureCategory {
    switch (type) {
      case 'auth_failed':
        return 'governance';
      case 'rate_limited':
      case 'connection_refused':
      case 'provider_unavailable':
        return 'network';
      case 'validation_failed':
        return 'runtime';
      case 'timeout':
        return 'system';
      default:
        return 'system';
    }
  }

  private inferRecoveryAction(type: FailureType): RecoveryAction {
    switch (type) {
      case 'auth_failed':
        return 'abort';
      case 'timeout':
      case 'rate_limited':
      case 'connection_refused':
        return 'retry';
      case 'provider_unavailable':
        return 'fallback';
      case 'validation_failed':
        return 'retry';
      default:
        return 'abort';
    }
  }

  private isRetryable(type: FailureType): boolean {
    switch (type) {
      case 'timeout':
      case 'rate_limited':
      case 'connection_refused':
      case 'provider_unavailable':
      case 'validation_failed':
        return true;
      case 'auth_failed':
      default:
        return false;
    }
  }

  private escalateSeverity(current: FailureSeverity): FailureSeverity {
    const escalation: Record<FailureSeverity, FailureSeverity> = {
      low: 'medium',
      medium: 'high',
      high: 'critical',
      critical: 'critical',
    };
    return escalation[current];
  }
}

// ═══════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════

let classifierInstance: FailureClassifier | null = null;

export function getFailureClassifier(): FailureClassifier {
  if (!classifierInstance) {
    classifierInstance = new FailureClassifier();
  }
  return classifierInstance;
}
