// ═══════════════════════════════════════════════════════════════
// NEXUS OS — Ollama Provider Adapter
// Real HTTP adapter for local Ollama models
// ═══════════════════════════════════════════════════════════════

import type { ProviderAdapter, RuntimeError } from './types';

const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434';

export class OllamaAdapter implements ProviderAdapter {
  type = 'ollama';

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
    const { baseUrl, modelId, prompt, systemPrompt, temperature, maxTokens, signal } = params;

    const endpoint = `${baseUrl || OLLAMA_DEFAULT_BASE_URL}/api/chat`;

    // Build messages array (OpenAI-compatible format for Ollama chat API)
    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const body: Record<string, unknown> = {
      model: modelId,
      messages,
      stream: false,
    };

    // Ollama options go in an "options" object
    const options: Record<string, unknown> = {};
    if (temperature !== undefined) options.temperature = temperature;
    if (maxTokens !== undefined) options.num_predict = maxTokens;

    if (Object.keys(options).length > 0) {
      body.options = options;
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

    // Parse Ollama response: { message: { role: "assistant", content: "..." }, ... }
    const data = await response.json();

    // Extract content from response.message.content
    const content = data?.message?.content;
    if (!content && content !== '') {
      throw {
        type: 'server_error',
        message: 'Ollama returned an empty response — no content in message.content',
        statusCode: response.status,
        providerType: this.type,
        retryable: true,
      } satisfies RuntimeError;
    }

    // Extract token usage from eval_count / prompt_eval_count
    const usage =
      data?.prompt_eval_count !== undefined || data?.eval_count !== undefined
        ? {
            promptTokens: data.prompt_eval_count ?? 0,
            completionTokens: data.eval_count ?? 0,
            totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
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
        message: `Ollama request timed out`,
        providerType: this.type,
        retryable: true,
      };
    }

    const message = err instanceof Error ? err.message : String(err);

    // Detect "connection refused" — Ollama is not running
    if (
      message.includes('ECONNREFUSED') ||
      message.includes('fetch failed') ||
      message.includes('connect')
    ) {
      return {
        type: 'connection_refused',
        message: `Ollama is not running or unreachable at localhost:11434. Start Ollama with: ollama serve`,
        providerType: this.type,
        retryable: false,
      };
    }

    return {
      type: 'connection_refused',
      message: `Ollama connection failed: ${message}`,
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
        : `Ollama HTTP ${response.status}`;

    switch (response.status) {
      case 400:
        throw {
          type: 'invalid_request',
          message: `Ollama invalid request: ${message}`,
          statusCode: 400,
          providerType: this.type,
          retryable: false,
        } satisfies RuntimeError;

      case 404:
        throw {
          type: 'invalid_request',
          message: `Ollama model not found: ${message}. Pull it with: ollama pull ${message.includes('model') ? 'MODEL_NAME' : '<model>'}`,
          statusCode: 404,
          providerType: this.type,
          retryable: false,
        } satisfies RuntimeError;

      case 500:
        throw {
          type: 'server_error',
          message: `Ollama server error: ${message}`,
          statusCode: 500,
          providerType: this.type,
          retryable: true,
        } satisfies RuntimeError;

      default:
        throw {
          type: 'unknown',
          message: `Ollama error (${response.status}): ${message}`,
          statusCode: response.status,
          providerType: this.type,
          retryable: response.status >= 500,
        } satisfies RuntimeError;
    }
  }
}
