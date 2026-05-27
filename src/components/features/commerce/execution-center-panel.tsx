'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Zap, Play, Pause, StopCircle, Loader2, RefreshCcw,
  Activity, Clock, CheckCircle, AlertCircle, Workflow,
  BarChart3, ListOrdered,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  paused: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  queued: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

function ExecutionRow({ execution }: { execution: any }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
      <span className={cn('w-2 h-2 rounded-full shrink-0', {
        'bg-blue-500': execution.status === 'running' || execution.status === 'completed',
        'bg-slate-400': execution.status === 'pending' || execution.status === 'paused',
        'bg-red-500': execution.status === 'failed',
      })} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
            {execution.workflowId || execution.type || 'Execution'}
          </p>
          <Badge variant="secondary" className={cn('text-[10px] capitalize', STATUS_COLORS[execution.status])}>
            {execution.status}
          </Badge>
        </div>
        <p className="text-[10px] text-slate-500 mt-0.5">
          {execution.createdAt ? new Date(execution.createdAt).toLocaleString() : 'Just now'}
          {execution.duration ? ` · ${execution.duration}ms` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {execution.status === 'running' && (
          <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">
            <StopCircle className="w-3.5 h-3.5 text-red-500" />
          </button>
        )}
        {execution.status === 'pending' && (
          <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">
            <Play className="w-3.5 h-3.5 text-blue-500" />
          </button>
        )}
      </div>
    </div>
  );
}

export function ExecutionCenterPanel() {
  const [activeTab, setActiveTab] = useState('executions');
  const [loading, setLoading] = useState(false);
  const [executions, setExecutions] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [execRes, queueRes] = await Promise.all([
        fetch('/api/execution?workspaceId=default'),
        fetch('/api/queue?workspaceId=default'),
      ]);
      const execJson = await execRes.json();
      if (execJson.success && execJson.data) setExecutions(execJson.data);
      const queueJson = await queueRes.json();
      if (queueJson.success && queueJson.data) setQueue(queueJson.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load executions';
      setError(message);
      toast({ title: 'Load failed', description: message, variant: 'destructive' });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <motion.div className="p-6 space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Execution Center</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Runtime orchestration for commerce workflows and autonomous execution
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCcw className={cn('w-3.5 h-3.5 mr-1.5', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </motion.div>

      {error && (
        <motion.div variants={itemVariants}>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Quick Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-slate-900 dark:text-slate-50 tabular-nums">{executions.length}</p>
            <p className="text-[10px] text-slate-500">Total Executions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {executions.filter(e => e.status === 'completed').length}
            </p>
            <p className="text-[10px] text-slate-500">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {executions.filter(e => e.status === 'running').length}
            </p>
            <p className="text-[10px] text-slate-500">Running</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-slate-600 dark:text-slate-400 tabular-nums">{queue.length}</p>
            <p className="text-[10px] text-slate-500">Queued</p>
          </CardContent>
        </Card>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="executions">Executions</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
        </TabsList>

        <TabsContent value="executions" className="mt-4 space-y-2">
          {executions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Activity className="w-8 h-8 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">No executions yet. Run a workflow or agent to see results.</p>
            </div>
          ) : (
            executions.map((exec, idx) => (
              <ExecutionRow key={exec.id || idx} execution={exec} />
            ))
          )}
        </TabsContent>

        <TabsContent value="queue" className="mt-4">
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <ListOrdered className="w-8 h-8 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">Queue is empty. Pending executions will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {queue.map((item: any, idx: number) => (
                <div key={item.id || idx} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{item.type || 'Queue Item'}</p>
                    <p className="text-[10px] text-slate-500">{item.priority ? `Priority: ${item.priority}` : ''}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Queued</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="workflows" className="mt-4">
          <div className="flex flex-col items-center justify-center py-16">
            <Workflow className="w-8 h-8 text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">Workflow templates for commerce operations</p>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
