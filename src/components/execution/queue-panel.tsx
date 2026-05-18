'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ListOrdered,
  Play,
  RotateCcw,
  XCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Inbox,
  RefreshCw,
  Flame,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ApiResponse } from '@/lib/types';

// ─── Types ──────────────────────────────────────────────────

type QueueItemStatus = 'pending' | 'running' | 'completed' | 'failed' | 'retrying' | 'cancelled';

interface QueueItem {
  id: string;
  name: string;
  status: QueueItemStatus;
  priority: number;
  retryCount: number;
  maxRetries: number;
  failureType: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface QueueStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  retrying: number;
  total: number;
}

// ─── Constants ──────────────────────────────────────────────

const STATUS_COLORS: Record<QueueItemStatus, string> = {
  pending: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  running: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  retrying: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const STATUS_LABELS: Record<QueueItemStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  retrying: 'Retrying',
  cancelled: 'Cancelled',
};

const STATUS_ICONS: Record<QueueItemStatus, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
  retrying: RotateCcw,
  cancelled: XCircle,
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

function priorityColor(priority: number): string {
  if (priority >= 8) return 'text-red-500';
  if (priority >= 5) return 'text-amber-500';
  return 'text-slate-400';
}

// ─── Stat Card ──────────────────────────────────────────────

interface StatCardProps {
  label: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
}

function StatCard({ label, count, icon: Icon, colorClass }: StatCardProps) {
  return (
    <div className="rounded-lg border bg-zinc-900/50 border-zinc-800/60 p-3 flex items-center gap-3">
      <div className={cn('flex items-center justify-center w-9 h-9 rounded-lg bg-zinc-800/80', colorClass)}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-lg font-bold text-zinc-100 tabular-nums">{count}</p>
        <p className="text-[10px] uppercase tracking-wide text-zinc-500 font-medium">{label}</p>
      </div>
    </div>
  );
}

// ─── Queue Item Row ─────────────────────────────────────────

interface QueueItemRowProps {
  item: QueueItem;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  retryingId: string | null;
  cancellingId: string | null;
}

function QueueItemRow({ item, onRetry, onCancel, retryingId, cancellingId }: QueueItemRowProps) {
  const StatusIcon = STATUS_ICONS[item.status];
  const isRunning = item.status === 'running';

  return (
    <motion.div
      variants={itemVariants}
      layout
      className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-3 transition-all duration-150 hover:border-zinc-700/80"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <StatusIcon
            className={cn(
              'w-4 h-4 mt-0.5 shrink-0',
              isRunning && 'animate-spin',
              item.status === 'failed' ? 'text-red-500' : item.status === 'completed' ? 'text-emerald-500' : item.status === 'running' ? 'text-sky-500' : 'text-zinc-500'
            )}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">{item.name}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge variant="secondary" className={cn('text-[10px] h-5 px-1.5', STATUS_COLORS[item.status])}>
                {STATUS_LABELS[item.status]}
              </Badge>
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Flame className={cn('w-3 h-3', priorityColor(item.priority))} />
                <span className="tabular-nums">P{item.priority}</span>
              </span>
              {item.retryCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-amber-500">
                  <RotateCcw className="w-3 h-3" />
                  <span className="tabular-nums">{item.retryCount}/{item.maxRetries}</span>
                </span>
              )}
              {item.failureType && (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-red-400 border-red-800/40">
                  {item.failureType}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {(item.status === 'failed' || item.status === 'retrying') && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] px-2 border-amber-800/40 text-amber-400 hover:bg-amber-900/20 hover:text-amber-300"
              onClick={(e) => { e.stopPropagation(); onRetry(item.id); }}
              disabled={retryingId === item.id}
            >
              {retryingId === item.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RotateCcw className="w-3 h-3 mr-1" />
              )}
              Retry
            </Button>
          )}
          {item.status === 'pending' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] px-2 text-zinc-500 hover:text-red-400 hover:bg-red-900/20"
              onClick={(e) => { e.stopPropagation(); onCancel(item.id); }}
              disabled={cancellingId === item.id}
            >
              {cancellingId === item.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <XCircle className="w-3 h-3 mr-1" />
              )}
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Timestamp */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-800/40">
        <span className="text-[10px] text-zinc-600">Queued {timeAgo(item.createdAt)}</span>
        {item.startedAt && (
          <span className="text-[10px] text-zinc-600">Started {timeAgo(item.startedAt)}</span>
        )}
        {item.completedAt && (
          <span className="text-[10px] text-zinc-600 ml-auto">Finished {timeAgo(item.completedAt)}</span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Empty State ────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800/60 mb-4">
        <Inbox className="w-8 h-8 text-zinc-600" />
      </div>
      <h3 className="text-base font-semibold text-zinc-300 mb-1">Queue is Empty</h3>
      <p className="text-sm text-zinc-500 text-center max-w-sm">
        No items in the execution queue. Items will appear here when workflows generate tasks.
      </p>
    </div>
  );
}

// ─── Main Queue Panel ───────────────────────────────────────

export function QueuePanel() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats>({ pending: 0, running: 0, completed: 0, failed: 0, retrying: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/queue');
      if (res.ok) {
        const json: ApiResponse<{ items: QueueItem[]; stats: QueueStats }> = await res.json();
        if (json.success && json.data) {
          setItems(json.data.items);
          setStats(json.data.stats);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + auto-refresh every 5 seconds
  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const handleProcessNext = async () => {
    setProcessing(true);
    try {
      const res = await fetch('/api/queue/process', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        fetchQueue();
      }
    } catch {
      // Silently fail
    } finally {
      setProcessing(false);
    }
  };

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      const res = await fetch('/api/queue/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (json.success) {
        fetchQueue();
      }
    } catch {
      // Silently fail
    } finally {
      setRetryingId(null);
    }
  };

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      const res = await fetch('/api/queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (json.success) {
        fetchQueue();
      }
    } catch {
      // Silently fail
    } finally {
      setCancellingId(null);
    }
  };

  // Separate active and completed items
  const activeItems = items.filter((i) => !['completed', 'cancelled'].includes(i.status));
  const completedItems = items.filter((i) => ['completed', 'cancelled'].includes(i.status));

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
            <ListOrdered className="w-5 h-5 text-zinc-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Execution Queue</h1>
            <p className="text-xs text-zinc-500">
              Monitor and manage the task execution queue
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-zinc-500 hover:text-zinc-300"
            onClick={fetchQueue}
            disabled={loading}
          >
            <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleProcessNext}
            disabled={processing || stats.pending === 0}
          >
            {processing ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 mr-1.5" />
            )}
            Process Next
          </Button>
        </div>
      </motion.div>

      {/* Statistics */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Pending" count={stats.pending} icon={Clock} colorClass="text-slate-400" />
        <StatCard label="Running" count={stats.running} icon={Zap} colorClass="text-sky-400" />
        <StatCard label="Completed" count={stats.completed} icon={CheckCircle2} colorClass="text-emerald-400" />
        <StatCard label="Failed" count={stats.failed} icon={XCircle} colorClass="text-red-400" />
        <StatCard label="Retrying" count={stats.retrying} icon={RotateCcw} colorClass="text-amber-400" />
        <StatCard label="Total" count={stats.total} icon={ListOrdered} colorClass="text-zinc-400" />
      </motion.div>

      {/* Active Queue */}
      <motion.div variants={itemVariants}>
        <Card className="border-zinc-800/60 bg-zinc-950/50">
          <CardHeader className="pb-2 px-4 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-zinc-200">
                Active Queue
              </CardTitle>
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-zinc-800 text-zinc-400 border-zinc-700">
                {activeItems.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loading ? (
              <div className="space-y-2 py-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState />
            ) : (
              <ScrollArea className="max-h-96">
                <AnimatePresence mode="popLayout">
                  <div className="space-y-2 pr-2">
                    {activeItems.length === 0 && completedItems.length > 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500/50 mb-2" />
                        <p className="text-xs text-zinc-500">All tasks processed</p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">
                          No active items in the queue
                        </p>
                      </div>
                    ) : (
                      activeItems.map((item) => (
                        <QueueItemRow
                          key={item.id}
                          item={item}
                          onRetry={handleRetry}
                          onCancel={handleCancel}
                          retryingId={retryingId}
                          cancellingId={cancellingId}
                        />
                      ))
                    )}
                  </div>
                </AnimatePresence>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Completed / Cancelled */}
      {completedItems.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-zinc-800/60 bg-zinc-950/50">
            <CardHeader className="pb-2 px-4 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-zinc-200">
                  Completed
                </CardTitle>
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-zinc-800 text-zinc-400 border-zinc-700">
                  {completedItems.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ScrollArea className="max-h-96">
                <div className="space-y-2 pr-2">
                  {completedItems.map((item) => (
                    <QueueItemRow
                      key={item.id}
                      item={item}
                      onRetry={handleRetry}
                      onCancel={handleCancel}
                      retryingId={retryingId}
                      cancellingId={cancellingId}
                    />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
