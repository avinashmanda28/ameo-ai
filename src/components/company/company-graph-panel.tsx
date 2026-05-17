'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch,
  Plus,
  ChevronRight,
  Building2,
  FolderKanban,
  Package,
  Server,
  Users,
  User,
  Trash2,
  Loader2,
  Search,
  TreePine,
  Circle,
  X,
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { toast } from 'sonner';
import { useWorkspaceStore } from '@/lib/store/workspace-store';
import type {
  Company,
  CompanyType,
  CompanyStatus,
  ApiResponse,
} from '@/lib/types';
import {
  COMPANY_TYPE_ICONS,
  COMPANY_TYPE_COLORS,
} from '@/lib/types';
import { cn } from '@/lib/utils';

// ─── Icon Resolution ────────────────────────────────────────────

const ICON_MAP: Record<CompanyType, React.ComponentType<{ className?: string }>> = {
  company: Building2,
  project: FolderKanban,
  product: Package,
  service: Server,
  team: Users,
  member: User,
};

const TYPE_BADGE_COLORS: Record<CompanyType, string> = {
  company: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  project: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  product: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  service: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  team: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  member: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_DOT: Record<CompanyStatus, string> = {
  active: 'bg-emerald-500',
  inactive: 'bg-zinc-400',
  archived: 'bg-amber-500',
};

const TYPE_OPTIONS: { value: CompanyType; label: string }[] = [
  { value: 'company', label: 'Company' },
  { value: 'project', label: 'Project' },
  { value: 'product', label: 'Product' },
  { value: 'service', label: 'Service' },
  { value: 'team', label: 'Team' },
  { value: 'member', label: 'Member' },
];

// ─── Animation Variants ────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.4, 0.25, 1] as const },
  },
};

const expandVariants = {
  hidden: { opacity: 0, height: 0, overflow: 'hidden' },
  visible: {
    opacity: 1,
    height: 'auto',
    overflow: 'hidden',
    transition: { duration: 0.25, ease: [0.25, 0.4, 0.25, 1] as const },
  },
  exit: {
    opacity: 0,
    height: 0,
    overflow: 'hidden',
    transition: { duration: 0.2, ease: [0.25, 0.4, 0.25, 1] as const },
  },
};

// ─── Helpers ────────────────────────────────────────────────────

function countDescendants(companyId: string, allCompanies: Company[]): number {
  const children = allCompanies.filter((c) => c.parentId === companyId);
  return children.reduce((acc, child) => acc + 1 + countDescendants(child.id, allCompanies), 0);
}

// ─── Tree Node Component ───────────────────────────────────────

interface TreeNodeProps {
  company: Company;
  allCompanies: Company[];
  level: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}

function TreeNode({
  company,
  allCompanies,
  level,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
}: TreeNodeProps) {
  const Icon = ICON_MAP[company.type] ?? Circle;
  const children = allCompanies.filter((c) => c.parentId === company.id);
  const hasChildren = children.length > 0;
  const isSelected = selectedId === company.id;
  const isExpanded = expandedIds.has(company.id);

  return (
    <div>
      <motion.div
        variants={itemVariants}
        className={cn(
          'group flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg cursor-pointer transition-colors',
          'hover:bg-muted/60',
          isSelected && 'bg-accent/80 hover:bg-accent'
        )}
        style={{ paddingLeft: level * 24 }}
        onClick={() => onSelect(company.id)}
      >
        {/* Expand toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(company.id);
          }}
          className={cn(
            'flex items-center justify-center w-4 h-4 shrink-0 transition-transform duration-200',
            hasChildren ? 'opacity-100 cursor-pointer' : 'opacity-0 pointer-events-none',
            isExpanded && 'rotate-90'
          )}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        </button>

        {/* Status dot */}
        <span
          className={cn(
            'w-2 h-2 rounded-full shrink-0',
            STATUS_DOT[company.status] ?? 'bg-zinc-300'
          )}
        />

        {/* Type icon */}
        <Icon
          className={cn(
            'w-4 h-4 shrink-0',
            COMPANY_TYPE_COLORS[company.type] ?? 'text-muted-foreground'
          )}
        />

        {/* Name */}
        <span className={cn(
          'text-sm font-medium truncate flex-1',
          company.status === 'active' ? 'text-foreground' : 'text-muted-foreground'
        )}>
          {company.name}
        </span>

        {/* Type badge */}
        <Badge
          variant="secondary"
          className={cn(
            'text-[10px] h-5 px-1.5 shrink-0 capitalize',
            TYPE_BADGE_COLORS[company.type]
          )}
        >
          {company.type}
        </Badge>

        {/* Children count */}
        {hasChildren && (
          <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0">
            {children.length}
          </span>
        )}
      </motion.div>

      {/* Children */}
      <AnimatePresence initial={false}>
        {hasChildren && isExpanded && (
          <motion.div
            variants={expandVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {children.map((child) => (
              <TreeNode
                key={child.id}
                company={child}
                allCompanies={allCompanies}
                level={level + 1}
                selectedId={selectedId}
                expandedIds={expandedIds}
                onSelect={onSelect}
                onToggle={onToggle}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Entity Detail Panel ───────────────────────────────────────

interface EntityDetailProps {
  company: Company;
  allCompanies: Company[];
  onClose: () => void;
  onUpdate: (id: string, data: Partial<Company>) => void;
  onDelete: (id: string) => void;
}

function EntityDetail({ company, allCompanies, onClose, onUpdate, onDelete }: EntityDetailProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(company.name);
  const [metadataValue, setMetadataValue] = useState(
    company.metadata && company.metadata !== 'null' ? company.metadata : '{}'
  );
  const [saving, setSaving] = useState(false);
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  const Icon = ICON_MAP[company.type] ?? Circle;
  const children = allCompanies.filter((c) => c.parentId === company.id);
  const parent = allCompanies.find((c) => c.id === company.parentId);
  const descendantCount = countDescendants(company.id, allCompanies);

  // Reset local state when selected entity changes
  useEffect(() => {
    setNameValue(company.name);
    setMetadataValue(company.metadata && company.metadata !== 'null' ? company.metadata : '{}');
    setEditingName(false);
    setMetadataError(null);
  }, [company.id, company.name, company.metadata]);

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === company.name) {
      setNameValue(company.name);
      setEditingName(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: company.id, name: trimmed }),
      });
      const json: ApiResponse<Company> = await res.json();
      if (json.success && json.data) {
        onUpdate(company.id, { name: trimmed });
        toast.success('Name updated');
      } else {
        toast.error(json.error ?? 'Failed to update name');
        setNameValue(company.name);
      }
    } catch {
      toast.error('Network error');
      setNameValue(company.name);
    } finally {
      setSaving(false);
      setEditingName(false);
    }
  };

  const handleToggleStatus = async (checked: boolean) => {
    const newStatus: CompanyStatus = checked ? 'active' : 'inactive';
    try {
      const res = await fetch('/api/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: company.id, status: newStatus }),
      });
      const json: ApiResponse<Company> = await res.json();
      if (json.success && json.data) {
        onUpdate(company.id, { status: newStatus });
        toast.success(`Status set to ${newStatus}`);
      } else {
        toast.error(json.error ?? 'Failed to update status');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const handleSaveMetadata = async () => {
    try {
      JSON.parse(metadataValue);
      setMetadataError(null);
    } catch {
      setMetadataError('Invalid JSON');
      return;
    }
    setMetadataSaving(true);
    try {
      const res = await fetch('/api/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: company.id, metadata: metadataValue }),
      });
      const json: ApiResponse<Company> = await res.json();
      if (json.success && json.data) {
        onUpdate(company.id, { metadata: metadataValue });
        toast.success('Metadata updated');
      } else {
        toast.error(json.error ?? 'Failed to update metadata');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setMetadataSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="w-full lg:w-80 xl:w-96 shrink-0"
    >
      <Card className="h-full border-l-0 rounded-l-none lg:rounded-l-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className={cn('w-4 h-4', COMPANY_TYPE_COLORS[company.type])} />
              <CardTitle className="text-sm font-semibold">Entity Details</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 lg:hidden"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4 pb-6 space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Name</Label>
            {editingName ? (
              <div className="flex gap-2">
                <Input
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') {
                      setNameValue(company.name);
                      setEditingName(false);
                    }
                  }}
                  className="h-8 text-sm"
                  autoFocus
                  disabled={saving}
                />
                <Button
                  size="sm"
                  className="h-8 px-3"
                  onClick={handleSaveName}
                  disabled={saving || !nameValue.trim()}
                >
                  {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  Save
                </Button>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 group/name cursor-pointer"
                onClick={() => setEditingName(true)}
              >
                <span className="text-sm font-medium text-foreground">{company.name}</span>
                <span className="text-[10px] text-muted-foreground opacity-0 group-hover/name:opacity-100 transition-opacity">
                  edit
                </span>
              </div>
            )}
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Type</Label>
            <Badge className={cn('capitalize', TYPE_BADGE_COLORS[company.type])}>
              {company.type}
            </Badge>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Status</Label>
            <div className="flex items-center gap-3">
              <Switch
                checked={company.status === 'active'}
                onCheckedChange={handleToggleStatus}
              />
              <span className={cn(
                'text-xs font-medium capitalize',
                company.status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
              )}>
                {company.status}
              </span>
            </div>
          </div>

          <Separator />

          {/* Parent */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Parent</Label>
            {parent ? (
              <div className="flex items-center gap-2">
                {(() => {
                  const PIcon = ICON_MAP[parent.type] ?? Circle;
                  return <PIcon className={cn('w-3.5 h-3.5', COMPANY_TYPE_COLORS[parent.type])} />;
                })()}
                <span className="text-sm text-foreground">{parent.name}</span>
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 capitalize">
                  {parent.type}
                </Badge>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground/60">Root entity</span>
            )}
          </div>

          {/* Children count */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Children</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tabular-nums">{children.length}</span>
              <span className="text-xs text-muted-foreground">
                direct{descendantCount > children.length && ` (${descendantCount} total)`}
              </span>
            </div>
          </div>

          <Separator />

          {/* Metadata */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">Metadata (JSON)</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={handleSaveMetadata}
                disabled={metadataSaving}
              >
                {metadataSaving ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : null}
                Save
              </Button>
            </div>
            <Textarea
              value={metadataValue}
              onChange={(e) => {
                setMetadataValue(e.target.value);
                setMetadataError(null);
              }}
              onBlur={() => {
                try {
                  JSON.parse(metadataValue);
                  setMetadataError(null);
                } catch {
                  setMetadataError('Invalid JSON');
                }
              }}
              className="min-h-[120px] text-xs font-mono resize-none"
              placeholder="{}"
            />
            {metadataError && (
              <p className="text-[10px] text-red-500">{metadataError}</p>
            )}
          </div>

          <Separator />

          {/* Created */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Created</Label>
            <p className="text-xs text-muted-foreground">
              {new Date(company.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          {/* Delete */}
          <div className="pt-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900/40 dark:hover:bg-red-950/40 dark:text-red-400 dark:hover:text-red-300"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Delete Entity
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete &quot;{company.name}&quot;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove this entity.{' '}
                    {descendantCount > 0 && (
                      <span className="font-medium text-destructive">
                        It has {descendantCount} descendant{descendantCount > 1 ? 's' : ''} that will also be affected.
                      </span>
                    )}
                    {' '}This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/company?id=${company.id}`, {
                          method: 'DELETE',
                        });
                        const json = await res.json();
                        if (json.success) {
                          onDelete(company.id);
                          toast.success('Entity deleted');
                        } else {
                          toast.error(json.error ?? 'Failed to delete');
                        }
                      } catch {
                        toast.error('Network error');
                      }
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Add Entity Dialog ──────────────────────────────────────────

interface AddEntityDialogProps {
  allCompanies: Company[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (company: Company) => void;
}

function AddEntityDialog({ allCompanies, open, onOpenChange, onCreated }: AddEntityDialogProps) {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const [name, setName] = useState('');
  const [type, setType] = useState<CompanyType>('company');
  const [parentId, setParentId] = useState<string>('none');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setName('');
    setType('company');
    setParentId('none');
  }, []);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!workspace) {
      toast.error('No workspace selected');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          name: name.trim(),
          type,
          ...(parentId !== 'none' ? { parentId } : { parentId: null }),
          status: 'active',
        }),
      });
      const json: ApiResponse<Company> = await res.json();
      if (json.success && json.data) {
        onCreated(json.data);
        toast.success(`Created ${type}: ${name.trim()}`);
        resetForm();
        onOpenChange(false);
      } else {
        toast.error(json.error ?? 'Failed to create entity');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Entity
          </DialogTitle>
          <DialogDescription>
            Create a new node in your company graph hierarchy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="entity-name">Name</Label>
            <Input
              id="entity-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter entity name"
              className="h-9"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="entity-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as CompanyType)}>
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="capitalize">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Parent */}
          <div className="space-y-2">
            <Label htmlFor="entity-parent">Parent (optional)</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="Select parent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">None (root entity)</span>
                </SelectItem>
                {allCompanies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      {(() => {
                        const CIcon = ICON_MAP[c.type] ?? Circle;
                        return <CIcon className={cn('w-3.5 h-3.5', COMPANY_TYPE_COLORS[c.type])} />;
                      })()}
                      <span className="truncate max-w-48">{c.name}</span>
                      <span className="text-[10px] text-muted-foreground capitalize">{c.type}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !name.trim()}>
            {submitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Loading Skeleton ───────────────────────────────────────────

function LoadingGraph() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 rounded-lg" style={{ marginLeft: i % 2 === 1 ? 24 : 0 }} />
        ))}
      </div>
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-muted/60 mb-4">
        <TreePine className="w-7 h-7 text-muted-foreground/60" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">No entities yet</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        Start building your company graph by adding companies, projects, teams, and more.
      </p>
      <Button onClick={onAdd} size="sm">
        <Plus className="w-4 h-4 mr-1.5" />
        Add First Entity
      </Button>
    </motion.div>
  );
}

// ─── Company Graph Panel ────────────────────────────────────────

export function CompanyGraphPanel() {
  const {
    workspace,
    companies,
    companiesLoading,
    setCompanies,
    addCompany,
    updateCompany,
    removeCompany,
  } = useWorkspaceStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const initializedRef = useRef(false);

  // ── Fetch on mount ──
  useEffect(() => {
    if (!initializedRef.current && companies.length === 0 && !companiesLoading) {
      initializedRef.current = true;
      const load = async () => {
        try {
          const res = await fetch('/api/company');
          const json: ApiResponse<Company[]> = await res.json();
          if (json.success && json.data) {
            setCompanies(json.data);
            // Auto-expand root nodes
            const roots = json.data.filter((c) => c.parentId === null);
            setExpandedIds(new Set(roots.map((r) => r.id)));
          }
        } catch {
          toast.error('Failed to load company data');
        }
      };
      load();
    } else if (!initializedRef.current) {
      initializedRef.current = true;
    }
  }, [companies.length, companiesLoading, setCompanies]);

  // ── Derive effective expanded IDs ──
  // If user hasn't expanded anything yet and companies exist, auto-expand roots
  const effectiveExpandedIds = useMemo(() => {
    // When searching, expand all
    if (searchQuery.trim()) {
      return new Set(companies.map((c) => c.id));
    }
    // If nothing manually expanded yet and companies loaded, auto-expand roots
    if (expandedIds.size === 0 && companies.length > 0) {
      return new Set(companies.filter((c) => c.parentId === null).map((c) => c.id));
    }
    return expandedIds;
  }, [expandedIds, searchQuery, companies]);

  // ── Tree construction ──
  const rootNodes = useMemo(() => {
    let nodes = companies.filter((c) => c.parentId === null);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchingIds = new Set(
        companies
          .filter((c) => c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q))
          .map((c) => c.id)
      );
      // Include ancestors of matching nodes
      const ancestorIds = new Set<string>();
      const findAncestors = (id: string) => {
        const parent = companies.find((c) => c.id === id);
        if (parent?.parentId) {
          ancestorIds.add(parent.parentId);
          findAncestors(parent.parentId);
        }
      };
      matchingIds.forEach((id) => findAncestors(id));
      matchingIds.forEach((id) => ancestorIds.add(id));

      nodes = nodes.filter((c) => ancestorIds.has(c.id));
    }
    return nodes;
  }, [companies, searchQuery]);

  // ── Handlers ──
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const handleCreated = useCallback(
    (company: Company) => {
      addCompany(company);
      // Expand parent if applicable
      if (company.parentId) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          next.add(company.parentId!);
          return next;
        });
      }
    },
    [addCompany]
  );

  const handleUpdate = useCallback(
    (id: string, data: Partial<Company>) => {
      updateCompany(id, data);
    },
    [updateCompany]
  );

  const handleDelete = useCallback(
    (id: string) => {
      removeCompany(id);
      if (selectedId === id) {
        setSelectedId(null);
      }
    },
    [removeCompany, selectedId]
  );

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedId) ?? null,
    [companies, selectedId]
  );

  // ── Render ──
  if (companiesLoading && companies.length === 0) {
    return <LoadingGraph />;
  }

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* ── Tree Side ── */}
      <motion.div
        className="flex-1 min-w-0 p-6 space-y-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <GitBranch className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">Company Graph</h1>
              <p className="text-xs text-muted-foreground">
                {companies.length} {companies.length === 1 ? 'entity' : 'entities'}
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Entity
          </Button>
        </motion.div>

        {/* Search */}
        {companies.length > 0 && (
          <motion.div variants={itemVariants}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search entities..."
                className="h-9 pl-9 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Tree */}
        {companies.length === 0 ? (
          <EmptyState onAdd={() => setDialogOpen(true)} />
        ) : (
          <motion.div variants={itemVariants}>
            <Card>
              <ScrollArea className="max-h-[calc(100vh-300px)] min-h-[200px]">
                <div className="p-3">
                  {rootNodes.length === 0 && searchQuery.trim() ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Search className="w-6 h-6 text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">No matching entities</p>
                    </div>
                  ) : (
                    rootNodes.map((node) => (
                      <TreeNode
                        key={node.id}
                        company={node}
                        allCompanies={companies}
                        level={0}
                        selectedId={selectedId}
                        expandedIds={effectiveExpandedIds}
                        onSelect={handleSelect}
                        onToggle={handleToggleExpand}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </Card>
          </motion.div>
        )}
      </motion.div>

      {/* ── Detail Side ── */}
      <AnimatePresence>
        {selectedCompany && (
          <EntityDetail
            company={selectedCompany}
            allCompanies={companies}
            onClose={() => setSelectedId(null)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>

      {/* ── Add Entity Dialog ── */}
      <AddEntityDialog
        allCompanies={companies}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}
