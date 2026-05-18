'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Terminal,
  Trash2,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  Activity,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWorkspaceStore } from '@/lib/store/workspace-store';
import { cn } from '@/lib/utils';
import type { LogLevel } from '@/lib/types';

// ─── Types ─────────────────────────────────────────────────────

interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  source: 'audit' | 'agent' | 'system';
  message: string;
}

type SourceFilter = 'all' | 'audit' | 'agent' | 'system';
type LevelFilter = 'all' | LogLevel;

// ─── Helpers ───────────────────────────────────────────────────

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: 'text-zinc-500',
  info: 'text-zinc-300',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

const LEVEL_BADGE_COLORS: Record<LogLevel, string> = {
  debug: 'bg-zinc-800 text-zinc-500 border-zinc-700',
  info: 'bg-zinc-800 text-sky-400 border-zinc-700',
  warn: 'bg-yellow-900/40 text-yellow-400 border-yellow-700',
  error: 'bg-red-900/40 text-red-400 border-red-700',
};

const SOURCE_COLORS: Record<string, string> = {
  audit: 'text-amber-400',
  agent: 'text-emerald-400',
  system: 'text-sky-400',
};

const LEVEL_ICONS: Record<LogLevel, React.ComponentType<{ className?: string }>> = {
  debug: Bug,
  info: Info,
  warn: AlertTriangle,
  error: AlertCircle,
};

// ─── Animation ─────────────────────────────────────────────────

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
    transition: { duration: 0.4, ease: [0.25, 0.4, 0.25, 1] as const },
  },
};

// ─── Log Line Component ────────────────────────────────────────

function LogLine({ entry }: { entry: LogEntry }) {
  const LevelIcon = LEVEL_ICONS[entry.level];
  const time = formatTime(entry.timestamp);

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'flex items-start gap-2 py-1 px-3 hover:bg-zinc-900/50 rounded transition-colors font-mono text-[13px] leading-relaxed',
        'group'
      )}
    >
      <span className="text-zinc-600 shrink-0 select-none tabular-nums">{time}</span>
      <span
        className={cn(
          'shrink-0 w-14 text-center uppercase font-bold text-[10px] tracking-wider',
          LEVEL_COLORS[entry.level]
        )}
      >
        {entry.level.padEnd(5)}
      </span>
      <span
        className={cn(
          'shrink-0 w-14 text-[11px] font-semibold',
          SOURCE_COLORS[entry.source] ?? 'text-zinc-500'
        )}
      >
        [{entry.source}]
      </span>
      <span className={cn('flex-1 break-all', LEVEL_COLORS[entry.level])}>
        {entry.message}
      </span>
    </motion.div>
  );
}

// ─── Empty State ───────────────────────────────────────────────

function EmptyTerminal() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-12">
      <Terminal className="w-10 h-10 text-zinc-700 mb-3" />
      <p className="text-sm text-zinc-500 font-mono">Terminal Observer ready</p>
      <p className="text-xs text-zinc-600 mt-1 font-mono">System logs will stream here</p>
    </div>
  );
}

// ─── Terminal Panel ────────────────────────────────────────────

export function TerminalPanel() {
  const auditLogs = useWorkspaceStore((s) => s.auditLogs);
  const agents = useWorkspaceStore((s) => s.agents);
  const workflows = useWorkspaceStore((s) => s.workflows);
  const runtimes = useWorkspaceStore((s) => s.runtimes);
  const governanceRules = useWorkspaceStore((s) => s.governanceRules);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // ── Generate boot system messages on mount ──
  useEffect(() => {
    const now = Date.now();
    const bootMessages: LogEntry[] = [
      {
        id: generateId(),
        timestamp: new Date(now - 4000),
        level: 'info',
        source: 'system',
        message: 'AMEO AI — Terminal Observer v2.0 initialized',
      },
      {
        id: generateId(),
        timestamp: new Date(now - 3500),
        level: 'info',
        source: 'system',
        message: `Workspace loaded: ${workflows.length + agents.length + runtimes.length + governanceRules.length} entities`,
      },
      {
        id: generateId(),
        timestamp: new Date(now - 3000),
        level: 'debug',
        source: 'system',
        message: `Runtimes: ${runtimes.length} connected, ${runtimes.filter((r) => r.status === 'active').length} active`,
      },
      {
        id: generateId(),
        timestamp: new Date(now - 2500),
        level: 'debug',
        source: 'system',
        message: `Workflows: ${workflows.filter((w) => w.state === 'active').length} active, ${workflows.filter((w) => w.state === 'blocked').length} blocked`,
      },
      {
        id: generateId(),
        timestamp: new Date(now - 2000),
        level: 'info',
        source: 'system',
        message: `Governance: ${governanceRules.filter((r) => r.enabled).length} rules enforced`,
      },
      {
        id: generateId(),
        timestamp: new Date(now - 1500),
        level: 'debug',
        source: 'agent',
        message: `Agent fleet: ${agents.length} registered (${agents.filter((a) => a.status === 'active' || a.status === 'busy').length} operational)`,
      },
    ];

    setLogs(bootMessages);
  }, []);

  // ── Convert audit logs to terminal entries ──
  useEffect(() => {
    const auditEntries: LogEntry[] = auditLogs.slice(0, 20).map((log) => ({
      id: `audit-${log.id}`,
      timestamp: new Date(log.createdAt),
      level: (log.severity === 'critical' ? 'error' : log.severity === 'error' ? 'error' : log.severity === 'warn' ? 'warn' : 'info') as LogLevel,
      source: 'audit' as const,
      message: `${log.action}${log.resource ? ` → ${log.resource}` : ''}${log.details ? ` | ${log.details}` : ''}`,
    }));

    setLogs((prev) => {
      const existingIds = new Set(prev.map((l) => l.id));
      const newEntries = auditEntries.filter((e) => !existingIds.has(e.id));
      if (newEntries.length === 0) return prev;

      // Merge: new audit entries at top, system boot messages below
      const merged = [...newEntries.reverse(), ...prev.filter((l) => l.source !== 'audit')];
      return merged;
    });
  }, [auditLogs]);

  // ── Periodic system heartbeat ──
  useEffect(() => {
    const heartbeatMessages = [
      () => {
        const activeCount = workflows.filter((w) => w.state === 'active').length;
        return {
          level: 'debug' as LogLevel,
          message: `heartbeat: ${activeCount} active workflow${activeCount !== 1 ? 's' : ''} running`,
        };
      },
      () => {
        const errorCount = agents.filter((a) => a.status === 'error').length;
        return {
          level: errorCount > 0 ? ('warn' as LogLevel) : ('debug' as LogLevel),
          message: `heartbeat: agent fleet status — ${errorCount > 0 ? `${errorCount} agent(s) in error state` : 'all nominal'}`,
        };
      },
      () => {
        const activeRuntimes = runtimes.filter((r) => r.status === 'active').length;
        return {
          level: 'debug' as LogLevel,
          message: `heartbeat: ${activeRuntimes}/${runtimes.length} runtimes responsive`,
        };
      },
    ];

    let idx = 0;
    const interval = setInterval(() => {
      const generator = heartbeatMessages[idx % heartbeatMessages.length];
      const { level, message } = generator();
      const entry: LogEntry = {
        id: generateId(),
        timestamp: new Date(),
        level,
        source: 'system',
        message,
      };
      setLogs((prev) => [...prev, entry]);
      idx++;
    }, 8000);

    return () => clearInterval(interval);
  }, [workflows, agents, runtimes]);

  // ── Filtered logs ──
  const filteredLogs = useMemo(() => {
    return logs.filter((entry) => {
      if (sourceFilter !== 'all' && entry.source !== sourceFilter) return false;
      if (levelFilter !== 'all' && entry.level !== levelFilter) return false;
      return true;
    });
  }, [logs, sourceFilter, levelFilter]);

  // ── Counts ──
  const totalCount = filteredLogs.length;
  const errorCount = filteredLogs.filter((l) => l.level === 'error').length;
  const warnCount = filteredLogs.filter((l) => l.level === 'warn').length;

  // ── Auto-scroll logic ──
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs.length, autoScroll]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 60;
    setAutoScroll(isAtBottom);
    setShowScrollBtn(!isAtBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setAutoScroll(true);
    setShowScrollBtn(false);
  }, []);

  const handleClear = useCallback(() => {
    setLogs([]);
  }, []);

  return (
    <motion.div
      className="flex flex-col h-full"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* ─── Header ─── */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 pb-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Terminal className="w-5 h-5 text-foreground" />
            <h1 className="text-lg font-bold tracking-tight">Terminal Observer</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Real-time system event monitoring
          </p>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] h-5 font-mono">
            <Activity className="w-3 h-3 mr-1" />
            {totalCount}
          </Badge>
          {errorCount > 0 && (
            <Badge className="text-[10px] h-5 bg-red-900/40 text-red-400 border-red-700 font-mono">
              <AlertCircle className="w-3 h-3 mr-1" />
              {errorCount}
            </Badge>
          )}
          {warnCount > 0 && (
            <Badge className="text-[10px] h-5 bg-yellow-900/40 text-yellow-400 border-yellow-700 font-mono">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {warnCount}
            </Badge>
          )}
        </div>
      </motion.div>

      {/* ─── Filter Bar ─── */}
      <motion.div variants={itemVariants} className="flex items-center gap-2 px-4 pb-2">
        <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
          <SelectTrigger size="sm" className="w-[110px] text-xs h-7 bg-zinc-900 border-zinc-800 text-zinc-300">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="audit">Audit</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>

        <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as LevelFilter)}>
          <SelectTrigger size="sm" className="w-[100px] text-xs h-7 bg-zinc-900 border-zinc-800 text-zinc-300">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="debug">Debug</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={handleClear}
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Clear
        </Button>
      </motion.div>

      {/* ─── Terminal Console ─── */}
      <motion.div variants={itemVariants} className="flex-1 relative min-h-0 px-4 pb-4">
        <div className="relative h-full min-h-[400px] max-h-[calc(100vh-280px)] rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-lg">
          {/* Terminal Title Bar */}
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            </div>
            <span className="text-[11px] text-zinc-500 font-mono ml-2">ameo://terminal-observer</span>
            <div className="flex-1" />
            <span className="text-[10px] text-zinc-600 font-mono tabular-nums">
              {filteredLogs.length} entries
            </span>
          </div>

          {/* Log Console */}
          <div
            className="h-[calc(100%-2.25rem)] overflow-y-auto custom-scrollbar"
            onScroll={handleScroll}
            ref={(el) => {
              // The scroll container is this div itself
            }}
          >
            {filteredLogs.length === 0 ? (
              <EmptyTerminal />
            ) : (
              <div className="py-2">
                {filteredLogs.map((entry) => (
                  <LogLine key={entry.id} entry={entry} />
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Scroll to Bottom Button */}
          {showScrollBtn && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-4 right-4"
            >
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-2 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 shadow-lg"
                onClick={scrollToBottom}
              >
                <ChevronDown className="w-3.5 h-3.5 mr-1" />
                Latest
              </Button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
