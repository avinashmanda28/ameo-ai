'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Bot, Sparkles, Loader2, RefreshCcw, Activity,
  Cpu, CheckCircle, AlertCircle, Clock, Play,
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

const AGENT_DEFS = [
  { type: 'product-hunter', label: 'Product Hunter', description: 'Discovers winning products with demand and profit analysis' },
  { type: 'trend-analyst', label: 'Trend Analyst', description: 'Monitors viral trends and market momentum signals' },
  { type: 'supplier-analyst', label: 'Supplier Analyst', description: 'Evaluates supplier trust, pricing, and reliability' },
  { type: 'pricing-agent', label: 'Pricing Agent', description: 'Optimizes product pricing based on market conditions' },
  { type: 'seo-agent', label: 'SEO Agent', description: 'Optimizes product listings for search discovery' },
  { type: 'store-builder', label: 'Store Builder', description: 'Automates store setup and product importing' },
  { type: 'ad-creative', label: 'Ad Creative Agent', description: 'Generates ad copy and campaign variants' },
  { type: 'analytics-agent', label: 'Analytics Agent', description: 'Provides commerce intelligence and performance analysis' },
  { type: 'fulfillment-agent', label: 'Fulfillment Agent', description: 'Manages order fulfillment and tracking' },
  { type: 'verification-agent', label: 'Verification Agent', description: 'Verifies AI outputs and data quality' },
];

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-slate-400',
  running: 'bg-blue-500',
  completed: 'bg-blue-500',
  failed: 'bg-red-500',
  pending: 'bg-slate-400',
};

function AgentCard({ agent, onRun }: { agent: typeof AGENT_DEFS[0]; onRun: (type: string) => void }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">{agent.label}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{agent.description}</CardDescription>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => onRun(agent.type)} className="shrink-0">
            <Play className="w-3.5 h-3.5 mr-1" />
            Run
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}

function AgentTaskCard({ task }: { task: any }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
      <span className={cn('w-2 h-2 rounded-full shrink-0', STATUS_COLORS[task.status] || 'bg-slate-400')} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{task.type}</p>
        <p className="text-[10px] text-slate-500">{task.status}</p>
      </div>
      {task.duration && (
        <span className="text-[10px] text-slate-400 tabular-nums">{task.duration}ms</span>
      )}
    </div>
  );
}

export function AgentSwarmPanel() {
  const [activeTab, setActiveTab] = useState('agents');
  const [loading, setLoading] = useState(false);
  const [runningAgent, setRunningAgent] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [memory, setMemory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleRunAgent = useCallback(async (agentType: string) => {
    setRunningAgent(agentType);
    try {
      const res = await fetch('/api/commerce/agents/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentType, input: {}, workspaceId: 'default' }),
      });
      const json = await res.json();
      if (json.success) {
        setTasks(prev => [{ type: agentType, status: 'completed', duration: json.data?.duration, id: Date.now() }, ...prev]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run agent';
      setError(message);
      toast({ title: 'Agent run failed', description: message, variant: 'destructive' });
    }
    setRunningAgent(null);
  }, []);

  const fetchMemory = useCallback(async () => {
    try {
      const res = await fetch('/api/commerce/agents/memory?workspaceId=default');
      const json = await res.json();
      if (json.success && json.data) setMemory(json.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch memory';
      setError(message);
      toast({ title: 'Memory load failed', description: message, variant: 'destructive' });
    }
  }, []);

  useEffect(() => { fetchMemory(); }, [fetchMemory]);

  return (
    <motion.div className="p-6 space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Agent Swarm</h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          AGI commerce agent orchestration — 10 specialized agents for autonomous operations
        </p>
      </motion.div>

      {error && (
        <motion.div variants={itemVariants}>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </motion.div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="tasks">Recent Tasks</TabsTrigger>
          <TabsTrigger value="memory">Agent Memory</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="mt-4">
          <motion.div className="grid gap-3" variants={containerVariants} initial="hidden" animate="show">
            {AGENT_DEFS.map((agent) => (
              <AgentCard key={agent.type} agent={agent} onRun={handleRunAgent} />
            ))}
          </motion.div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Activity className="w-8 h-8 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">No recent tasks. Run an agent to see execution history.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <AgentTaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="memory" className="mt-4">
          {memory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Cpu className="w-8 h-8 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">Agent memory is empty. Agents will store learnings here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {memory.map((mem: any, idx: number) => (
                <Card key={mem.id || idx}>
                  <CardContent className="p-3">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{mem.agentType}</p>
                    <p className="text-[11px] text-slate-500 mt-1">{mem.content}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{new Date(mem.createdAt).toLocaleString()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
