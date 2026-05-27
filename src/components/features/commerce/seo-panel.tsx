'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Sparkles, Loader2, Tags, FileText, List, AlertCircle,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function SEOPanel() {
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [seoData, setSeoData] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOptimize = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/commerce/agents/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: 'seo-agent',
          input: { productName, currentDescription: description, targetPlatform: 'shopify' },
          workspaceId: 'default',
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.output) {
        setSeoData(json.data.output);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to optimize listing';
      setError(message);
      toast({ title: 'Optimization failed', description: message, variant: 'destructive' });
    }
    setLoading(false);
  }, [productName, description]);

  return (
    <motion.div className="p-6 space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Search className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">SEO & Listings</h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          AI-powered product listing optimization with keyword analysis
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

      <motion.div variants={itemVariants} className="space-y-3">
        <Input
          placeholder="Product name"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
        />
        <Textarea
          placeholder="Current product description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
        <Button onClick={handleOptimize} disabled={loading} className="w-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {loading ? 'Optimizing...' : 'Optimize Listing'}
        </Button>
      </motion.div>

      {seoData && (
        <motion.div variants={itemVariants} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Optimized Title</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{seoData.optimizedTitle}</p>
            </CardContent>
          </Card>

          {seoData.metaDescription && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Meta Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 dark:text-slate-400">{seoData.metaDescription}</p>
              </CardContent>
            </Card>
          )}

          {seoData.bulletPoints && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Bullet Points</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {seoData.bulletPoints.map((point: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <List className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                      <span className="text-slate-600 dark:text-slate-400">{point}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {seoData.searchTags && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Search Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {seoData.searchTags.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {seoData.scores && (
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500">Readability</p>
                <p className="text-lg font-bold text-blue-600">{seoData.scores.readability}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500">Keywords</p>
                <p className="text-lg font-bold text-blue-600">{seoData.scores.keywordDensity}%</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500">Completeness</p>
                <p className="text-lg font-bold text-blue-600">{seoData.scores.completeness}</p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
