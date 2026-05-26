import { create } from 'zustand';
import type {
  Workspace,
  WorkspaceMode,
  Company,
  RuntimeProvider,
  Workflow,
  WorkflowState,
  Agent,
  GovernanceRule,
  AuditLog,
  BuildRating,
} from '@/lib/types';

// ═══════════════════════════════════════════════════════════════
// AMEO AI — Central State Store
// ═══════════════════════════════════════════════════════════════

interface WorkspaceStore {
  // Workspace
  workspace: Workspace | null;
  workspaceLoading: boolean;
  setWorkspace: (w: Workspace | null) => void;
  setWorkspaceMode: (mode: WorkspaceMode) => void;

  // Company Graph
  companies: Company[];
  companiesLoading: boolean;
  setCompanies: (c: Company[]) => void;
  addCompany: (c: Company) => void;
  updateCompany: (id: string, data: Partial<Company>) => void;
  removeCompany: (id: string) => void;

  // Runtime Hub
  runtimes: RuntimeProvider[];
  runtimesLoading: boolean;
  setRuntimes: (r: RuntimeProvider[]) => void;
  addRuntime: (r: RuntimeProvider) => void;
  updateRuntime: (id: string, data: Partial<RuntimeProvider>) => void;
  removeRuntime: (id: string) => void;

  // Workflow Engine
  workflows: Workflow[];
  workflowsLoading: boolean;
  workflowFilter: WorkflowState | 'all';
  setWorkflows: (w: Workflow[]) => void;
  addWorkflow: (w: Workflow) => void;
  updateWorkflow: (id: string, data: Partial<Workflow>) => void;
  removeWorkflow: (id: string) => void;
  setWorkflowFilter: (f: WorkflowState | 'all') => void;

  // Governance
  governanceRules: GovernanceRule[];
  auditLogs: AuditLog[];
  governanceLoading: boolean;
  setGovernanceRules: (r: GovernanceRule[]) => void;
  addGovernanceRule: (r: GovernanceRule) => void;
  updateGovernanceRule: (id: string, data: Partial<GovernanceRule>) => void;
  removeGovernanceRule: (id: string) => void;
  setAuditLogs: (l: AuditLog[]) => void;
  addAuditLog: (l: AuditLog) => void;

  // Agent System
  agents: Agent[];
  agentsLoading: boolean;
  selectedAgentId: string | null;
  setAgents: (a: Agent[]) => void;
  addAgent: (a: Agent) => void;
  updateAgent: (id: string, data: Partial<Agent>) => void;
  removeAgent: (id: string) => void;
  setSelectedAgentId: (id: string | null) => void;

  // Ratings
  buildRatings: BuildRating[];
  setBuildRatings: (r: BuildRating[]) => void;
  addBuildRating: (r: BuildRating) => void;

  // Active panel (for mobile / mode display)
  activePanel: string;
  setActivePanel: (p: string) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  // Workspace
  workspace: null,
  workspaceLoading: true,
  setWorkspace: (w) => set({ workspace: w, workspaceLoading: false }),
  setWorkspaceMode: (mode) =>
    set((s) => (s.workspace ? { workspace: { ...s.workspace, mode } } : {})),

  // Company Graph
  companies: [],
  companiesLoading: true,
  setCompanies: (c) => set({ companies: c, companiesLoading: false }),
  addCompany: (c) => set((s) => ({ companies: [...s.companies, c] })),
  updateCompany: (id, data) =>
    set((s) => ({
      companies: s.companies.map((c) => (c.id === id ? { ...c, ...data } : c)),
    })),
  removeCompany: (id) =>
    set((s) => ({ companies: s.companies.filter((c) => c.id !== id) })),

  // Runtime Hub
  runtimes: [],
  runtimesLoading: true,
  setRuntimes: (r) => set({ runtimes: r, runtimesLoading: false }),
  addRuntime: (r) => set((s) => ({ runtimes: [...s.runtimes, r] })),
  updateRuntime: (id, data) =>
    set((s) => ({
      runtimes: s.runtimes.map((r) => (r.id === id ? { ...r, ...data } : r)),
    })),
  removeRuntime: (id) =>
    set((s) => ({ runtimes: s.runtimes.filter((r) => r.id !== id) })),

  // Workflow Engine
  workflows: [],
  workflowsLoading: true,
  workflowFilter: 'all',
  setWorkflows: (w) => set({ workflows: w, workflowsLoading: false }),
  addWorkflow: (w) => set((s) => ({ workflows: [...s.workflows, w] })),
  updateWorkflow: (id, data) =>
    set((s) => ({
      workflows: s.workflows.map((w) => (w.id === id ? { ...w, ...data } : w)),
    })),
  removeWorkflow: (id) =>
    set((s) => ({ workflows: s.workflows.filter((w) => w.id !== id) })),
  setWorkflowFilter: (f) => set({ workflowFilter: f }),

  // Governance
  governanceRules: [],
  auditLogs: [],
  governanceLoading: true,
  setGovernanceRules: (r) => set({ governanceRules: r, governanceLoading: false }),
  addGovernanceRule: (r) =>
    set((s) => ({ governanceRules: [...s.governanceRules, r] })),
  updateGovernanceRule: (id, data) =>
    set((s) => ({
      governanceRules: s.governanceRules.map((r) =>
        r.id === id ? { ...r, ...data } : r
      ),
    })),
  removeGovernanceRule: (id) =>
    set((s) => ({
      governanceRules: s.governanceRules.filter((r) => r.id !== id),
    })),
  setAuditLogs: (l) => set({ auditLogs: l }),
  addAuditLog: (l) => set((s) => ({ auditLogs: [l, ...s.auditLogs] })),

  // Agent System
  agents: [],
  agentsLoading: true,
  selectedAgentId: null,
  setAgents: (a) => set({ agents: a, agentsLoading: false }),
  addAgent: (a) => set((s) => ({ agents: [...s.agents, a] })),
  updateAgent: (id, data) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, ...data } : a)),
    })),
  removeAgent: (id) =>
    set((s) => ({ agents: s.agents.filter((a) => a.id !== id) })),
  setSelectedAgentId: (id) => set({ selectedAgentId: id }),

  // Ratings
  buildRatings: [],
  setBuildRatings: (r) => set({ buildRatings: r }),
  addBuildRating: (r) =>
    set((s) => ({ buildRatings: [...s.buildRatings, r] })),

  // Active panel
  activePanel: 'overview',
  setActivePanel: (p) => set({ activePanel: p }),
}));
