'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Eye,
  Search,
  Filter,
  Loader2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useWorkspaceStore } from '@/lib/store/workspace-store';
import {
  GovernanceRule,
  AuditLog,
  RuleType,
  RuleSeverity,
  AuditSeverity,
  RULE_TYPE_LABELS,
  RULE_SEVERITY_COLORS,
  ApiResponse,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';

// ═══════════════════════════════════════════════════════════════
// Animation Variants
// ═══════════════════════════════════════════════════════════════

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
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

// ═══════════════════════════════════════════════════════════════
// Audit Severity Colors
// ═══════════════════════════════════════════════════════════════

const AUDIT_SEVERITY_COLORS: Record<AuditSeverity, string> = {
  info: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  warn: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 font-bold',
};

const AUDIT_SEVERITY_TEXT: Record<AuditSeverity, string> = {
  info: 'text-muted-foreground',
  warn: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
  critical: 'text-red-700 dark:text-red-300 font-semibold',
};

const AUDIT_SEVERITY_ICONS: Record<AuditSeverity, React.ComponentType<{ className?: string }>> = {
  info: CheckCircle2,
  warn: AlertTriangle,
  error: XCircle,
  critical: XCircle,
};

const RULE_TYPE_COLORS: Record<RuleType, string> = {
  permission: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  approval: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  rate_limit: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  security: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  compliance: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

// ═══════════════════════════════════════════════════════════════
// Loading Skeletons
// ═══════════════════════════════════════════════════════════════

function LoadingGovernance() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="h-7 w-32" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <div className="flex gap-1">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <Skeleton className="h-4 w-48" />
        <div className="space-y-2 pt-1">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Security Summary Card
// ═══════════════════════════════════════════════════════════════

interface SummaryItemProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  sub?: string;
}

function SummaryItem({ label, value, icon: Icon, accent, sub }: SummaryItemProps) {
  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {label}
            </p>
            <p className="text-2xl font-bold tabular-nums text-foreground mt-1">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={cn('flex items-center justify-center w-9 h-9 rounded-xl shrink-0', accent)}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SecuritySummary() {
  const governanceRules = useWorkspaceStore((s) => s.governanceRules);
  const auditLogs = useWorkspaceStore((s) => s.auditLogs);

  const totalRules = governanceRules.length;
  const activeRules = governanceRules.filter((r) => r.enabled).length;
  const criticalRules = governanceRules.filter((r) => r.severity === 'critical' && r.enabled).length;
  const totalAuditEvents = auditLogs.length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryItem
        label="Total Rules"
        value={totalRules}
        icon={Shield}
        accent="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
        sub={`${totalRules - activeRules} disabled`}
      />
      <SummaryItem
        label="Active Rules"
        value={activeRules}
        icon={ShieldCheck}
        accent="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
        sub={totalRules > 0 ? `${Math.round((activeRules / totalRules) * 100)}% of rules` : 'No rules yet'}
      />
      <SummaryItem
        label="Critical Rules"
        value={criticalRules}
        icon={ShieldAlert}
        accent="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
        sub={criticalRules > 0 ? 'Requires attention' : 'No critical alerts'}
      />
      <SummaryItem
        label="Audit Events"
        value={totalAuditEvents}
        icon={Activity}
        accent="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
        sub="Total logged events"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Rule Form Dialog
// ═══════════════════════════════════════════════════════════════

interface RuleFormData {
  name: string;
  type: RuleType;
  description: string;
  severity: RuleSeverity;
  enabled: boolean;
  config: string;
}

const DEFAULT_FORM_DATA: RuleFormData = {
  name: '',
  type: 'permission',
  description: '',
  severity: 'medium',
  enabled: true,
  config: '{}',
};

function RuleFormDialog({
  open,
  onOpenChange,
  editingRule,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRule: GovernanceRule | null;
  workspaceId: string;
}) {
  const [formData, setFormData] = useState<RuleFormData>(DEFAULT_FORM_DATA);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!editingRule;

  useEffect(() => {
    if (editingRule) {
      setFormData({
        name: editingRule.name,
        type: editingRule.type,
        description: editingRule.description ?? '',
        severity: editingRule.severity,
        enabled: editingRule.enabled,
        config: editingRule.config ?? '{}',
      });
    } else {
      setFormData(DEFAULT_FORM_DATA);
    }
    setError(null);
  }, [editingRule, open]);

  const validateConfig = (value: string): boolean => {
    if (!value.trim()) return true; // allow empty config
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Rule name is required.');
      return;
    }
    if (!validateConfig(formData.config)) {
      setError('Config must be valid JSON.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = '/api/governance';
      const method = isEditing ? 'PUT' : 'POST';
      const body = {
        ...(isEditing && { id: editingRule.id }),
        workspaceId,
        name: formData.name.trim(),
        type: formData.type,
        description: formData.description.trim() || null,
        severity: formData.severity,
        enabled: formData.enabled,
        config: formData.config.trim() || null,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result: ApiResponse<GovernanceRule> = await res.json();

      if (!result.success || !result.data) {
        setError(result.error ?? 'Failed to save rule.');
        setSaving(false);
        return;
      }

      // Update store
      if (isEditing) {
        useWorkspaceStore.getState().updateGovernanceRule(result.data.id, result.data);
      } else {
        useWorkspaceStore.getState().addGovernanceRule(result.data);
      }

      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            {isEditing ? 'Edit Governance Rule' : 'Create Governance Rule'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modify the rule configuration, severity, or enabled status.'
              : 'Define a new governance rule to enforce policies across the system.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="rule-name">Name *</Label>
            <Input
              id="rule-name"
              placeholder="e.g., API Rate Limiter"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="rule-type">Type</Label>
            <Select
              value={formData.type}
              onValueChange={(v) => setFormData((p) => ({ ...p, type: v as RuleType }))}
            >
              <SelectTrigger id="rule-type" className="w-full">
                <SelectValue placeholder="Select rule type" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(RULE_TYPE_LABELS) as [RuleType, string][]).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <Label htmlFor="rule-severity">Severity</Label>
            <Select
              value={formData.severity}
              onValueChange={(v) => setFormData((p) => ({ ...p, severity: v as RuleSeverity }))}
            >
              <SelectTrigger id="rule-severity" className="w-full">
                <SelectValue placeholder="Select severity" />
              </SelectTrigger>
              <SelectContent>
                {(['low', 'medium', 'high', 'critical'] as RuleSeverity[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="capitalize">{s}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="rule-description">Description</Label>
            <Textarea
              id="rule-description"
              placeholder="Describe what this rule does..."
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Config JSON */}
          <div className="space-y-2">
            <Label htmlFor="rule-config">Config (JSON)</Label>
            <Textarea
              id="rule-config"
              placeholder='{"maxRequests": 100, "windowMs": 60000}'
              value={formData.config}
              onChange={(e) => setFormData((p) => ({ ...p, config: e.target.value }))}
              rows={4}
              className={cn(
                'font-mono text-xs',
                formData.config.trim() && !validateConfig(formData.config) && 'border-red-500 focus-visible:border-red-500'
              )}
            />
            {formData.config.trim() && !validateConfig(formData.config) && (
              <p className="text-xs text-red-500">Invalid JSON format</p>
            )}
          </div>

          {/* Enabled toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="rule-enabled" className="cursor-pointer">Enabled</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formData.enabled ? 'Rule is active and enforcing' : 'Rule is disabled and dormant'}
              </p>
            </div>
            <Switch
              id="rule-enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData((p) => ({ ...p, enabled: checked }))}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// Rules Tab
// ═══════════════════════════════════════════════════════════════

function RulesTab({ onAddRule }: { onAddRule: () => void }) {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const governanceRules = useWorkspaceStore((s) => s.governanceRules);
  const updateGovernanceRule = useWorkspaceStore((s) => s.updateGovernanceRule);
  const removeGovernanceRule = useWorkspaceStore((s) => s.removeGovernanceRule);
  const governanceLoading = useWorkspaceStore((s) => s.governanceLoading);

  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRule, setEditingRule] = useState<GovernanceRule | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredRules = useMemo(() => {
    let rules = governanceRules;

    if (typeFilter !== 'all') {
      rules = rules.filter((r) => r.type === typeFilter);
    }
    if (severityFilter !== 'all') {
      rules = rules.filter((r) => r.severity === severityFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rules = rules.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q)
      );
    }

    return rules;
  }, [governanceRules, typeFilter, severityFilter, searchQuery]);

  const handleToggle = useCallback(
    async (rule: GovernanceRule) => {
      const newEnabled = !rule.enabled;
      // Optimistic update
      updateGovernanceRule(rule.id, { enabled: newEnabled });
      setTogglingId(rule.id);

      try {
        const res = await fetch('/api/governance', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: rule.id, enabled: newEnabled }),
        });
        const result: ApiResponse<GovernanceRule> = await res.json();

        if (!result.success || !result.data) {
          // Revert
          updateGovernanceRule(rule.id, { enabled: rule.enabled });
        } else {
          updateGovernanceRule(rule.id, result.data);
        }
      } catch {
        // Revert
        updateGovernanceRule(rule.id, { enabled: rule.enabled });
      } finally {
        setTogglingId(null);
      }
    },
    [updateGovernanceRule]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id);
      try {
        const res = await fetch(`/api/governance?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        const result = await res.json();

        if (result.success) {
          removeGovernanceRule(id);
        }
      } catch {
        // Silently fail — the rule stays
      } finally {
        setDeletingId(null);
      }
    },
    [removeGovernanceRule]
  );

  const handleEdit = useCallback((rule: GovernanceRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  }, []);

  return (
    <>
      <motion.div variants={itemVariants} className="space-y-6">
        {/* Security Summary */}
        <SecuritySummary />

        {/* Filters + Search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="relative flex-1 w-full sm:max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search rules..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
                    Filters
                  </span>
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger size="sm" className="w-[140px]">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {(Object.entries(RULE_TYPE_LABELS) as [RuleType, string][]).map(
                      ([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger size="sm" className="w-[130px]">
                    <SelectValue placeholder="All Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severity</SelectItem>
                    {(['low', 'medium', 'high', 'critical'] as RuleSeverity[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className="capitalize">{s}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(typeFilter !== 'all' || severityFilter !== 'all' || searchQuery.trim()) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTypeFilter('all');
                      setSeverityFilter('all');
                      setSearchQuery('');
                    }}
                    className="text-xs"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rules Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Governance Rules</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {filteredRules.length} of {governanceRules.length} rules shown
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-[10px] h-5">
                {governanceRules.filter((r) => r.enabled).length} active
              </Badge>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            {governanceLoading ? (
              <div className="p-6 space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredRules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Shield className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">
                  {governanceRules.length === 0 ? 'No governance rules yet' : 'No rules match filters'}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {governanceRules.length === 0
                    ? 'Create your first rule to start enforcing policies'
                    : 'Try adjusting your search or filter criteria'}
                </p>
                {governanceRules.length === 0 && (
                  <Button size="sm" onClick={onAddRule} className="mt-4">
                    <Plus className="w-3.5 h-3.5" />
                    Create First Rule
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead className="hidden md:table-cell">Description</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.map((rule) => (
                    <TableRow key={rule.id} className={cn(!rule.enabled && 'opacity-60')}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'w-1.5 h-8 rounded-full shrink-0',
                              rule.enabled
                                ? rule.severity === 'critical'
                                  ? 'bg-red-500'
                                  : rule.severity === 'high'
                                    ? 'bg-orange-500'
                                    : rule.severity === 'medium'
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                : 'bg-muted-foreground/30'
                            )}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {rule.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground/60 md:hidden truncate">
                              {rule.description || 'No description'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn('text-[10px] h-5', RULE_TYPE_COLORS[rule.type])}
                        >
                          {RULE_TYPE_LABELS[rule.type]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn('text-[10px] h-5 capitalize', RULE_SEVERITY_COLORS[rule.severity])}
                        >
                          {rule.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {rule.description || '\u2014'}
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <Switch
                                  checked={rule.enabled}
                                  disabled={togglingId === rule.id}
                                  onCheckedChange={() => handleToggle(rule)}
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {rule.enabled ? 'Disable rule' : 'Enable rule'}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEdit(rule)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit rule</TooltipContent>
                          </Tooltip>
                          <AlertDialog>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  >
                                    {deletingId === rule.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent>Delete rule</TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Rule</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete <strong>{rule.name}</strong>? This action
                                  cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(rule.id)}
                                  className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Rule Form Dialog */}
      {workspace && (
        <RuleFormDialog
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o);
            if (!o) setEditingRule(null);
          }}
          editingRule={editingRule}
          workspaceId={workspace.id}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Audit Log Tab
// ═══════════════════════════════════════════════════════════════

function AuditLogTab() {
  const auditLogs = useWorkspaceStore((s) => s.auditLogs);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch audit logs on mount
  useEffect(() => {
    async function fetchAuditLogs() {
      setLoading(true);
      try {
        const res = await fetch('/api/governance/audit?limit=50');
        const result: ApiResponse<AuditLog[]> = await res.json();
        if (result.success && result.data) {
          useWorkspaceStore.getState().setAuditLogs(result.data);
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    }
    fetchAuditLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    if (severityFilter === 'all') return auditLogs;
    return auditLogs.filter((l) => l.severity === severityFilter);
  }, [auditLogs, severityFilter]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM d, yyyy HH:mm:ss');
    } catch {
      return dateStr;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return '';
    }
  };

  return (
    <motion.div variants={itemVariants} className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">
                Filter by Severity
              </span>
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger size="sm" className="w-[150px]">
                <SelectValue placeholder="All Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                {(['info', 'warn', 'error', 'critical'] as AuditSeverity[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="capitalize">{s}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="text-[10px] h-5 ml-auto">
              {filteredLogs.length} events
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Audit Trail</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Comprehensive log of all governance events and actions
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Last {Math.min(filteredLogs.length, 50)} events
              </span>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Eye className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground font-medium">No audit events found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {severityFilter !== 'all'
                  ? 'No events match the selected severity filter'
                  : 'Audit events will appear here as rules are enforced'}
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="divide-y">
                {filteredLogs.map((log) => {
                  const SeverityIcon = AUDIT_SEVERITY_ICONS[log.severity] ?? Activity;
                  const isExpanded = expandedId === log.id;

                  return (
                    <div
                      key={log.id}
                      className={cn(
                        'transition-colors hover:bg-muted/40',
                        log.severity === 'critical' && 'bg-red-50/50 dark:bg-red-900/5'
                      )}
                    >
                      <button
                        onClick={() => toggleExpand(log.id)}
                        className="w-full flex items-start gap-3 p-3 px-4 text-left cursor-pointer group/row"
                      >
                        {/* Expand icon */}
                        <div className="flex items-center justify-center w-5 h-5 shrink-0 mt-0.5">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </div>

                        {/* Severity icon */}
                        <SeverityIcon
                          className={cn(
                            'w-4 h-4 mt-0.5 shrink-0',
                            AUDIT_SEVERITY_TEXT[log.severity] ?? 'text-muted-foreground'
                          )}
                        />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p
                              className={cn(
                                'text-sm font-medium truncate',
                                log.severity === 'critical'
                                  ? 'text-red-700 dark:text-red-300 font-semibold'
                                  : 'text-foreground'
                              )}
                            >
                              {log.action}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {log.resource && (
                              <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                                {log.resource}
                              </span>
                            )}
                            <span className="text-[11px] text-muted-foreground/50 tabular-nums">
                              {formatTimeAgo(log.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-2 shrink-0">
                          {log.approved !== null && (
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] h-5',
                                log.approved
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              )}
                            >
                              {log.approved ? 'Approved' : 'Rejected'}
                            </Badge>
                          )}
                          <Badge
                            variant="secondary"
                            className={cn(
                              'text-[10px] h-5 capitalize',
                              AUDIT_SEVERITY_COLORS[log.severity]
                            )}
                          >
                            {log.severity}
                          </Badge>
                        </div>
                      </button>

                      {/* Expanded details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-3 pl-16">
                              <div className="rounded-lg bg-muted/50 border p-3 space-y-2 text-xs">
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                  <div>
                                    <span className="text-muted-foreground font-medium">ID:</span>
                                    <span className="ml-1.5 text-foreground font-mono">
                                      {log.id.slice(0, 12)}...
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground font-medium">Timestamp:</span>
                                    <span className="ml-1.5 text-foreground tabular-nums">
                                      {formatTimestamp(log.createdAt)}
                                    </span>
                                  </div>
                                  {log.ruleId && (
                                    <div>
                                      <span className="text-muted-foreground font-medium">Rule ID:</span>
                                      <span className="ml-1.5 text-foreground font-mono">
                                        {log.ruleId.slice(0, 12)}...
                                      </span>
                                    </div>
                                  )}
                                  {log.agentId && (
                                    <div>
                                      <span className="text-muted-foreground font-medium">Agent ID:</span>
                                      <span className="ml-1.5 text-foreground font-mono">
                                        {log.agentId.slice(0, 12)}...
                                      </span>
                                    </div>
                                  )}
                                </div>
                                {log.details && (
                                  <div className="pt-1 border-t mt-2">
                                    <span className="text-muted-foreground font-medium block mb-1">
                                      Details:
                                    </span>
                                    <pre className="whitespace-pre-wrap text-foreground/80 font-mono bg-background rounded p-2 text-[11px] max-h-40 overflow-y-auto">
                                      {(() => {
                                        try {
                                          return JSON.stringify(JSON.parse(log.details), null, 2);
                                        } catch {
                                          return log.details;
                                        }
                                      })()}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Governance Panel
// ═══════════════════════════════════════════════════════════════

export function GovernancePanel() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const governanceLoading = useWorkspaceStore((s) => s.governanceLoading);
  const setGovernanceRules = useWorkspaceStore((s) => s.setGovernanceRules);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch governance rules on mount
  useEffect(() => {
    async function fetchRules() {
      try {
        const res = await fetch('/api/governance');
        const result: ApiResponse<GovernanceRule[]> = await res.json();
        if (result.success && result.data) {
          setGovernanceRules(result.data);
        } else {
          setGovernanceRules([]);
        }
      } catch {
        setGovernanceRules([]);
      }
    }
    fetchRules();
  }, [setGovernanceRules]);

  const handleAddRule = useCallback(() => {
    setDialogOpen(true);
  }, []);

  if (governanceLoading) {
    return <LoadingGovernance />;
  }

  return (
    <motion.div
      className="p-6 space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* ─── Header ─── */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/30">
            <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Governance</h1>
            <p className="text-xs text-muted-foreground">
              Rules, permissions, and audit compliance
            </p>
          </div>
        </div>
        <Button onClick={handleAddRule} size="sm">
          <Plus className="w-4 h-4" />
          Add Rule
        </Button>
      </motion.div>

      {/* ─── Tabs ─── */}
      <motion.div variants={itemVariants}>
        <Tabs defaultValue="rules" className="space-y-4">
          <TabsList>
            <TabsTrigger value="rules" className="gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Rules
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              Audit Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rules">
            <RulesTab onAddRule={handleAddRule} />
          </TabsContent>

          <TabsContent value="audit">
            <AuditLogTab />
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}
