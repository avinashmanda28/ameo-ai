// ═══════════════════════════════════════════════════════════════
// AMEO AI — Integration Hub (System 10)
// Centralized external service connection manager with modular
// provider adapters, token management, health monitoring,
// and reconnect logic.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getEventBus } from '@/lib/services/event-bus';

// ─── Types ───

export interface IntegrationConfig {
  id: string;
  workspaceId: string;
  provider: string;
  name: string;
  description?: string | null;
  connectionStatus: string;
  apiKey?: string | null;
  apiSecret?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  scopes?: string | null;
  config?: string | null;
  settings?: string | null;
  healthScore?: number | null;
  healthStatus: string;
  lastHealthCheckAt?: Date | null;
  lastConnectedAt?: Date | null;
  lastErrorAt?: Date | null;
  lastErrorMessage?: string | null;
  syncCount: number;
  errorCount: number;
  lastSyncAt?: Date | null;
  metadata?: string | null;
  tags?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderAdapter {
  provider: string;
  name: string;
  connect(config: Record<string, unknown>): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    metadata?: Record<string, unknown>;
  }>;
  disconnect(integration: IntegrationConfig): Promise<void>;
  validateConnection(integration: IntegrationConfig): Promise<{
    valid: boolean;
    healthScore: number;
    metadata?: Record<string, unknown>;
  }>;
  refreshToken?(integration: IntegrationConfig): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }>;
  sync?(integration: IntegrationConfig, resource: string): Promise<{
    synced: number;
    errors: number;
    metadata?: Record<string, unknown>;
  }>;
  webhookHandler?(integration: IntegrationConfig, event: string, payload: unknown): Promise<void>;
}

export interface SyncResult {
  synced: number;
  errors: number;
  total: number;
  resource: string;
  metadata?: Record<string, unknown>;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'error' | 'unknown';
  score: number;
  latencyMs: number;
  message?: string;
}

// ─── Provider Registry ───

const providerRegistry = new Map<string, ProviderAdapter>();

export function registerProviderAdapter(adapter: ProviderAdapter): void {
  providerRegistry.set(adapter.provider, adapter);
}

export function getProviderAdapter(provider: string): ProviderAdapter | undefined {
  return providerRegistry.get(provider);
}

export function getRegisteredProviders(): string[] {
  return Array.from(providerRegistry.keys());
}

// ─── Integration Hub ───

export class IntegrationHub {
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  // ─── CRUD ───

  async listIntegrations(): Promise<IntegrationConfig[]> {
    return db.integration.findMany({
      where: { workspaceId: this.workspaceId },
      orderBy: { createdAt: 'desc' },
    }) as unknown as IntegrationConfig[];
  }

  async getIntegration(id: string): Promise<IntegrationConfig | null> {
    return db.integration.findFirst({
      where: { id, workspaceId: this.workspaceId },
    }) as unknown as IntegrationConfig | null;
  }

  async createIntegration(data: {
    provider: string;
    name: string;
    description?: string;
    apiKey?: string;
    apiSecret?: string;
    config?: Record<string, unknown>;
  }): Promise<IntegrationConfig> {
    const integration = await db.integration.create({
      data: {
        workspaceId: this.workspaceId,
        provider: data.provider,
        name: data.name,
        description: data.description,
        apiKey: data.apiKey,
        apiSecret: data.apiSecret,
        config: data.config ? JSON.stringify(data.config) : null,
        connectionStatus: 'disconnected',
        healthStatus: 'unknown',
      },
    });
    return integration as unknown as IntegrationConfig;
  }

  async updateIntegration(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      config: Record<string, unknown>;
      settings: Record<string, unknown>;
      tags: string[];
    }>
  ): Promise<IntegrationConfig | null> {
    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.config) updateData.config = JSON.stringify(data.config);
    if (data.settings) updateData.settings = JSON.stringify(data.settings);
    if (data.tags) updateData.tags = JSON.stringify(data.tags);

    const integration = await db.integration.update({
      where: { id, workspaceId: this.workspaceId },
      data: updateData,
    });
    return integration as unknown as IntegrationConfig;
  }

  async deleteIntegration(id: string): Promise<void> {
    await db.integration.delete({
      where: { id, workspaceId: this.workspaceId },
    });
  }

  // ─── Connection Management ───

  async connect(id: string, connectionData?: Record<string, unknown>): Promise<IntegrationConfig> {
    const integration = await this.getIntegration(id);
    if (!integration) throw new Error(`Integration ${id} not found`);

    const adapter = getProviderAdapter(integration.provider);
    if (!adapter) throw new Error(`No adapter registered for provider: ${integration.provider}`);

    await db.integration.update({
      where: { id },
      data: { connectionStatus: 'connecting' },
    });

    try {
      const result = await adapter.connect(connectionData || {});

      const updated = await db.integration.update({
        where: { id },
        data: {
          connectionStatus: 'connected',
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          tokenExpiresAt: result.expiresAt,
          lastConnectedAt: new Date(),
          healthStatus: 'healthy',
          healthScore: 100,
          metadata: result.metadata ? JSON.stringify(result.metadata) : integration.metadata,
        },
      });

      const eventBus = getEventBus();
      await eventBus.emit({
        workspaceId: this.workspaceId,
        eventType: 'integration.connected',
        source: 'integration-hub',
        level: 'info',
        payload: { integrationId: id, provider: integration.provider },
        resourceType: 'integration',
        resourceId: id,
      });

      return updated as unknown as IntegrationConfig;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
      await db.integration.update({
        where: { id },
        data: {
          connectionStatus: 'error',
          lastErrorAt: new Date(),
          lastErrorMessage: errorMessage,
          healthStatus: 'error',
          healthScore: 0,
        },
      });
      throw error;
    }
  }

  async disconnect(id: string): Promise<void> {
    const integration = await this.getIntegration(id);
    if (!integration) throw new Error(`Integration ${id} not found`);

    const adapter = getProviderAdapter(integration.provider);
    if (adapter) {
      try {
        await adapter.disconnect(integration);
      } catch {
        // Non-blocking — clean up local state regardless
      }
    }

    await db.integration.update({
      where: { id },
      data: {
        connectionStatus: 'disconnected',
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
        lastConnectedAt: null,
        healthStatus: 'unknown',
        healthScore: 0,
      },
    });
  }

  // ─── Health Monitoring ───

  async checkHealth(id: string): Promise<HealthCheckResult> {
    const integration = await this.getIntegration(id);
    if (!integration) throw new Error(`Integration ${id} not found`);

    const adapter = getProviderAdapter(integration.provider);
    if (!adapter) {
      return { status: 'unknown', score: 0, latencyMs: 0, message: 'No adapter registered' };
    }

    const startTime = Date.now();
    try {
      const result = await adapter.validateConnection(integration);
      const latencyMs = Date.now() - startTime;

      const status = result.healthScore >= 80 ? 'healthy' : result.healthScore >= 40 ? 'degraded' : 'error';

      await db.integration.update({
        where: { id },
        data: {
          healthStatus: status,
          healthScore: result.healthScore,
          lastHealthCheckAt: new Date(),
        },
      });

      return { status, score: result.healthScore, latencyMs };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      await db.integration.update({
        where: { id },
        data: {
          healthStatus: 'error',
          healthScore: 0,
          lastHealthCheckAt: new Date(),
          lastErrorAt: new Date(),
          lastErrorMessage: error instanceof Error ? error.message : 'Health check failed',
        },
      });

      return {
        status: 'error',
        score: 0,
        latencyMs,
        message: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  }

  async checkAllHealth(): Promise<HealthCheckResult[]> {
    const integrations = await this.listIntegrations();
    const results = await Promise.allSettled(
      integrations
        .filter((i) => i.connectionStatus === 'connected')
        .map((i) => this.checkHealth(i.id))
    );
    return results
      .filter((r): r is PromiseFulfilledResult<HealthCheckResult> => r.status === 'fulfilled')
      .map((r) => r.value);
  }

  // ─── Token Management ───

  async refreshAccessToken(id: string): Promise<void> {
    const integration = await this.getIntegration(id);
    if (!integration) throw new Error(`Integration ${id} not found`);

    const adapter = getProviderAdapter(integration.provider);
    if (!adapter?.refreshToken) {
      throw new Error(`Provider ${integration.provider} does not support token refresh`);
    }

    if (integration.tokenExpiresAt && integration.tokenExpiresAt > new Date()) {
      return; // Token still valid
    }

    try {
      const result = await adapter.refreshToken(integration);
      await db.integration.update({
        where: { id },
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          tokenExpiresAt: result.expiresAt,
        },
      });
    } catch (error) {
      await db.integration.update({
        where: { id },
        data: {
          connectionStatus: 'error',
          lastErrorAt: new Date(),
          lastErrorMessage: error instanceof Error ? error.message : 'Token refresh failed',
        },
      });
      throw error;
    }
  }

  // ─── Sync Operations ───

  async sync(id: string, resource: string): Promise<SyncResult> {
    const integration = await this.getIntegration(id);
    if (!integration) throw new Error(`Integration ${id} not found`);

    const adapter = getProviderAdapter(integration.provider);
    if (!adapter?.sync) {
      throw new Error(`Provider ${integration.provider} does not support sync`);
    }

    // Refresh token if needed
    if (integration.tokenExpiresAt && integration.tokenExpiresAt <= new Date()) {
      await this.refreshAccessToken(id);
    }

    const startTime = Date.now();
    try {
      const result = await adapter.sync(integration, resource);

      await db.integration.update({
        where: { id },
        data: {
          syncCount: { increment: result.synced },
          lastSyncAt: new Date(),
          healthStatus: 'healthy',
        },
      });

      const eventBus = getEventBus();
      await eventBus.emit({
        workspaceId: this.workspaceId,
        eventType: 'integration.sync.completed',
        source: 'integration-hub',
        level: 'info',
        payload: { integrationId: id, resource, ...result },
        resourceType: 'integration',
        resourceId: id,
      });

      return {
        synced: result.synced,
        errors: result.errors,
        total: result.synced + result.errors,
        resource,
        metadata: result.metadata,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      await db.integration.update({
        where: { id },
        data: {
          errorCount: { increment: 1 },
          lastErrorAt: new Date(),
          lastErrorMessage: errorMessage,
          healthStatus: 'error',
        },
      });
      throw error;
    }
  }

  async syncAll(resource: string): Promise<SyncResult[]> {
    const integrations = await this.listIntegrations();
    const connected = integrations.filter((i) => i.connectionStatus === 'connected');
    const results = await Promise.allSettled(
      connected.map((i) => this.sync(i.id, resource))
    );
    return results
      .filter((r): r is PromiseFulfilledResult<SyncResult> => r.status === 'fulfilled')
      .map((r) => r.value);
  }

  // ─── Webhook Processing ───

  async processWebhook(
    provider: string,
    eventType: string,
    eventId: string | undefined,
    rawBody: string,
    integrationId?: string
  ): Promise<void> {
    // Record the webhook event
    const webhookEvent = await db.webhookEvent.create({
      data: {
        workspaceId: this.workspaceId,
        integrationId: integrationId || null,
        provider,
        eventType,
        eventId: eventId || null,
        rawBody,
        status: 'processing',
      },
    });

    try {
      if (integrationId) {
        const integration = await this.getIntegration(integrationId);
        if (integration) {
          const adapter = getProviderAdapter(integration.provider);
          if (adapter?.webhookHandler) {
            const payload = JSON.parse(rawBody);
            await adapter.webhookHandler(integration, eventType, payload);
          }
        }
      }

      await db.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: 'processed',
          processedData: rawBody,
          processedAt: new Date(),
        },
      });
    } catch (error) {
      await db.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: 'failed',
          processingError: error instanceof Error ? error.message : 'Webhook processing failed',
        },
      });
    }
  }

  // ─── Metrics & Stats ───

  async getStats(): Promise<{
    total: number;
    connected: number;
    error: number;
    disconnected: number;
    healthScore: number;
  }> {
    const integrations = await this.listIntegrations();
    const total = integrations.length;
    const connected = integrations.filter((i) => i.connectionStatus === 'connected').length;
    const error = integrations.filter((i) => i.connectionStatus === 'error').length;
    const disconnected = integrations.filter((i) => i.connectionStatus === 'disconnected').length;
    const avgHealth =
      integrations.length > 0
        ? integrations.reduce((sum, i) => sum + (i.healthScore || 0), 0) / integrations.length
        : 0;

    return { total, connected, error, disconnected, healthScore: Math.round(avgHealth) };
  }
}

// ─── Singleton Factory ───

const hubInstances = new Map<string, IntegrationHub>();

export function getIntegrationHub(workspaceId: string): IntegrationHub {
  let hub = hubInstances.get(workspaceId);
  if (!hub) {
    hub = new IntegrationHub(workspaceId);
    hubInstances.set(workspaceId, hub);
  }
  return hub;
}
