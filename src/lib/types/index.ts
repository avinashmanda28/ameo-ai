// ═══════════════════════════════════════════════════════════════
// NEXUS OS — Master Type Definitions
// AI-Native Operational Operating System
// ═══════════════════════════════════════════════════════════════

// ─── Workspace ───

export type WorkspaceMode = 'builder' | 'operations' | 'strategy' | 'governance';
export type WorkspaceStatus = 'active' | 'archived' | 'suspended';

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  mode: WorkspaceMode;
  status: WorkspaceStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Company Graph ───

export type CompanyType = 'company' | 'project' | 'product' | 'service' | 'team' | 'member';
export type CompanyStatus = 'active' | 'inactive' | 'archived';

export interface Company {
  id: string;
  workspaceId: string;
  name: string;
  type: CompanyType;
  parentId: string | null;
  metadata: string | null;
  status: CompanyStatus;
  createdAt: string;
  updatedAt: string;
  children?: Company[];
  parent?: Company | null;
}

export const COMPANY_TYPE_ICONS: Record<CompanyType, string> = {
  company: 'Building2',
  project: 'FolderKanban',
  product: 'Package',
  service: 'Server',
  team: 'Users',
  member: 'User',
};

export const COMPANY_TYPE_COLORS: Record<CompanyType, string> = {
  company: 'text-emerald-600',
  project: 'text-amber-600',
  product: 'text-violet-600',
  service: 'text-sky-600',
  team: 'text-rose-600',
  member: 'text-slate-600',
};

// ─── Runtime Hub ───

export type RuntimeType = 'openrouter' | 'groq' | 'gemini' | 'ollama';
export type RuntimeStatus = 'active' | 'inactive' | 'error' | 'verifying';
export type RuntimeRole = 'primary' | 'secondary' | 'fallback';
export type HealthStatus = 'healthy' | 'degraded' | 'error' | 'unknown';

export interface RuntimeProvider {
  id: string;
  workspaceId: string;
  name: string;
  type: RuntimeType;
  apiKey: string | null;
  baseUrl: string | null;
  modelId: string | null;
  status: RuntimeStatus;
  role: RuntimeRole | null;
  healthScore: number;
  rating: number;
  lastHealthCheck: string | null;
  config: string | null;
  createdAt: string;
  updatedAt: string;
  healthLogs?: RuntimeHealthLog[];
}

export interface RuntimeHealthLog {
  id: string;
  providerId: string;
  status: HealthStatus;
  latencyMs: number | null;
  errorMessage: string | null;
  createdAt: string;
}

export const RUNTIME_TYPE_LABELS: Record<RuntimeType, string> = {
  openrouter: 'OpenRouter',
  groq: 'Groq',
  gemini: 'Gemini',
  ollama: 'Ollama',
};

export const RUNTIME_TYPE_COLORS: Record<RuntimeType, string> = {
  openrouter: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  groq: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  gemini: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  ollama: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
};

// ─── Workflow Engine ───

export type WorkflowState = 'draft' | 'validated' | 'active' | 'blocked' | 'recovering' | 'completed' | 'archived';
export type WorkflowType = 'build' | 'test' | 'deploy' | 'custom';
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type DependencyType = 'after' | 'parallel' | 'conditional';

export interface Workflow {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  type: WorkflowType | null;
  state: WorkflowState;
  definition: string | null;
  config: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
  executions?: WorkflowExecution[];
  checkpoints?: WorkflowCheckpoint[];
  logs?: WorkflowLog[];
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  agentId: string | null;
  status: ExecutionStatus;
  stepName: string | null;
  input: string | null;
  output: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  retryCount: number;
  createdAt: string;
}

export interface WorkflowCheckpoint {
  id: string;
  workflowId: string;
  executionId: string | null;
  name: string;
  state: string;
  data: string | null;
  createdAt: string;
}

export interface WorkflowLog {
  id: string;
  workflowId: string;
  executionId: string | null;
  level: LogLevel;
  message: string;
  metadata: string | null;
  createdAt: string;
}

export interface WorkflowDependency {
  id: string;
  sourceId: string;
  targetId: string;
  type: DependencyType;
  createdAt: string;
}

export const WORKFLOW_STATE_COLORS: Record<WorkflowState, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  validated: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  recovering: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  completed: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  archived: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

export const WORKFLOW_STATE_LABELS: Record<WorkflowState, string> = {
  draft: 'Draft',
  validated: 'Validated',
  active: 'Active',
  blocked: 'Blocked',
  recovering: 'Recovering',
  completed: 'Completed',
  archived: 'Archived',
};

export const EXECUTION_STATUS_COLORS: Record<ExecutionStatus, string> = {
  pending: 'text-slate-500',
  running: 'text-sky-500',
  completed: 'text-emerald-500',
  failed: 'text-red-500',
  cancelled: 'text-gray-400',
};

// ─── Governance Kernel ───

export type RuleType = 'permission' | 'approval' | 'rate_limit' | 'security' | 'compliance';
export type RuleSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AuditSeverity = 'info' | 'warn' | 'error' | 'critical';

export interface GovernanceRule {
  id: string;
  workspaceId: string;
  name: string;
  type: RuleType;
  description: string | null;
  config: string | null;
  enabled: boolean;
  severity: RuleSeverity;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  workspaceId: string;
  ruleId: string | null;
  agentId: string | null;
  action: string;
  resource: string | null;
  severity: AuditSeverity;
  details: string | null;
  approved: boolean | null;
  createdAt: string;
}

export const RULE_TYPE_LABELS: Record<RuleType, string> = {
  permission: 'Permission',
  approval: 'Approval',
  rate_limit: 'Rate Limit',
  security: 'Security',
  compliance: 'Compliance',
};

export const RULE_SEVERITY_COLORS: Record<RuleSeverity, string> = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

// ─── Agent System ───

export type AgentType = 'head' | 'builder' | 'qa' | 'verification' | 'terminal' | 'governance';
export type AgentStatus = 'idle' | 'active' | 'busy' | 'error' | 'suspended';

export interface Agent {
  id: string;
  workspaceId: string;
  name: string;
  type: AgentType;
  description: string | null;
  status: AgentStatus;
  config: string | null;
  capabilities: string | null;
  createdAt: string;
  updatedAt: string;
  executions?: WorkflowExecution[];
  logs?: AgentLog[];
}

export interface AgentLog {
  id: string;
  agentId: string;
  level: LogLevel;
  message: string;
  metadata: string | null;
  createdAt: string;
}

export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  head: 'Agent Head',
  builder: 'Builder Agent',
  qa: 'QA Agent',
  verification: 'Verification Agent',
  terminal: 'Terminal Observer',
  governance: 'Governance Agent',
};

export const AGENT_TYPE_DESCRIPTIONS: Record<AgentType, string> = {
  head: 'Orchestrates all agents, manages task distribution and coordination',
  builder: 'Executes build tasks, creates implementations, manages code generation',
  qa: 'Quality assurance, testing, validation of built systems',
  verification: 'Reality verification, detects fake implementations, validates execution',
  terminal: 'Observes runtime logs, monitors build failures, tracks crashes',
  governance: 'Security enforcement, governance rules, permission management',
};

export const AGENT_TYPE_COLORS: Record<AgentType, string> = {
  head: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  builder: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  qa: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  verification: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  terminal: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  governance: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export const AGENT_STATUS_COLORS: Record<AgentStatus, string> = {
  idle: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  busy: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  suspended: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

// ─── Build Rating Engine ───

export type RatingTargetType = 'workflow' | 'agent' | 'runtime' | 'build';

export interface BuildRating {
  id: string;
  workspaceId: string;
  targetId: string;
  targetType: RatingTargetType;
  architectureQuality: number | null;
  runtimeStability: number | null;
  uiIntegrity: number | null;
  workflowQuality: number | null;
  verificationConfidence: number | null;
  hallucinationRisk: number | null;
  operationalStability: number | null;
  overallScore: number | null;
  notes: string | null;
  createdAt: string;
}

export const RATING_DIMENSIONS = [
  { key: 'architectureQuality', label: 'Architecture Quality' },
  { key: 'runtimeStability', label: 'Runtime Stability' },
  { key: 'uiIntegrity', label: 'UI Integrity' },
  { key: 'workflowQuality', label: 'Workflow Quality' },
  { key: 'verificationConfidence', label: 'Verification Confidence' },
  { key: 'hallucinationRisk', label: 'Hallucination Risk' },
  { key: 'operationalStability', label: 'Operational Stability' },
] as const;

// ─── API Response Types ───

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ─── Workspace Modes ───

export const WORKSPACE_MODES: { key: WorkspaceMode; label: string; icon: string; description: string }[] = [
  { key: 'builder', label: 'Builder', icon: 'Hammer', description: 'Build, create, and implement systems' },
  { key: 'operations', label: 'Operations', icon: 'Activity', description: 'Monitor, manage, and optimize operations' },
  { key: 'strategy', label: 'Strategy', icon: 'Compass', description: 'Plan, analyze, and decide strategically' },
  { key: 'governance', label: 'Governance', icon: 'Shield', description: 'Enforce rules, audit, and secure the system' },
];
