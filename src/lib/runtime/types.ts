// ═══════════════════════════════════════════════════════════════
// AMEO AI — Runtime Execution Engine Types
// Core type definitions for the runtime AI execution layer
// ═══════════════════════════════════════════════════════════════

/**
 * Incoming runtime execution request
 */
export interface RuntimeRequest {
  workspaceId: string;
  providerId?: string;
  agentId?: string;
  workflowId?: string;
  requestType: 'chat' | 'completion' | 'embedding';
  prompt: string;
  systemPrompt?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  skipApproval?: boolean; // governance override
}

/**
 * Standardized runtime execution response
 */
export interface RuntimeResponse {
  success: boolean;
  executionId: string;
  response?: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs?: number;
  error?: string;
  approvalRequired?: boolean;
  approvalId?: string;
  verificationResult?: string;
  artifactId?: string;
}

/**
 * Provider adapter interface — all adapters must implement this
 */
export interface ProviderAdapter {
  /** Adapter identifier matching RuntimeProvider.type */
  type: string;

  /**
   * Execute a request against the provider's API.
   * Makes a REAL HTTP call — no mocking.
   */
  execute(params: {
    apiKey: string;
    baseUrl?: string;
    modelId: string;
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
  }): Promise<{
    content: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }>;
}

/**
 * Result from the runtime router — which provider to use and why
 */
export interface RouterResult {
  providerId: string;
  providerName: string;
  providerType: string;
  modelId: string;
  reason: string;
}

/**
 * Classification of runtime errors
 */
export type RuntimeErrorType =
  | 'auth_failed'
  | 'rate_limited'
  | 'timeout'
  | 'provider_unavailable'
  | 'invalid_request'
  | 'server_error'
  | 'connection_refused'
  | 'no_provider_available'
  | 'approval_required'
  | 'approval_rejected'
  | 'unknown';

/**
 * Structured runtime error
 */
export interface RuntimeError {
  type: RuntimeErrorType;
  message: string;
  statusCode?: number;
  providerType?: string;
  retryable: boolean;
}

/**
 * Default timeout for adapter requests (30 seconds)
 */
export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Minimum prompt length to consider generating an artifact
 */
export const ARTIFACT_MIN_LENGTH = 200;
