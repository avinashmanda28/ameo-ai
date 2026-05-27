'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertOctagon,
  AlertTriangle,
  Filter,
  Inbox,
  RefreshCw,
  ShieldAlert,
  BarChart3,
  ChevronDown,
  Clock,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  TrendingUp,
  Tag,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ApiResponse } from '@/lib/types';

// ─── Types ──────────────────────────────────────────────────

type FailureSeverity = 'low' | 'medium' | 'high' | 'critical';
type RecoveryStatus = 'success' | 'pending' | 'failed' | 'none';

interface FailureRecord {
  id: string;
  type: string;
  category: string;
  severity: FailureSeverity;
  message: string;
  recoveryAction: string | null;
  recoveryStatus: RecoveryStatus;
  occurrenceCount: number;
  lastOccurredAt: string;
  createdAt: string;
  sourceWorkflowId: string | null;
  sourceExecutionId: string | null;
}

interface FailureAggregation {
  type: string;
  count: number;
  severity: FailureSeverity;
  category: string;
}

// ─── Constants ──────────────────────────────────────────────

const SEVERITY_COLORS: Record<FailureSeverity, string> = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  high: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const SEVERITY_DOT_COLORS: Record<FailureSeverity, string> = {
  low: 'bg-slate-500',
  medium: 'bg-slate-400',
  high: 'bg-slate-500',
  critical: 'bg-red-500',
};

const SEVERITY_ICONS: Record<FailureSeverity, React.ComponentType<{ className?: string }>> = {
  low: AlertTriangle,
  medium: AlertTriangle,
  high: ShieldAlert,
  critical: AlertOctagon,
};

const RECOVERY_STATUS_COLORS: Record<RecoveryStatus, string> = {
  success: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  pending: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  none: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
};

const RECOVERY_STATUS_LABELS: Record<RecoveryStatus, string> = {
  success: 'Recovered',
  pending: 'Pending',
  failed: 'Failed',
  none: 'No Action',
};

const RECOVERY_STATUS_ICONS: Record<RecoveryStatus, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  pending: Loader2,
  failed: XCircle,
  none: Clock,
};

// ─── Animation Variants ─────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.4, 0.25, 1] as const },
  },
};

// ─── Helpers ────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ─── Bar Chart Visualization ────────────────────────────────

interface BarChartProps {
  aggregations: FailureAggregation[];
}

function FailureBarChart({ aggregations }: BarChartProps) {
  const maxCount = Math.max(...aggregations.map((a) => a.count), 1);

  return (
    <div className="space-y-2">
      {aggregations.map((agg) => (
        <div key={agg.type} className="flex items-center gap-3">
          <span className="text-xs text-zinc-400 w-28 shrink-0 truncate" title={agg.type}>
            {agg.type}
          </span>
          <div className="flex-1 h-6 bg-zinc-800/50 rounded overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(agg.count / maxCount) * 100}%` }}
              transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] as const }}
              className={cn(
                'h-full rounded flex items-center px-2',
                agg.severity === 'critical' ? 'bg-red-500/70' :
                agg.severity === 'high' ? 'bg-slate-500/70' :
                agg.severity === 'medium' ? 'bg-slate-400/70' :
                'bg-slate-500/70'
              )}
            >
              <span className="text-[10px] font-bold text-white tabular-nums">{agg.count}</span>
            </motion.div>
          </div>
          <Badge variant="secondary" className={cn('text-[10px] h-5 px-1.5 shrink-0', SEVERITY_COLORS[agg.severity])}>
            {agg.severity}
          </Badge>
        </div>
      ))}
    </div>
  );
}

// ─── Failure Detail Row ─────────────────────────────────────

interface FailureDetailRowProps {
  record: FailureRecord;
  showCategory: boolean;
}

function FailureDetailRow({ record, showCategory }: FailureDetailRowProps) {
  const SeverityIcon = SEVERITY_ICONS[record.severity];
  const RecoveryIcon = RECOVERY_STATUS_ICONS[record.recoveryStatus];
  const isRecurring = record.occurrenceCount > 1;

  return (
    <motion.div
      variants={itemVariants}
      layout
      className={cn(
        'rounded-lg border p-3 transition-all duration-150',
        isRecurring
          ? 'border-red-800/40 bg-red-950/20'
          : 'border-zinc-800/60 bg-zinc-900/50 hover:border-zinc-700/80'
      )}
    >
      <div className="flex items-start gap-2.5">
        <SeverityIcon className={cn('w-4 h-4 mt-0.5 shrink-0', SEVERITY_DOT_COLORS[record.severity].replace('bg-', 'text-'))} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-medium text-zinc-200 truncate">{record.type}</span>
            <Badge variant="secondary" className={cn('text-[10px] h-5 px-1.5', SEVERITY_COLORS[record.severity])}>
              {record.severity}
            </Badge>
            {isRecurring && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-red-400 border-red-800/40 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {record.occurrenceCount}x
              </Badge>
            )}
            <Badge variant="secondary" className={cn('text-[10px] h-5 px-1.5', RECOVERY_STATUS_COLORS[record.recoveryStatus])}>
              {RECOVERY_STATUS_LABELS[record.recoveryStatus]}
            </Badge>
          </div>
          {showCategory && (
            <div className="flex items-center gap-1.5 mb-1">
              <Tag className="w-3 h-3 text-zinc-600" />
              <span className="text-[10px] text-zinc-500">{record.category}</span>
            </div>
          )}
          <p className="text-xs text-zinc-400 line-clamp-2">{record.message}</p>
          {record.recoveryAction && (
            <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-zinc-800/40">
              <RecoveryIcon className={cn('w-3 h-3 mt-0.5 shrink-0', record.recoveryStatus === 'success' ? 'text-blue-500' : record.recoveryStatus === 'pending' ? 'text-slate-400' : record.recoveryStatus === 'failed' ? 'text-red-500' : 'text-zinc-500')} />
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Recovery: </span>
                <span className="text-[11px] text-zinc-400">{record.recoveryAction}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-zinc-800/40">
        <span className="text-[10px] text-zinc-600">Last: {timeAgo(record.lastOccurredAt)}</span>
        <span className="text-[10px] text-zinc-600 ml-auto">Created: {timeAgo(record.createdAt)}</span>
      </div>
    </motion.div>
  );
}

// ─── Empty State ────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800/60 mb-4">
        <CheckCircle2 className="w-8 h-8 text-blue-600/40" />
      </div>
      <h3 className="text-base font-semibold text-zinc-300 mb-1">No Failures Recorded</h3>
      <p className="text-sm text-zinc-500 text-center max-w-sm">
        The system is operating normally. Failure records will appear here when issues are detected.
      </p>
    </div>
  );
}

// ─── Main Failures Panel ────────────────────────────────────

export function FailuresPanel() {
  const [failures, setFailures] = useState<FailureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<FailureSeverity | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const fetchFailures = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (severityFilter !== 'all') params.set('severity', severityFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      const qs = params.toString();
      const url = `/api/failures${qs ? `?${qs}` : ''}`;

      const res = await fetch(url);
      if (res.ok) {
        const json: ApiResponse<FailureRecord[]> = await res.json();
        if (json.success && json.data) {
          setFailures(json.data);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [severityFilter, categoryFilter, typeFilter]);

  // Initial fetch + re-fetch on filter change
  useEffect(() => {
    setLoading(true);
    fetchFailures();
  }, [fetchFailures]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshing(true);
      fetchFailures();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchFailures]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFailures();
  };

  // Derived data
  const categories = useMemo(() => {
    const cats = new Set(failures.map((f) => f.category));
    return Array.from(cats).sort();
  }, [failures]);

  const types = useMemo(() => {
    const t = new Set(failures.map((f) => f.type));
    return Array.from(t).sort();
  }, [failures]);

  const aggregations = useMemo(() => {
    const map = new Map<string, FailureAggregation>();
    for (const f of failures) {
      const existing = map.get(f.type);
      if (existing) {
        existing.count += 1;
        if (['critical', 'high'].includes(f.severity) && !['critical', 'high'].includes(existing.severity)) {
          existing.severity = f.severity;
        }
      } else {
        map.set(f.type, {
          type: f.type,
          count: 1,
          severity: f.severity,
          category: f.category,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [failures]);

  const recurringFailures = useMemo(() => {
    return failures.filter((f) => f.occurrenceCount > 1).sort((a, b) => b.occurrenceCount - a.occurrenceCount);
  }, [failures]);

  const hasFilters = severityFilter !== 'all' || categoryFilter !== 'all' || typeFilter !== 'all';

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
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-950/50 ring-1 ring-red-800/30">
            <AlertOctagon className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Failure Analysis</h1>
            <p className="text-xs text-zinc-500">
              Classify failures, detect patterns, and track recovery
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs text-zinc-500 hover:text-zinc-300"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </motion.div>

      {/* Stats Summary */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-zinc-900/50 border-zinc-800/60 p-3">
          <p className="text-lg font-bold text-zinc-100 tabular-nums">{failures.length}</p>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500 font-medium">Total Failures</p>
        </div>
        <div className="rounded-lg border bg-zinc-900/50 border-zinc-800/60 p-3">
          <p className="text-lg font-bold text-red-400 tabular-nums">
            {failures.filter((f) => f.severity === 'critical').length}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500 font-medium">Critical</p>
        </div>
        <div className="rounded-lg border bg-zinc-900/50 border-zinc-800/60 p-3">
          <p className="text-lg font-bold text-slate-400 tabular-nums">{recurringFailures.length}</p>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500 font-medium">Recurring</p>
        </div>
        <div className="rounded-lg border bg-zinc-900/50 border-zinc-800/60 p-3">
          <p className="text-lg font-bold text-blue-400 tabular-nums">
            {failures.filter((f) => f.recoveryStatus === 'success').length}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500 font-medium">Recovered</p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants}>
        <Card className="border-zinc-800/60 bg-zinc-950/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs font-medium text-zinc-400">Filters</span>
              {hasFilters && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] px-2 text-zinc-500 hover:text-zinc-300 ml-auto"
                  onClick={() => {
                    setSeverityFilter('all');
                    setCategoryFilter('all');
                    setTypeFilter('all');
                  }}
                >
                  Clear All
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Severity filter */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-zinc-600 mr-1">Severity:</span>
                {(['all', 'low', 'medium', 'high', 'critical'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSeverityFilter(s)}
                    className={cn(
                      'px-2 py-1 rounded text-[10px] font-medium transition-all border',
                      severityFilter === s
                        ? 'bg-zinc-700 text-zinc-100 border-zinc-600'
                        : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'
                    )}
                  >
                    {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>

              {/* Category filter */}
              {categories.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-zinc-600 mr-1">Category:</span>
                  <button
                    onClick={() => setCategoryFilter('all')}
                    className={cn(
                      'px-2 py-1 rounded text-[10px] font-medium transition-all border',
                      categoryFilter === 'all'
                        ? 'bg-zinc-700 text-zinc-100 border-zinc-600'
                        : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'
                    )}
                  >
                    All
                  </button>
                  {categories.slice(0, 5).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={cn(
                        'px-2 py-1 rounded text-[10px] font-medium transition-all border',
                        categoryFilter === cat
                          ? 'bg-zinc-700 text-zinc-100 border-zinc-600'
                          : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {/* Type filter */}
              {types.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-zinc-600 mr-1">Type:</span>
                  <button
                    onClick={() => setTypeFilter('all')}
                    className={cn(
                      'px-2 py-1 rounded text-[10px] font-medium transition-all border',
                      typeFilter === 'all'
                        ? 'bg-zinc-700 text-zinc-100 border-zinc-600'
                        : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'
                    )}
                  >
                    All
                  </button>
                  {types.slice(0, 4).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={cn(
                        'px-2 py-1 rounded text-[10px] font-medium transition-all border',
                        typeFilter === t
                          ? 'bg-zinc-700 text-zinc-100 border-zinc-600'
                          : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Aggregation chart */}
        <motion.div variants={itemVariants} className="lg:col-span-5">
          <Card className="border-zinc-800/60 bg-zinc-950/50 h-full">
            <CardHeader className="pb-2 px-4 pt-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-zinc-500" />
                <CardTitle className="text-sm font-semibold text-zinc-200">
                  Failure Distribution
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loading ? (
                <div className="space-y-3 py-2">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-6 w-full rounded" />
                  ))}
                </div>
              ) : aggregations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <BarChart3 className="w-6 h-6 text-zinc-700 mb-2" />
                  <p className="text-xs text-zinc-500">No data to display</p>
                </div>
              ) : (
                <ScrollArea className="max-h-96">
                  <FailureBarChart aggregations={aggregations} />
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Right: Failure details */}
        <motion.div variants={itemVariants} className="lg:col-span-7 space-y-6">
          {/* Recurring Failures Section */}
          {recurringFailures.length > 0 && (
            <Card className="border-red-800/30 bg-red-950/10">
              <CardHeader className="pb-2 px-4 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-red-400" />
                    <CardTitle className="text-sm font-semibold text-red-300">
                      Recurring Failures
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-red-400 border-red-800/40">
                    {recurringFailures.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ScrollArea className="max-h-96">
                  <AnimatePresence mode="popLayout">
                    <div className="space-y-2 pr-2">
                      {recurringFailures.slice(0, 5).map((record) => (
                        <FailureDetailRow key={record.id} record={record} showCategory={false} />
                      ))}
                    </div>
                  </AnimatePresence>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* All Failures */}
          <Card className="border-zinc-800/60 bg-zinc-950/50">
            <CardHeader className="pb-2 px-4 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-zinc-200">
                  All Failures
                </CardTitle>
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-zinc-800 text-zinc-400 border-zinc-700">
                  {failures.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loading ? (
                <div className="space-y-2 py-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-lg" />
                  ))}
                </div>
              ) : failures.length === 0 ? (
                <EmptyState />
              ) : (
                <ScrollArea className="max-h-96">
                  <AnimatePresence mode="popLayout">
                    <div className="space-y-2 pr-2">
                      {failures.map((record) => (
                        <FailureDetailRow key={record.id} record={record} showCategory={true} />
                      ))}
                    </div>
                  </AnimatePresence>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
