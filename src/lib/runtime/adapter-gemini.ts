// ═══════════════════════════════════════════════════════════════
// AMEO AI — Gemini Provider Adapter
// Real HTTP adapter for the Google Gemini API
// ═══════════════════════════════════════════════════════════════

import type { ProviderAdapter, RuntimeError } from './types';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiAdapter implements ProviderAdapter {
  type = 'gemini';

  async execute(params: {
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
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  }> {
    const { apiKey, modelId, prompt, systemPrompt, temperature, maxTokens, signal } = params;

    const endpoint = `${GEMINI_BASE_URL}/${modelId}:generateContent?key=${apiKey}`;

    // Build Gemini request body
    const body: Record<string, unknown> = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    };

    // System instruction goes at top level for Gemini
    if (systemPrompt) {
      body.systemInstruction = {
        parts: [{ text: systemPrompt }],
      };
    }

    // Generation config
    const generationConfig: Record<string, unknown> = {};
    if (temperature !== undefined) generationConfig.temperature = temperature;
    if (maxTokens !== undefined) generationConfig.maxOutputTokens = maxTokens;

    if (Object.keys(generationConfig).length > 0) {
      body.generationConfig = generationConfig;
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      throw this.classifyError(err);
    }

    // Handle non-OK responses
    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    // Parse Gemini response format
    const data = await response.json();

    // Extract content: response.candidates[0].content.parts[0].text
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content && content !== '') {
      // Check if blocked by safety
      const blockReason = data?.candidates?.[0]?.finishReason;
      if (blockReason === 'SAFETY') {
        throw {
          type: 'invalid_request',
          message: `Gemini response blocked by safety filters`,
          statusCode: response.status,
          providerType: this.type,
          retryable: false,
        } satisfies RuntimeError;
      }

      throw {
        type: 'server_error',
        message: `Gemini returned an empty response — no content in candidates[0].content.parts[0].text`,
        statusCode: response.status,
        providerType: this.type,
        retryable: true,
      } satisfies RuntimeError;
    }

    // Extract token usage from usageMetadata
    const rawUsage = data?.usageMetadata;
    const usage = rawUsage
      ? {
          promptTokens: rawUsage.promptTokenCount ?? 0,
          completionTokens: rawUsage.candidatesTokenCount ?? 0,
          totalTokens: rawUsage.totalTokenCount ?? 0,
        }
      : undefined;

    return { content, usage };
  }

  /**
   * Classify fetch-level errors (network, abort, etc.)
   */
  private classifyError(err: unknown): RuntimeError {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        type: 'timeout',
        message: `Gemini request timed out`,
        providerType: this.type,
        retryable: true,
      };
    }

    return {
      type: 'connection_refused',
      message: `Gemini connection failed: ${err instanceof Error ? err.message : String(err)}`,
      providerType: this.type,
      retryable: true,
    };
  }

  /**
   * Parse and throw structured errors for HTTP error responses
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      // response body is not JSON
    }

    const message =
      (errorBody as Record<string, unknown>)?.error
        ? String(((errorBody as Record<string, unknown>).error as Record<string, unknown>)?.message ?? (errorBody as Record<string, unknown>).error)
        : `Gemini HTTP ${response.status}`;

    switch (response.status) {
      case 400:
      case 403:
        throw {
          type: 'auth_failed',
          message: `Gemini authentication/permission failed: ${message}`,
          statusCode: response.status,
          providerType: this.type,
          retryable: false,
        } satisfies RuntimeError;

      case 429:
        throw {
          type: 'rate_limited',
          message: `Gemini rate limit exceeded: ${message}`,
          statusCode: 429,
          providerType: this.type,
          retryable: true,
        } satisfies RuntimeError;

      case 404:
        throw {
          type: 'invalid_request',
          message: `Gemini model not found: ${message}`,
          statusCode: 404,
          providerType: this.type,
          retryable: false,
        } satisfies RuntimeError;

      case 500:
      case 503:
        throw {
          type: 'server_error',
          message: `Gemini server error: ${message}`,
          statusCode: response.status,
          providerType: this.type,
          retryable: true,
        } satisfies RuntimeError;

      default:
        throw {
          type: 'unknown',
          message: `Gemini error (${response.status}): ${message}`,
          statusCode: response.status,
          providerType: this.type,
          retryable: response.status >= 500,
        } satisfies RuntimeError;
    }
  }
}
