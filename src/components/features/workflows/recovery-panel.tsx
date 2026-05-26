'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  RotateCcw,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Inbox,
  AlertTriangle,
  Bookmark,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { ApiResponse } from '@/lib/types';
import {
  WORKFLOW_STATE_COLORS,
  WORKFLOW_STATE_LABELS,
} from '@/lib/types';

// ─── Types ──────────────────────────────────────────────────

type WorkflowState = 'draft' | 'validated' | 'active' | 'blocked' | 'recovering' | 'completed' | 'archived';

interface RecoveryCheckpoint {
  id: string;
  name: string;
  state: string;
  data: string | null;
  createdAt: string;
}

interface RecoveryAuditLog {
  id: string;
  action: string;
  status: 'success' | 'pending' | 'failed';
  message: string;
  createdAt: string;
}

interface RecoverableWorkflow {
  id: string;
  name: string;
  state: WorkflowState;
  description: string | null;
  blockedReason: string | null;
  recoveryAttempts: number;
  lastRecoveryAt: string | null;
  checkpoints: RecoveryCheckpoint[];
  auditLogs: RecoveryAuditLog[];
  createdAt: string;
  updatedAt: string;
}

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

// ─── Checkpoint Row ─────────────────────────────────────────

interface CheckpointRowProps {
  checkpoint: RecoveryCheckpoint;
  onRecover: (workflowId: string, checkpointId: string) => void;
  workflowId: string;
  recovering: boolean;
}

function CheckpointRow({ checkpoint, onRecover, workflowId, recovering }: CheckpointRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-zinc-800/40 border border-zinc-700/30 hover:border-zinc-600/50 transition-colors">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <Bookmark className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-200 truncate">{checkpoint.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-zinc-800 text-zinc-400 border-zinc-700">
              {checkpoint.state}
            </Badge>
            <span className="text-[10px] text-zinc-600">{timeAgo(checkpoint.createdAt)}</span>
          </div>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-[11px] px-2.5 border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/20 hover:text-emerald-300 shrink-0"
        onClick={() => onRecover(workflowId, checkpoint.id)}
        disabled={recovering}
      >
        {recovering ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <RotateCcw className="w-3 h-3 mr-1" />
        )}
        Recover
      </Button>
    </div>
  );
}

// ─── Audit Log Row ──────────────────────────────────────────

interface AuditLogRowProps {
  log: RecoveryAuditLog;
}

function AuditLogRow({ log }: AuditLogRowProps) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <div className="mt-0.5">
        {log.status === 'success' ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        ) : log.status === 'failed' ? (
          <XCircle className="w-3.5 h-3.5 text-red-500" />
        ) : (
          <Loader2 className="w-3.5 h-3.5 text-amber-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-300">{log.action}</p>
        <p className="text-[11px] text-zinc-500 line-clamp-2">{log.message}</p>
      </div>
      <span className="text-[10px] text-zinc-600 shrink-0">{timeAgo(log.createdAt)}</span>
    </div>
  );
}

// ─── Workflow Recovery Card ─────────────────────────────────

interface WorkflowRecoveryCardProps {
  workflow: RecoverableWorkflow;
  onRecoverFromCheckpoint: (workflowId: string, checkpointId: string) => void;
  recoveringCheckpointId: string | null;
}

function WorkflowRecoveryCard({
  workflow,
  onRecoverFromCheckpoint,
  recoveringCheckpointId,
}: WorkflowRecoveryCardProps) {
  const [expanded, setExpanded] = useState(true);

  const statusColor = WORKFLOW_STATE_COLORS[workflow.state] ?? '';

  return (
    <motion.div variants={itemVariants} layout>
      <Card className={cn(
        'border transition-all duration-200',
        workflow.state === 'blocked'
          ? 'border-red-800/30 bg-red-950/10'
          : 'border-amber-800/30 bg-amber-950/10'
      )}>
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CardHeader className="pb-2 px-4 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                {workflow.state === 'blocked' ? (
                  <AlertTriangle className="w-4 h-4 mt-0.5 text-red-400 shrink-0" />
                ) : (
                  <Loader2 className="w-4 h-4 mt-0.5 text-amber-400 shrink-0 animate-spin" />
                )}
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-zinc-200 truncate">{workflow.name}</h3>
                  {workflow.blockedReason && (
                    <p className="text-xs text-red-400/80 mt-0.5 line-clamp-1">{workflow.blockedReason}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge variant="secondary" className={cn('text-[10px] h-5 px-1.5', statusColor)}>
                      {WORKFLOW_STATE_LABELS[workflow.state]}
                    </Badge>
                    {workflow.recoveryAttempts > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                        <RotateCcw className="w-3 h-3" />
                        <span className="tabular-nums">{workflow.recoveryAttempts} attempts</span>
                      </span>
                    )}
                    {workflow.lastRecoveryAt && (
                      <span className="text-[10px] text-zinc-600">
                        Last recovery {timeAgo(workflow.lastRecoveryAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
                  <ChevronDown className={cn(
                    'w-4 h-4 text-zinc-500 transition-transform duration-200',
                    expanded && 'rotate-180'
                  )} />
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="px-4 pb-4 space-y-4">
              {/* Checkpoints */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Bookmark className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-xs font-medium text-zinc-400">
                    Available Checkpoints
                  </span>
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-zinc-800 text-zinc-400 border-zinc-700 ml-auto">
                    {workflow.checkpoints.length}
                  </Badge>
                </div>
                {workflow.checkpoints.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Bookmark className="w-5 h-5 text-zinc-700 mb-1.5" />
                    <p className="text-xs text-zinc-500">No checkpoints available</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {workflow.checkpoints.map((cp) => (
                      <CheckpointRow
                        key={cp.id}
                        checkpoint={cp}
                        workflowId={workflow.id}
                        recovering={recoveringCheckpointId === cp.id}
                        onRecover={onRecoverFromCheckpoint}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Audit Logs */}
              {workflow.auditLogs.length > 0 && (
                <div className="border-t border-zinc-800/40 pt-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <FileText className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-xs font-medium text-zinc-400">
                      Recovery Audit Logs
                    </span>
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-zinc-800 text-zinc-400 border-zinc-700 ml-auto">
                      {workflow.auditLogs.length}
                    </Badge>
                  </div>
                  <ScrollArea className="max-h-48">
                    <div className="space-y-1 pr-1">
                      {workflow.auditLogs.map((log) => (
                        <AuditLogRow key={log.id} log={log} />
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </motion.div>
  );
}

// ─── Empty State ────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800/60 mb-4">
        <ShieldCheck className="w-8 h-8 text-emerald-600/40" />
      </div>
      <h3 className="text-base font-semibold text-zinc-300 mb-1">All Workflows Healthy</h3>
      <p className="text-sm text-zinc-500 text-center max-w-sm">
        No workflows are currently blocked or recovering. This panel will show workflows that need attention.
      </p>
    </div>
  );
}

// ─── Main Recovery Panel ────────────────────────────────────

export function RecoveryPanel() {
  const [workflows, setWorkflows] = useState<RecoverableWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [recoveringCheckpointId, setRecoveringCheckpointId] = useState<string | null>(null);

  const fetchRecoveryData = useCallback(async () => {
    try {
      const res = await fetch('/api/workflows/recovery');
      if (res.ok) {
        const json: ApiResponse<RecoverableWorkflow[]> = await res.json();
        if (json.success && json.data) {
          setWorkflows(json.data);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecoveryData();
  }, [fetchRecoveryData]);

  const handleRecoverFromCheckpoint = async (workflowId: string, checkpointId: string) => {
    setRecoveringCheckpointId(checkpointId);
    try {
      const res = await fetch('/api/workflows/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId, checkpointId }),
      });
      const json = await res.json();
      if (json.success) {
        fetchRecoveryData();
      }
    } catch {
      // Silently fail
    } finally {
      setRecoveringCheckpointId(null);
    }
  };

  // Counts
  const blockedCount = workflows.filter((w) => w.state === 'blocked').length;
  const recoveringCount = workflows.filter((w) => w.state === 'recovering').length;

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
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-950/50 ring-1 ring-amber-800/30">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Workflow Recovery</h1>
            <p className="text-xs text-zinc-500">
              Monitor and recover blocked or failing workflows
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {blockedCount > 0 && (
            <Badge variant="outline" className="text-[10px] h-6 px-2 text-red-400 border-red-800/40">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {blockedCount} Blocked
            </Badge>
          )}
          {recoveringCount > 0 && (
            <Badge variant="outline" className="text-[10px] h-6 px-2 text-amber-400 border-amber-800/40">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              {recoveringCount} Recovering
            </Badge>
          )}
        </div>
      </motion.div>

      {/* Workflow List */}
      <motion.div variants={itemVariants}>
        {loading ? (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <EmptyState />
        ) : (
          <ScrollArea className="max-h-[calc(100vh-14rem)]">
            <AnimatePresence mode="popLayout">
              <div className="space-y-4 pr-3">
                {workflows.map((wf) => (
                  <WorkflowRecoveryCard
                    key={wf.id}
                    workflow={wf}
                    onRecoverFromCheckpoint={handleRecoverFromCheckpoint}
                    recoveringCheckpointId={recoveringCheckpointId}
                  />
                ))}
              </div>
            </AnimatePresence>
          </ScrollArea>
        )}
      </motion.div>
    </motion.div>
  );
}
