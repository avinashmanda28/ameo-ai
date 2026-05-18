// ═══════════════════════════════════════════════════════════════
// AMEO AI — OpenRouter Provider Adapter
// Real HTTP adapter for the OpenRouter API (OpenAI-compatible)
// ═══════════════════════════════════════════════════════════════

import type { ProviderAdapter, RuntimeError } from './types';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export class OpenRouterAdapter implements ProviderAdapter {
  type = 'openrouter';

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

    // Build messages array
    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const body: Record<string, unknown> = {
      model: modelId,
      messages,
    };

    if (temperature !== undefined) body.temperature = temperature;
    if (maxTokens !== undefined) body.max_tokens = maxTokens;

    let response: Response;
    try {
      response = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ameo.ai',
          'X-Title': 'Ameo AI',
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

    // Parse the OpenAI-compatible response
    const data = await response.json();

    // Extract content from response
    const content = data?.choices?.[0]?.message?.content;
    if (!content && content !== '') {
      throw {
        type: 'server_error',
        message: 'OpenRouter returned an empty response — no content in choices[0].message.content',
        statusCode: response.status,
        providerType: this.type,
        retryable: true,
      } satisfies RuntimeError;
    }

    // Extract token usage
    const rawUsage = data?.usage;
    const usage = rawUsage
      ? {
          promptTokens: rawUsage.prompt_tokens ?? 0,
          completionTokens: rawUsage.completion_tokens ?? 0,
          totalTokens: rawUsage.total_tokens ?? 0,
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
        message: `OpenRouter request timed out`,
        providerType: this.type,
        retryable: true,
      };
    }

    return {
      type: 'connection_refused',
      message: `OpenRouter connection failed: ${err instanceof Error ? err.message : String(err)}`,
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
        ? String((errorBody as Record<string, unknown>).error)
        : `OpenRouter HTTP ${response.status}`;

    switch (response.status) {
      case 401:
        throw {
          type: 'auth_failed',
          message: `OpenRouter authentication failed: ${message}`,
          statusCode: 401,
          providerType: this.type,
          retryable: false,
        } satisfies RuntimeError;

      case 429:
        throw {
          type: 'rate_limited',
          message: `OpenRouter rate limit exceeded: ${message}`,
          statusCode: 429,
          providerType: this.type,
          retryable: true,
        } satisfies RuntimeError;

      case 400:
      case 422:
        throw {
          type: 'invalid_request',
          message: `OpenRouter invalid request: ${message}`,
          statusCode: response.status,
          providerType: this.type,
          retryable: false,
        } satisfies RuntimeError;

      case 500:
      case 502:
      case 503:
        throw {
          type: 'server_error',
          message: `OpenRouter server error: ${message}`,
          statusCode: response.status,
          providerType: this.type,
          retryable: true,
        } satisfies RuntimeError;

      default:
        throw {
          type: 'unknown',
          message: `OpenRouter error (${response.status}): ${message}`,
          statusCode: response.status,
          providerType: this.type,
          retryable: response.status >= 500,
        } satisfies RuntimeError;
    }
  }
}
