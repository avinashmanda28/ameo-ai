'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Eye, TrendingUp, TrendingDown, AlertTriangle,
  Target, Search, Loader2, RefreshCcw, BarChart3,
  Globe, ShoppingBag, AlertCircle, Shield,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

function ThreatBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    critical: 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  };
  return (
    <Badge className={cn('text-[10px] font-medium capitalize', colors[level] || colors.low)}>
      {level}
    </Badge>
  );
}

export function CompetitorIntelligencePanel() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('');
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [marketAnalysis, setMarketAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeMarket = useCallback(async () => {
    if (!category.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/commerce/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, workspaceId: 'default' }),
      });
      const json = await res.json();
      if (json.success) {
        setMarketAnalysis(json.data);
        if (json.data.competitors) setCompetitors(json.data.competitors);
        toast({ title: 'Market analyzed', description: `Analysis complete for ${category}` });
      } else {
        setError(json.error);
      }
    } catch (err) {
      setError('Failed to analyze market');
    }
    setLoading(false);
  }, [category]);

  const fetchCompetitors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/commerce/competitors?workspaceId=default');
      const json = await res.json();
      if (json.success) {
        setCompetitors(json.data || []);
        if (json.data?.marketAnalysis) setMarketAnalysis(json.data.marketAnalysis);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load competitors', variant: 'destructive' });
    }
    setLoading(false);
  }, []);

  return (
    <motion.div className="p-6 space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Competitor Intelligence</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Market analysis, competitor tracking, and threat assessment
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCompetitors} disabled={loading}>
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

      {/* Market Analysis Input */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Market Category Analysis</CardTitle>
            <CardDescription className="text-xs">
              Enter a product category to analyze the competitive landscape
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                placeholder="e.g., wireless earbuds, protein powder, yoga mats"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && analyzeMarket()}
                className="text-sm"
              />
              <Button onClick={analyzeMarket} disabled={loading || !category.trim()}>
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5 mr-1.5" />
                )}
                Analyze
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Market Overview */}
      {marketAnalysis && (
        <motion.div variants={itemVariants}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <ShoppingBag className="w-5 h-5 text-blue-500 mx-auto mb-1.5" />
                <p className="text-2xl font-bold">{marketAnalysis.competitorCount || 0}</p>
                <p className="text-[11px] text-slate-500">Competitors</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <BarChart3 className="w-5 h-5 text-blue-500 mx-auto mb-1.5" />
                <p className="text-2xl font-bold capitalize">{marketAnalysis.marketConcentration || 'N/A'}</p>
                <p className="text-[11px] text-slate-500">Concentration</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Target className="w-5 h-5 text-blue-500 mx-auto mb-1.5" />
                <p className="text-lg font-bold truncate">{marketAnalysis.pricingStrategy || 'N/A'}</p>
                <p className="text-[11px] text-slate-500">Strategy</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Shield className="w-5 h-5 text-blue-500 mx-auto mb-1.5" />
                <p className="text-2xl font-bold capitalize">{marketAnalysis.marketHealth || 'Unknown'}</p>
                <p className="text-[11px] text-slate-500">Market Health</p>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      {/* Competitors List */}
      <motion.div variants={itemVariants}>
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
          {competitors.length > 0 ? `${competitors.length} Competitors Tracked` : 'Tracked Competitors'}
        </h3>
        {competitors.length > 0 ? (
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-2">
              {competitors.map((comp: any, idx: number) => (
                <Card key={idx} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                          <Globe className="w-4 h-4 text-slate-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{comp.name}</p>
                            {comp.threatLevel && <ThreatBadge level={comp.threatLevel} />}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-[11px] text-slate-500">{comp.website}</p>
                            {comp.marketShare && (
                              <p className="text-[11px] text-slate-500">{comp.marketShare}% market share</p>
                            )}
                            {comp.overallScore && (
                              <div className="flex items-center gap-1">
                                <BarChart3 className="w-3 h-3 text-slate-400" />
                                <span className="text-[11px] text-slate-500">{comp.overallScore}/100</span>
                              </div>
                            )}
                          </div>
                          {comp.strengths && (
                            <div className="flex items-center gap-1.5 mt-2">
                              {comp.strengths.slice(0, 3).map((s: string, i: number) => (
                                <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {comp.priceRange && (
                        <Badge variant="outline" className="text-[11px]">{comp.priceRange}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed">
            <Eye className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No competitors tracked yet</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Run a market analysis to discover competitors</p>
          </div>
        )}
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="threats">
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
            Threat Assessment
          </TabsTrigger>
          <TabsTrigger value="trends">
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
            Market Trends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="threats" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Competitive Threat Analysis</CardTitle>
              <CardDescription className="text-xs">AI-assessed threat levels and risk factors</CardDescription>
            </CardHeader>
            <CardContent>
              {competitors.filter(c => c.threatLevel === 'high' || c.threatLevel === 'critical').length > 0 ? (
                <div className="space-y-2">
                  {competitors.filter(c => c.threatLevel === 'high' || c.threatLevel === 'critical').map((comp: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-red-700 dark:text-red-400">{comp.name}</p>
                        <p className="text-[10px] text-red-500">{comp.website} · {comp.overallScore || '?'}/100 threat score</p>
                      </div>
                      <ThreatBadge level={comp.threatLevel} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-8">No high-threat competitors detected</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Market Trend Intelligence</CardTitle>
              <CardDescription className="text-xs">Emerging trends and market movements</CardDescription>
            </CardHeader>
            <CardContent>
              {marketAnalysis?.marketInsights?.length > 0 ? (
                <div className="space-y-2">
                  {marketAnalysis.marketInsights.map((insight: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 p-2">
                      <TrendingUp className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-slate-600 dark:text-slate-400">{insight}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-8">Run a market analysis to see trends</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
