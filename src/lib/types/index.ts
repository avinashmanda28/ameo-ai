// ═══════════════════════════════════════════════════════════════
// AMEO AI — Master Type Definitions
// Governed AI-Native Operational Platform
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
  company: 'text-blue-600',
  project: 'text-blue-500',
  product: 'text-slate-600',
  service: 'text-blue-500',
  team: 'text-slate-600',
  member: 'text-slate-500',
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
  openrouter: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  groq: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  gemini: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400',
  ollama: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400',
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
  validated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  recovering: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  completed: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  archived: 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
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
  pending: 'text-slate-400',
  running: 'text-blue-500',
  completed: 'text-blue-600',
  failed: 'text-red-500',
  cancelled: 'text-slate-400',
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
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  high: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
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
  head: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  builder: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  qa: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400',
  verification: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  terminal: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400',
  governance: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
};

export const AGENT_STATUS_COLORS: Record<AgentStatus, string> = {
  idle: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  busy: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  suspended: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
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

// ─── Phase 1.5: Runtime Execution ───

export type ExecutionRunStatus = 'pending' | 'awaiting_approval' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed' | 'timed_out';
export type ArtifactType = 'code' | 'report' | 'plan' | 'spec' | 'analysis' | 'architecture' | 'general';
export type ArtifactStatus = 'draft' | 'verified' | 'approved' | 'rejected' | 'archived';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type ApprovalRequestType = 'runtime_execution' | 'deployment' | 'data_export' | 'sensitive_action';

export const EXECUTION_RUN_STATUS_COLORS: Record<ExecutionRunStatus, string> = {
  pending: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  awaiting_approval: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  executing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  timed_out: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export const ARTIFACT_TYPE_COLORS: Record<ArtifactType, string> = {
  code: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  report: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400',
  plan: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  spec: 'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  analysis: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400',
  architecture: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  general: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400',
};

// ─── Phase 1.7: Operational Cohesion Layer ───

// Event Bus
export type EventLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';
export type EventSource = 'workflow' | 'runtime' | 'queue' | 'governance' | 'agent' | 'artifact' | 'system' | 'integration-hub' | 'commerce-memory' | 'shopify-integration' | 'product-import' | 'product-page-generator' | 'creative-generation' | 'fulfillment-engine' | 'competitor-intelligence' | 'autonomous-execution' | 'revenue-operations';

export interface SystemEvent {
  id: string;
  workspaceId: string;
  eventType: string;
  source: EventSource | null;
  level: EventLevel;
  correlationId: string | null;
  causationId: string | null;
  traceId: string | null;
  payload: string | null;
  resourceType: string | null;
  resourceId: string | null;
  actorId: string | null;
  actorType: string | null;
  tags: string | null;
  version: number;
  createdAt: string;
}

export const EVENT_LEVEL_COLORS: Record<EventLevel, string> = {
  debug: 'text-slate-400',
  info: 'text-blue-500',
  warn: 'text-slate-500',
  error: 'text-red-500',
  critical: 'text-red-400 font-bold',
};

// Execution Trace
export type TraceOperation = 'execute' | 'verify' | 'approve' | 'queue' | 'retry' | 'recover' | 'checkpoint' | 'coordinate' | 'snapshot';
export type TraceStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface ExecutionTrace {
  id: string;
  workspaceId: string;
  traceId: string;
  parentId: string | null;
  rootId: string | null;
  operation: TraceOperation;
  subsystem: string;
  status: TraceStatus;
  stepOrder: number;
  workflowId: string | null;
  executionId: string | null;
  queueId: string | null;
  agentId: string | null;
  artifactId: string | null;
  eventId: string | null;
  inputSnapshot: string | null;
  outputSnapshot: string | null;
  errorSnapshot: string | null;
  metadata: string | null;
  durationMs: number | null;
  startedAt: string;
  completedAt: string | null;
}

export const TRACE_OPERATION_LABELS: Record<TraceOperation, string> = {
  execute: 'Execute',
  verify: 'Verify',
  approve: 'Approve',
  queue: 'Queue',
  retry: 'Retry',
  recover: 'Recover',
  checkpoint: 'Checkpoint',
  coordinate: 'Coordinate',
  snapshot: 'Snapshot',
};

export const TRACE_STATUS_COLORS: Record<TraceStatus, string> = {
  pending: 'text-slate-400',
  running: 'text-blue-500',
  completed: 'text-blue-600',
  failed: 'text-red-500',
  skipped: 'text-slate-400',
};

// Agent Coordination
export type CoordinationTaskType = 'build' | 'verify' | 'govern' | 'execute' | 'observe' | 'coordinate';
export type CoordinationStatus = 'claimed' | 'active' | 'handed_off' | 'completed' | 'failed' | 'expired';

export interface AgentCoordination {
  id: string;
  workspaceId: string;
  taskId: string;
  taskType: CoordinationTaskType;
  description: string | null;
  ownerAgentId: string;
  ownerAgentType: string | null;
  authorityScope: string | null;
  permissionSet: string | null;
  status: CoordinationStatus;
  priority: number;
  handedOffTo: string | null;
  handedOffAt: string | null;
  handoffReason: string | null;
  lockedAt: string | null;
  lockExpiresAt: string | null;
  isLocked: boolean;
  conflictCheckIds: string | null;
  traceId: string | null;
  correlationId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export const COORDINATION_STATUS_COLORS: Record<CoordinationStatus, string> = {
  claimed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  handed_off: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  completed: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  expired: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
};

// State Snapshot
export type ConsistencyStatus = 'consistent' | 'drifted' | 'unknown';

export interface StateSnapshot {
  id: string;
  workspaceId: string;
  subsystem: string;
  resourceType: string | null;
  resourceId: string | null;
  stateHash: string | null;
  stateData: string | null;
  previousHash: string | null;
  consistencyStatus: ConsistencyStatus;
  driftDetected: boolean;
  driftDetails: string | null;
  capturedBy: string | null;
  snapshotReason: string | null;
  createdAt: string;
}

// System Health Metric
export type HealthSeverity = 'normal' | 'warning' | 'degraded' | 'critical';

export interface SystemHealthMetric {
  id: string;
  workspaceId: string;
  subsystem: string;
  metricType: string;
  value: number;
  unit: string | null;
  severity: HealthSeverity;
  threshold: number | null;
  metadata: string | null;
  sourceEventId: string | null;
  createdAt: string;
}

export const HEALTH_SEVERITY_COLORS: Record<HealthSeverity, string> = {
  normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  warning: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  degraded: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export const HEALTH_SEVERITY_DOT_COLORS: Record<HealthSeverity, string> = {
  normal: 'bg-blue-500',
  warning: 'bg-slate-400',
  degraded: 'bg-slate-500',
  critical: 'bg-red-500 animate-pulse',
};

// Workflow Graph Intelligence
export type GraphIssueType = 'circular_dependency' | 'deadlock' | 'orphan' | 'missing_dependency' | 'self_reference';

export interface GraphAnalysisResult {
  isValid: boolean;
  issues: GraphIssue[];
  nodeCount: number;
  edgeCount: number;
  executionPlan: string[][];
  integrityScore: number;
}

export interface GraphIssue {
  type: GraphIssueType;
  severity: 'warning' | 'error';
  description: string;
  affectedNodes: string[];
}

// Sandbox
export type SandboxPermission = 'read' | 'write' | 'execute' | 'network' | 'file_system';

export interface SandboxProfile {
  id: string;
  name: string;
  description: string;
  permissions: SandboxPermission[];
  restrictedPaths: string[];
  maxExecutionTimeMs: number;
  maxMemoryMb: number;
}

export const DEFAULT_SANDBOX_PROFILE: SandboxProfile = {
  id: 'restricted',
  name: 'Restricted',
  description: 'Default restricted sandbox for untrusted executions',
  permissions: ['read'],
  restrictedPaths: ['*'],
  maxExecutionTimeMs: 30000,
  maxMemoryMb: 256,
};

// System Health Dashboard Aggregation
export interface SystemHealthSummary {
  overallScore: number;
  subsystems: {
    queue: { score: number; severity: HealthSeverity; details: string };
    runtime: { score: number; severity: HealthSeverity; details: string };
    workflow: { score: number; severity: HealthSeverity; details: string };
    verification: { score: number; severity: HealthSeverity; details: string };
    recovery: { score: number; severity: HealthSeverity; details: string };
    agent: { score: number; severity: HealthSeverity; details: string };
    eventBus: { score: number; severity: HealthSeverity; details: string };
  };
  lastUpdatedAt: string;
}
