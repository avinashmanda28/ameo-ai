'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Bot, Play, Square, AlertTriangle, CheckCircle2,
  Clock, Target, Settings, Loader2, RefreshCcw,
  Zap, Activity, Shield, Sliders, AlertCircle,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const EXECUTION_GOALS = [
  { key: 'import-products', label: 'Import Products', category: 'commerce', description: 'Auto-import winning products from intelligence' },
  { key: 'optimize-pricing', label: 'Optimize Pricing', category: 'commerce', description: 'Dynamic pricing based on competitor analysis' },
  { key: 'generate-creatives', label: 'Generate Creatives', category: 'commerce', description: 'Create ad creatives for campaigns' },
  { key: 'fulfill-orders', label: 'Fulfill Orders', category: 'commerce', description: 'Auto-fulfill pending orders' },
  { key: 'analyze-market', label: 'Analyze Market', category: 'intelligence', description: 'Market intelligence and competitor tracking' },
  { key: 'sync-stores', label: 'Sync Stores', category: 'commerce', description: 'Sync product data across stores' },
  { key: 'check-health', label: 'Health Check', category: 'system', description: 'Full system health scan' },
];

export function AutonomousExecutionPanel() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [executions, setExecutions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = useCallback(async (goal: string) => {
    setIsExecuting(true);
    try {
      const res = await fetch('/api/commerce/autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, workspaceId: 'default', mode: autoMode ? 'autonomous' : 'assisted' }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Execution started', description: `${goal} is now running` });
        setExecutions(prev => [json.data, ...prev]);
      } else {
        setError(json.error);
      }
    } catch (err) {
      toast({ title: 'Execution failed', description: 'Failed to start execution', variant: 'destructive' });
    }
    setIsExecuting(false);
  }, [autoMode]);

  const handleStopExecution = useCallback(async (id: string) => {
    try {
      await fetch(`/api/commerce/autonomous?id=${id}`, { method: 'DELETE' });
      toast({ title: 'Stopped', description: 'Execution terminated' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to stop execution', variant: 'destructive' });
    }
  }, []);

  const fetchExecutions = useCallback(async () => {
    try {
      const res = await fetch('/api/commerce/autonomous?workspaceId=default');
      const json = await res.json();
      if (json.success) setExecutions(json.data || []);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load executions', variant: 'destructive' });
    }
  }, []);

  return (
    <motion.div className="p-6 space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Autonomous Execution</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                AI-driven autonomous commerce operations and orchestration
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchExecutions}>
            <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
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

      {/* Mode & Controls */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-500" />
                  Execution Controls
                </CardTitle>
                <CardDescription className="text-xs">Configure execution mode and trigger autonomous actions</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Auto Mode</span>
                <Switch checked={autoMode} onCheckedChange={setAutoMode} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {EXECUTION_GOALS.map((goal) => {
                const Icon = goal.key === 'check-health' ? Shield : goal.category === 'intelligence' ? Target : Zap;
                return (
                  <button
                    key={goal.key}
                    onClick={() => handleExecute(goal.key)}
                    disabled={isExecuting}
                    className={cn(
                      'flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all duration-150',
                      'hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'border-slate-200 dark:border-slate-700'
                    )}
                  >
                    <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
                      <Icon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{goal.label}</p>
                      <p className="text-[10px] text-slate-500 truncate">{goal.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Status Indicator */}
      {isExecuting && (
        <motion.div variants={itemVariants}>
          <Card className="border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/30">
            <CardContent className="p-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Execution in progress</p>
                <p className="text-xs text-blue-500/70">Autonomous agent is executing the action</p>
              </div>
              <Badge variant="secondary" className="ml-auto text-[10px]">{autoMode ? 'Autonomous' : 'Assisted'}</Badge>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Execution History */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard">
            <Activity className="w-3.5 h-3.5 mr-1.5" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="history">
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            History
            {executions.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">{executions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="policies">
            <Settings className="w-3.5 h-3.5 mr-1.5" />
            Policies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <Zap className="w-5 h-5 text-blue-500 mx-auto mb-1.5" />
                <p className="text-2xl font-bold">{executions.length}</p>
                <p className="text-[11px] text-slate-500">Total Executions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <CheckCircle2 className="w-5 h-5 text-blue-500 mx-auto mb-1.5" />
                <p className="text-2xl font-bold">{executions.filter(e => e.status === 'completed').length}</p>
                <p className="text-[11px] text-slate-500">Completed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="w-5 h-5 text-amber-500 mx-auto mb-1.5" />
                <p className="text-2xl font-bold">{executions.filter(e => e.status === 'pending' || e.status === 'running').length}</p>
                <p className="text-[11px] text-slate-500">In Progress</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-1.5" />
                <p className="text-2xl font-bold">{executions.filter(e => e.status === 'failed').length}</p>
                <p className="text-[11px] text-slate-500">Failed</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Execution Mode</CardTitle>
              <CardDescription className="text-xs">Current autonomous execution configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-blue-500" />
                    <p className="text-sm font-medium">Mode</p>
                  </div>
                  <Badge className="text-xs">{autoMode ? 'Autonomous' : 'Assisted'}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-blue-500" />
                    <p className="text-sm font-medium">Max Parallel Actions</p>
                  </div>
                  <span className="text-sm font-bold text-blue-600">3</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-500" />
                    <p className="text-sm font-medium">Approval Required</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{autoMode ? 'Selective' : 'Always'}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-2">
          {executions.length > 0 ? (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-2">
                {executions.map((exec: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                      {exec.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-blue-500" />
                      ) : exec.status === 'failed' ? (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      ) : (
                        <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                      )}
                      <div>
                        <p className="text-xs font-medium">{exec.goal || exec.action || 'Action'}</p>
                        <p className="text-[10px] text-slate-500">{exec.createdAt ? new Date(exec.createdAt).toLocaleString() : 'Recently'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{exec.status}</Badge>
                      {(exec.status === 'running' || exec.status === 'pending') && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleStopExecution(exec.id)}>
                          <Square className="w-3 h-3 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <Bot className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No executions yet</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Trigger an autonomous action above to get started</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="policies" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Execution Policies</CardTitle>
              <CardDescription className="text-xs">Rules governing autonomous agent behavior</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {['Require approval for financial actions', 'Max order value: $500', 'Auto-retry on failure (max 3)', 'Log all executions to memory', 'Notify on critical errors'].map((policy, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2">
                    <div className="w-3.5 h-3.5 rounded border-2 border-blue-500 bg-blue-500 flex items-center justify-center">
                      <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{policy}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
