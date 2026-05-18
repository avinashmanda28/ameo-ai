'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Check,
  X,
  ChevronUp,
  ChevronDown,
  Clock,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useExecutionStore } from '@/lib/store/execution-store';
import type { ApprovalRequest } from '@/lib/store/execution-store';
import type { ApiResponse } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────

const POLL_INTERVAL = 5000; // 5 seconds

// ─── Single Approval Item ────────────────────────────────────

function ApprovalItem({
  approval,
  onApprove,
  onReject,
  resolving,
}: {
  approval: ApprovalRequest;
  onApprove: () => void;
  onReject: () => void;
  resolving: boolean;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200/60 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-900/10">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 shrink-0 mt-0.5">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-foreground">
            {approval.providerName ?? 'Unknown Provider'}
          </span>
          {approval.providerType && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
              {approval.providerType}
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
            {new Date(approval.createdAt).toLocaleTimeString()}
          </span>
        </div>
        {approval.promptPreview && (
          <p className="text-[11px] text-muted-foreground mb-2 line-clamp-2">
            {approval.promptPreview}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-7 text-[11px] px-3 bg-emerald-600 hover:bg-emerald-700"
            onClick={onApprove}
            disabled={resolving}
          >
            {resolving ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Check className="w-3 h-3 mr-1" />
            )}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] px-3 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800/40 dark:hover:bg-red-900/10"
            onClick={onReject}
            disabled={resolving}
          >
            {resolving ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <X className="w-3 h-3 mr-1" />
            )}
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Approval Banner ──────────────────────────────────────────

export function ApprovalBanner() {
  const { pendingApprovals, setPendingApprovals, removeApproval } = useExecutionStore();
  const [expanded, setExpanded] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [pendingRejectId, setPendingRejectId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll pending approvals
  useEffect(() => {
    async function fetchApprovals() {
      try {
        const res = await fetch('/api/approvals?status=pending');
        if (res.ok) {
          const json: ApiResponse<ApprovalRequest[]> = await res.json();
          if (json.success && json.data) {
            setPendingApprovals(json.data);
          }
        }
      } catch (err) {
        console.warn('[Ameo AI] Failed to fetch approvals:', err);
      }
    }

    // Initial fetch
    fetchApprovals();

    // Set up polling
    intervalRef.current = setInterval(fetchApprovals, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [setPendingApprovals]);

  const handleApprove = useCallback(async (id: string) => {
    setResolvingId(id);
    try {
      const res = await fetch(`/api/approvals/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      if (res.ok) {
        removeApproval(id);
      }
    } catch (err) {
      console.warn('[Ameo AI] Failed to approve:', err);
    } finally {
      setResolvingId(null);
    }
  }, [removeApproval]);

  const handleReject = useCallback(async (id: string) => {
    setResolvingId(id);
    try {
      const res = await fetch(`/api/approvals/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      });
      if (res.ok) {
        removeApproval(id);
      }
    } catch (err) {
      console.warn('[Ameo AI] Failed to reject:', err);
    } finally {
      setResolvingId(null);
      setRejectDialogOpen(false);
      setPendingRejectId(null);
    }
  }, [removeApproval]);

  const openRejectDialog = useCallback((id: string) => {
    setPendingRejectId(id);
    setRejectDialogOpen(true);
  }, []);

  // Don't render if no pending approvals
  if (pendingApprovals.length === 0) {
    return null;
  }

  return (
    <>
      {/* Floating banner */}
      <AnimatePresence>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4"
        >
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-background/95 backdrop-blur-md shadow-lg shadow-amber-500/5 overflow-hidden">
            {/* Collapsed state */}
            {!expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 shrink-0">
                  <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {pendingApprovals.length} Pending Approval{pendingApprovals.length > 1 ? 's' : ''}
                    </span>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {pendingApprovals[0]?.providerName ?? 'Provider'} requires approval
                    {pendingApprovals.length > 1 && ` +${pendingApprovals.length - 1} more`}
                  </p>
                </div>
                <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            )}

            {/* Expanded state */}
            {expanded && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200/60 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-900/10">
                  <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-semibold text-foreground">
                    Pending Approvals ({pendingApprovals.length})
                  </span>
                  <button
                    onClick={() => setExpanded(false)}
                    className="ml-auto p-1 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors"
                  >
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                <ScrollArea className="max-h-[300px]">
                  <div className="p-3 space-y-2">
                    {pendingApprovals.map((approval) => (
                      <ApprovalItem
                        key={approval.id}
                        approval={approval}
                        onApprove={() => handleApprove(approval.id)}
                        onReject={() => openRejectDialog(approval.id)}
                        resolving={resolvingId === approval.id}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Reject confirmation dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Approval Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this approval request? This will prevent the
              associated execution from proceeding. You can optionally provide a reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRejectId) {
                  handleReject(pendingRejectId);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
