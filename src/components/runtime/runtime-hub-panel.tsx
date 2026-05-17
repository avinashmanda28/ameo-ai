'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu,
  Plus,
  Pencil,
  Trash2,
  Activity,
  Star,
  ChevronDown,
  ChevronRight,
  Server,
  Zap,
  ShieldCheck,
  RefreshCw,
  Loader2,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWorkspaceStore } from '@/lib/store/workspace-store';
import {
  type RuntimeProvider,
  type RuntimeType,
  type RuntimeRole,
  type RuntimeStatus,
  RUNTIME_TYPE_LABELS,
  RUNTIME_TYPE_COLORS,
} from '@/lib/types';
import type { ApiResponse } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// ─── Animation Variants ────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.4, 0.25, 1] },
  },
};

// ─── Constants ─────────────────────────────────────────────────

const STATUS_DOT_COLORS: Record<RuntimeStatus, string> = {
  active: 'bg-emerald-500',
  inactive: 'bg-zinc-400',
  error: 'bg-red-500',
  verifying: 'bg-amber-500',
};

const STATUS_LABELS: Record<RuntimeStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  error: 'Error',
  verifying: 'Verifying',
};

const ROLE_COLORS: Record<RuntimeRole, string> = {
  primary: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  secondary: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  fallback: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
};

const ROLE_LABELS: Record<RuntimeRole, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  fallback: 'Fallback',
};

const RUNTIME_TYPES: RuntimeType[] = ['openrouter', 'groq', 'gemini', 'ollama'];
const RUNTIME_ROLES: RuntimeRole[] = ['primary', 'secondary', 'fallback'];

const EMPTY_FORM = {
  name: '',
  type: 'openrouter' as RuntimeType,
  apiKey: '',
  baseUrl: '',
  modelId: '',
  role: 'secondary' as RuntimeRole,
};

// ─── Helpers ───────────────────────────────────────────────────

function getHealthColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function getHealthTextColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function formatLastCheck(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'w-3.5 h-3.5',
            i < rating
              ? 'text-amber-400 fill-amber-400'
              : 'text-zinc-300 dark:text-zinc-600'
          )}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground tabular-nums">
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

// ─── Loading Skeleton ──────────────────────────────────────────

function LoadingRuntimeHub() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-52 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Runtime Hub Panel ─────────────────────────────────────────

export function RuntimeHubPanel() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const runtimes = useWorkspaceStore((s) => s.runtimes);
  const setRuntimes = useWorkspaceStore((s) => s.setRuntimes);
  const addRuntime = useWorkspaceStore((s) => s.addRuntime);
  const updateRuntime = useWorkspaceStore((s) => s.updateRuntime);
  const removeRuntime = useWorkspaceStore((s) => s.removeRuntime);
  const runtimesLoading = useWorkspaceStore((s) => s.runtimesLoading);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<RuntimeProvider | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<RuntimeProvider | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Health checking
  const [healthChecking, setHealthChecking] = useState<Set<string>>(new Set());

  // Collapsible
  const [archOpen, setArchOpen] = useState(false);

  // ─── Fetch Runtimes ───
  const fetchRuntimes = useCallback(async () => {
    try {
      const res = await fetch('/api/runtime');
      const json: ApiResponse<RuntimeProvider[]> = await res.json();
      if (json.success && json.data) {
        setRuntimes(json.data);
      } else {
        toast.error('Failed to load runtime providers');
      }
    } catch {
      toast.error('Network error loading providers');
    }
  }, [setRuntimes]);

  useEffect(() => {
    fetchRuntimes();
  }, [fetchRuntimes]);

  // ─── Open Add Dialog ───
  const handleAdd = () => {
    setEditingProvider(null);
    setForm({ ...EMPTY_FORM });
    setShowApiKey(false);
    setDialogOpen(true);
  };

  // ─── Open Edit Dialog ───
  const handleEdit = (provider: RuntimeProvider) => {
    setEditingProvider(provider);
    setForm({
      name: provider.name,
      type: provider.type,
      apiKey: provider.apiKey ?? '',
      baseUrl: provider.baseUrl ?? '',
      modelId: provider.modelId ?? '',
      role: (provider.role as RuntimeRole) ?? 'secondary',
    });
    setShowApiKey(false);
    setDialogOpen(true);
  };

  // ─── Submit Form ───
  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Provider name is required');
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingProvider) {
        // Update
        const res = await fetch('/api/runtime', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingProvider.id,
            name: form.name.trim(),
            type: form.type,
            apiKey: form.apiKey.trim() || undefined,
            baseUrl: form.baseUrl.trim() || undefined,
            modelId: form.modelId.trim() || undefined,
            role: form.role,
          }),
        });
        const json: ApiResponse<RuntimeProvider> = await res.json();
        if (json.success && json.data) {
          updateRuntime(editingProvider.id, json.data);
          toast.success(`Provider "${form.name}" updated`);
          setDialogOpen(false);
        } else {
          toast.error(json.error ?? 'Failed to update provider');
        }
      } else {
        // Create
        const res = await fetch('/api/runtime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: workspace?.id,
            name: form.name.trim(),
            type: form.type,
            apiKey: form.apiKey.trim() || undefined,
            baseUrl: form.baseUrl.trim() || undefined,
            modelId: form.modelId.trim() || undefined,
            role: form.role,
          }),
        });
        const json: ApiResponse<RuntimeProvider> = await res.json();
        if (json.success && json.data) {
          addRuntime(json.data);
          toast.success(`Provider "${form.name}" added`);
          setDialogOpen(false);
        } else {
          toast.error(json.error ?? 'Failed to create provider');
        }
      }
    } catch {
      toast.error('Network error saving provider');
    } finally {
      setFormSubmitting(false);
    }
  };

  // ─── Delete Provider ───
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/runtime?id=${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const json: ApiResponse<{ id: string }> = await res.json();
      if (json.success) {
        removeRuntime(deleteTarget.id);
        toast.success(`Provider "${deleteTarget.name}" deleted`);
        setDeleteTarget(null);
      } else {
        toast.error(json.error ?? 'Failed to delete provider');
      }
    } catch {
      toast.error('Network error deleting provider');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ─── Health Check ───
  const handleHealthCheck = async (provider: RuntimeProvider) => {
    setHealthChecking((prev) => new Set(prev).add(provider.id));
    try {
      const res = await fetch(`/api/runtime/${provider.id}/healthcheck`, {
        method: 'POST',
      });
      const json: ApiResponse<{ healthLog: { status: string; latencyMs: number | null }; provider: RuntimeProvider }> = await res.json();
      if (json.success && json.data) {
        updateRuntime(provider.id, json.data.provider);
        const status = json.data.healthLog.status;
        const latency = json.data.healthLog.latencyMs;
        if (status === 'healthy') {
          toast.success(
            `${provider.name}: Healthy${latency != null ? ` (${latency}ms)` : ''}`,
            { description: 'Health check passed' }
          );
        } else if (status === 'degraded') {
          toast.warning(
            `${provider.name}: Degraded${latency != null ? ` (${latency}ms)` : ''}`,
            { description: 'Performance may be impacted' }
          );
        } else if (status === 'error') {
          toast.error(`${provider.name}: Error`, {
            description: 'Health check failed — check configuration',
          });
        } else {
          toast.info(`${provider.name}: Unknown status`);
        }
      } else {
        toast.error(json.error ?? 'Health check failed');
      }
    } catch {
      toast.error('Network error during health check');
    } finally {
      setHealthChecking((prev) => {
        const next = new Set(prev);
        next.delete(provider.id);
        return next;
      });
    }
  };

  // ─── Derived Stats ───
  const totalProviders = runtimes.length;
  const activeCount = runtimes.filter((r) => r.status === 'active').length;
  const avgHealthScore =
    totalProviders > 0
      ? Math.round(runtimes.reduce((sum, r) => sum + r.healthScore, 0) / totalProviders)
      : 0;

  // ─── Render ───
  if (runtimesLoading) {
    return <LoadingRuntimeHub />;
  }

  return (
    <motion.div
      className="p-6 space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* ─── Header ─── */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Runtime Hub
            </h1>
          </div>
          <p className="text-sm text-muted-foreground ml-[42px]">
            Manage AI provider configurations, monitor health, and assign roles
          </p>
        </div>
        <Button onClick={handleAdd} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Add Provider
        </Button>
      </motion.div>

      {/* ─── Health Stats ─── */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Providers */}
          <Card className="relative overflow-hidden hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Total Providers
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-foreground">
                    {totalProviders}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Configured runtimes</p>
                </div>
                <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 bg-slate-100 dark:bg-slate-800">
                  <Server className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Count */}
          <Card className="relative overflow-hidden hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Active
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {activeCount}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totalProviders > 0
                      ? `${Math.round((activeCount / totalProviders) * 100)}% online`
                      : 'No providers'}
                  </p>
                </div>
                <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 bg-emerald-100 dark:bg-emerald-900/30">
                  <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Average Health */}
          <Card className="relative overflow-hidden hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Avg Health
                  </p>
                  <p className={cn('text-2xl font-bold tabular-nums', getHealthTextColor(avgHealthScore))}>
                    {avgHealthScore}
                  </p>
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground">Score</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{avgHealthScore}/100</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className={cn('h-full rounded-full', getHealthColor(avgHealthScore))}
                        initial={{ width: 0 }}
                        animate={{ width: `${avgHealthScore}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 bg-sky-100 dark:bg-sky-900/30">
                  <ShieldCheck className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* ─── Provider Cards Grid ─── */}
      {runtimes.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-muted/60 mb-4">
                <Cpu className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">No runtime providers</h3>
              <p className="text-xs text-muted-foreground mb-6 max-w-xs">
                Add your first AI provider to get started. No providers are pre-configured — you must explicitly set them up.
              </p>
              <Button variant="outline" onClick={handleAdd}>
                <Plus className="w-4 h-4 mr-2" />
                Add Provider
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {runtimes.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  healthChecking={healthChecking.has(provider.id)}
                  onEdit={() => handleEdit(provider)}
                  onDelete={() => setDeleteTarget(provider)}
                  onHealthCheck={() => handleHealthCheck(provider)}
                />
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* ─── Runtime Architecture Info ─── */}
      <motion.div variants={itemVariants}>
        <Collapsible open={archOpen} onOpenChange={setArchOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-semibold">
                      Runtime Architecture
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] h-5">
                      Info
                    </Badge>
                    {archOpen ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
                <CardDescription className="text-xs">
                  Learn about the multi-runtime provider abstraction layer
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Separator />
              <CardContent className="pt-4 pb-5 space-y-4">
                {/* Supported Providers */}
                <div>
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">
                    Supported Providers
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {RUNTIME_TYPES.map((type) => (
                      <div
                        key={type}
                        className={cn(
                          'flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center',
                          'bg-muted/30 hover:bg-muted/50 transition-colors'
                        )}
                      >
                        <Badge className={cn('text-[10px]', RUNTIME_TYPE_COLORS[type])}>
                          {RUNTIME_TYPE_LABELS[type]}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground capitalize">
                          {type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Multi-Runtime Support */}
                <div>
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">
                    Multi-Runtime Support
                  </h4>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      Connect multiple providers simultaneously for high availability
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      Automatic failover from primary to secondary and fallback providers
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      Real-time health monitoring with configurable thresholds
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      Per-provider rate limiting and cost management
                    </li>
                  </ul>
                </div>

                {/* Role Assignments */}
                <div>
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">
                    Role Assignments
                  </h4>
                  <div className="space-y-2">
                    {RUNTIME_ROLES.map((role) => (
                      <div key={role} className="flex items-center gap-2">
                        <Badge className={cn('text-[10px] w-20 justify-center', ROLE_COLORS[role])}>
                          {ROLE_LABELS[role]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {role === 'primary'
                            ? 'Default provider for all AI interactions — highest priority'
                            : role === 'secondary'
                              ? 'Backup provider used when primary is unavailable or at capacity'
                              : 'Last-resort provider — used only when all others fail'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Health Monitoring */}
                <div>
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">
                    Health Monitoring
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Each provider undergoes periodic health checks measuring response latency and availability.
                    Health scores range from 0–100 and influence routing decisions. Providers with scores below
                    50 are flagged for review and may be temporarily deprioritized in the routing chain.
                    Manual health checks can be triggered from each provider&apos;s card.
                  </p>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </motion.div>

      {/* ─── Add/Edit Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProvider ? 'Edit Provider' : 'Add Provider'}
            </DialogTitle>
            <DialogDescription>
              {editingProvider
                ? `Update the configuration for "${editingProvider.name}"`
                : 'Configure a new AI runtime provider'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="provider-name">Name</Label>
              <Input
                id="provider-name"
                placeholder="e.g. My GPT-4 Provider"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label>Provider Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as RuntimeType }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RUNTIME_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {RUNTIME_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <Label htmlFor="provider-apikey">API Key</Label>
              <div className="relative">
                <Input
                  id="provider-apikey"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={form.apiKey}
                  onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowApiKey((s) => !s)}
                  tabIndex={-1}
                >
                  {showApiKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Base URL */}
            <div className="space-y-1.5">
              <Label htmlFor="provider-baseurl">Base URL</Label>
              <Input
                id="provider-baseurl"
                placeholder="https://api.openrouter.ai/v1"
                value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              />
            </div>

            {/* Model ID */}
            <div className="space-y-1.5">
              <Label htmlFor="provider-model">Model ID</Label>
              <Input
                id="provider-model"
                placeholder="openai/gpt-4o"
                value={form.modelId}
                onChange={(e) => setForm((f) => ({ ...f, modelId: e.target.value }))}
              />
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v as RuntimeRole }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RUNTIME_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={formSubmitting}>
              {formSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingProvider ? 'Update Provider' : 'Add Provider'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Provider</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This action
              cannot be undone. All associated health logs will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleteLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

// ─── Provider Card ─────────────────────────────────────────────

function ProviderCard({
  provider,
  healthChecking,
  onEdit,
  onDelete,
  onHealthCheck,
}: {
  provider: RuntimeProvider;
  healthChecking: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onHealthCheck: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
    >
      <Card className="h-full hover:shadow-md transition-all duration-200 group">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            {/* Left: Status dot + Name + Type */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={cn(
                  'w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-background',
                  STATUS_DOT_COLORS[provider.status]
                )}
              />
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold truncate">
                  {provider.name}
                </CardTitle>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge
                    className={cn(
                      'text-[10px] h-5 px-1.5 font-medium',
                      RUNTIME_TYPE_COLORS[provider.type]
                    )}
                  >
                    {RUNTIME_TYPE_LABELS[provider.type]}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="text-[10px] h-5 px-1.5"
                  >
                    {STATUS_LABELS[provider.status]}
                  </Badge>
                  {provider.role && (
                    <Badge
                      className={cn(
                        'text-[10px] h-5 px-1.5',
                        ROLE_COLORS[provider.role as RuntimeRole]
                      )}
                    >
                      {ROLE_LABELS[provider.role as RuntimeRole]}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onEdit}
                title="Edit provider"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={onDelete}
                title="Delete provider"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 pb-4 space-y-3">
          {/* Model ID */}
          {provider.modelId && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Server className="w-3 h-3 shrink-0" />
              <span className="truncate">{provider.modelId}</span>
            </div>
          )}

          {/* Health Score */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Health Score
              </span>
              <span
                className={cn(
                  'text-xs font-semibold tabular-nums',
                  getHealthTextColor(provider.healthScore)
                )}
              >
                {provider.healthScore}
                <span className="text-muted-foreground font-normal">/100</span>
              </span>
            </div>
            <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
              <motion.div
                className={cn(
                  'absolute inset-y-0 left-0 rounded-full',
                  getHealthColor(provider.healthScore)
                )}
                initial={{ width: 0 }}
                animate={{ width: `${provider.healthScore}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Rating */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Rating
            </span>
            <StarRating rating={provider.rating} />
          </div>

          {/* Last Health Check */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Last Check
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {formatLastCheck(provider.lastHealthCheck)}
            </span>
          </div>

          {/* Health Check Button */}
          <Separator className="my-1" />
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={onHealthCheck}
            disabled={healthChecking}
          >
            {healthChecking ? (
              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
            ) : (
              <Activity className="w-3.5 h-3.5 mr-2" />
            )}
            {healthChecking ? 'Checking...' : 'Run Health Check'}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
