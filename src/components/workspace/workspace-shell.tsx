'use client';

import React, { useEffect } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspaceStore } from '@/lib/store/workspace-store';
import { useExecutionStore } from '@/lib/store/execution-store';
import type { ApiResponse } from '@/lib/types';
import type {
  Workspace,
  Company,
  Workflow,
  RuntimeProvider,
  GovernanceRule,
  Agent,
  AuditLog,
  BuildRating,
} from '@/lib/types';
import { WorkspaceSidebar } from './workspace-sidebar';
import { WorkspaceHeader } from './workspace-header';
import { WorkspaceContent } from './workspace-content';
import { ApprovalBanner } from '@/components/approvals/approval-banner';

// ─── Data Fetching ─────────────────────────────────────────────

async function safeFetch<T>(url: string, label: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[Nexus OS] Failed to fetch ${label}: ${res.status}`);
      return null;
    }
    const json: ApiResponse<T> = await res.json();
    if (!json.success) {
      console.warn(`[Nexus OS] ${label} returned error: ${json.error}`);
      return null;
    }
    return json.data ?? null;
  } catch (err) {
    console.warn(`[Nexus OS] Error fetching ${label}:`, err);
    return null;
  }
}

// ─── Loading Shell ─────────────────────────────────────────────

function LoadingShell() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

// ─── Workspace Shell ───────────────────────────────────────────

export function WorkspaceShell() {
  const store = useWorkspaceStore();

  // Fetch all data on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      // Workspace
      const workspace = await safeFetch<Workspace>('/api/workspace', 'workspace');
      if (cancelled) return;
      if (workspace) store.setWorkspace(workspace);

      // Parallel fetch subsystem data
      const [
        companies,
        workflows,
        runtimes,
        rules,
        agents,
        ratings,
        auditLogs,
        executions,
        artifacts,
        approvals,
      ] = await Promise.all([
        safeFetch<Company[]>('/api/company', 'companies'),
        safeFetch<Workflow[]>('/api/workflows', 'workflows'),
        safeFetch<RuntimeProvider[]>('/api/runtime', 'runtimes'),
        safeFetch<GovernanceRule[]>('/api/governance', 'governance rules'),
        safeFetch<Agent[]>('/api/agents', 'agents'),
        safeFetch<BuildRating[]>('/api/ratings', 'ratings'),
        safeFetch<AuditLog[]>('/api/governance/audit', 'audit logs'),
        safeFetch<unknown[]>('/api/execution', 'executions'),
        safeFetch<unknown[]>('/api/artifacts', 'artifacts'),
        safeFetch<unknown[]>('/api/approvals?status=pending', 'approvals'),
      ]);

      if (cancelled) return;

      if (companies) store.setCompanies(companies);
      if (workflows) store.setWorkflows(workflows);
      if (runtimes) store.setRuntimes(runtimes);
      if (rules) store.setGovernanceRules(rules);
      if (agents) store.setAgents(agents);
      if (ratings) store.setBuildRatings(ratings);
      if (auditLogs) store.setAuditLogs(auditLogs);

      // Phase 1.5 execution store
      const executionStore = useExecutionStore.getState();
      if (executions) executionStore.setExecutions(executions as any);
      if (artifacts) executionStore.setArtifacts(artifacts as any);
      if (approvals) executionStore.setPendingApprovals(approvals as any);
    }

    fetchAll();

    return () => {
      cancelled = true;
    };
  }, []);

  // Show loading shell until workspace data is loaded
  if (store.workspaceLoading && !store.workspace) {
    return <LoadingShell />;
  }

  return (
    <SidebarProvider>
      <WorkspaceSidebar />
      <SidebarInset className="bg-background">
        <WorkspaceHeader />
        <WorkspaceContent />
      </SidebarInset>
      <ApprovalBanner />
    </SidebarProvider>
  );
}
