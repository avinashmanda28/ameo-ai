'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck, Search, Sparkles, Loader2, RefreshCcw,
  CheckCircle, AlertCircle, AlertTriangle, FileText,
  ThumbsUp, ThumbsDown, BarChart3,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const VERDICT_COLORS: Record<string, string> = {
  verified: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  warning: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
  pending: 'bg-slate-100 text-slate-500 dark:bg-slate-800/50 dark:text-slate-500 border-slate-200 dark:border-slate-700',
};

function VerificationResultCard({ result }: { result: any }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold capitalize">{result.type} Verification</CardTitle>
              <Badge variant="outline" className={cn('text-[10px]', VERDICT_COLORS[result.verdict])}>
                {result.verdict === 'verified' && <CheckCircle className="w-3 h-3 mr-1" />}
                {result.verdict === 'warning' && <AlertTriangle className="w-3 h-3 mr-1" />}
                {result.verdict === 'failed' && <AlertCircle className="w-3 h-3 mr-1" />}
                {result.verdict}
              </Badge>
            </div>
            <CardDescription className="text-xs mt-1">
              Confidence: {result.confidence}% | Score: {result.score}/100
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {result.summary && (
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <p className="text-xs text-slate-600 dark:text-slate-400">{result.summary}</p>
          </div>
        )}

        {result.checks && result.checks.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Quality Checks</p>
            {result.checks.map((check: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {check.passed ? (                    <ThumbsUp className="w-3 h-3 text-blue-500 shrink-0" />
                ) : (
                  <ThumbsDown className="w-3 h-3 text-red-500 shrink-0" />
                )}
                <span className={cn(check.passed ? 'text-slate-600 dark:text-slate-400' : 'text-red-600 dark:text-red-400')}>
                  {check.label}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <p className="text-[10px] text-slate-500">Accuracy</p>
            <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{result.accuracy}%</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <p className="text-[10px] text-slate-500">Completeness</p>
            <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{result.completeness}%</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <p className="text-[10px] text-slate-500">Consistency</p>
            <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{result.consistency}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function VerificationPanel() {
  const [targetId, setTargetId] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = useCallback(async () => {
    setLoading(true);
    setResults(null);
    try {
      const res = await fetch('/api/commerce/agents/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: 'verification-agent',
          input: { targetId: targetId || undefined, verifyAll: !targetId },
          workspaceId: 'default',
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.output?.results) {
        setResults(json.data.output.results);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      setError(message);
      toast({ title: 'Verification failed', description: message, variant: 'destructive' });
    }
    setLoading(false);
  }, [targetId]);

  return (
    <motion.div className="p-6 space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Verification</h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          AI output verification and quality assurance with multi-dimensional scoring
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
            placeholder="Target ID to verify, or leave empty to verify all"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            className="pl-9 h-10"
          />
        </div>
        <Button onClick={handleVerify} disabled={loading} className="h-10">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          <span className="ml-2">{loading ? 'Verifying...' : 'Verify'}</span>
        </Button>
      </motion.div>

      {results && (
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{results.length} verification result(s)</p>
            <Button variant="outline" size="sm" onClick={handleVerify} disabled={loading}>
              <RefreshCcw className="w-3.5 h-3.5 mr-1.5" /> Re-run
            </Button>
          </div>
          <div className="grid gap-4">
            {results.map((r, idx) => (
              <VerificationResultCard key={r.id || idx} result={r} />
            ))}
          </div>
        </motion.div>
      )}

      {!results && !loading && (
        <motion.div variants={itemVariants} className="flex flex-col items-center justify-center py-20">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 mb-4">
            <ShieldCheck className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Quality Assurance Ready</h3>
          <p className="text-xs text-slate-400">Verify AI outputs for accuracy, completeness, and consistency</p>
        </motion.div>
      )}
    </motion.div>
  );
}
