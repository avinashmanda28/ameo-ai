'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, Search, Sparkles, Loader2, RefreshCcw,
  TrendingDown, Activity, Clock, Zap, BarChart3, AlertCircle,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function TrendCard({ trend, rank }: { trend: any; rank: number }) {
  const timingColors: Record<string, string> = {
    early: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    growth: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    peak: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    saturation: 'bg-slate-100 text-slate-500 dark:bg-slate-800/50 dark:text-slate-500',
    decline: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const momentumColor = trend.momentumScore >= 70 ? 'text-blue-500' :
    trend.momentumScore >= 40 ? 'text-blue-500' : 'text-slate-400';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">#{rank}</span>
              <CardTitle className="text-sm font-semibold">{trend.name}</CardTitle>
              <Badge variant="outline" className={cn('text-[10px]', timingColors[trend.marketTiming] || '')}>
                {trend.marketTiming}
              </Badge>
            </div>
            <CardDescription className="text-xs mt-1">
              {trend.opportunityWeeks ? `${trend.opportunityWeeks} week opportunity window` : 'Emerging trend'}
            </CardDescription>
          </div>
          <div className="text-right">
            <p className={cn('text-lg font-bold tabular-nums', momentumColor)}>{trend.overallScore}</p>
            <p className="text-[10px] text-slate-400">Score</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <p className="text-[10px] text-slate-500">Viral</p>
            <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{trend.viralScore}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-500">Acceleration</p>
            <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{trend.accelerationRate}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-500">Momentum</p>
            <p className="text-sm font-bold tabular-nums">{trend.momentumScore}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-500">Confidence</p>
            <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{trend.confidence}%</p>
          </div>
        </div>
        {trend.keySignals && (
          <div className="mt-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <p className="text-[10px] font-medium text-slate-500 mb-1">Key Signals</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">{trend.keySignals}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TrendDiscoveryPanel() {
  const [niche, setNiche] = useState('');
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState<any[] | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/commerce/agents/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: 'trend-analyst',
          input: { niche: niche || '', minMomentum: 30, lookbackDays: 14 },
          workspaceId: 'default',
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.output?.trends) {
        setTrends(json.data.output.trends);
        setAnalysis(json.data.output.analysis || '');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to discover trends';
      setError(message);
      toast({ title: 'Discovery failed', description: message, variant: 'destructive' });
    }
    setLoading(false);
  }, [niche]);

  return (
    <motion.div className="p-6 space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Trend Discovery</h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          AI-powered viral trend intelligence with momentum tracking and opportunity analysis
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

      <motion.div variants={itemVariants} className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search niche or leave empty for all categories"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9 h-10"
          />
        </div>
        <Button onClick={handleSearch} disabled={loading} className="h-10">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span className="ml-2">{loading ? 'Analyzing...' : 'Discover Trends'}</span>
        </Button>
      </motion.div>

      {trends && (
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {trends.length} trending opportunities
              </p>
              {analysis && (
                <Badge variant="secondary" className="text-[10px]">
                  AI Analysis Available
                </Badge>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleSearch} disabled={loading}>
              <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
          </div>

          {analysis && (
            <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Activity className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Trend Analysis</p>
                    <p className="text-xs text-blue-600/80 dark:text-blue-300/80">{analysis}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {trends.map((trend, idx) => (
              <TrendCard key={trend.name} trend={trend} rank={idx + 1} />
            ))}
          </div>
        </motion.div>
      )}

      {!trends && !loading && (
        <motion.div variants={itemVariants} className="flex flex-col items-center justify-center py-20">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 mb-4">
            <TrendingUp className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Trend Intelligence Ready</h3>
          <p className="text-xs text-slate-400">Search a niche or discover across all categories to find viral opportunities</p>
        </motion.div>
      )}
    </motion.div>
  );
}
