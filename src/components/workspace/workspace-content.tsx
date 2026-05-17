'use client';

import React from 'react';
import {
  LayoutDashboard,
  GitBranch,
  Cpu,
  Workflow,
  Shield,
  Bot,
  TerminalSquare,
  BarChart3,
} from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/workspace-store';
import { Skeleton } from '@/components/ui/skeleton';
import { OverviewPanel } from './overview-panel';
import { WorkflowEnginePanel } from '@/components/workflows/workflow-engine-panel';
import { GovernancePanel } from '@/components/governance/governance-panel';
import { CompanyGraphPanel } from '@/components/company/company-graph-panel';
import { RuntimeHubPanel } from '@/components/runtime/runtime-hub-panel';
import { AgentPanel } from '@/components/agents/agent-panel';
import { ReportsPanel } from '@/components/reports/reports-panel';
import { TerminalPanel } from '@/components/reports/terminal-panel';

// ─── Panel Configuration ───────────────────────────────────────

interface PanelConfig {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PANEL_CONFIGS: PanelConfig[] = [
  { key: 'overview', label: 'Overview', description: 'System overview and dashboard', icon: LayoutDashboard },
  { key: 'company-graph', label: 'Company Graph', description: 'Organizational structure and company graph', icon: GitBranch },
  { key: 'runtime-hub', label: 'Runtime Hub', description: 'AI runtime providers and health monitoring', icon: Cpu },
  { key: 'workflows', label: 'Workflows', description: 'Workflow engine and execution management', icon: Workflow },
  { key: 'governance', label: 'Governance', description: 'Rules, permissions, and compliance', icon: Shield },
  { key: 'agents', label: 'Agents', description: 'AI agent fleet and status monitoring', icon: Bot },
  { key: 'terminal', label: 'Terminal', description: 'System logs and terminal output', icon: TerminalSquare },
  { key: 'reports', label: 'Reports', description: 'Build ratings and analytical reports', icon: BarChart3 },
];

const CONFIG_MAP = new Map(PANEL_CONFIGS.map((p) => [p.key, p]));

// ─── Placeholder Panel ─────────────────────────────────────────

function PlaceholderPanel({ config }: { config: PanelConfig }) {
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 animate-in fade-in-0 duration-500">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/60 mb-5">
        <Icon className="w-8 h-8 text-muted-foreground/60" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-1.5">{config.label}</h2>
      <p className="text-sm text-muted-foreground mb-8 text-center max-w-sm">
        Coming in next build phase
      </p>
      <div className="w-full max-w-2xl space-y-4">
        {/* Skeleton placeholders to suggest future content */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <Skeleton className="h-4 w-48" />
          <div className="space-y-2 pt-1">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Content Router ────────────────────────────────────────────

export function WorkspaceContent() {
  const activePanel = useWorkspaceStore((s) => s.activePanel);
  const config = CONFIG_MAP.get(activePanel);

  if (!config) {
    // Fallback to overview if unknown panel
    return <OverviewPanel />;
  }

  // Real implementation for overview
  if (activePanel === 'overview') {
    return <OverviewPanel />;
  }

  // Real implementation for company-graph
  if (activePanel === 'company-graph') {
    return <CompanyGraphPanel />;
  }

  // Real implementation for runtime-hub
  if (activePanel === 'runtime-hub') {
    return <RuntimeHubPanel />;
  }

  // Workflow Engine panel
  if (activePanel === 'workflows') {
    return <WorkflowEnginePanel />;
  }

  // Governance Kernel panel
  if (activePanel === 'governance') {
    return <GovernancePanel />;
  }

  // Real implementation for agents
  if (activePanel === 'agents') {
    return <AgentPanel />;
  }

  // Real implementation for reports
  if (activePanel === 'reports') {
    return <ReportsPanel />;
  }

  // Real implementation for terminal
  if (activePanel === 'terminal') {
    return <TerminalPanel />;
  }

  // Placeholder for all other panels
  return <PlaceholderPanel config={config} />;
}
