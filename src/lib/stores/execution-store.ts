import { create } from 'zustand';
import type { ExecutionRunStatus, ArtifactType, ArtifactStatus, ApprovalStatus, ApprovalRequestType } from '@/lib/types';

// ═══════════════════════════════════════════════════════════════
// AMEO AI — Execution State Store
// ═══════════════════════════════════════════════════════════════

// ─── Inline types not in master types ───

export interface RuntimeExecution {
  id: string;
  workspaceId: string;
  providerId: string | null;
  agentId: string | null;
  workflowId: string | null;
  artifactId: string | null;
  requestType: string;
  prompt: string;
  systemPrompt: string | null;
  modelId: string | null;
  temperature: number | null;
  maxTokens: number | null;
  status: string;
  response: string | null;
  errorMessage: string | null;
  tokenUsage: string | null;
  latencyMs: number | null;
  approvalId: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  verificationResult: string | null;
  verificationNotes: string | null;
  hallucinationDetected: boolean;
  verificationAgentId: string | null;
  qualityScore: number | null;
  retryCount: number;
  timedOut: boolean;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  provider?: { id: string; name: string; type: string } | null;
  agent?: { id: string; name: string; type: string } | null;
}

export interface Artifact {
  id: string;
  workspaceId: string;
  executionId: string | null;
  workflowId: string | null;
  agentId: string | null;
  title: string;
  type: string;
  language: string | null;
  content: string;
  summary: string | null;
  metadata: string | null;
  status: string;
  version: number;
  verificationResult: string | null;
  verificationNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRequest {
  id: string;
  workspaceId: string;
  executionId: string | null;
  requestType: string;
  providerName: string | null;
  providerType: string | null;
  promptPreview: string | null;
  dataSize: number | null;
  metadata: string | null;
  status: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  expiresAt: string | null;
  reason: string | null;
  createdAt: string;
}

// ─── Execution Form ───

interface ExecutionForm {
  prompt: string;
  systemPrompt: string;
  requestType: string;
  temperature: number;
  maxTokens: number;
  selectedProviderId: string;
}

const DEFAULT_EXECUTION_FORM: ExecutionForm = {
  prompt: '',
  systemPrompt: '',
  requestType: 'chat',
  temperature: 0.7,
  maxTokens: 2048,
  selectedProviderId: '',
};

// ─── Store Interface ───

interface ExecutionStore {
  // Runtime executions
  executions: RuntimeExecution[];
  executionsLoading: boolean;
  setExecutions: (e: RuntimeExecution[]) => void;
  addExecution: (e: RuntimeExecution) => void;
  updateExecution: (id: string, data: Partial<RuntimeExecution>) => void;

  // Artifacts
  artifacts: Artifact[];
  artifactsLoading: boolean;
  selectedArtifactId: string | null;
  setArtifacts: (a: Artifact[]) => void;
  addArtifact: (a: Artifact) => void;
  updateArtifact: (id: string, data: Partial<Artifact>) => void;
  setSelectedArtifactId: (id: string | null) => void;

  // Approval requests
  pendingApprovals: ApprovalRequest[];
  setPendingApprovals: (a: ApprovalRequest[]) => void;
  addApproval: (a: ApprovalRequest) => void;
  removeApproval: (id: string) => void;

  // Execution form
  executionForm: ExecutionForm;
  setExecutionForm: (form: Partial<ExecutionForm>) => void;
  resetExecutionForm: () => void;

  // Live execution state
  isExecuting: boolean;
  currentExecutionId: string | null;
  setIsExecuting: (v: boolean) => void;
  setCurrentExecutionId: (id: string | null) => void;
}

// ─── Store Implementation ───

export const useExecutionStore = create<ExecutionStore>((set) => ({
  // Runtime executions
  executions: [],
  executionsLoading: true,
  setExecutions: (e) => set({ executions: e, executionsLoading: false }),
  addExecution: (e) => set((s) => ({ executions: [e, ...s.executions] })),
  updateExecution: (id, data) =>
    set((s) => ({
      executions: s.executions.map((ex) => (ex.id === id ? { ...ex, ...data } : ex)),
    })),

  // Artifacts
  artifacts: [],
  artifactsLoading: true,
  selectedArtifactId: null,
  setArtifacts: (a) => set({ artifacts: a, artifactsLoading: false }),
  addArtifact: (a) => set((s) => ({ artifacts: [a, ...s.artifacts] })),
  updateArtifact: (id, data) =>
    set((s) => ({
      artifacts: s.artifacts.map((ar) => (ar.id === id ? { ...ar, ...data } : ar)),
    })),
  setSelectedArtifactId: (id) => set({ selectedArtifactId: id }),

  // Approval requests
  pendingApprovals: [],
  setPendingApprovals: (a) => set({ pendingApprovals: a }),
  addApproval: (a) => set((s) => ({ pendingApprovals: [...s.pendingApprovals, a] })),
  removeApproval: (id) =>
    set((s) => ({
      pendingApprovals: s.pendingApprovals.filter((ap) => ap.id !== id),
    })),

  // Execution form
  executionForm: { ...DEFAULT_EXECUTION_FORM },
  setExecutionForm: (form) =>
    set((s) => ({ executionForm: { ...s.executionForm, ...form } })),
  resetExecutionForm: () => set({ executionForm: { ...DEFAULT_EXECUTION_FORM } }),

  // Live execution state
  isExecuting: false,
  currentExecutionId: null,
  setIsExecuting: (v) => set({ isExecuting: v }),
  setCurrentExecutionId: (id) => set({ currentExecutionId: id }),
}));
