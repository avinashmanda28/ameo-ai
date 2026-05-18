'use client';

import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Loader2,
  Inbox,
  GitBranch,
  Network,
  Lock,
  User,
  Zap,
  Heart,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type {
  SystemEvent,
  SystemHealthMetric,
  GraphAnalysisResult,
  AgentCoordination,
  HealthSeverity,
  EventLevel,
  ApiResponse,
  SystemHealthSummary,
} from '@/lib/types';

// ─── Animation ───────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.4, 0.25, 1] as const },
  },
};

// ─── Color Maps ──────────────────────────────────────────────

const SEVERITY_SCORE_COLORS: Record<string, string> = {
  normal: 'text-emerald-400',
  warning: 'text-amber-400',
  degraded: 'text-orange-400',
  critical: 'text-red-400',
};

function scoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 70) return 'text-amber-400';
  if (score >= 50) return 'text-orange-400';
  return 'text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 90) return 'bg-emerald-500/10 border-emerald-800/30';
  if (score >= 70) return 'bg-amber-500/10 border-amber-800/30';
  if (score >= 50) return 'bg-orange-500/10 border-orange-800/30';
  return 'bg-red-500/10 border-red-800/30';
}

const SEVERITY_DOT_COLORS: Record<string, string> = {
  normal: 'bg-emerald-500',
  warning: 'bg-amber-500',
  degraded: 'bg-orange-500',
  critical: 'bg-red-500 animate-pulse',
};

const EVENT_LEVEL_DOT: Record<EventLevel, string> = {
  debug: 'bg-zinc-500',
  info: 'bg-sky-500',
  warn: 'bg-amber-500',
  error: 'bg-red-500',
  critical: 'bg-red-500 animate-pulse',
};

// ─── Helpers ────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  if (diff < 5000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function tryParseJson(str: string | null): string {
  if (!str) return '—';
  try {
    const parsed = JSON.parse(str);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return str;
  }
}

// ─── Subsystem Health Card ──────────────────────────────────

const SUBSYSTEM_LABELS: Record<string, string> = {
  queue: 'Queue',
  runtime: 'Runtime',
  workflow: 'Workflow',
  verification: 'Verification',
  recovery: 'Recovery',
  agent: 'Agent',
  event_bus: 'Event Bus',
};

const SUBSYSTEM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  queue: Zap,
  runtime: Heart,
  workflow: GitBranch,
  verification: ShieldCheck,
  recovery: RefreshCw,
  agent: User,
  event_bus: Network,
};

function SubsystemHealthCard({
  subsystem,
  score,
  severity,
  details,
}: {
  subsystem: string;
  score: number;
  severity: HealthSeverity;
  details: string;
}) {
  const Icon = SUBSYSTEM_ICONS[subsystem] || Activity;

  return (
    <Card className={cn(
      'border transition-colors',
      scoreBg(score)
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className={cn('w-4 h-4', scoreColor(score))} />
            <span className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
              {SUBSYSTEM_LABELS[subsystem] || subsystem}
            </span>
          </div>
          <span className={cn('w-2.5 h-2.5 rounded-full', SEVERITY_DOT_COLORS[severity] || 'bg-zinc-500')} />
        </div>
        <div className="flex items-baseline gap-1.5 mb-1.5">
          <span className={cn('text-2xl font-bold tabular-nums', scoreColor(score))}>{score}</span>
          <span className="text-[10px] text-zinc-500">/ 100</span>
        </div>
        <p className="text-[10px] text-zinc-500 truncate">{details}</p>
        <Badge
          variant="outline"
          className={cn(
            'mt-2 text-[10px] h-5 px-1.5 border',
            severity === 'normal' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-800/40' :
            severity === 'warning' ? 'bg-amber-900/20 text-amber-400 border-amber-800/40' :
            severity === 'degraded' ? 'bg-orange-900/20 text-orange-400 border-orange-800/40' :
            'bg-red-900/20 text-red-400 border-red-800/40'
          )}
        >
          {severity}
        </Badge>
      </CardContent>
    </Card>
  );
}

// ─── Event Timeline Item ────────────────────────────────────

function EventTimelineItem({ event }: { event: SystemEvent }) {
  return (
    <div className="flex gap-3 relative">
      {/* Dot and line */}
      <div className="flex flex-col items-center">
        <div className={cn('w-2.5 h-2.5 rounded-full mt-1 shrink-0', EVENT_LEVEL_DOT[event.level as EventLevel] || 'bg-zinc-500')} />
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-zinc-600 font-mono tabular-nums">{formatTimestamp(event.createdAt)}</span>
          <Badge
            variant="outline"
            className={cn(
              'text-[9px] h-4 px-1 border',
              event.level === 'error' || event.level === 'critical' ? 'bg-red-900/20 text-red-400 border-red-800/40' :
              event.level === 'warn' ? 'bg-amber-900/20 text-amber-400 border-amber-800/40' :
              event.level === 'info' ? 'bg-sky-900/20 text-sky-400 border-sky-800/40' :
              'bg-zinc-800 text-zinc-500 border-zinc-700'
            )}
          >
            {event.level}
          </Badge>
          <span className="text-[11px] font-mono text-zinc-300">{event.eventType}</span>
          {event.source && (
            <span className="text-[10px] text-zinc-600 font-mono">[{event.source}]</span>
          )}
        </div>
        {event.payload && (
          <p className="text-[10px] text-zinc-500 mt-0.5 truncate font-mono">
            {typeof event.payload === 'string' && event.payload.length > 120
              ? event.payload.slice(0, 120) + '...'
              : event.payload}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Panel ─────────────────────────────────────────────

export function ObservabilityPanel() {
  const [healthSummary, setHealthSummary] = useState<SystemHealthSummary | null>(null);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [graphAnalysis, setGraphAnalysis] = useState<GraphAnalysisResult | null>(null);
  const [coordinations, setCoordinations] = useState<AgentCoordination[]>([]);
  const [healthMetrics, setHealthMetrics] = useState<SystemHealthMetric[]>([]);

  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAll = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [healthRes, eventsRes, graphRes, coordRes, metricsRes] = await Promise.all([
        fetch('/api/health?summary=true'),
        fetch('/api/events?limit=10'),
        fetch('/api/graph-analysis'),
        fetch('/api/coordination?limit=50'),
        fetch('/api/health?limit=100'),
      ]);

      const [healthJson, eventsJson, graphJson, coordJson, metricsJson] = await Promise.all([
        healthRes.json() as Promise<ApiResponse<SystemHealthSummary>>,
        eventsRes.json() as Promise<ApiResponse<SystemEvent[]>>,
        graphRes.json() as Promise<ApiResponse<GraphAnalysisResult>>,
        coordRes.json() as Promise<ApiResponse<AgentCoordination[]>>,
        metricsRes.json() as Promise<ApiResponse<SystemHealthMetric[]>>,
      ]);

      if (healthJson.success && healthJson.data) {
        setHealthSummary(healthJson.data);
      }
      if (eventsJson.success && eventsJson.data) {
        setEvents(eventsJson.data);
      }
      if (graphJson.success && graphJson.data) {
        setGraphAnalysis(graphJson.data);
      }
      if (coordJson.success && coordJson.data) {
        setCoordinations(coordJson.data);
      }
      if (metricsJson.success && metricsJson.data) {
        setHealthMetrics(metricsJson.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate local health scores from raw metrics if summary is not available
  const localHealthSummary = useMemo<SystemHealthSummary | null>(() => {
    if (healthSummary) return healthSummary;
    if (healthMetrics.length === 0) return null;

    const subsystems = ['queue', 'runtime', 'workflow', 'verification', 'recovery', 'agent', 'event_bus'];
    const summary: SystemHealthSummary['subsystems'] = {} as SystemHealthSummary['subsystems'];

    for (const sub of subsystems) {
      const subMetrics = healthMetrics.filter((m) => m.subsystem === sub);
      if (subMetrics.length === 0) {
        (summary as Record<string, unknown>)[sub] = { score: 100, severity: 'normal', details: 'No metrics' };
        continue;
      }

      const severities = subMetrics.map((m) => m.severity);
      const hasCritical = severities.includes('critical');
      const hasDegraded = severities.includes('degraded');
      const hasWarning = severities.includes('warning');

      let sev: HealthSeverity = 'normal';
      let score = 100;
      if (hasCritical) { sev = 'critical'; score = 20; }
      else if (hasDegraded) { sev = 'degraded'; score = 50; }
      else if (hasWarning) { sev = 'warning'; score = 75; }

      const metricTypes = [...new Set(subMetrics.map((m) => m.metricType))].join(', ');
      (summary as Record<string, unknown>)[sub] = {
        score,
        severity: sev,
        details: `${metricTypes} — ${subMetrics.length} metrics`,
      };
    }

    const scores = Object.values(summary).map((h: { score: number }) => h.score);
    const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    return {
      overallScore,
      subsystems: summary,
      lastUpdatedAt: new Date().toISOString(),
    };
  }, [healthSummary, healthMetrics]);

  const activeCoordRecords = coordinations.filter((c) => ['claimed', 'active', 'handed_off'].includes(c.status));
  const lockedRecords = coordinations.filter((c) => c.isLocked);
  const conflictRecords = coordinations.filter((c) => c.status === 'handed_off');

  useEffect(() => {
    fetchAll(true);
  }, [fetchAll]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setTimeout(() => {
        fetchAll(false);
        intervalRef.current = null;
      }, 5000);
    }
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [autoRefresh, fetchAll]);

  const overallScore = localHealthSummary?.overallScore ?? 0;
  const subsystemData = localHealthSummary?.subsystems;

  return (
    <motion.div
      className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-zinc-800/80 ring-1 ring-zinc-700/50">
            <Activity className="w-5 h-5 text-zinc-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Observability</h1>
            <p className="text-xs text-zinc-500">System health, graph diagnostics, and coordination view</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-8 text-xs', autoRefresh ? 'text-emerald-400' : 'text-zinc-500')}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className={cn('w-3.5 h-3.5 mr-1.5', autoRefresh && 'animate-pulse')} />
            Auto {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-zinc-500 hover:text-zinc-300"
            onClick={() => fetchAll(false)}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </motion.div>

      {/* Overall Health Score Bar */}
      <motion.div variants={itemVariants}>
        <Card className="border-zinc-800/60 bg-zinc-950/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className={cn('text-5xl font-bold tabular-nums', scoreColor(overallScore))}>
                    {localHealthSummary ? overallScore : '—'}
                  </p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Health Score</p>
                </div>
                <Separator orientation="vertical" className="h-14 bg-zinc-800" />
                <div>
                  <p className="text-xs text-zinc-400 mb-1">System Status</p>
                  {localHealthSummary ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs h-6 px-2.5 border',
                        overallScore >= 90
                          ? 'bg-emerald-900/20 text-emerald-400 border-emerald-800/40'
                          : overallScore >= 70
                            ? 'bg-amber-900/20 text-amber-400 border-amber-800/40'
                            : overallScore >= 50
                              ? 'bg-orange-900/20 text-orange-400 border-orange-800/40'
                              : 'bg-red-900/20 text-red-400 border-red-800/40'
                      )}
                    >
                      {overallScore >= 90 ? 'Healthy' : overallScore >= 70 ? 'Minor Issues' : overallScore >= 50 ? 'Degraded' : 'Critical'}
                    </Badge>
                  ) : (
                    <Skeleton className="h-6 w-24" />
                  )}
                </div>
              </div>
              {localHealthSummary && (
                <div className="text-right">
                  <p className="text-[10px] text-zinc-600">Last updated</p>
                  <p className="text-xs text-zinc-400 font-mono">
                    {formatTimestamp(localHealthSummary.lastUpdatedAt)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* System Health Grid */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-zinc-200">Subsystem Health</h2>
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-zinc-800 text-zinc-400 border-zinc-700">
            7 subsystems
          </Badge>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg bg-zinc-900/50" />
            ))}
          </div>
        ) : subsystemData ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {Object.entries(subsystemData).map(([sub, data]) => {
              const d = data as { score: number; severity: HealthSeverity; details: string };
              return (
                <SubsystemHealthCard
                  key={sub}
                  subsystem={sub}
                  score={d.score}
                  severity={d.severity}
                  details={d.details}
                />
              );
            })}
          </div>
        ) : (
          <Card className="border-zinc-800/60 bg-zinc-950/50">
            <CardContent className="py-8 flex flex-col items-center justify-center">
              <Inbox className="w-8 h-8 text-zinc-600 mb-2" />
              <p className="text-xs text-zinc-500">No health data available</p>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Events Timeline */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-200">Recent Events</h2>
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-zinc-800 text-zinc-400 border-zinc-700">
                {events.length}
              </Badge>
            </div>
          </div>
          <Card className="border-zinc-800/60 bg-zinc-950/50">
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full rounded bg-zinc-900/50" />
                  ))}
                </div>
              ) : events.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center">
                  <Inbox className="w-8 h-8 text-zinc-600 mb-2" />
                  <p className="text-xs text-zinc-500">No events recorded</p>
                </div>
              ) : (
                <ScrollArea className="max-h-96">
                  <div className="p-4">
                    {events.slice(0, 10).map((event) => (
                      <EventTimelineItem key={event.id} event={event} />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Workflow Graph Diagnostics */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-zinc-200">Workflow Graph Diagnostics</h2>
          </div>
          <Card className="border-zinc-800/60 bg-zinc-950/50">
            <CardContent className="p-4 space-y-4">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded bg-zinc-900/50" />
                  ))}
                </div>
              ) : graphAnalysis ? (
                <>
                  {/* Stats Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-3 text-center">
                      <p className="text-lg font-bold text-zinc-200 tabular-nums">{graphAnalysis.nodeCount}</p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Nodes</p>
                    </div>
                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-3 text-center">
                      <p className="text-lg font-bold text-zinc-200 tabular-nums">{graphAnalysis.edgeCount}</p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Edges</p>
                    </div>
                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-3 text-center">
                      <p className={cn('text-lg font-bold tabular-nums', scoreColor(graphAnalysis.integrityScore))}>
                        {graphAnalysis.integrityScore}
                      </p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Integrity</p>
                    </div>
                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-3 text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          graphAnalysis.isValid
                            ? 'bg-emerald-900/20 text-emerald-400 border-emerald-800/40'
                            : 'bg-red-900/20 text-red-400 border-red-800/40'
                        )}
                      >
                        {graphAnalysis.isValid ? (
                          <><CheckCircle2 className="w-3 h-3 mr-1" /> Valid</>
                        ) : (
                          <><XCircle className="w-3 h-3 mr-1" /> Invalid</>
                        )}
                      </Badge>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Status</p>
                    </div>
                  </div>

                  {/* Issues */}
                  {graphAnalysis.issues.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Issues Detected</p>
                      {graphAnalysis.issues.map((issue, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            'rounded-lg border p-3',
                            issue.severity === 'error'
                              ? 'border-red-800/40 bg-red-950/20'
                              : 'border-amber-800/40 bg-amber-950/20'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {issue.severity === 'error' ? (
                              <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[9px] h-4 px-1 border',
                                issue.severity === 'error'
                                  ? 'bg-red-900/20 text-red-400 border-red-800/40'
                                  : 'bg-amber-900/20 text-amber-400 border-amber-800/40'
                              )}
                            >
                              {issue.type.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          <p className="text-xs text-zinc-300 mt-1.5">{issue.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500/50 mb-1" />
                      <p className="text-xs text-zinc-500">No issues detected in workflow graph</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-6">
                  <Inbox className="w-8 h-8 text-zinc-600 mb-2" />
                  <p className="text-xs text-zinc-500">Unable to load graph analysis</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Cross-System Coordination View */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-zinc-200">Cross-System Coordination</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Active Agent Tasks */}
          <Card className="border-zinc-800/60 bg-zinc-950/50">
            <CardHeader className="pb-2 px-4 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-sky-400" />
                  Active Tasks
                </CardTitle>
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-zinc-800 text-zinc-400 border-zinc-700">
                  {activeCoordRecords.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full rounded bg-zinc-900/50" />)}
                </div>
              ) : activeCoordRecords.length === 0 ? (
                <p className="text-[11px] text-zinc-500 py-4 text-center">No active agent tasks</p>
              ) : (
                <ScrollArea className="max-h-48">
                  <div className="space-y-1.5">
                    {activeCoordRecords.slice(0, 10).map((coord) => (
                      <div key={coord.id} className="rounded-lg border border-zinc-800/40 bg-zinc-900/20 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-zinc-200 truncate flex-1">{coord.taskId}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[9px] h-4 px-1 border shrink-0',
                              coord.status === 'active' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-800/40' :
                              coord.status === 'claimed' ? 'bg-sky-900/20 text-sky-400 border-sky-800/40' :
                              'bg-violet-900/20 text-violet-400 border-violet-800/40'
                            )}
                          >
                            {coord.status}
                          </Badge>
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                          {coord.ownerAgentType || coord.ownerAgentId.slice(0, 8)} · {coord.taskType}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Coordination Conflicts */}
          <Card className="border-zinc-800/60 bg-zinc-950/50">
            <CardHeader className="pb-2 px-4 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  Handoffs
                </CardTitle>
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-zinc-800 text-zinc-400 border-zinc-700">
                  {conflictRecords.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loading ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => <Skeleton key={i} className="h-10 w-full rounded bg-zinc-900/50" />)}
                </div>
              ) : conflictRecords.length === 0 ? (
                <div className="flex flex-col items-center py-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500/40 mb-1" />
                  <p className="text-[11px] text-zinc-500">No active handoffs</p>
                </div>
              ) : (
                <ScrollArea className="max-h-48">
                  <div className="space-y-1.5">
                    {conflictRecords.slice(0, 10).map((coord) => (
                      <div key={coord.id} className="rounded-lg border border-amber-800/30 bg-amber-950/10 px-3 py-2">
                        <span className="text-[11px] font-mono text-zinc-200 truncate block">{coord.taskId}</span>
                        <div className="text-[10px] text-amber-400 mt-0.5">
                          Handed to {coord.handedOffTo?.slice(0, 8)}
                          {coord.handoffReason ? ` — ${coord.handoffReason}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Active Locks */}
          <Card className="border-zinc-800/60 bg-zinc-950/50">
            <CardHeader className="pb-2 px-4 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-orange-400" />
                  Active Locks
                </CardTitle>
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-zinc-800 text-zinc-400 border-zinc-700">
                  {lockedRecords.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loading ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => <Skeleton key={i} className="h-10 w-full rounded bg-zinc-900/50" />)}
                </div>
              ) : lockedRecords.length === 0 ? (
                <div className="flex flex-col items-center py-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500/40 mb-1" />
                  <p className="text-[11px] text-zinc-500">No active locks</p>
                </div>
              ) : (
                <ScrollArea className="max-h-48">
                  <div className="space-y-1.5">
                    {lockedRecords.slice(0, 10).map((coord) => (
                      <div key={coord.id} className="rounded-lg border border-orange-800/30 bg-orange-950/10 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Lock className="w-3 h-3 text-orange-400" />
                          <span className="text-[11px] font-mono text-zinc-200 truncate flex-1">{coord.taskId}</span>
                        </div>
                        <div className="text-[10px] text-orange-400/70 mt-0.5">
                          Agent: {coord.ownerAgentType || coord.ownerAgentId.slice(0, 8)}
                          {coord.lockExpiresAt && ` · expires ${timeAgo(coord.lockExpiresAt)}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </motion.div>
  );
}
