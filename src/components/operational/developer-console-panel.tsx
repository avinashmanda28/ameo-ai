'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TerminalSquare,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Lock,
  Unlock,
  Loader2,
  Timer,
  Activity,
  Inbox,
  AlertTriangle,
  FileWarning,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useOperationalStore } from '@/lib/store/operational-store';
import type {
  SystemEvent,
  ExecutionTrace,
  AgentCoordination,
  StateSnapshot,
  SystemHealthMetric,
  EventLevel,
  EventSource,
  TraceStatus,
  CoordinationStatus,
  HealthSeverity,
  ApiResponse,
} from '@/lib/types';

// ─── Animation ───────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.1 },
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

const LEVEL_BADGE: Record<EventLevel, string> = {
  debug: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  info: 'bg-sky-900/30 text-sky-400 border-sky-800/50',
  warn: 'bg-amber-900/30 text-amber-400 border-amber-800/50',
  error: 'bg-red-900/30 text-red-400 border-red-800/50',
  critical: 'bg-red-900/40 text-red-300 border-red-700/50',
};

const LEVEL_DOT: Record<EventLevel, string> = {
  debug: 'bg-zinc-500',
  info: 'bg-sky-500',
  warn: 'bg-amber-500',
  error: 'bg-red-500',
  critical: 'bg-red-500 animate-pulse',
};

const TRACE_STATUS_BADGE: Record<TraceStatus, string> = {
  pending: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  running: 'bg-sky-900/30 text-sky-400 border-sky-800/50',
  completed: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50',
  failed: 'bg-red-900/30 text-red-400 border-red-800/50',
  skipped: 'bg-zinc-800 text-zinc-500 border-zinc-700',
};

const HEALTH_SEV_BADGE: Record<HealthSeverity, string> = {
  normal: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50',
  warning: 'bg-amber-900/30 text-amber-400 border-amber-800/50',
  degraded: 'bg-orange-900/30 text-orange-400 border-orange-800/50',
  critical: 'bg-red-900/30 text-red-400 border-red-800/50',
};

const COORD_STATUS_BADGE: Record<CoordinationStatus, string> = {
  claimed: 'bg-sky-900/30 text-sky-400 border-sky-800/50',
  active: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50',
  handed_off: 'bg-violet-900/30 text-violet-400 border-violet-800/50',
  completed: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  failed: 'bg-red-900/30 text-red-400 border-red-800/50',
  expired: 'bg-zinc-800 text-zinc-500 border-zinc-700',
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

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
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

// ─── Empty State ────────────────────────────────────────────

function EmptyState({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800/60 mb-4">
        <Icon className="w-7 h-7 text-zinc-600" />
      </div>
      <h3 className="text-sm font-semibold text-zinc-300 mb-1">{title}</h3>
      <p className="text-xs text-zinc-500 text-center max-w-sm">{description}</p>
    </div>
  );
}

// ─── Loading Skeleton ───────────────────────────────────────

function LoadingRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg bg-zinc-900/50" />
      ))}
    </div>
  );
}

// ─── Tab 1: Live Event Stream ───────────────────────────────

function EventStreamTab() {
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (levelFilter !== 'all') params.set('level', levelFilter);
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      const res = await fetch(`/api/events?${params}`);
      const json: ApiResponse<SystemEvent[]> = await res.json();
      if (json.success && json.data) {
        setEvents(json.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [levelFilter, sourceFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchEvents, 3000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchEvents]);

  const filteredEvents = levelFilter === 'all' && sourceFilter === 'all'
    ? events
    : events.filter((e) => {
      if (levelFilter !== 'all' && e.level !== levelFilter) return false;
      if (sourceFilter !== 'all' && e.source !== sourceFilter) return false;
      return true;
    });

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[120px] h-8 text-xs bg-zinc-900 border-zinc-800 text-zinc-300">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="debug">Debug</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs bg-zinc-900 border-zinc-800 text-zinc-300">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="workflow">Workflow</SelectItem>
            <SelectItem value="runtime">Runtime</SelectItem>
            <SelectItem value="queue">Queue</SelectItem>
            <SelectItem value="governance">Governance</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 text-xs',
            autoRefresh ? 'text-emerald-400' : 'text-zinc-500'
          )}
          onClick={() => setAutoRefresh(!autoRefresh)}
        >
          <Activity className={cn('w-3.5 h-3.5 mr-1.5', autoRefresh && 'animate-pulse')} />
          Auto {autoRefresh ? 'ON' : 'OFF'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-zinc-500 hover:text-zinc-300"
          onClick={fetchEvents}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
        <Badge variant="secondary" className="text-[10px] h-6 px-2 bg-zinc-800 text-zinc-400 border-zinc-700">
          {filteredEvents.length} events
        </Badge>
      </div>

      {/* Event List */}
      <Card className="border-zinc-800/60 bg-zinc-950/50">
        <CardContent className="p-0">
          {loading ? (
            <LoadingRows count={8} />
          ) : filteredEvents.length === 0 ? (
            <EmptyState icon={Inbox} title="No Events" description="No system events recorded yet. Events will stream here as the system operates." />
          ) : (
            <ScrollArea className="max-h-[calc(100vh-20rem)]">
              <div className="divide-y divide-zinc-800/40">
                {filteredEvents.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    expanded={expandedId === event.id}
                    onToggle={() => setExpandedId(expandedId === event.id ? null : event.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EventRow({ event, expanded, onToggle }: { event: SystemEvent; expanded: boolean; onToggle: () => void }) {
  const hasPayload = !!event.payload;
  return (
    <div className="px-4 py-2.5 hover:bg-zinc-900/40 transition-colors cursor-pointer" onClick={onToggle}>
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <span className={cn('w-2 h-2 rounded-full', LEVEL_DOT[event.level as EventLevel] || 'bg-zinc-500')} />
          <span className="text-[10px] text-zinc-600 font-mono tabular-nums w-16">
            {formatTimestamp(event.createdAt)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5 border', LEVEL_BADGE[event.level as EventLevel] || '')}>
              {event.level}
            </Badge>
            <span className="text-xs font-medium text-zinc-200 font-mono">{event.eventType}</span>
            {event.source && (
              <span className="text-[10px] text-zinc-500 font-mono">[{event.source}]</span>
            )}
            {event.resourceType && (
              <span className="text-[10px] text-zinc-600 font-mono">
                {event.resourceType}{event.resourceId ? `:${event.resourceId.slice(0, 8)}` : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-zinc-600">{timeAgo(event.createdAt)}</span>
            {event.traceId && (
              <span className="text-[10px] text-zinc-600 font-mono">trace:{event.traceId.slice(0, 8)}</span>
            )}
            {hasPayload && (
              <span className="text-[10px] text-zinc-600 flex items-center gap-0.5">
                {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                payload
              </span>
            )}
          </div>
        </div>
      </div>
      {expanded && hasPayload && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="mt-2 ml-[5.5rem]"
        >
          <pre className="text-[11px] text-zinc-400 bg-zinc-900/80 border border-zinc-800/60 rounded-lg p-3 overflow-x-auto font-mono leading-relaxed max-h-60">
            {tryParseJson(event.payload)}
          </pre>
        </motion.div>
      )}
    </div>
  );
}

// ─── Tab 2: Execution Traces ────────────────────────────────

function ExecutionTracesTab() {
  const [traces, setTraces] = useState<ExecutionTrace[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const fetchTraces = useCallback(async () => {
    try {
      const res = await fetch('/api/traces?limit=50&grouped=true');
      const json: ApiResponse<ExecutionTrace[]> = await res.json();
      if (json.success && json.data) {
        setTraces(json.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTraces();
  }, [fetchTraces]);

  // Group traces by traceId
  const traceGroups = new Map<string, ExecutionTrace[]>();
  for (const t of traces) {
    const existing = traceGroups.get(t.traceId) || [];
    existing.push(t);
    traceGroups.set(t.traceId, existing);
  }

  // Sort groups by most recent step
  const sortedGroups = Array.from(traceGroups.entries()).sort((a, b) => {
    const aTime = new Date(a[1][0].startedAt).getTime();
    const bTime = new Date(b[1][0].startedAt).getTime();
    return bTime - aTime;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-[10px] h-6 px-2 bg-zinc-800 text-zinc-400 border-zinc-700">
          {sortedGroups.length} trace chains
        </Badge>
        <Button variant="ghost" size="sm" className="h-8 text-xs text-zinc-500 hover:text-zinc-300" onClick={fetchTraces}>
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      <Card className="border-zinc-800/60 bg-zinc-950/50">
        <CardContent className="p-0">
          {loading ? (
            <LoadingRows count={5} />
          ) : sortedGroups.length === 0 ? (
            <EmptyState icon={Timer} title="No Traces" description="No execution traces recorded. Traces appear when operations span multiple subsystems." />
          ) : (
            <ScrollArea className="max-h-[calc(100vh-20rem)]">
              <div className="divide-y divide-zinc-800/40">
                {sortedGroups.map(([traceId, steps]) => (
                  <TraceChain
                    key={traceId}
                    traceId={traceId}
                    steps={steps}
                    expanded={expandedTraceId === traceId}
                    expandedStep={expandedStep}
                    onToggle={() => {
                      setExpandedTraceId(expandedTraceId === traceId ? null : traceId);
                      setExpandedStep(null);
                    }}
                    onStepToggle={(id) => setExpandedStep(expandedStep === id ? null : id)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TraceChain({
  traceId,
  steps,
  expanded,
  expandedStep,
  onToggle,
  onStepToggle,
}: {
  traceId: string;
  steps: ExecutionTrace[];
  expanded: boolean;
  expandedStep: string | null;
  onToggle: () => void;
  onStepToggle: (id: string) => void;
}) {
  const sortedSteps = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
  const completedCount = sortedSteps.filter((s) => s.status === 'completed').length;
  const failedCount = sortedSteps.filter((s) => s.status === 'failed').length;

  return (
    <div>
      <div className="px-4 py-3 hover:bg-zinc-900/40 transition-colors cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
          <span className="text-xs font-mono text-zinc-400">{traceId.slice(0, 12)}</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500">{steps.length} steps</span>
            {completedCount > 0 && (
              <span className="text-[10px] text-emerald-500">{completedCount} done</span>
            )}
            {failedCount > 0 && (
              <span className="text-[10px] text-red-500">{failedCount} failed</span>
            )}
          </div>
          <span className="text-[10px] text-zinc-600 ml-auto">{timeAgo(sortedSteps[0].startedAt)}</span>
        </div>
      </div>
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="ml-4 mr-4 mb-3"
        >
          <div className="relative border-l-2 border-zinc-800 pl-4 space-y-2">
            {sortedSteps.map((step, idx) => (
              <div key={step.id} className="relative">
                {/* Step connector dot */}
                <div className={cn(
                  'absolute -left-[1.3rem] top-3 w-3 h-3 rounded-full border-2 border-zinc-950',
                  step.status === 'completed' ? 'bg-emerald-500' :
                  step.status === 'running' ? 'bg-sky-500 animate-pulse' :
                  step.status === 'failed' ? 'bg-red-500' :
                  'bg-zinc-600'
                )} />
                <div
                  className={cn(
                    'rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-3 cursor-pointer hover:border-zinc-700/60 transition-colors',
                  )}
                  onClick={() => onStepToggle(step.id)}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-zinc-600 font-mono">#{step.stepOrder}</span>
                    <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5 border', TRACE_STATUS_BADGE[step.status as TraceStatus] || '')}>
                      {step.status}
                    </Badge>
                    <span className="text-xs font-medium text-zinc-200 font-mono">{step.operation}</span>
                    <span className="text-[10px] text-zinc-500">[{step.subsystem}]</span>
                    {step.durationMs !== null && (
                      <span className="text-[10px] text-zinc-500 font-mono">{formatDuration(step.durationMs)}</span>
                    )}
                    {(step.inputSnapshot || step.outputSnapshot || step.errorSnapshot) && (
                      <span className="text-[10px] text-zinc-600 ml-auto flex items-center gap-0.5">
                        {expandedStep === step.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        details
                      </span>
                    )}
                  </div>
                  {expandedStep === step.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-2 space-y-1.5">
                      {step.inputSnapshot && (
                        <div>
                          <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Input</span>
                          <pre className="text-[11px] text-zinc-400 bg-zinc-950 rounded p-2 mt-1 overflow-x-auto font-mono max-h-32">{tryParseJson(step.inputSnapshot)}</pre>
                        </div>
                      )}
                      {step.outputSnapshot && (
                        <div>
                          <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Output</span>
                          <pre className="text-[11px] text-zinc-400 bg-zinc-950 rounded p-2 mt-1 overflow-x-auto font-mono max-h-32">{tryParseJson(step.outputSnapshot)}</pre>
                        </div>
                      )}
                      {step.errorSnapshot && (
                        <div>
                          <span className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">Error</span>
                          <pre className="text-[11px] text-red-400 bg-zinc-950 rounded p-2 mt-1 overflow-x-auto font-mono max-h-32">{tryParseJson(step.errorSnapshot)}</pre>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── Tab 3: Agent Coordination ──────────────────────────────

function AgentCoordinationTab() {
  const [coordinations, setCoordinations] = useState<AgentCoordination[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCoordinations = useCallback(async () => {
    try {
      const res = await fetch('/api/coordination?limit=50');
      const json: ApiResponse<AgentCoordination[]> = await res.json();
      if (json.success && json.data) {
        setCoordinations(json.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoordinations();
  }, [fetchCoordinations]);

  const handleAction = async (taskId: string, action: 'complete' | 'fail') => {
    setActionLoading(taskId);
    try {
      const res = await fetch('/api/coordination', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, taskId }),
      });
      const json = await res.json();
      if (json.success) fetchCoordinations();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const activeRecords = coordinations.filter((c) => !['completed', 'expired'].includes(c.status));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] h-6 px-2 bg-zinc-800 text-zinc-400 border-zinc-700">
            {coordinations.length} total
          </Badge>
          {activeRecords.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-6 px-2 bg-sky-900/30 text-sky-400 border-sky-800/50">
              {activeRecords.length} active
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-8 text-xs text-zinc-500 hover:text-zinc-300" onClick={fetchCoordinations}>
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      <Card className="border-zinc-800/60 bg-zinc-950/50">
        <CardContent className="p-0">
          {loading ? (
            <LoadingRows count={4} />
          ) : coordinations.length === 0 ? (
            <EmptyState icon={FileWarning} title="No Coordination Records" description="Agent coordination records will appear here when agents claim or hand off tasks." />
          ) : (
            <ScrollArea className="max-h-[calc(100vh-20rem)]">
              <div className="divide-y divide-zinc-800/40">
                {coordinations.map((coord) => (
                  <div key={coord.id} className="px-4 py-3 hover:bg-zinc-900/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-medium text-zinc-200 truncate max-w-[200px]">{coord.taskId}</span>
                          <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5 border', COORD_STATUS_BADGE[coord.status as CoordinationStatus] || '')}>
                            {coord.status.replace('_', ' ')}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-zinc-800 text-zinc-500 border-zinc-700">
                            {coord.taskType}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                          <span className="font-mono">Agent: {coord.ownerAgentType || coord.ownerAgentId.slice(0, 8)}</span>
                          <span className="font-mono">P{coord.priority}</span>
                          {coord.isLocked ? (
                            <span className="flex items-center gap-1 text-amber-500">
                              <Lock className="w-3 h-3" /> locked
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-zinc-600">
                              <Unlock className="w-3 h-3" /> unlocked
                            </span>
                          )}
                          {coord.handedOffTo && (
                            <span className="text-violet-400">handed off</span>
                          )}
                        </div>
                        {coord.description && (
                          <p className="text-[11px] text-zinc-500 mt-1 truncate">{coord.description}</p>
                        )}
                      </div>
                      {/* Actions */}
                      {!['completed', 'failed', 'expired'].includes(coord.status) && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] px-2 border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/20"
                            onClick={() => handleAction(coord.taskId, 'complete')}
                            disabled={actionLoading === coord.taskId}
                          >
                            {actionLoading === coord.taskId ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                            )}
                            Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] px-2 border-red-800/40 text-red-400 hover:bg-red-900/20"
                            onClick={() => handleAction(coord.taskId, 'fail')}
                            disabled={actionLoading === coord.taskId}
                          >
                            {actionLoading === coord.taskId ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <XCircle className="w-3 h-3 mr-1" />
                            )}
                            Fail
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-600">
                      <span>Created {timeAgo(coord.createdAt)}</span>
                      {coord.completedAt && <span>Completed {timeAgo(coord.completedAt)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab 4: State Snapshots ─────────────────────────────────

function StateSnapshotsTab() {
  const [snapshots, setSnapshots] = useState<StateSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchSnapshots = useCallback(async () => {
    try {
      const res = await fetch('/api/snapshots?limit=20');
      const json: ApiResponse<StateSnapshot[]> = await res.json();
      if (json.success && json.data) {
        setSnapshots(json.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  // Group by subsystem
  const grouped = new Map<string, StateSnapshot[]>();
  for (const s of snapshots) {
    const existing = grouped.get(s.subsystem) || [];
    existing.push(s);
    grouped.set(s.subsystem, existing);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] h-6 px-2 bg-zinc-800 text-zinc-400 border-zinc-700">
            {snapshots.length} snapshots
          </Badge>
          {snapshots.filter((s) => s.driftDetected).length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-6 px-2 bg-amber-900/30 text-amber-400 border-amber-800/50">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {snapshots.filter((s) => s.driftDetected).length} drift
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-8 text-xs text-zinc-500 hover:text-zinc-300" onClick={fetchSnapshots}>
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {loading ? (
        <Card className="border-zinc-800/60 bg-zinc-950/50">
          <CardContent className="p-0">
            <LoadingRows count={4} />
          </CardContent>
        </Card>
      ) : grouped.size === 0 ? (
        <Card className="border-zinc-800/60 bg-zinc-950/50">
          <CardContent className="p-0">
            <EmptyState icon={FileWarning} title="No Snapshots" description="State snapshots will appear here when the system captures consistency checkpoints." />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Array.from(grouped.entries()).map(([subsystem, subs]) => (
            <Card key={subsystem} className="border-zinc-800/60 bg-zinc-950/50">
              <CardHeader className="pb-2 px-4 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                    {subsystem}
                  </CardTitle>
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-zinc-800 text-zinc-400 border-zinc-700">
                    {subs.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ScrollArea className="max-h-64">
                  <div className="space-y-2">
                    {subs.map((snap) => (
                      <div
                        key={snap.id}
                        className={cn(
                          'rounded-lg border p-2.5 cursor-pointer transition-colors',
                          snap.driftDetected
                            ? 'border-amber-800/40 bg-amber-950/10 hover:border-amber-700/50'
                            : 'border-zinc-800/60 bg-zinc-900/30 hover:border-zinc-700/60'
                        )}
                        onClick={() => setExpandedId(expandedId === snap.id ? null : snap.id)}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] h-5 px-1.5 border',
                              snap.consistencyStatus === 'consistent'
                                ? 'bg-emerald-900/20 text-emerald-400 border-emerald-800/40'
                                : snap.consistencyStatus === 'drifted'
                                  ? 'bg-amber-900/20 text-amber-400 border-amber-800/40'
                                  : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                            )}
                          >
                            {snap.consistencyStatus}
                          </Badge>
                          {snap.driftDetected && (
                            <span className="text-[10px] text-amber-500 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> drift detected
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-600 ml-auto">{timeAgo(snap.createdAt)}</span>
                        </div>
                        {snap.snapshotReason && (
                          <p className="text-[10px] text-zinc-500 mt-1">{snap.snapshotReason}</p>
                        )}
                        {expandedId === snap.id && snap.driftDetails && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-2">
                            <pre className="text-[11px] text-amber-400/80 bg-zinc-950 rounded p-2 overflow-x-auto font-mono max-h-32">{tryParseJson(snap.driftDetails)}</pre>
                          </motion.div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab 5: API Health ──────────────────────────────────────

function ApiHealthTab() {
  const [metrics, setMetrics] = useState<SystemHealthMetric[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/health?limit=50');
      const json: ApiResponse<SystemHealthMetric[]> = await res.json();
      if (json.success && json.data) {
        setMetrics(json.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-[10px] h-6 px-2 bg-zinc-800 text-zinc-400 border-zinc-700">
          {metrics.length} metrics
        </Badge>
        <Button variant="ghost" size="sm" className="h-8 text-xs text-zinc-500 hover:text-zinc-300" onClick={fetchMetrics}>
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      <Card className="border-zinc-800/60 bg-zinc-950/50">
        <CardContent className="p-0">
          {loading ? (
            <LoadingRows count={6} />
          ) : metrics.length === 0 ? (
            <EmptyState icon={Activity} title="No Health Metrics" description="Health metrics will be recorded as the system monitors subsystem performance." />
          ) : (
            <ScrollArea className="max-h-[calc(100vh-20rem)]">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800/60">
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Subsystem</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Metric</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Value</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Severity</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/30">
                    {metrics.map((metric) => (
                      <tr key={metric.id} className="hover:bg-zinc-900/40 transition-colors">
                        <td className="px-4 py-2 font-mono text-zinc-300">{metric.subsystem}</td>
                        <td className="px-4 py-2 text-zinc-400">{metric.metricType}</td>
                        <td className="px-4 py-2">
                          <span className="font-mono text-zinc-200 tabular-nums">
                            {metric.value.toFixed(1)}
                          </span>
                          {metric.unit && (
                            <span className="text-zinc-600 ml-1">{metric.unit}</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5 border', HEALTH_SEV_BADGE[metric.severity as HealthSeverity] || '')}>
                            {metric.severity}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-zinc-600 text-[10px]">{timeAgo(metric.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Panel ─────────────────────────────────────────────

export function DeveloperConsolePanel() {
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
            <TerminalSquare className="w-5 h-5 text-zinc-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Developer Console</h1>
            <p className="text-xs text-zinc-500">Deep operational debugging — event stream, traces, coordination</p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={itemVariants}>
        <Tabs defaultValue="events" className="space-y-4">
          <TabsList className="bg-zinc-900 border border-zinc-800/60">
            <TabsTrigger value="events" className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100">
              Event Stream
            </TabsTrigger>
            <TabsTrigger value="traces" className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100">
              Execution Traces
            </TabsTrigger>
            <TabsTrigger value="coordination" className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100">
              Coordination
            </TabsTrigger>
            <TabsTrigger value="snapshots" className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100">
              State Snapshots
            </TabsTrigger>
            <TabsTrigger value="health" className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100">
              API Health
            </TabsTrigger>
          </TabsList>

          <TabsContent value="events">
            <EventStreamTab />
          </TabsContent>
          <TabsContent value="traces">
            <ExecutionTracesTab />
          </TabsContent>
          <TabsContent value="coordination">
            <AgentCoordinationTab />
          </TabsContent>
          <TabsContent value="snapshots">
            <StateSnapshotsTab />
          </TabsContent>
          <TabsContent value="health">
            <ApiHealthTab />
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}
