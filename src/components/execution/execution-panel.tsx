'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  Plus,
  Send,
  Loader2,
  ChevronDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Shield,
  RotateCcw,
  Eye,
} from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/workspace-store';
import { useExecutionStore } from '@/lib/store/execution-store';
import { EXECUTION_RUN_STATUS_COLORS as STATUS_COLORS } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { RuntimeExecution } from '@/lib/store/execution-store';
import type { ApiResponse } from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────

function statusColor(status: string): string {
  return (STATUS_COLORS as Record<string, string>)[status] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    awaiting_approval: 'Awaiting Approval',
    approved: 'Approved',
    rejected: 'Rejected',
    executing: 'Executing',
    completed: 'Completed',
    failed: 'Failed',
    timed_out: 'Timed Out',
  };
  return labels[status] ?? status;
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

function formatLatency(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ─── Execution History Item ───────────────────────────────────

function ExecutionHistoryItem({
  execution,
  isSelected,
  onClick,
}: {
  execution: RuntimeExecution;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg border p-3 transition-all duration-150',
        'hover:border-border/80 hover:bg-accent/40',
        isSelected
          ? 'border-primary/30 bg-accent/60 ring-1 ring-primary/20'
          : 'border-border/50 bg-card'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-xs font-medium text-foreground leading-relaxed line-clamp-2">
          {truncateText(execution.prompt, 120)}
        </p>
        <Badge
          variant="secondary"
          className={cn('text-[10px] shrink-0 h-5 px-1.5 font-medium', statusColor(execution.status))}
        >
          {statusLabel(execution.status)}
        </Badge>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        {execution.provider?.name && (
          <span className="truncate max-w-24">{execution.provider.name}</span>
        )}
        {execution.latencyMs !== null && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatLatency(execution.latencyMs)}
          </span>
        )}
        <span className="ml-auto">{timeAgo(execution.createdAt)}</span>
      </div>
    </motion.button>
  );
}

// ─── Response Viewer ──────────────────────────────────────────

function ResponseViewer({
  execution,
  onVerify,
  onApproveClick,
  verifying,
}: {
  execution: RuntimeExecution;
  onVerify: () => void;
  onApproveClick: () => void;
  verifying: boolean;
}) {
  const hasArtifact = !!execution.artifactId;
  const needsVerification =
    execution.status === 'completed' && !execution.verificationResult;

  return (
    <motion.div
      key={execution.id}
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-4 h-full"
    >
      {/* Metadata bar */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className="text-[10px] font-medium h-5 px-2">
          {execution.provider?.name ?? 'Unknown Provider'}
        </Badge>
        {execution.modelId && (
          <span className="text-muted-foreground font-mono text-[10px]">
            {execution.modelId}
          </span>
        )}
        {execution.latencyMs !== null && (
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatLatency(execution.latencyMs)}
          </span>
        )}
        {execution.tokenUsage && (
          <span className="text-muted-foreground font-mono text-[10px]">
            {execution.tokenUsage} tokens
          </span>
        )}
      </div>

      {/* Status-specific indicators */}
      {execution.status === 'awaiting_approval' && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 p-3">
          <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
              Awaiting Approval
            </p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              This execution requires approval before proceeding. Check the approval banner.
            </p>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={onApproveClick}>
            View Approval
          </Button>
        </div>
      )}

      {execution.hallucinationDetected && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10 p-3">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-red-800 dark:text-red-300">
              Hallucination Detected
            </p>
            <p className="text-[11px] text-red-600 dark:text-red-400">
              Verification detected potential hallucinations in the response.
            </p>
          </div>
        </div>
      )}

      {/* Response content */}
      <div className="flex-1 rounded-lg border bg-zinc-950 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          </div>
          <span className="text-[10px] text-zinc-500 font-mono ml-1">Response</span>
        </div>
        <ScrollArea className="h-[400px]">
          <pre className="p-4 text-sm font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">
            {execution.response ?? execution.errorMessage ?? 'No response available.'}
          </pre>
        </ScrollArea>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2">
        {needsVerification && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={onVerify}
            disabled={verifying}
          >
            {verifying ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            )}
            Run Verification
          </Button>
        )}
        {hasArtifact && (
          <Badge variant="secondary" className="text-[10px] h-6 px-2">
            📄 Artifact Generated
          </Badge>
        )}
        {execution.verificationResult && (
          <Badge
            variant="secondary"
            className={cn(
              'text-[10px] h-6 px-2',
              execution.verificationResult === 'pass'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            )}
          >
            Verification: {execution.verificationResult}
          </Badge>
        )}
        {execution.qualityScore !== null && (
          <Badge variant="outline" className="text-[10px] h-6 px-2 ml-auto">
            Quality: {execution.qualityScore}/100
          </Badge>
        )}
      </div>
    </motion.div>
  );
}

// ─── Empty State ──────────────────────────────────────────────

function EmptyViewer() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-muted/60 mb-4">
        <Eye className="w-7 h-7 text-muted-foreground/60" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">No Execution Selected</h3>
      <p className="text-xs text-muted-foreground max-w-xs">
        Run a new execution or select one from the history to view its details.
      </p>
    </div>
  );
}

// ─── Main Execution Panel ─────────────────────────────────────

export function ExecutionPanel() {
  const {
    executions,
    executionsLoading,
    setExecutions,
    addExecution,
    updateExecution,
    executionForm,
    setExecutionForm,
    resetExecutionForm,
    isExecuting,
    setIsExecuting,
    currentExecutionId,
    setCurrentExecutionId,
  } = useExecutionStore();

  const runtimes = useWorkspaceStore((s) => s.runtimes);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const selectedExecution = executions.find((e) => e.id === selectedExecutionId) ?? null;

  // Fetch executions on mount
  useEffect(() => {
    async function fetchExecutions() {
      try {
        const res = await fetch('/api/execution');
        if (res.ok) {
          const json: ApiResponse<RuntimeExecution[]> = await res.json();
          if (json.success && json.data) {
            setExecutions(json.data);
          }
        }
      } catch (err) {
        console.warn('[Nexus OS] Failed to fetch executions:', err);
      }
    }
    fetchExecutions();
  }, [setExecutions]);

  // Handle execute
  const handleExecute = useCallback(async () => {
    if (!executionForm.prompt.trim()) return;

    setIsExecuting(true);
    try {
      const res = await fetch('/api/execution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: executionForm.prompt,
          systemPrompt: executionForm.systemPrompt || null,
          requestType: executionForm.requestType,
          providerId: executionForm.selectedProviderId || null,
          temperature: executionForm.temperature,
          maxTokens: executionForm.maxTokens,
        }),
      });

      if (res.ok) {
        const json: ApiResponse<RuntimeExecution> = await res.json();
        if (json.success && json.data) {
          addExecution(json.data);
          setSelectedExecutionId(json.data.id);
          setCurrentExecutionId(json.data.id);
          resetExecutionForm();
          setAdvancedOpen(false);
        }
      }
    } catch (err) {
      console.warn('[Nexus OS] Execution failed:', err);
    } finally {
      setIsExecuting(false);
    }
  }, [executionForm, setIsExecuting, addExecution, resetExecutionForm, setCurrentExecutionId]);

  // Handle verify
  const handleVerify = useCallback(async () => {
    if (!selectedExecutionId) return;
    setVerifying(true);
    try {
      const res = await fetch(`/api/execution/${selectedExecutionId}/verify`, {
        method: 'POST',
      });
      if (res.ok) {
        const json: ApiResponse<RuntimeExecution> = await res.json();
        if (json.success && json.data) {
          updateExecution(selectedExecutionId, json.data);
        }
      }
    } catch (err) {
      console.warn('[Nexus OS] Verification failed:', err);
    } finally {
      setVerifying(false);
    }
  }, [selectedExecutionId, updateExecution]);

  const handleApproveClick = useCallback(() => {
    useWorkspaceStore.getState().setActivePanel('execution');
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <Zap className="w-5 h-5 text-amber-700 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Runtime Execution</h1>
            <p className="text-xs text-muted-foreground">
              Execute prompts against configured runtime providers
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={() => {
            resetExecutionForm();
            setSelectedExecutionId(null);
            setAdvancedOpen(false);
          }}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          New Execution
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Form + History */}
        <div className="lg:col-span-5 space-y-4">
          {/* Execution Form */}
          <Card className="border-border/50">
            <CardHeader className="pb-3 px-4 pt-4">
              <CardTitle className="text-sm font-semibold">Execute Prompt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              {/* Prompt */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Prompt</Label>
                <Textarea
                  placeholder="Enter your prompt..."
                  value={executionForm.prompt}
                  onChange={(e) => setExecutionForm({ prompt: e.target.value })}
                  className="min-h-[80px] text-sm font-mono resize-none"
                  rows={3}
                  disabled={isExecuting}
                />
              </div>

              {/* Advanced Options (collapsible) */}
              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronDown
                      className={cn(
                        'w-3 h-3 transition-transform duration-200',
                        advancedOpen && 'rotate-180'
                      )}
                    />
                    Advanced Options
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-2">
                  {/* System Prompt */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">System Prompt</Label>
                    <Textarea
                      placeholder="Optional system instructions..."
                      value={executionForm.systemPrompt}
                      onChange={(e) => setExecutionForm({ systemPrompt: e.target.value })}
                      className="min-h-[60px] text-sm font-mono resize-none"
                      rows={2}
                      disabled={isExecuting}
                    />
                  </div>

                  {/* Provider selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Provider</Label>
                    <Select
                      value={executionForm.selectedProviderId}
                      onValueChange={(v) => setExecutionForm({ selectedProviderId: v })}
                      disabled={isExecuting}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Auto-select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto-select</SelectItem>
                        {runtimes.map((rt) => (
                          <SelectItem key={rt.id} value={rt.id}>
                            {rt.name} ({rt.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Request Type */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Request Type</Label>
                    <Select
                      value={executionForm.requestType}
                      onValueChange={(v) => setExecutionForm({ requestType: v })}
                      disabled={isExecuting}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="chat">Chat</SelectItem>
                        <SelectItem value="completion">Completion</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Temperature */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Temperature</Label>
                      <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                        {executionForm.temperature.toFixed(1)}
                      </span>
                    </div>
                    <Slider
                      value={[executionForm.temperature]}
                      onValueChange={([v]) => setExecutionForm({ temperature: v })}
                      min={0}
                      max={2}
                      step={0.1}
                      disabled={isExecuting}
                      className="py-1"
                    />
                  </div>

                  {/* Max Tokens */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Max Tokens</Label>
                    <Input
                      type="number"
                      value={executionForm.maxTokens}
                      onChange={(e) => setExecutionForm({ maxTokens: parseInt(e.target.value) || 2048 })}
                      className="h-8 text-xs font-mono"
                      min={1}
                      max={128000}
                      disabled={isExecuting}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Execute button */}
              <Button
                className="w-full h-9 text-sm"
                onClick={handleExecute}
                disabled={isExecuting || !executionForm.prompt.trim()}
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Execute
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Execution History */}
          <Card className="border-border/50">
            <CardHeader className="pb-2 px-4 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Recent Executions</CardTitle>
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono">
                  {executions.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {executionsLoading ? (
                <div className="space-y-2 py-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : executions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <RotateCcw className="w-6 h-6 text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">No executions yet</p>
                  <p className="text-[10px] text-muted-foreground/60">
                    Run a prompt to get started
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-2 pr-1">
                    {executions.map((exec) => (
                      <ExecutionHistoryItem
                        key={exec.id}
                        execution={exec}
                        isSelected={selectedExecutionId === exec.id}
                        onClick={() => setSelectedExecutionId(exec.id)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Response viewer */}
        <div className="lg:col-span-7">
          <Card className="border-border/50 h-full min-h-[500px]">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold">
                {selectedExecution ? 'Execution Response' : 'Response Viewer'}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 h-[calc(100%-3.5rem)]">
              {selectedExecution ? (
                <ResponseViewer
                  execution={selectedExecution}
                  onVerify={handleVerify}
                  onApproveClick={handleApproveClick}
                  verifying={verifying}
                />
              ) : (
                <EmptyViewer />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
