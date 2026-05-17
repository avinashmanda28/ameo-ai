'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Zap,
  Shield,
  Brain,
  TrendingUp,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useExecutionStore } from '@/lib/store/execution-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { RuntimeExecution } from '@/lib/store/execution-store';

// ─── Color palette ────────────────────────────────────────────

const CHART_COLORS: Record<string, string> = {
  completed: '#10b981',
  failed: '#ef4444',
  pending: '#94a3b8',
  timed_out: '#f97316',
  executing: '#0ea5e9',
  awaiting_approval: '#f59e0b',
};

// ─── Stat Card ────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">{label}</span>
            <div className={cn('flex items-center justify-center w-7 h-7 rounded-md', color)}>
              <Icon className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
          {sublabel && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Status Distribution Chart ────────────────────────────────

function StatusChart({ executions }: { executions: RuntimeExecution[] }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const exec of executions) {
      counts[exec.status] = (counts[exec.status] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [executions]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        No execution data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={CHART_COLORS[entry.name] ?? '#64748b'}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            fontSize: '12px',
            borderRadius: '8px',
            border: '1px solid rgba(0,0,0,0.1)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: '11px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Provider Performance Table ───────────────────────────────

function ProviderPerformance({ executions }: { executions: RuntimeExecution[] }) {
  const providerStats = useMemo(() => {
    const stats: Record<string, {
      name: string;
      type: string;
      total: number;
      completed: number;
      failed: number;
      totalLatency: number;
      latencyCount: number;
    }> = {};

    for (const exec of executions) {
      const key = exec.provider?.id ?? 'unknown';
      const providerName = exec.provider?.name ?? 'Unknown';
      const providerType = exec.provider?.type ?? '—';

      if (!stats[key]) {
        stats[key] = {
          name: providerName,
          type: providerType,
          total: 0,
          completed: 0,
          failed: 0,
          totalLatency: 0,
          latencyCount: 0,
        };
      }

      stats[key].total++;
      if (exec.status === 'completed') stats[key].completed++;
      if (exec.status === 'failed' || exec.status === 'timed_out') stats[key].failed++;
      if (exec.latencyMs !== null) {
        stats[key].totalLatency += exec.latencyMs;
        stats[key].latencyCount++;
      }
    }

    return Object.values(stats);
  }, [executions]);

  if (providerStats.length === 0) {
    return (
      <div className="flex items-center justify-center h-[120px] text-sm text-muted-foreground">
        No provider data available
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-[11px] h-8">Provider</TableHead>
          <TableHead className="text-[11px] h-8 text-center">Calls</TableHead>
          <TableHead className="text-[11px] h-8 text-center">Success</TableHead>
          <TableHead className="text-[11px] h-8 text-center">Avg Latency</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {providerStats.map((stat) => {
          const successRate = stat.total > 0 ? ((stat.completed / stat.total) * 100).toFixed(1) : '—';
          const avgLatency =
            stat.latencyCount > 0
              ? (stat.totalLatency / stat.latencyCount).toFixed(0) + 'ms'
              : '—';

          return (
            <TableRow key={stat.name}>
              <TableCell className="text-xs py-2">
                <div className="flex flex-col">
                  <span className="font-medium">{stat.name}</span>
                  <span className="text-[10px] text-muted-foreground">{stat.type}</span>
                </div>
              </TableCell>
              <TableCell className="text-xs text-center py-2 font-mono">
                {stat.total}
              </TableCell>
              <TableCell className="text-center py-2">
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-[10px] h-5 px-1.5 font-mono',
                    parseFloat(successRate) >= 80
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : parseFloat(successRate) >= 50
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  )}
                >
                  {successRate}%
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-center py-2 font-mono text-muted-foreground">
                {avgLatency}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ─── Recent Executions Table ──────────────────────────────────

function RecentExecutionsTable({ executions }: { executions: RuntimeExecution[] }) {
  const recent = executions.slice(0, 20);

  if (recent.length === 0) {
    return (
      <div className="flex items-center justify-center h-[120px] text-sm text-muted-foreground">
        No executions recorded
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[400px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[11px] h-8">Prompt</TableHead>
            <TableHead className="text-[11px] h-8">Status</TableHead>
            <TableHead className="text-[11px] h-8">Provider</TableHead>
            <TableHead className="text-[11px] h-8 text-right">Latency</TableHead>
            <TableHead className="text-[11px] h-8">Verification</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recent.map((exec) => {
            const statusColors: Record<string, string> = {
              pending: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
              awaiting_approval: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
              approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
              rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
              executing: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
              completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
              failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
              timed_out: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
            };

            const statusLabels: Record<string, string> = {
              pending: 'Pending',
              awaiting_approval: 'Awaiting',
              approved: 'Approved',
              rejected: 'Rejected',
              executing: 'Running',
              completed: 'Done',
              failed: 'Failed',
              timed_out: 'Timeout',
            };

            return (
              <TableRow key={exec.id}>
                <TableCell className="text-xs py-2 max-w-[200px]">
                  <span className="font-mono truncate block">
                    {exec.prompt.length > 60 ? exec.prompt.slice(0, 60) + '...' : exec.prompt}
                  </span>
                </TableCell>
                <TableCell className="py-2">
                  <Badge
                    variant="secondary"
                    className={cn('text-[9px] h-4 px-1.5 font-medium', statusColors[exec.status] ?? '')}
                  >
                    {statusLabels[exec.status] ?? exec.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs py-2 text-muted-foreground">
                  {exec.provider?.name ?? '—'}
                </TableCell>
                <TableCell className="text-xs py-2 text-right font-mono text-muted-foreground">
                  {exec.latencyMs !== null ? `${exec.latencyMs}ms` : '—'}
                </TableCell>
                <TableCell className="py-2">
                  {exec.hallucinationDetected ? (
                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      ⚠ Hallucination
                    </Badge>
                  ) : exec.verificationResult ? (
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[9px] h-4 px-1.5',
                        exec.verificationResult === 'pass'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}
                    >
                      {exec.verificationResult}
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

// ─── Main Runtime Metrics Panel ───────────────────────────────

export function RuntimeMetricsPanel() {
  const { executions, executionsLoading, pendingApprovals } = useExecutionStore();

  const metrics = useMemo(() => {
    const total = executions.length;
    const completed = executions.filter((e) => e.status === 'completed').length;
    const failed = executions.filter((e) => e.status === 'failed' || e.status === 'timed_out').length;
    const successRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';

    const latencies = executions
      .filter((e) => e.latencyMs !== null)
      .map((e) => e.latencyMs as number);
    const avgLatency =
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0;

    const hallucinations = executions.filter((e) => e.hallucinationDetected).length;
    const verified = executions.filter((e) => e.verificationResult).length;
    const verifiedPassed = executions.filter(
      (e) => e.verificationResult === 'pass'
    ).length;
    const verifiedFailed = executions.filter(
      (e) => e.verificationResult === 'fail'
    ).length;
    const verificationPassRate =
      verified > 0 ? ((verifiedPassed / verified) * 100).toFixed(1) : '—';

    return {
      total,
      completed,
      failed,
      successRate,
      avgLatency,
      pendingApprovals: pendingApprovals.length,
      hallucinations,
      verified,
      verifiedPassed,
      verifiedFailed,
      verificationPassRate,
    };
  }, [executions, pendingApprovals]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-900/30">
          <Activity className="w-5 h-5 text-rose-700 dark:text-rose-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Runtime Metrics</h1>
          <p className="text-xs text-muted-foreground">
            Operational performance dashboard for runtime executions
          </p>
        </div>
      </div>

      {/* Stat cards */}
      {executionsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Executions"
            value={metrics.total}
            icon={Zap}
            color="bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
          />
          <StatCard
            label="Success Rate"
            value={`${metrics.successRate}%`}
            sublabel={`${metrics.completed} / ${metrics.total} successful`}
            icon={TrendingUp}
            color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            label="Avg Latency"
            value={metrics.avgLatency > 0 ? `${metrics.avgLatency}ms` : '—'}
            sublabel="Across all providers"
            icon={Clock}
            color="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
          />
          <StatCard
            label="Pending Approvals"
            value={metrics.pendingApprovals}
            icon={Shield}
            color="bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400"
          />
        </div>
      )}

      {/* Charts and tables */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Status distribution */}
        <div className="lg:col-span-5">
          <Card className="border-border/50">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold">Execution Status Distribution</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <StatusChart executions={executions} />
            </CardContent>
          </Card>
        </div>

        {/* Provider performance */}
        <div className="lg:col-span-7">
          <Card className="border-border/50">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold">Provider Performance</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ProviderPerformance executions={executions} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hallucination detection & verification */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Hallucinations Detected"
          value={metrics.hallucinations}
          sublabel={metrics.total > 0 ? `${((metrics.hallucinations / metrics.total) * 100).toFixed(1)}% detection rate` : 'No data'}
          icon={AlertTriangle}
          color="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
        />
        <StatCard
          label="Verification Pass Rate"
          value={metrics.verificationPassRate !== '—' ? `${metrics.verificationPassRate}%` : '—'}
          sublabel={`${metrics.verifiedPassed} passed / ${metrics.verifiedFailed} failed`}
          icon={CheckCircle2}
          color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          label="Failed Executions"
          value={metrics.failed}
          sublabel={metrics.total > 0 ? `${((metrics.failed / metrics.total) * 100).toFixed(1)}% failure rate` : 'No data'}
          icon={XCircle}
          color="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
        />
        <StatCard
          label="Quality Avg"
          value={(() => {
            const scored = executions.filter((e) => e.qualityScore !== null);
            if (scored.length === 0) return '—';
            const avg = scored.reduce((sum, e) => sum + (e.qualityScore ?? 0), 0) / scored.length;
            return avg.toFixed(0);
          })()}
          sublabel="Across verified executions"
          icon={Brain}
          color="bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
        />
      </div>

      {/* Recent executions table */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 px-4 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Recent Executions</CardTitle>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono">
              Last {Math.min(executions.length, 20)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <RecentExecutionsTable executions={executions} />
        </CardContent>
      </Card>
    </div>
  );
}
