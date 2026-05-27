'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useWorkspaceStore } from '@/lib/stores/workspace-store';
import { WORKSPACE_MODES, type WorkspaceMode } from '@/lib/types';
import { cn } from '@/lib/utils';
import { signOut } from 'next-auth/react';
import { Check, LogOut, Pencil, X } from 'lucide-react';
import { useExecutionStore } from '@/lib/stores/execution-store';

// ─── Panel labels map ──────────────────────────────────────────

const PANEL_LABELS: Record<string, string> = {
  overview: 'Overview',
  'company-graph': 'Company Graph',
  'runtime-hub': 'Runtime Hub',
  workflows: 'Workflows',
  governance: 'Governance',
  agents: 'Agents',
  terminal: 'Terminal',
  reports: 'Reports',
  execution: 'Execution',
  artifacts: 'Artifacts',
  'runtime-metrics': 'Runtime Metrics',
};

const PANEL_GROUPS: Record<string, string> = {
  overview: 'OVERVIEW',
  'company-graph': 'SYSTEMS',
  'runtime-hub': 'SYSTEMS',
  workflows: 'SYSTEMS',
  governance: 'SYSTEMS',
  execution: 'SYSTEMS',
  artifacts: 'SYSTEMS',
  agents: 'INTELLIGENCE',
  terminal: 'INTELLIGENCE',
  reports: 'INTELLIGENCE',
  'runtime-metrics': 'INTELLIGENCE',
};

const MODE_BADGE_CLASSES: Record<WorkspaceMode, string> = {
  builder: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800/40',
  operations: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700/50',
  strategy: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800/40',
  governance: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800/40',
};

// ─── Editable Workspace Name ───────────────────────────────────

function EditableWorkspaceName() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const name = workspace?.name ?? 'Ameo AI';

  const startEdit = useCallback(() => {
    setDraft(name);
    setIsEditing(true);
  }, [name]);

  const confirmEdit = useCallback(() => {
    if (draft.trim() && workspace) {
      setWorkspace({ ...workspace, name: draft.trim() });
    }
    setIsEditing(false);
  }, [draft, workspace, setWorkspace]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!isEditing) return;
      if (e.key === 'Enter') confirmEdit();
      if (e.key === 'Escape') cancelEdit();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isEditing, confirmEdit, cancelEdit]);

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="text-sm font-semibold bg-background border border-border rounded-md px-2 py-0.5 w-48 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={confirmEdit}
          className="p-0.5 rounded-sm hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={cancelEdit}
          className="p-0.5 rounded-sm hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startEdit}
      className="flex items-center gap-1.5 text-sm font-semibold hover:bg-accent rounded-md px-2 py-0.5 -ml-2 transition-colors"
    >
      <span className="truncate max-w-48">{name}</span>
      <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover/header:opacity-100 transition-opacity" />
    </button>
  );
}

// ─── Agent Status Indicators ───────────────────────────────────

function AgentStatusIndicators() {
  const agents = useWorkspaceStore((s) => s.agents);

  if (agents.length === 0) return null;

  const statusCounts: Record<string, number> = {};
  for (const agent of agents) {
    statusCounts[agent.status] = (statusCounts[agent.status] || 0) + 1;
  }

  const STATUS_DOT_COLORS: Record<string, string> = {
    idle: 'bg-slate-400',
    active: 'bg-blue-500',
    busy: 'bg-blue-500',
    error: 'bg-red-500',
    suspended: 'bg-slate-400',
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground mr-1 hidden sm:inline">Agents</span>
      {Object.entries(statusCounts).map(([status, count]) => (
        <div key={status} className="flex items-center gap-1" title={`${status}: ${count}`}>
          <span
            className={cn('w-1.5 h-1.5 rounded-full', STATUS_DOT_COLORS[status] ?? 'bg-zinc-400')}
          />
          <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Execution Indicator ──────────────────────────────────────

function ExecutionIndicator() {
  const isExecuting = useExecutionStore((s) => s.isExecuting);

  if (!isExecuting) return null;

  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
      </span>
      <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium hidden sm:inline">
        Executing...
      </span>
    </div>
  );
}

// ─── Header Component ──────────────────────────────────────────

export function WorkspaceHeader() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const activePanel = useWorkspaceStore((s) => s.activePanel);
  const currentMode = workspace?.mode ?? 'builder';
  const modeLabel = WORKSPACE_MODES.find((m) => m.key === currentMode)?.label ?? currentMode;

  const panelLabel = PANEL_LABELS[activePanel] ?? 'Overview';
  const panelGroup = PANEL_GROUPS[activePanel] ?? 'OVERVIEW';

  return (
    <header className="sticky top-0 z-30 flex items-center h-14 gap-3 border-b bg-background/80 backdrop-blur-md px-4 group/header">
      {/* Sidebar toggle */}
      <SidebarTrigger className="-ml-1" />

      <Separator orientation="vertical" className="h-5" />

      {/* Workspace name */}
      <EditableWorkspaceName />

      {/* Breadcrumb */}
      <Breadcrumb className="ml-2 hidden sm:flex">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#" className="text-xs text-muted-foreground">
              {panelGroup}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="text-xs">{panelLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side controls */}
      <div className="flex items-center gap-3">
        {/* Mode badge */}
        <Badge
          variant="outline"
          className={cn('text-[11px] font-medium h-5 px-2', MODE_BADGE_CLASSES[currentMode])}
        >
          {modeLabel}
        </Badge>

        <Separator orientation="vertical" className="h-5" />

        {/* Execution indicator */}
        <ExecutionIndicator />

        <Separator orientation="vertical" className="h-5" />

        {/* Agent status dots */}
        <AgentStatusIndicators />

        <Separator orientation="vertical" className="h-5" />

        {/* Sign out */}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-destructive/5"
          title="Sign out"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
