import { create } from 'zustand';
import type {
  SystemEvent,
  ExecutionTrace,
  AgentCoordination,
  StateSnapshot,
  SystemHealthMetric,
  GraphAnalysisResult,
  SystemHealthSummary,
} from '@/lib/types';

// ═══════════════════════════════════════════════════════════════
// AMEO AI — Operational Cohesion Store (Phase 1.7)
// Centralized state for events, traces, coordination, health
// ═══════════════════════════════════════════════════════════════

interface OperationalStore {
  // Event Bus
  events: SystemEvent[];
  eventsLoading: boolean;
  setEvents: (e: SystemEvent[]) => void;
  addEvent: (e: SystemEvent) => void;
  eventFilter: string;
  setEventFilter: (f: string) => void;

  // Execution Traces
  traces: ExecutionTrace[];
  tracesLoading: boolean;
  setTraces: (t: ExecutionTrace[]) => void;
  addTrace: (t: ExecutionTrace) => void;
  selectedTraceId: string | null;
  setSelectedTraceId: (id: string | null) => void;

  // Agent Coordination
  coordinations: AgentCoordination[];
  coordinationsLoading: boolean;
  setCoordinations: (c: AgentCoordination[]) => void;
  addCoordination: (c: AgentCoordination) => void;
  updateCoordination: (id: string, data: Partial<AgentCoordination>) => void;

  // State Snapshots
  snapshots: StateSnapshot[];
  snapshotsLoading: boolean;
  setSnapshots: (s: StateSnapshot[]) => void;

  // System Health
  healthMetrics: SystemHealthMetric[];
  healthLoading: boolean;
  setHealthMetrics: (m: SystemHealthMetric[]) => void;
  addHealthMetric: (m: SystemHealthMetric) => void;
  healthSummary: SystemHealthSummary | null;
  setHealthSummary: (s: SystemHealthSummary | null) => void;

  // Workflow Graph
  graphAnalysis: GraphAnalysisResult | null;
  setGraphAnalysis: (r: GraphAnalysisResult | null) => void;

  // Console state
  consoleAutoRefresh: boolean;
  setConsoleAutoRefresh: (v: boolean) => void;
  consoleFilter: {
    levels: string[];
    sources: string[];
  };
  setConsoleFilter: (f: { levels?: string[]; sources?: string[] }) => void;
}

export const useOperationalStore = create<OperationalStore>((set) => ({
  // Event Bus
  events: [],
  eventsLoading: true,
  setEvents: (e) => set({ events: e, eventsLoading: false }),
  addEvent: (e) => set((s) => ({ events: [e, ...s.events].slice(0, 500) })),
  eventFilter: 'all',
  setEventFilter: (f) => set({ eventFilter: f }),

  // Execution Traces
  traces: [],
  tracesLoading: true,
  setTraces: (t) => set({ traces: t, tracesLoading: false }),
  addTrace: (t) => set((s) => ({ traces: [t, ...s.traces] })),
  selectedTraceId: null,
  setSelectedTraceId: (id) => set({ selectedTraceId: id }),

  // Agent Coordination
  coordinations: [],
  coordinationsLoading: true,
  setCoordinations: (c) => set({ coordinations: c, coordinationsLoading: false }),
  addCoordination: (c) => set((s) => ({ coordinations: [c, ...s.coordinations] })),
  updateCoordination: (id, data) =>
    set((s) => ({
      coordinations: s.coordinations.map((c) =>
        c.id === id ? { ...c, ...data } : c
      ),
    })),

  // State Snapshots
  snapshots: [],
  snapshotsLoading: true,
  setSnapshots: (s) => set({ snapshots: s, snapshotsLoading: false }),

  // System Health
  healthMetrics: [],
  healthLoading: true,
  setHealthMetrics: (m) => set({ healthMetrics: m, healthLoading: false }),
  addHealthMetric: (m) => set((s) => ({ healthMetrics: [m, ...s.healthMetrics] })),
  healthSummary: null,
  setHealthSummary: (s) => set({ healthSummary: s }),

  // Workflow Graph
  graphAnalysis: null,
  setGraphAnalysis: (r) => set({ graphAnalysis: r }),

  // Console
  consoleAutoRefresh: true,
  setConsoleAutoRefresh: (v) => set({ consoleAutoRefresh: v }),
  consoleFilter: { levels: [], sources: [] },
  setConsoleFilter: (f) =>
    set((s) => ({
      consoleFilter: {
        levels: f.levels ?? s.consoleFilter.levels,
        sources: f.sources ?? s.consoleFilter.sources,
      },
    })),
}));
