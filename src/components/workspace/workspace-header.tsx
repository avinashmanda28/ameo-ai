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
  builder: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/40',
  operations: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40',
  strategy: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200 dark:border-violet-800/40',
  governance: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800/40',
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
    idle: 'bg-zinc-400',
    active: 'bg-emerald-500',
    busy: 'bg-amber-500',
    error: 'bg-red-500',
    suspended: 'bg-zinc-600',
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
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
      </span>
      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium hidden sm:inline">
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
