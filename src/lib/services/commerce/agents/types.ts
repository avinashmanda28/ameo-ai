// ═══════════════════════════════════════════════════════════════
// AMEO AI — AGI Commerce Agent Swarm Types
// 10 specialized operational agents for autonomous commerce
// ═══════════════════════════════════════════════════════════════

import type { ExecutionRunStatus } from '@/lib/types';

// ─── Agent Identifiers ───

export type CommerceAgentType =
  | 'product-hunter'
  | 'trend-analyst'
  | 'supplier-analyst'
  | 'pricing-agent'
  | 'seo-agent'
  | 'store-builder'
  | 'ad-creative-agent'
  | 'analytics-agent'
  | 'fulfillment-agent'
  | 'verification-agent';

// ─── Agent Configuration ───

export interface CommerceAgentConfig {
  id: string;
  workspaceId: string;
  agentType: CommerceAgentType;
  name: string;
  description: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Agent Task ───

export interface AgentTask {
  id: string;
  workspaceId: string;
  agentType: CommerceAgentType;
  taskType: string;
  priority: number;
  input: Record<string, unknown>;
  status: AgentTaskStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  retryCount: number;
  traceId: string | null;
  correlationId: string | null;
  createdAt: string;
}

export type AgentTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// ─── Agent Memory ───

export interface AgentMemoryEntry {
  id: string;
  agentId: string;
  agentType: CommerceAgentType;
  workspaceId: string;
  memoryType: string;
  key: string;
  value: string;
  ttl: number | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Agent Execution Result ───

export interface AgentExecutionResult {
  success: boolean;
  taskId: string;
  agentType: CommerceAgentType;
  output: Record<string, unknown>;
  confidence: number;
  error: string | null;
  durationMs: number;
  artifacts: AgentArtifact[];
  events: string[];
}

export interface AgentArtifact {
  type: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

// ─── Swarm Orchestration ───

export interface SwarmTask {
  id: string;
  workspaceId: string;
  goal: string;
  status: SwarmTaskStatus;
  assignedAgentType: CommerceAgentType;
  priority: number;
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  agentTraces: SwarmAgentTrace[];
  createdAt: string;
  completedAt: string | null;
}

export type SwarmTaskStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed';

export interface SwarmAgentTrace {
  agentType: CommerceAgentType;
  status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed';
  startedAt: string | null;
  completedAt: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
}

// ─── Agent Metrics ───

export interface AgentMetrics {
  agentType: CommerceAgentType;
  workspaceId: string;
  tasksCompleted: number;
  tasksFailed: number;
  avgDurationMs: number;
  totalDurationMs: number;
  successRate: number;
  lastActiveAt: string | null;
  lastError: string | null;
}

// ─── Agent Capabilities ───

export const AGENT_CAPABILITIES: Record<CommerceAgentType, string> = {
  'product-hunter': 'Discovers winning products, analyzes demand, competition, and profit potential',
  'trend-analyst': 'Identifies viral trends, tracks momentum, detects acceleration signals',
  'supplier-analyst': 'Evaluates supplier trust, shipping reliability, pricing, and risk',
  'pricing-agent': 'Optimizes pricing strategies, analyzes margins, recommends price points',
  'seo-agent': 'Optimizes product listings, generates SEO metadata, improves discoverability',
  'store-builder': 'Automates store setup, product importing, listing optimization',
  'ad-creative-agent': 'Generates ad copy, creatives, and campaign recommendations',
  'analytics-agent': 'Analyzes operational metrics, revenue intelligence, performance insights',
  'fulfillment-agent': 'Manages order fulfillment, tracking sync, delivery optimization',
  'verification-agent': 'Verifies AI outputs, detects hallucinations, validates execution',
};

export const AGENT_NAMES: Record<CommerceAgentType, string> = {
  'product-hunter': 'Product Hunter',
  'trend-analyst': 'Trend Analyst',
  'supplier-analyst': 'Supplier Analyst',
  'pricing-agent': 'Pricing Agent',
  'seo-agent': 'SEO Agent',
  'store-builder': 'Store Builder',
  'ad-creative-agent': 'Ad Creative Agent',
  'analytics-agent': 'Analytics Agent',
  'fulfillment-agent': 'Fulfillment Agent',
  'verification-agent': 'Verification Agent',
};

export const AGENT_ICONS: Record<CommerceAgentType, string> = {
  'product-hunter': 'Target',
  'trend-analyst': 'TrendingUp',
  'supplier-analyst': 'Truck',
  'pricing-agent': 'DollarSign',
  'seo-agent': 'Search',
  'store-builder': 'Store',
  'ad-creative-agent': 'PenTool',
  'analytics-agent': 'BarChart3',
  'fulfillment-agent': 'Package',
  'verification-agent': 'ShieldCheck',
};
