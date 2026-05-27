'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  PenTool, Sparkles, Loader2, RefreshCcw, Copy, Check,
  Target, Users, TrendingUp, DollarSign, Eye, AlertCircle,
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
import { cn } from '@/lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function AdVariantCard({ ad, onCopy }: { ad: any; onCopy: (text: string) => void }) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">{ad.headline}</CardTitle>
              <Badge variant="secondary" className="text-[10px] capitalize">{ad.tone}</Badge>
            </div>
            <CardDescription className="text-xs mt-1">{ad.platform} ad variant</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
              Score: {ad.qualityScore}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Primary Text</span>
            <button
              onClick={() => handleCopy(ad.primaryText, 'primary')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              {copied === 'primary' ? <Check className="w-3.5 h-3.5 text-blue-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">{ad.primaryText}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Headline</span>
              <button
                onClick={() => handleCopy(ad.headline, 'headline')}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                {copied === 'headline' ? <Check className="w-3 h-3 text-blue-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300">{ad.headline}</p>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Description</span>
              <button
                onClick={() => handleCopy(ad.description, 'desc')}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                {copied === 'desc' ? <Check className="w-3 h-3 text-blue-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">{ad.description}</p>
          </div>
        </div>

        {ad.callToAction && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">CTA:</span>
            <Badge variant="secondary" className="text-[10px]">{ad.callToAction}</Badge>
          </div>
        )}

        {ad.targeting && (
          <div className="flex flex-wrap gap-1">
            {ad.targeting.map((t: string, i: number) => (
              <Badge key={i} variant="outline" className="text-[10px] text-slate-500">{t}</Badge>
            ))}
          </div>
        )}

        <Separator />

        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <p className="text-[10px] text-slate-500">CTR Est.</p>
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">{ad.estimatedCTR}%</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-500">Conv. Rate</p>
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">{ad.estimatedConversion}%</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-500">CPC Est.</p>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">${ad.estimatedCPC}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-500">ROAS Est.</p>
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">{ad.estimatedROAS}x</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdCreativePanel() {
  const [productDesc, setProductDesc] = useState('');
  const [platform, setPlatform] = useState('facebook');
  const [loading, setLoading] = useState(false);
  const [ads, setAds] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setAds(null);
    try {
      const res = await fetch('/api/commerce/agents/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: 'ad-creative',
          input: { productDescription: productDesc, platform, variants: 3 },
          workspaceId: 'default',
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.output?.adVariants) {
        setAds(json.data.output.adVariants);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate ads';
      setError(message);
      toast({ title: 'Generation failed', description: message, variant: 'destructive' });
    }
    setLoading(false);
  }, [productDesc, platform]);

  return (
    <motion.div className="p-6 space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <PenTool className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Ad Creative</h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          AI-powered ad copy and campaign generation with performance estimates
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
        <Textarea
          placeholder="Describe your product in detail — features, benefits, target audience, unique selling points..."
          value={productDesc}
          onChange={(e) => setProductDesc(e.target.value)}
          className="min-h-[80px]"
        />
        <div className="flex gap-3">
          <div className="flex gap-2">
            {['facebook', 'instagram', 'tiktok', 'google'].map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  platform === p
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                )}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <Button onClick={handleGenerate} disabled={loading || !productDesc} className="ml-auto">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span className="ml-2">{loading ? 'Generating...' : 'Generate Ads'}</span>
          </Button>
        </div>
      </motion.div>

      {ads && (
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{ads.length} ad variants created</p>
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loading}>
              <RefreshCcw className="w-3.5 h-3.5 mr-1.5" /> Regenerate
            </Button>
          </div>
          <div className="grid gap-4">
            {ads.map((ad, idx) => (
              <AdVariantCard key={`${ad.headline}-${idx}`} ad={ad} onCopy={() => {}} />
            ))}
          </div>
        </motion.div>
      )}

      {!ads && !loading && (
        <motion.div variants={itemVariants} className="flex flex-col items-center justify-center py-20">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 mb-4">
            <PenTool className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ad Creative Studio</h3>
          <p className="text-xs text-slate-400">Describe your product and generate AI-optimized ad variants</p>
        </motion.div>
      )}
    </motion.div>
  );
}
