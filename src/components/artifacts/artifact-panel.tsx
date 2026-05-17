'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileCode,
  Pencil,
  Check,
  X,
  Trash2,
  ShieldCheck,
  ExternalLink,
  Clock,
  FileText,
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useExecutionStore } from '@/lib/store/execution-store';
import type { Artifact } from '@/lib/store/execution-store';
import type { ArtifactType, ApiResponse } from '@/lib/types';
import { ARTIFACT_TYPE_COLORS } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────

function typeBadgeColor(type: string): string {
  return (ARTIFACT_TYPE_COLORS as Record<string, string>)[type] ?? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400';
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    code: 'Code',
    report: 'Report',
    plan: 'Plan',
    spec: 'Spec',
    analysis: 'Analysis',
    architecture: 'Architecture',
    general: 'General',
  };
  return labels[type] ?? type;
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    verified: 'Verified',
    approved: 'Approved',
    rejected: 'Rejected',
    archived: 'Archived',
  };
  return labels[status] ?? status;
}

function statusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    verified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    approved: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    archived: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };
  return colors[status] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
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

// ─── Artifact List Item ───────────────────────────────────────

function ArtifactListItem({
  artifact,
  isSelected,
  onClick,
}: {
  artifact: Artifact;
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
        <p className="text-xs font-medium text-foreground leading-snug truncate">
          {artifact.title}
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge
          variant="secondary"
          className={cn('text-[9px] h-4 px-1.5 font-medium', typeBadgeColor(artifact.type))}
        >
          {typeLabel(artifact.type)}
        </Badge>
        <Badge
          variant="secondary"
          className={cn('text-[9px] h-4 px-1.5 font-medium', statusColor(artifact.status))}
        >
          {statusLabel(artifact.status)}
        </Badge>
        <span className="text-[10px] text-muted-foreground ml-auto font-mono">
          v{artifact.version}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
        <Clock className="w-3 h-3" />
        {timeAgo(artifact.updatedAt)}
      </div>
    </motion.button>
  );
}

// ─── Artifact Viewer ──────────────────────────────────────────

function ArtifactViewer({
  artifact,
  onSave,
  onDelete,
  onVerify,
  saving,
}: {
  artifact: Artifact;
  onSave: (content: string) => void;
  onDelete: () => void;
  onVerify: () => void;
  saving: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(artifact.content);

  const isCode = artifact.type === 'code';

  const handleStartEdit = useCallback(() => {
    setEditContent(artifact.content);
    setIsEditing(true);
  }, [artifact.content]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditContent(artifact.content);
  }, [artifact.content]);

  const handleSave = useCallback(() => {
    onSave(editContent);
    setIsEditing(false);
  }, [editContent, onSave]);

  return (
    <motion.div
      key={artifact.id}
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-4 h-full"
    >
      {/* Viewer header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground">{artifact.title}</h3>
          <Badge
            variant="secondary"
            className={cn('text-[10px] h-5 px-1.5 font-medium', typeBadgeColor(artifact.type))}
          >
            {typeLabel(artifact.type)}
          </Badge>
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-mono">
            v{artifact.version}
          </Badge>
          <Badge
            variant="secondary"
            className={cn('text-[10px] h-5 px-1.5 font-medium', statusColor(artifact.status))}
          >
            {statusLabel(artifact.status)}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          {!isEditing && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px] px-2"
                onClick={handleStartEdit}
              >
                <Pencil className="w-3.5 h-3.5 mr-1" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px] px-2"
                onClick={onVerify}
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                Verify
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px] px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Artifact</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete &quot;{artifact.title}&quot;? This action cannot
                      be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {isEditing && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px] px-2 text-emerald-600 hover:text-emerald-700"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    Saving
                  </span>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Save
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px] px-2"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* Content area */}
      {isEditing ? (
        <div className="flex-1">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-[400px] font-mono text-sm resize-none"
            disabled={saving}
          />
        </div>
      ) : isCode && artifact.language ? (
        <div className="flex-1 rounded-lg border overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-mono">
              {artifact.language}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-mono ml-1">
              {artifact.title}
            </span>
          </div>
          <ScrollArea className="max-h-[500px]">
            <SyntaxHighlighter
              language={artifact.language}
              style={oneDark}
              customStyle={{
                margin: 0,
                borderRadius: 0,
                fontSize: '13px',
                lineHeight: '1.6',
              }}
              showLineNumbers
            >
              {artifact.content}
            </SyntaxHighlighter>
          </ScrollArea>
        </div>
      ) : (
        <div className="flex-1 rounded-lg border bg-card overflow-hidden">
          <ScrollArea className="max-h-[500px]">
            <div className="p-4">
              <pre className="text-sm font-mono text-foreground whitespace-pre-wrap leading-relaxed">
                {artifact.content}
              </pre>
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Metadata section */}
      <div className="space-y-2">
        <Separator className="opacity-50" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
          {artifact.executionId && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ExternalLink className="w-3 h-3" />
              <span>Execution: {artifact.executionId.slice(0, 8)}...</span>
            </div>
          )}
          {artifact.workflowId && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ExternalLink className="w-3 h-3" />
              <span>Workflow: {artifact.workflowId.slice(0, 8)}...</span>
            </div>
          )}
          {artifact.agentId && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ExternalLink className="w-3 h-3" />
              <span>Agent: {artifact.agentId.slice(0, 8)}...</span>
            </div>
          )}
          {artifact.verificationResult && (
            <div
              className={cn(
                'flex items-center gap-1.5 font-medium',
                artifact.verificationResult === 'pass'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              )}
            >
              <ShieldCheck className="w-3 h-3" />
              <span>Verified: {artifact.verificationResult}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Empty State ──────────────────────────────────────────────

function EmptyArtifactState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-muted/60 mb-4">
        <FileText className="w-7 h-7 text-muted-foreground/60" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">No Artifacts Yet</h3>
      <p className="text-xs text-muted-foreground max-w-xs">
        Run an execution to generate artifacts. Artifacts are created automatically from
        execution responses.
      </p>
    </div>
  );
}

// ─── Main Artifact Panel ──────────────────────────────────────

export function ArtifactPanel() {
  const {
    artifacts,
    artifactsLoading,
    setArtifacts,
    updateArtifact,
    selectedArtifactId,
    setSelectedArtifactId,
  } = useExecutionStore();

  const [saving, setSaving] = useState(false);

  const selectedArtifact = artifacts.find((a) => a.id === selectedArtifactId) ?? null;

  // Fetch artifacts on mount
  useEffect(() => {
    async function fetchArtifacts() {
      try {
        const res = await fetch('/api/artifacts');
        if (res.ok) {
          const json: ApiResponse<Artifact[]> = await res.json();
          if (json.success && json.data) {
            setArtifacts(json.data);
          }
        }
      } catch (err) {
        console.warn('[Nexus OS] Failed to fetch artifacts:', err);
      }
    }
    fetchArtifacts();
  }, [setArtifacts]);

  // Save artifact
  const handleSave = useCallback(
    async (content: string) => {
      if (!selectedArtifactId) return;
      setSaving(true);
      try {
        const res = await fetch(`/api/artifacts/${selectedArtifactId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        if (res.ok) {
          const json: ApiResponse<Artifact> = await res.json();
          if (json.success && json.data) {
            updateArtifact(selectedArtifactId, json.data);
          }
        }
      } catch (err) {
        console.warn('[Nexus OS] Failed to save artifact:', err);
      } finally {
        setSaving(false);
      }
    },
    [selectedArtifactId, updateArtifact]
  );

  // Delete artifact
  const handleDelete = useCallback(async () => {
    if (!selectedArtifactId) return;
    try {
      await fetch(`/api/artifacts/${selectedArtifactId}`, { method: 'DELETE' });
      setSelectedArtifactId(null);
    } catch (err) {
      console.warn('[Nexus OS] Failed to delete artifact:', err);
    }
  }, [selectedArtifactId, setSelectedArtifactId]);

  // Verify artifact
  const handleVerify = useCallback(async () => {
    if (!selectedArtifactId) return;
    try {
      const res = await fetch(`/api/artifacts/${selectedArtifactId}/verify`, {
        method: 'POST',
      });
      if (res.ok) {
        const json: ApiResponse<Artifact> = await res.json();
        if (json.success && json.data) {
          updateArtifact(selectedArtifactId, json.data);
        }
      }
    } catch (err) {
      console.warn('[Nexus OS] Failed to verify artifact:', err);
    }
  }, [selectedArtifactId, updateArtifact]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
          <FileCode className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">Artifacts</h1>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono">
              {artifacts.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Generated artifacts from runtime executions
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left — Artifact List */}
        <div className="lg:col-span-4">
          <Card className="border-border/50">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold">All Artifacts</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {artifactsLoading ? (
                <div className="space-y-2 py-2">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : artifacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-xs text-muted-foreground">No artifacts found</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[600px]">
                  <div className="space-y-2 pr-1">
                    {artifacts.map((artifact) => (
                      <ArtifactListItem
                        key={artifact.id}
                        artifact={artifact}
                        isSelected={selectedArtifactId === artifact.id}
                        onClick={() => setSelectedArtifactId(artifact.id)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right — Artifact Viewer */}
        <div className="lg:col-span-8">
          <Card className="border-border/50 min-h-[500px]">
            <CardContent className="p-4 h-full">
              <AnimatePresence mode="wait">
                {selectedArtifact ? (
                  <ArtifactViewer
                    key={selectedArtifact.id}
                    artifact={selectedArtifact}
                    onSave={handleSave}
                    onDelete={handleDelete}
                    onVerify={handleVerify}
                    saving={saving}
                  />
                ) : (
                  <EmptyArtifactState />
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
