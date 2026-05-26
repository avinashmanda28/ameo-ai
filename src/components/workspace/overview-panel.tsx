'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Workflow,
  Cpu,
  Bot,
  Shield,
  Clock,
  Activity,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWorkspaceStore } from '@/lib/stores/workspace-store';
import { WORKSPACE_MODES, WORKFLOW_STATE_COLORS, AGENT_STATUS_COLORS } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// ─── Animation Variants ────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.4, 0.25, 1] as const },
  },
};

// ─── Metric Card ───────────────────────────────────────────────

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

function MetricCard({ title, value, subtitle, icon: Icon, accentColor }: MetricCardProps) {
  return (
    <motion.div variants={itemVariants}>
      <Card className="relative overflow-hidden hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                {title}
              </p>
              <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            </div>
            <div
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-xl shrink-0',
                accentColor
              )}
            >
              <Icon className="w-5 h-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Audit Log Entry ───────────────────────────────────────────

function AuditLogEntry({
  log,
}: {
  log: {
    id: string;
    action: string;
    severity: string;
    resource: string | null;
    details: string | null;
    createdAt: string;
  };
}) {
  const SEVERITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    info: CheckCircle2,
    warn: AlertTriangle,
    error: XCircle,
    critical: XCircle,
  };

  const SEVERITY_COLORS: Record<string, string> = {
    info: 'text-emerald-500',
    warn: 'text-amber-500',
    error: 'text-red-500',
    critical: 'text-red-600',
  };

  const Icon = SEVERITY_ICONS[log.severity] ?? Activity;

  let timeAgo = '';
  try {
    timeAgo = formatDistanceToNow(new Date(log.createdAt), { addSuffix: true });
  } catch {
    timeAgo = 'just now';
  }

  return (
    <div className="flex items-start gap-3 py-2.5 group/entry hover:bg-muted/40 rounded-lg px-2 -mx-2 transition-colors">
      <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', SEVERITY_COLORS[log.severity] ?? 'text-muted-foreground')} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{log.action}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {log.resource && (
            <span className="text-xs text-muted-foreground truncate max-w-40">{log.resource}</span>
          )}
          <span className="text-xs text-muted-foreground/60 tabular-nums">{timeAgo}</span>
        </div>
      </div>
      <Badge
        variant="secondary"
        className={cn(
          'text-[10px] h-5 px-1.5 shrink-0 capitalize',
          log.severity === 'error' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
          log.severity === 'warn' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
          log.severity === 'critical' && 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
          log.severity === 'info' && 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
        )}
      >
        {log.severity}
      </Badge>
    </div>
  );
}

// ─── Runtime Health Entry ──────────────────────────────────────

function RuntimeHealthEntry({
  name,
  status,
  healthScore,
  type,
}: {
  name: string;
  status: string;
  healthScore: number;
  type: string;
}) {
  const STATUS_DOT: Record<string, string> = {
    active: 'bg-emerald-500',
    inactive: 'bg-zinc-400',
    error: 'bg-red-500',
    verifying: 'bg-amber-500',
  };

  const TYPE_COLORS: Record<string, string> = {
    openrouter: 'text-emerald-600 dark:text-emerald-400',
    groq: 'text-orange-600 dark:text-orange-400',
    gemini: 'text-sky-600 dark:text-sky-400',
    ollama: 'text-zinc-600 dark:text-zinc-400',
  };

  const scoreColor =
    healthScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
    healthScore >= 50 ? 'text-amber-600 dark:text-amber-400' :
    'text-red-600 dark:text-red-400';

  return (
    <div className="flex items-center gap-3 py-2 hover:bg-muted/40 rounded-lg px-2 -mx-2 transition-colors">
      <span className={cn('w-2 h-2 rounded-full shrink-0', STATUS_DOT[status] ?? 'bg-zinc-400')} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{name}</p>
        <p className={cn('text-xs capitalize', TYPE_COLORS[type] ?? 'text-muted-foreground')}>{type}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={cn('text-sm font-semibold tabular-nums', scoreColor)}>{healthScore}</span>
        <span className="text-[10px] text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

// ─── Loading Skeletons ─────────────────────────────────────────

function LoadingOverview() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Overview Panel ────────────────────────────────────────────

export function OverviewPanel() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const workflows = useWorkspaceStore((s) => s.workflows);
  const runtimes = useWorkspaceStore((s) => s.runtimes);
  const agents = useWorkspaceStore((s) => s.agents);
  const governanceRules = useWorkspaceStore((s) => s.governanceRules);
  const auditLogs = useWorkspaceStore((s) => s.auditLogs);
  const workspaceLoading = useWorkspaceStore((s) => s.workspaceLoading);

  if (workspaceLoading) {
    return <LoadingOverview />;
  }

  const activeWorkflows = workflows.filter((w) => w.state === 'active').length;
  const activeRuntimes = runtimes.filter((r) => r.status === 'active').length;
  const activeAgents = agents.filter((a) => a.status === 'active' || a.status === 'busy').length;
  const recentLogs = auditLogs.slice(0, 5);

  const modeLabel = WORKSPACE_MODES.find((m) => m.key === workspace?.mode)?.label ?? workspace?.mode ?? 'Builder';

  return (
    <motion.div
      className="p-6 space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* ─── Welcome Section ─── */}
      <motion.div variants={itemVariants}>
        <div className="flex flex-col sm:flex-row sm:items-end gap-1 sm:gap-3 mb-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back
          </h1>
          <Badge variant="outline" className="w-fit text-xs font-medium">
            {modeLabel} Mode
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {workspace?.description
            ? workspace.description
            : 'Your AI-native operational workspace is ready.'}
        </p>
      </motion.div>

      {/* ─── Metric Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Workflows"
          value={activeWorkflows}
          subtitle={`${workflows.length} total`}
          icon={Workflow}
          accentColor="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
        />
        <MetricCard
          title="Connected Runtimes"
          value={activeRuntimes}
          subtitle={`${runtimes.length} configured`}
          icon={Cpu}
          accentColor="bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400"
        />
        <MetricCard
          title="Active Agents"
          value={activeAgents}
          subtitle={`${agents.length} deployed`}
          icon={Bot}
          accentColor="bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
        />
        <MetricCard
          title="Governance Rules"
          value={governanceRules.length}
          subtitle={`${governanceRules.filter((r) => r.enabled).length} enabled`}
          icon={Shield}
          accentColor="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* ─── Bottom Grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
                </div>
                <Badge variant="secondary" className="text-[10px] h-5">
                  {auditLogs.length} events
                </Badge>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-2 pb-1">
              {recentLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Activity className="w-8 h-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No activity yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    Audit events will appear here
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-64">
                  <div className="space-y-0.5">
                    {recentLogs.map((log) => (
                      <AuditLogEntry key={log.id} log={log} />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* System Health */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-semibold">System Health</CardTitle>
                </div>
                <Badge variant="secondary" className="text-[10px] h-5">
                  {runtimes.length} runtimes
                </Badge>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-2 pb-1">
              {runtimes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Cpu className="w-8 h-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No runtimes connected</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    Add runtime providers in Runtime Hub
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-64">
                  <div className="space-y-0.5">
                    {runtimes.map((rt) => (
                      <RuntimeHealthEntry
                        key={rt.id}
                        name={rt.name}
                        status={rt.status}
                        healthScore={rt.healthScore}
                        type={rt.type}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
