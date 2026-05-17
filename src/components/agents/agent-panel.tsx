'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Plus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Clock,
  ChevronRight,
  X,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Play,
  Pause,
  Zap,
  Eye,
  Trash2,
  Activity,
} from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/workspace-store';
import {
  type Agent,
  type AgentType,
  type AgentStatus,
  type AgentLog,
  type LogLevel,
  AGENT_TYPE_LABELS,
  AGENT_TYPE_DESCRIPTIONS,
  AGENT_TYPE_COLORS,
  AGENT_STATUS_COLORS,
} from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

// ─── Log Level Configs ─────────────────────────────────────────

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  debug: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  info: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  warn: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const LOG_LEVEL_ICONS: Record<LogLevel, React.ComponentType<{ className?: string }>> = {
  debug: Info,
  info: Info,
  warn: AlertTriangle,
  error: XCircle,
};

// ─── Agent Type Icon Map ──────────────────────────────────────

const AGENT_TYPE_ICONS: Record<AgentType, React.ComponentType<{ className?: string }>> = {
  head: Activity,
  builder: Zap,
  qa: CheckCircle2,
  verification: ShieldCheck,
  terminal: Eye,
  governance: ShieldAlert,
};

// ─── Status Flow ──────────────────────────────────────────────

const STATUS_FLOW: AgentStatus[] = ['idle', 'active', 'busy', 'suspended'];

const STATUS_FLOW_LABELS: Record<AgentStatus, string> = {
  idle: 'Set Idle',
  active: 'Set Active',
  busy: 'Set Busy',
  error: 'Error',
  suspended: 'Suspend',
};

const STATUS_FLOW_ICONS: Record<AgentStatus, React.ComponentType<{ className?: string }>> = {
  idle: Pause,
  active: Play,
  busy: Zap,
  error: XCircle,
  suspended: Pause,
};

// ─── Animations ───────────────────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.35, ease: 'easeOut' },
  }),
};

const detailVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
};

// ─── Utility ──────────────────────────────────────────────────

function parseCapabilities(caps: string | null): string[] {
  if (!caps) return [];
  try {
    const parsed = JSON.parse(caps);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // fallback: treat as comma-separated
  }
  return caps.split(',').map((s) => s.trim()).filter(Boolean);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ─── Register Agent Dialog ────────────────────────────────────

function RegisterAgentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (agent: Agent) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AgentType>('head');
  const [description, setDescription] = useState('');
  const [capabilities, setCapabilities] = useState('["task-distribution", "coordination"]');
  const [submitting, setSubmitting] = useState(false);

  const workspaceId = useWorkspaceStore((s) => s.workspace?.id);

  const reset = useCallback(() => {
    setName('');
    setType('head');
    setDescription('');
    setCapabilities('["task-distribution", "coordination"]');
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!workspaceId || !name.trim() || !type) return;

      setSubmitting(true);
      try {
        const res = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            name: name.trim(),
            type,
            description: description.trim() || undefined,
            capabilities: capabilities.trim() || undefined,
          }),
        });

        const json = await res.json();
        if (!json.success) {
          toast.error('Failed to register agent', { description: json.error });
          return;
        }

        toast.success(`Agent "${name}" registered successfully`);
        onCreated(json.data as Agent);
        reset();
        onOpenChange(false);
      } catch {
        toast.error('Failed to register agent', { description: 'Network error' });
      } finally {
        setSubmitting(false);
      }
    },
    [workspaceId, name, type, description, capabilities, onCreated, onOpenChange, reset]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-violet-500" />
            Register New Agent
          </DialogTitle>
          <DialogDescription>
            Add a new agent to the system fleet. Each agent fulfills a specialized operational role.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent-name">Agent Name</Label>
            <Input
              id="agent-name"
              placeholder="e.g. Alpha Builder"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-type">Agent Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as AgentType)}>
              <SelectTrigger className="w-full" id="agent-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(AGENT_TYPE_LABELS) as AgentType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {AGENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {type && AGENT_TYPE_DESCRIPTIONS[type]}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-desc">Description</Label>
            <Textarea
              id="agent-desc"
              placeholder="Optional description of this agent's role..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-caps">Capabilities (JSON array)</Label>
            <Textarea
              id="agent-caps"
              placeholder='["capability-1", "capability-2"]'
              value={capabilities}
              onChange={(e) => setCapabilities(e.target.value)}
              rows={2}
              className="font-mono text-xs"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Register Agent
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Agent Card ───────────────────────────────────────────────

function AgentCard({
  agent,
  index,
  isSelected,
  onSelect,
}: {
  agent: Agent;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const capabilities = parseCapabilities(agent.capabilities);
  const description = agent.description || AGENT_TYPE_DESCRIPTIONS[agent.type];
  const TypeIcon = AGENT_TYPE_ICONS[agent.type];
  const showPulse = agent.status === 'active' || agent.status === 'busy';

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="cursor-pointer"
      onClick={onSelect}
    >
      <Card
        className={`relative transition-all duration-200 ${
          isSelected
            ? 'border-violet-500/60 shadow-lg shadow-violet-500/5 ring-1 ring-violet-500/20'
            : 'hover:border-border/80 hover:shadow-md'
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
                  agent.type === 'verification'
                    ? 'bg-amber-100 dark:bg-amber-900/30'
                    : 'bg-muted'
                }`}
              >
                <TypeIcon className="h-4.5 w-4.5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base font-semibold truncate leading-tight">
                  {agent.name}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {AGENT_TYPE_LABELS[agent.type]}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Badge variant="secondary" className={AGENT_TYPE_COLORS[agent.type]}>
                {agent.type}
              </Badge>
              <Badge variant="secondary" className={AGENT_STATUS_COLORS[agent.status]}>
                {showPulse && (
                  <motion.span
                    className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1"
                    animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
                {agent.status}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {description}
          </p>

          {capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {capabilities.slice(0, 3).map((cap) => (
                <Badge
                  key={cap}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 font-normal"
                >
                  {cap}
                </Badge>
              ))}
              {capabilities.length > 3 && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground"
                >
                  +{capabilities.length - 3}
                </Badge>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
            <Clock className="h-3 w-3" />
            <span>{formatDate(agent.createdAt)}</span>
          </div>

          {agent.type === 'verification' && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium pt-0.5">
              <ShieldCheck className="h-3 w-3" />
              <span>Verification Authority</span>
            </div>
          )}
        </CardContent>

        {isSelected && (
          <motion.div
            className="absolute top-0 left-0 right-0 h-0.5 bg-violet-500 rounded-t-lg"
            layoutId="agent-card-indicator"
            transition={{ duration: 0.3 }}
          />
        )}
      </Card>
    </motion.div>
  );
}

// ─── Agent Logs Section ───────────────────────────────────────

function AgentLogsSection({ agent }: { agent: Agent }) {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logLevel, setLogLevel] = useState<string>('info');
  const [logMessage, setLogMessage] = useState('');
  const [logSubmitting, setLogSubmitting] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/logs?limit=50`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.data || []);
      }
    } catch {
      // silent fail
    } finally {
      setLogsLoading(false);
    }
  }, [agent.id]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleAddLog = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!logMessage.trim()) return;

      setLogSubmitting(true);
      try {
        const res = await fetch(`/api/agents/${agent.id}/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level: logLevel, message: logMessage.trim() }),
        });

        const json = await res.json();
        if (!json.success) {
          toast.error('Failed to add log', { description: json.error });
          return;
        }

        toast.success('Log entry added');
        setLogMessage('');
        fetchLogs();
      } catch {
        toast.error('Failed to add log');
      } finally {
        setLogSubmitting(false);
      }
    },
    [agent.id, logLevel, logMessage, fetchLogs]
  );

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        Agent Logs
      </h4>

      {/* Add log form */}
      <form onSubmit={handleAddLog} className="flex gap-2">
        <Select value={logLevel} onValueChange={setLogLevel}>
          <SelectTrigger className="w-[100px]" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(['debug', 'info', 'warn', 'error'] as LogLevel[]).map((lvl) => (
              <SelectItem key={lvl} value={lvl}>
                <span className="capitalize">{lvl}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Log message..."
          value={logMessage}
          onChange={(e) => setLogMessage(e.target.value)}
          className="flex-1 h-8 text-sm"
        />
        <Button type="submit" size="sm" disabled={logSubmitting || !logMessage.trim()}>
          {logSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </Button>
      </form>

      {/* Logs list */}
      <ScrollArea className="h-64 rounded-md border">
        <div className="p-2 space-y-1">
          {logsLoading ? (
            <div className="space-y-2 p-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              No log entries yet
            </div>
          ) : (
            logs.map((log) => {
              const LevelIcon = LOG_LEVEL_ICONS[log.level] || Info;
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors text-sm"
                >
                  <Badge
                    variant="secondary"
                    className={`shrink-0 text-[10px] px-1.5 py-0 mt-0.5 ${LOG_LEVEL_COLORS[log.level]}`}
                  >
                    <LevelIcon className="h-2.5 w-2.5 mr-0.5" />
                    {log.level}
                  </Badge>
                  <span className="flex-1 text-foreground/90 break-all leading-relaxed">
                    {log.message}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums mt-0.5">
                    {formatTime(log.createdAt)}
                  </span>
                </motion.div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Verification Authority Section ────────────────────────────

function VerificationAuthority() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-lg border-2 border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/10 p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30">
          <ShieldAlert className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Verification Authority
          </h4>
          <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 font-medium uppercase tracking-wider">
            Elevated privileges active
          </p>
        </div>
      </div>

      <Separator className="bg-amber-500/20" />

      <div className="space-y-2">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          This agent has the authority to:
        </p>
        <ul className="space-y-1.5">
          {[
            { icon: ShieldCheck, text: 'Stop fake completions and reject fabricated results' },
            { icon: XCircle, text: 'Reject broken workflows and malformed implementations' },
            { icon: ShieldAlert, text: 'Block hallucinated implementations and false outputs' },
          ].map((item) => (
            <li key={item.text} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300/90">
              <item.icon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400 text-[10px]">
          <ShieldCheck className="h-3 w-3 mr-1" />
          AUTHORIZED
        </Badge>
      </div>
    </motion.div>
  );
}

// ─── Agent Detail Panel ───────────────────────────────────────

function AgentDetailPanel({
  agent,
  onBack,
  onRefresh,
}: {
  agent: Agent;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const { updateAgent, removeAgent, workspace } = useWorkspaceStore();
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const capabilities = parseCapabilities(agent.capabilities);
  const description = agent.description || AGENT_TYPE_DESCRIPTIONS[agent.type];
  const TypeIcon = AGENT_TYPE_ICONS[agent.type];
  const isVerification = agent.type === 'verification';

  const handleStatusChange = useCallback(
    async (newStatus: AgentStatus) => {
      if (newStatus === agent.status) return;

      setStatusUpdating(true);
      try {
        const res = await fetch('/api/agents', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: agent.id, status: newStatus }),
        });

        const json = await res.json();
        if (!json.success) {
          toast.error('Failed to update status', { description: json.error });
          return;
        }

        toast.success(`Agent status updated to ${newStatus}`);
        updateAgent(agent.id, { status: newStatus });
      } catch {
        toast.error('Failed to update status');
      } finally {
        setStatusUpdating(false);
      }
    },
    [agent.id, agent.status, updateAgent]
  );

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/agents?id=${agent.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) {
        toast.error('Failed to delete agent', { description: json.error });
        return;
      }
      toast.success(`Agent "${agent.name}" deleted`);
      removeAgent(agent.id);
      onBack();
    } catch {
      toast.error('Failed to delete agent');
    } finally {
      setDeleting(false);
    }
  }, [agent.id, agent.name, removeAgent, onBack]);

  return (
    <motion.div
      variants={detailVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-6"
    >
      {/* Back button + header */}
      <div className="space-y-1">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          Back to Agents
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center justify-center w-12 h-12 rounded-xl ${
                isVerification
                  ? 'bg-amber-100 dark:bg-amber-900/30'
                  : 'bg-muted'
              }`}
            >
              <TypeIcon
                className={`h-6 w-6 ${
                  isVerification
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-muted-foreground'
                }`}
              />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{agent.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className={AGENT_TYPE_COLORS[agent.type]}>
                  {AGENT_TYPE_LABELS[agent.type]}
                </Badge>
                <Badge variant="secondary" className={AGENT_STATUS_COLORS[agent.status]}>
                  {agent.status}
                </Badge>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Verification Authority */}
      {isVerification && <VerificationAuthority />}

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono text-xs text-foreground/70 truncate max-w-[200px]">
                {agent.id.slice(0, 12)}...
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium">{AGENT_TYPE_LABELS[agent.type]}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="secondary" className={AGENT_STATUS_COLORS[agent.status]}>
                {agent.status}
              </Badge>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{formatDate(agent.createdAt)}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Updated</span>
              <span>{formatDate(agent.updatedAt)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Description + Capabilities */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
              <p className="text-sm text-foreground/90 leading-relaxed">{description}</p>
            </div>
            {capabilities.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Capabilities</p>
                <div className="flex flex-wrap gap-1.5">
                  {capabilities.map((cap) => (
                    <Badge
                      key={cap}
                      variant="outline"
                      className="text-xs px-2 py-0.5 font-normal"
                    >
                      {cap}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Status Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {STATUS_FLOW.map((s) => {
              const StatusIcon = STATUS_FLOW_ICONS[s];
              const isActive = agent.status === s;
              return (
                <Button
                  key={s}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5"
                  disabled={statusUpdating || isActive}
                  onClick={() => handleStatusChange(s)}
                >
                  <StatusIcon className="h-3.5 w-3.5" />
                  {STATUS_FLOW_LABELS[s]}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Agent Logs */}
      <Card>
        <CardContent className="pt-6">
          <AgentLogsSection agent={agent} />
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── System Agent Types Info ──────────────────────────────────

function SystemAgentTypesInfo({
  registeredTypes,
}: {
  registeredTypes: Set<AgentType>;
}) {
  const allTypes: AgentType[] = ['head', 'builder', 'qa', 'verification', 'terminal', 'governance'];

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Required System Agents
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {registeredTypes.size}/{allTypes.length} registered
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {allTypes.map((type) => {
            const TypeIcon = AGENT_TYPE_ICONS[type];
            const isRegistered = registeredTypes.has(type);
            return (
              <div
                key={type}
                className={`flex items-start gap-2.5 p-3 rounded-lg border transition-colors ${
                  isRegistered
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-500/20'
                    : 'bg-muted/30 border-dashed border-muted-foreground/20'
                }`}
              >
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
                    isRegistered
                      ? 'bg-emerald-100 dark:bg-emerald-900/30'
                      : 'bg-muted'
                  }`}
                >
                  {isRegistered ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <TypeIcon className="h-4 w-4 text-muted-foreground/60" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {AGENT_TYPE_LABELS[type]}
                    </p>
                    <Badge
                      variant="secondary"
                      className={`text-[9px] px-1 py-0 ${
                        isRegistered
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {isRegistered ? 'Registered' : 'Not registered'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                    {AGENT_TYPE_DESCRIPTIONS[type]}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Agent Panel ─────────────────────────────────────────

export function AgentPanel() {
  const {
    agents,
    agentsLoading,
    selectedAgentId,
    setSelectedAgentId,
    setAgents,
    addAgent,
    workspace,
  } = useWorkspaceStore();

  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch agents
  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch('/api/agents');
        const json = await res.json();
        if (json.success) {
          setAgents(json.data || []);
        }
      } catch {
        // silent fail — store has agentsLoading state
      }
    }
    fetchAgents();
  }, [setAgents]);

  const handleAgentCreated = useCallback(
    (agent: Agent) => {
      addAgent(agent);
    },
    [addAgent]
  );

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) ?? null,
    [agents, selectedAgentId]
  );

  const registeredTypes = useMemo(
    () => new Set(agents.map((a) => a.type)),
    [agents]
  );

  const handleBack = useCallback(() => {
    setSelectedAgentId(null);
  }, [setSelectedAgentId]);

  const handleRefresh = useCallback(() => {
    setAgents([]);
    fetch('/api/agents')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setAgents(json.data || []);
      })
      .catch(() => {});
  }, [setAgents]);

  // ── Loading State
  if (agentsLoading && agents.length === 0) {
    return (
      <div className="animate-in fade-in-0 duration-500 space-y-6 p-1">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Detail View
  if (selectedAgent) {
    return (
      <div className="animate-in fade-in-0 duration-500 p-1">
        <AgentDetailPanel agent={selectedAgent} onBack={handleBack} onRefresh={handleRefresh} />
      </div>
    );
  }

  // ── Grid View
  return (
    <div className="animate-in fade-in-0 duration-500 space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/30">
            <Bot className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Agents</h1>
            <p className="text-xs text-muted-foreground">
              {agents.length} agent{agents.length !== 1 ? 's' : ''} registered
            </p>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Register Agent
            </Button>
          </DialogTrigger>
          <RegisterAgentDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            onCreated={handleAgentCreated}
          />
        </Dialog>
      </div>

      {/* System Agent Types */}
      <SystemAgentTypesInfo registeredTypes={registeredTypes} />

      {/* Agent Grid */}
      {agents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {agents.map((agent, i) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                index={i}
                isSelected={agent.id === selectedAgentId}
                onSelect={() => setSelectedAgentId(agent.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-muted/60 mb-4">
              <Bot className="w-7 h-7 text-muted-foreground/60" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">No agents registered</h3>
            <p className="text-xs text-muted-foreground mb-5 text-center max-w-xs">
              Register your first agent to start building your operational fleet. Each agent type
              fulfills a specialized role in the system.
            </p>
            <Button size="sm" className="gap-2" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Register Agent
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
