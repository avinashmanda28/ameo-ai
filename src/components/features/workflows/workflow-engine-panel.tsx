'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Workflow,
  Plus,
  Play,
  Pencil,
  Trash2,
  ChevronRight,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Sparkles,
  History,
  CircleDot,
  Flame,
  Inbox,
  Layers,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWorkspaceStore } from '@/lib/stores/workspace-store';
import { useToast } from '@/hooks/use-toast';
import {
  type Workflow as WorkflowType,
  type WorkflowState,
  type WorkflowType as WfType,
  type WorkflowExecution,
  type ExecutionStatus,
  WORKFLOW_STATE_COLORS,
  WORKFLOW_STATE_LABELS,
  EXECUTION_STATUS_COLORS,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// ─── Constants ──────────────────────────────────────────────────

const WORKFLOW_TYPE_LABELS: Record<WfType, string> = {
  build: 'Build',
  test: 'Test',
  deploy: 'Deploy',
  custom: 'Custom',
};

const WORKFLOW_TYPE_COLORS: Record<WfType, string> = {
  build: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  test: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  deploy: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  custom: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
};

const WORKFLOW_TYPE_ICONS: Record<WfType, React.ComponentType<{ className?: string }>> = {
  build: Layers,
  test: CheckCircle2,
  deploy: ArrowRight,
  custom: Sparkles,
};

const EXECUTION_STATUS_ICONS: Record<ExecutionStatus, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
  cancelled: AlertCircle,
};

const VALID_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  draft: ['validated'],
  validated: ['active'],
  active: ['blocked', 'completed'],
  blocked: ['recovering', 'archived'],
  recovering: ['active', 'blocked'],
  completed: ['archived'],
  archived: [],
};

const FILTER_OPTIONS: { value: WorkflowState | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'validated', label: 'Validated' },
  { value: 'active', label: 'Active' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'recovering', label: 'Recovering' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

// ─── Animation Variants ─────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.4, 0.25, 1] as const },
  },
};

const detailVariants = {
  hidden: { opacity: 0, x: 20 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: [0.25, 0.4, 0.25, 1] as const },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.2 },
  },
};

// ─── Helpers ────────────────────────────────────────────────────

function timeAgo(date: string): string {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return 'just now';
  }
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// ─── Loading Skeleton ───────────────────────────────────────────

function LoadingState() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-7 w-28" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/60 mb-4">
        <Inbox className="w-8 h-8 text-muted-foreground/50" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">No workflows yet</h3>
      <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
        Create your first workflow to start automating your development pipeline.
      </p>
      <Button onClick={onCreate} size="sm">
        <Plus className="w-4 h-4" />
        Create Workflow
      </Button>
    </div>
  );
}

// ─── Create Workflow Dialog ─────────────────────────────────────

interface CreateWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CreateWorkflowDialog({ open, onOpenChange }: CreateWorkflowDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<WfType>('custom');
  const [priority, setPriority] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const workspace = useWorkspaceStore((s) => s.workspace);
  const addWorkflow = useWorkspaceStore((s) => s.addWorkflow);
  const { toast } = useToast();

  const resetForm = useCallback(() => {
    setName('');
    setDescription('');
    setType('custom');
    setPriority(5);
  }, []);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    if (!workspace) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          name: name.trim(),
          description: description.trim() || null,
          type,
          priority,
        }),
      });
      const json = await res.json();

      if (json.success && json.data) {
        addWorkflow(json.data);
        toast({ title: 'Workflow created', description: `"${name.trim()}" is ready.` });
        resetForm();
        onOpenChange(false);
      } else {
        toast({ title: 'Failed to create workflow', description: json.error || 'Unknown error', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Create Workflow
          </DialogTitle>
          <DialogDescription>
            Define a new workflow to automate your pipeline.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="wf-name">Name *</Label>
            <Input
              id="wf-name"
              placeholder="e.g. CI Build Pipeline"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wf-desc">Description</Label>
            <Textarea
              id="wf-desc"
              placeholder="Optional description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as WfType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WORKFLOW_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wf-priority">Priority</Label>
              <Input
                id="wf-priority"
                type="number"
                min={0}
                max={10}
                value={priority}
                onChange={(e) => setPriority(Math.max(0, Math.min(10, Number(e.target.value))))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !name.trim()}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Workflow Dialog ───────────────────────────────────────

interface EditWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow: WorkflowType | null;
}

function EditWorkflowDialog({ open, onOpenChange, workflow }: EditWorkflowDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<WfType>('custom');
  const [priority, setPriority] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const updateWorkflow = useWorkspaceStore((s) => s.updateWorkflow);
  const { toast } = useToast();

  useEffect(() => {
    if (workflow) {
      setName(workflow.name);
      setDescription(workflow.description ?? '');
      setType(workflow.type ?? 'custom');
      setPriority(workflow.priority);
    }
  }, [workflow]);

  const handleSubmit = async () => {
    if (!name.trim() || !workflow) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/workflows', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: workflow.id,
          name: name.trim(),
          description: description.trim() || null,
          type,
          priority,
        }),
      });
      const json = await res.json();

      if (json.success && json.data) {
        updateWorkflow(workflow.id, json.data);
        toast({ title: 'Workflow updated' });
        onOpenChange(false);
      } else {
        toast({ title: 'Failed to update', description: json.error || 'Unknown error', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-primary" />
            Edit Workflow
          </DialogTitle>
          <DialogDescription>
            Update the workflow configuration.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-wf-name">Name *</Label>
            <Input
              id="edit-wf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-wf-desc">Description</Label>
            <Textarea
              id="edit-wf-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as WfType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WORKFLOW_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-wf-priority">Priority</Label>
              <Input
                id="edit-wf-priority"
                type="number"
                min={0}
                max={10}
                value={priority}
                onChange={(e) => setPriority(Math.max(0, Math.min(10, Number(e.target.value))))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !name.trim()}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirmation ────────────────────────────────────────

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow: WorkflowType | null;
}

function DeleteDialog({ open, onOpenChange, workflow }: DeleteDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const removeWorkflow = useWorkspaceStore((s) => s.removeWorkflow);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!workflow) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/workflows?id=${workflow.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        removeWorkflow(workflow.id);
        toast({ title: 'Workflow deleted', description: `"${workflow.name}" has been removed.` });
        onOpenChange(false);
      } else {
        toast({ title: 'Failed to delete', description: json.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{workflow?.name}</strong>? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={submitting} className="bg-destructive text-white hover:bg-destructive/90">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Workflow Card Item ─────────────────────────────────────────

interface WorkflowCardProps {
  workflow: WorkflowType;
  isSelected: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTransition: (targetState: WorkflowState) => void;
}

function WorkflowCard({
  workflow,
  isSelected,
  onClick,
  onEdit,
  onDelete,
  onTransition,
}: WorkflowCardProps) {
  const executionCount = workflow.executions?.length ?? 0;
  const validTransitions = VALID_TRANSITIONS[workflow.state] ?? [];
  const TypeIcon = WORKFLOW_TYPE_ICONS[workflow.type ?? 'custom'] ?? Sparkles;

  return (
    <motion.div
      variants={itemVariants}
      layout
      className="group"
    >
      <Card
        className={cn(
          'relative cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/20',
          isSelected && 'ring-2 ring-primary/40 border-primary/30 shadow-md'
        )}
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            {/* Left: info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <TypeIcon className={cn('w-4 h-4 shrink-0', workflow.type ? WORKFLOW_TYPE_COLORS[workflow.type].split(' ')[1] : 'text-muted-foreground')} />
                <h3 className="text-sm font-semibold text-foreground truncate">
                  {workflow.name}
                </h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {workflow.type && (
                  <Badge variant="secondary" className={cn('text-[10px] h-5 px-1.5', WORKFLOW_TYPE_COLORS[workflow.type])}>
                    {WORKFLOW_TYPE_LABELS[workflow.type]}
                  </Badge>
                )}
                <Badge variant="secondary" className={cn('text-[10px] h-5 px-1.5', WORKFLOW_STATE_COLORS[workflow.state])}>
                  {WORKFLOW_STATE_LABELS[workflow.state]}
                </Badge>
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                    <Pencil className="w-4 h-4" />
                    Edit
                  </DropdownMenuItem>
                  {validTransitions.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Transition</DropdownMenuLabel>
                      {validTransitions.map((ts) => (
                        <DropdownMenuItem key={ts} onClick={(e) => { e.stopPropagation(); onTransition(ts); }}>
                          <ArrowRight className="w-4 h-4" />
                          <span className="capitalize">{WORKFLOW_STATE_LABELS[ts]}</span>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Bottom: meta row */}
          <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-border/50">
            {/* Priority */}
            <div className="flex items-center gap-1">
              <Flame className={cn('w-3.5 h-3.5', workflow.priority >= 7 ? 'text-red-500' : workflow.priority >= 4 ? 'text-amber-500' : 'text-slate-400')} />
              <span className="text-xs text-muted-foreground tabular-nums">{workflow.priority}</span>
            </div>
            {/* Execution count */}
            <div className="flex items-center gap-1">
              <CircleDot className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground tabular-nums">{executionCount}</span>
            </div>
            {/* Date */}
            <div className="flex items-center gap-1 ml-auto">
              <Clock className="w-3.5 h-3.5 text-muted-foreground/60" />
              <span className="text-[11px] text-muted-foreground/60">{timeAgo(workflow.createdAt)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Execution Row ──────────────────────────────────────────────

interface ExecutionRowProps {
  execution: WorkflowExecution;
}

function ExecutionRow({ execution }: ExecutionRowProps) {
  const StatusIcon = EXECUTION_STATUS_ICONS[execution.status] ?? CircleDot;
  const isRunning = execution.status === 'running';

  return (
    <div className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-muted/40 transition-colors group/exec">
      <StatusIcon
        className={cn(
          'w-4 h-4 shrink-0',
          EXECUTION_STATUS_COLORS[execution.status],
          isRunning && 'animate-spin'
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {execution.stepName ?? 'Unnamed Step'}
          </span>
          <Badge
            variant="secondary"
            className={cn(
              'text-[10px] h-4 px-1.5 capitalize',
              execution.status === 'completed' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
              execution.status === 'failed' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
              execution.status === 'running' && 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
              execution.status === 'pending' && 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
              execution.status === 'cancelled' && 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
            )}
          >
            {execution.status}
          </Badge>
        </div>
        {execution.error && (
          <p className="text-xs text-red-500 truncate mt-0.5">{execution.error}</p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatDuration(execution.durationMs)}
        </span>
        <span className="text-[11px] text-muted-foreground/50">{timeAgo(execution.createdAt)}</span>
      </div>
    </div>
  );
}

// ─── Detail Panel ───────────────────────────────────────────────

interface DetailPanelProps {
  workflow: WorkflowType;
  onClose: () => void;
  onEdit: () => void;
  onTransition: (targetState: WorkflowState) => void;
}

function DetailPanel({ workflow, onClose, onEdit, onTransition }: DetailPanelProps) {
  const [executions, setExecutions] = useState<WorkflowExecution[]>(workflow.executions ?? []);
  const [running, setRunning] = useState(false);
  const [transitioning, setTransitioning] = useState<WorkflowState | null>(null);
  const updateWorkflow = useWorkspaceStore((s) => s.updateWorkflow);
  const { toast } = useToast();

  const validTransitions = VALID_TRANSITIONS[workflow.state] ?? [];
  const TypeIcon = WORKFLOW_TYPE_ICONS[workflow.type ?? 'custom'] ?? Sparkles;

  const fetchExecutions = useCallback(async () => {
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/executions`);
      const json = await res.json();
      if (json.success && json.data) {
        setExecutions(json.data);
      }
    } catch {
      // Silently fail on fetch
    }
  }, [workflow.id]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/executions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepName: 'Manual Run' }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Execution started', description: 'A new workflow run has been created.' });
        fetchExecutions();
      } else {
        toast({ title: 'Failed to start', description: json.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  const handleTransition = async (targetState: WorkflowState) => {
    setTransitioning(targetState);
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: targetState }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        updateWorkflow(workflow.id, { state: targetState });
        toast({
          title: 'State transitioned',
          description: `${WORKFLOW_STATE_LABELS[workflow.state]} → ${WORKFLOW_STATE_LABELS[targetState]}`,
        });
      } else {
        toast({ title: 'Transition failed', description: json.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setTransitioning(null);
    }
  };

  return (
    <motion.div
      key={`detail-${workflow.id}`}
      variants={detailVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-foreground truncate">{workflow.name}</h2>
          {workflow.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{workflow.description}</p>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 lg:hidden" onClick={onClose}>
          <XCircle className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-5">
        <div className="space-y-5 pb-6">
          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Type</p>
              <div className="flex items-center gap-1.5">
                <TypeIcon className={cn('w-4 h-4', workflow.type ? WORKFLOW_TYPE_COLORS[workflow.type].split(' ')[1] : 'text-muted-foreground')} />
                <span className="text-sm font-medium capitalize">{workflow.type ?? 'Custom'}</span>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">State</p>
              <Badge className={cn('text-xs', WORKFLOW_STATE_COLORS[workflow.state])}>
                {WORKFLOW_STATE_LABELS[workflow.state]}
              </Badge>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Priority</p>
              <div className="flex items-center gap-1.5">
                <Flame className={cn('w-4 h-4', workflow.priority >= 7 ? 'text-red-500' : workflow.priority >= 4 ? 'text-amber-500' : 'text-slate-400')} />
                <span className="text-sm font-semibold tabular-nums">{workflow.priority}/10</span>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Created</p>
              <span className="text-sm text-foreground">{timeAgo(workflow.createdAt)}</span>
            </div>
          </div>

          {/* State Transition */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5" />
              State Transitions
            </h3>
            {validTransitions.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">
                No transitions available from <Badge variant="secondary" className={cn('text-[10px] h-4 px-1.5 ml-1', WORKFLOW_STATE_COLORS[workflow.state])}>{WORKFLOW_STATE_LABELS[workflow.state]}</Badge> state.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className={cn('text-[10px] h-6 px-2', WORKFLOW_STATE_COLORS[workflow.state])}>
                  {WORKFLOW_STATE_LABELS[workflow.state]}
                </Badge>
                <span className="text-muted-foreground text-xs self-center">→</span>
                {validTransitions.map((ts) => (
                  <Button
                    key={ts}
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    disabled={transitioning !== null}
                    onClick={() => handleTransition(ts)}
                  >
                    {transitioning === ts && <Loader2 className="w-3 h-3 animate-spin" />}
                    {WORKFLOW_STATE_LABELS[ts]}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Execution History */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                Execution History
              </h3>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleRun} disabled={running}>
                {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Run
              </Button>
            </div>
            {executions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CircleDot className="w-6 h-6 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">No executions yet</p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                  Click Run to create a new execution
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-72">
                <div className="space-y-0.5">
                  {executions.map((exec) => (
                    <ExecutionRow key={exec.id} execution={exec} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <Separator />

          {/* Edit button */}
          <div className="pt-1">
            <Button variant="outline" size="sm" className="w-full" onClick={onEdit}>
              <Pencil className="w-4 h-4" />
              Edit Workflow
            </Button>
          </div>
        </div>
      </ScrollArea>
    </motion.div>
  );
}

// ─── Main Workflow Engine Panel ─────────────────────────────────

export function WorkflowEnginePanel() {
  const workflows = useWorkspaceStore((s) => s.workflows);
  const workflowsLoading = useWorkspaceStore((s) => s.workflowsLoading);
  const workflowFilter = useWorkspaceStore((s) => s.workflowFilter);
  const setWorkflowFilter = useWorkspaceStore((s) => s.setWorkflowFilter);
  const setWorkflows = useWorkspaceStore((s) => s.setWorkflows);
  const updateWorkflow = useWorkspaceStore((s) => s.updateWorkflow);
  const workspace = useWorkspaceStore((s) => s.workspace);
  const { toast } = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Fetch workflows
  useEffect(() => {
    async function fetchWorkflows() {
      try {
        const stateParam = workflowFilter !== 'all' ? `?state=${workflowFilter}` : '';
        const res = await fetch(`/api/workflows${stateParam}`);
        const json = await res.json();
        if (json.success && json.data) {
          setWorkflows(json.data);
        }
      } catch {
        // Silently fail
      }
    }
    fetchWorkflows();
  }, [workflowFilter, setWorkflows]);

  // Filter locally as well (for immediate feedback)
  const filteredWorkflows = useMemo(() => {
    if (workflowFilter === 'all') return workflows;
    return workflows.filter((w) => w.state === workflowFilter);
  }, [workflows, workflowFilter]);

  const selectedWorkflow = useMemo(
    () => workflows.find((w) => w.id === selectedId) ?? null,
    [workflows, selectedId]
  );

  // Transition handler
  const handleTransition = useCallback(
    async (workflowId: string, targetState: WorkflowState) => {
      try {
        const res = await fetch(`/api/workflows/${workflowId}/transition`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: targetState }),
        });
        const json = await res.json();
        if (json.success && json.data) {
          updateWorkflow(workflowId, { state: targetState });
          toast({
            title: 'State transitioned',
            description: `Workflow moved to ${WORKFLOW_STATE_LABELS[targetState]}`,
          });
        } else {
          toast({ title: 'Transition failed', description: json.error, variant: 'destructive' });
        }
      } catch {
        toast({ title: 'Network error', variant: 'destructive' });
      }
    },
    [updateWorkflow, toast]
  );

  if (workflowsLoading) {
    return <LoadingState />;
  }

  return (
    <motion.div
      className="flex flex-col h-full"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* ─── Header ─── */}
      <motion.div variants={itemVariants} className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10">
              <Workflow className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">Workflows</h1>
              <p className="text-xs text-muted-foreground">
                {workflows.length} workflow{workflows.length !== 1 ? 's' : ''} total
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create Workflow</span>
          </Button>
        </div>
      </motion.div>

      {/* ─── Filter Bar ─── */}
      <motion.div variants={itemVariants} className="px-5 pb-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {FILTER_OPTIONS.map((opt) => {
            const count = opt.value === 'all'
              ? workflows.length
              : workflows.filter((w) => w.state === opt.value).length;
            const isActive = workflowFilter === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setWorkflowFilter(opt.value)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 border shrink-0',
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-background text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {opt.label}
                <span
                  className={cn(
                    'text-[10px] tabular-nums px-1 rounded-full',
                    isActive
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ─── Content Area ─── */}
      <div className="flex-1 flex min-h-0 px-5 pb-5">
        {/* List */}
        <div
          className={cn(
            'min-w-0 transition-all duration-300',
            selectedId ? 'w-full lg:w-1/2 lg:pr-3' : 'w-full'
          )}
        >
          {filteredWorkflows.length === 0 ? (
            <EmptyState onCreate={() => setCreateOpen(true)} />
          ) : (
            <ScrollArea className="max-h-[calc(100vh-14rem)]">
              <div className="space-y-2.5 pr-3">
                <AnimatePresence mode="popLayout">
                  {filteredWorkflows.map((wf) => (
                    <WorkflowCard
                      key={wf.id}
                      workflow={wf}
                      isSelected={selectedId === wf.id}
                      onClick={() => setSelectedId(selectedId === wf.id ? null : wf.id)}
                      onEdit={() => setEditOpen(true)}
                      onDelete={() => setDeleteOpen(true)}
                      onTransition={(ts) => handleTransition(wf.id, ts)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Detail Panel (desktop) */}
        {selectedId && selectedWorkflow && (
          <div className="hidden lg:flex flex-1 min-w-0">
            <Card className="w-full overflow-hidden">
              <DetailPanel
                workflow={selectedWorkflow}
                onClose={() => setSelectedId(null)}
                onEdit={() => setEditOpen(true)}
                onTransition={(ts) => handleTransition(selectedWorkflow.id, ts)}
              />
            </Card>
          </div>
        )}
      </div>

      {/* Detail Panel (mobile overlay) */}
      <AnimatePresence>
        {selectedId && selectedWorkflow && (
          <motion.div
            className="lg:hidden fixed inset-0 z-50 bg-background/95 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <DetailPanel
              workflow={selectedWorkflow}
              onClose={() => setSelectedId(null)}
              onEdit={() => setEditOpen(true)}
              onTransition={(ts) => handleTransition(selectedWorkflow.id, ts)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Dialogs ─── */}
      <CreateWorkflowDialog open={createOpen} onOpenChange={setCreateOpen} />

      <EditWorkflowDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        workflow={selectedWorkflow}
      />

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        workflow={selectedWorkflow}
      />
    </motion.div>
  );
}
