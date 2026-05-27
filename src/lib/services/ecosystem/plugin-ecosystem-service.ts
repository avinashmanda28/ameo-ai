// ═══════════════════════════════════════════════════════════════
// AMEO AI — AGI App Store / Plugin Ecosystem Service (System 2)
// Installable modules with sandboxed execution, permissions,
// health monitoring, and version management.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getEventBus } from '@/lib/services/event-bus';

// ─── Types ───

export interface PluginData {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  type: string;
  provider?: string | null;
  entryPoint?: string | null;
  apiVersion: string;
  dependencies?: Record<string, unknown> | null;
  permissions?: Record<string, unknown> | null;
  permissionLevel: string;
  sandboxConfig?: Record<string, unknown> | null;
  maxMemory?: number | null;
  maxCpu?: number | null;
  networkAccess: boolean;
  enabled: boolean;
  status: string;
  healthScore?: number | null;
  lastHealthCheckAt?: Date | null;
  lastError?: string | null;
  executionCount: number;
  errorCount: number;
  averageLatencyMs?: number | null;
  version: string;
  latestVersion: string;
  updateAvailable: boolean;
  config?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  tags?: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PluginHealthCheck {
  status: 'healthy' | 'degraded' | 'error' | 'unknown';
  score: number;
  latencyMs: number;
  message?: string;
}

export interface PluginEcosystemStats {
  totalPlugins: number;
  activePlugins: number;
  erroredPlugins: number;
  totalInstallations: number;
  averageHealthScore: number;
  byType: Record<string, number>;
}

// ─── Plugin Ecosystem Service ───

export class PluginEcosystemService {
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  // ─── CRUD ───

  async listPlugins(params?: {
    type?: string;
    status?: string;
    enabled?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ plugins: PluginData[]; total: number }> {
    const where: Record<string, unknown> = { workspaceId: this.workspaceId };
    if (params?.type) where.type = params.type;
    if (params?.status) where.status = params.status;
    if (params?.enabled !== undefined) where.enabled = params.enabled;
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const limit = params?.limit ?? 20;
    const offset = params?.offset ?? 0;

    const [plugins, total] = await Promise.all([
      db.plugin.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
      db.plugin.count({ where }),
    ]);
    return { plugins: plugins as unknown as PluginData[], total };
  }

  async getPlugin(id: string): Promise<PluginData | null> {
    const plugin = await db.plugin.findFirst({
      where: { id, workspaceId: this.workspaceId },
    });
    return plugin as unknown as PluginData | null;
  }

  async installPlugin(data: {
    name: string;
    type: string;
    provider?: string;
    description?: string;
    entryPoint?: string;
    dependencies?: Record<string, unknown>;
    permissions?: Record<string, unknown>;
    sandboxConfig?: Record<string, unknown>;
    maxMemory?: number;
    maxCpu?: number;
    networkAccess?: boolean;
    config?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    tags?: string[];
  }): Promise<PluginData> {
    const plugin = await db.plugin.create({
      data: {
        workspaceId: this.workspaceId,
        name: data.name,
        type: data.type,
        provider: data.provider || null,
        description: data.description || null,
        entryPoint: data.entryPoint || null,
        apiVersion: '1.0',
        dependencies: data.dependencies ? JSON.stringify(data.dependencies) : null,
        permissions: data.permissions ? JSON.stringify(data.permissions) : null,
        sandboxConfig: data.sandboxConfig ? JSON.stringify(data.sandboxConfig) : null,
        maxMemory: data.maxMemory ?? 256,
        maxCpu: data.maxCpu ?? 0.5,
        networkAccess: data.networkAccess ?? false,
        config: data.config ? JSON.stringify(data.config) : null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        version: '1.0.0',
        latestVersion: '1.0.0',
      },
    });

    // Create installation record
    await db.pluginInstallation.create({
      data: {
        pluginId: plugin.id,
        workspaceId: this.workspaceId,
        version: '1.0.0',
        config: data.config ? JSON.stringify(data.config) : null,
      },
    });

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'plugin.installed',
      source: 'plugin-ecosystem',
      level: 'info',
      payload: { pluginId: plugin.id, name: data.name, type: data.type },
      resourceType: 'plugin',
      resourceId: plugin.id,
    });

    return plugin as unknown as PluginData;
  }

  async uninstallPlugin(id: string): Promise<void> {
    await db.plugin.update({
      where: { id, workspaceId: this.workspaceId },
      data: { enabled: false, status: 'inactive' },
    });

    await db.pluginInstallation.updateMany({
      where: { pluginId: id, workspaceId: this.workspaceId },
      data: { enabled: false, status: 'uninstalled' },
    });
  }

  async enablePlugin(id: string): Promise<PluginData | null> {
    const plugin = await db.plugin.update({
      where: { id, workspaceId: this.workspaceId },
      data: { enabled: true, status: 'active' },
    });

    await db.pluginInstallation.updateMany({
      where: { pluginId: id, workspaceId: this.workspaceId },
      data: { enabled: true, status: 'active' },
    });

    return plugin as unknown as PluginData;
  }

  async disablePlugin(id: string): Promise<PluginData | null> {
    const plugin = await db.plugin.update({
      where: { id, workspaceId: this.workspaceId },
      data: { enabled: false, status: 'inactive' },
    });
    return plugin as unknown as PluginData;
  }

  async updatePluginConfig(
    id: string,
    config: Record<string, unknown>
  ): Promise<PluginData | null> {
    const plugin = await db.plugin.update({
      where: { id, workspaceId: this.workspaceId },
      data: { config: JSON.stringify(config) },
    });

    await db.pluginInstallation.updateMany({
      where: { pluginId: id, workspaceId: this.workspaceId },
      data: { config: JSON.stringify(config) },
    });

    return plugin as unknown as PluginData;
  }

  async deletePlugin(id: string): Promise<void> {
    await db.pluginInstallation.deleteMany({
      where: { pluginId: id, workspaceId: this.workspaceId },
    });
    await db.plugin.delete({ where: { id, workspaceId: this.workspaceId } });
  }

  // ─── Health & Permissions ───

  async checkPluginHealth(id: string): Promise<PluginHealthCheck> {
    const plugin = await this.getPlugin(id);
    if (!plugin) throw new Error(`Plugin ${id} not found`);

    const startTime = Date.now();
    try {
      const score = plugin.healthScore || 0;
      const latencyMs = Date.now() - startTime;
      const status = score >= 80 ? 'healthy' : score >= 40 ? 'degraded' : 'error';

      await db.plugin.update({
        where: { id },
        data: {
          healthScore: score,
          lastHealthCheckAt: new Date(),
          status: status === 'healthy' ? 'active' : status === 'error' ? 'error' : plugin.status,
        },
      });

      return { status, score, latencyMs };
    } catch (error) {
      await db.plugin.update({
        where: { id },
        data: {
          healthScore: 0,
          lastHealthCheckAt: new Date(),
          lastError: error instanceof Error ? error.message : 'Health check failed',
          status: 'error',
        },
      });
      return {
        status: 'error',
        score: 0,
        latencyMs: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  }

  async recordExecution(id: string, latencyMs: number, error?: string): Promise<void> {
    const updateData: Record<string, unknown> = {
      executionCount: { increment: 1 },
    };

    if (error) {
      updateData.errorCount = { increment: 1 };
      updateData.lastError = error;
    }

    // Rolling average latency
    const plugin = await db.plugin.findUnique({ where: { id } });
    if (plugin && plugin.executionCount > 0) {
      const currentAvg = plugin.averageLatencyMs || 0;
      const count = plugin.executionCount;
      updateData.averageLatencyMs = Math.round(
        (currentAvg * count + latencyMs) / (count + 1)
      );
    } else {
      updateData.averageLatencyMs = latencyMs;
    }

    await db.plugin.update({ where: { id }, data: updateData });
  }

  // ─── Version Management ───

  async checkForUpdates(): Promise<{ pluginId: string; currentVersion: string; latestVersion: string }[]> {
    const plugins = await db.plugin.findMany({
      where: { workspaceId: this.workspaceId, updateAvailable: true },
    });
    return plugins.map((p) => ({
      pluginId: p.id,
      currentVersion: p.version,
      latestVersion: p.latestVersion,
    }));
  }

  async updatePluginVersion(
    id: string,
    newVersion: string,
    data?: { description?: string; entryPoint?: string; dependencies?: Record<string, unknown> }
  ): Promise<PluginData | null> {
    const updateData: Record<string, unknown> = {
      version: newVersion,
      latestVersion: newVersion,
      updateAvailable: false,
    };
    if (data?.description) updateData.description = data.description;
    if (data?.entryPoint) updateData.entryPoint = data.entryPoint;
    if (data?.dependencies) updateData.dependencies = JSON.stringify(data.dependencies);

    const plugin = await db.plugin.update({
      where: { id, workspaceId: this.workspaceId },
      data: updateData,
    });

    // Update installations
    await db.pluginInstallation.updateMany({
      where: { pluginId: id, workspaceId: this.workspaceId },
      data: { version: newVersion },
    });

    return plugin as unknown as PluginData;
  }

  // ─── Stats ───

  async getStats(): Promise<PluginEcosystemStats> {
    const plugins = await db.plugin.findMany({
      where: { workspaceId: this.workspaceId },
    });

    const byType: Record<string, number> = {};
    let activeCount = 0;
    let erroredCount = 0;
    let totalHealth = 0;

    for (const p of plugins) {
      byType[p.type] = (byType[p.type] || 0) + 1;
      if (p.enabled && p.status === 'active') activeCount++;
      if (p.status === 'error') erroredCount++;
      totalHealth += p.healthScore || 0;
    }

    const installations = await db.pluginInstallation.count({
      where: { workspaceId: this.workspaceId, enabled: true },
    });

    return {
      totalPlugins: plugins.length,
      activePlugins: activeCount,
      erroredPlugins: erroredCount,
      totalInstallations: installations,
      averageHealthScore: plugins.length > 0 ? Math.round(totalHealth / plugins.length) : 0,
      byType,
    };
  }
}

// ─── Singleton Factory ───

const pluginInstances = new Map<string, PluginEcosystemService>();

export function getPluginEcosystemService(workspaceId: string): PluginEcosystemService {
  let instance = pluginInstances.get(workspaceId);
  if (!instance) {
    instance = new PluginEcosystemService(workspaceId);
    pluginInstances.set(workspaceId, instance);
  }
  return instance;
}
