'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  PenTool, Sparkles, Loader2, RefreshCcw, Image,
  Video, MessageSquare, Share2, Target, Palette,
  CheckCircle2, AlertCircle, Download, Play,
  Copy,
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

const CREATIVE_TYPES = [
  { key: 'ad-copy', label: 'Ad Copy', icon: MessageSquare, description: 'Facebook, Instagram, TikTok ad copy' },
  { key: 'ugc-script', label: 'UGC Scripts', icon: Video, description: 'User-generated content scripts' },
  { key: 'social-post', label: 'Social Posts', icon: Share2, description: 'Organic social media content' },
  { key: 'image-prompt', label: 'Image Prompts', icon: Image, description: 'AI image generation prompts' },
];

export function CreativeGenerationPanel() {
  const [activeTab, setActiveTab] = useState('generate');
  const [creativeType, setCreativeType] = useState('ad-copy');
  const [loading, setLoading] = useState(false);
  const [productDescription, setProductDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [platform, setPlatform] = useState('facebook');
  const [generated, setGenerated] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!productDescription.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/commerce/creatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: creativeType,
          productDescription,
          targetAudience: targetAudience || undefined,
          platform,
          workspaceId: 'default',
          count: 3,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setGenerated(json.data);
        toast({ title: 'Creatives generated', description: 'AI creative assets created' });
      } else {
        setError(json.error);
      }
    } catch (err) {
      setError('Failed to generate creatives');
    }
    setLoading(false);
  }, [creativeType, productDescription, targetAudience, platform]);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch('/api/commerce/creatives?workspaceId=default');
      const json = await res.json();
      if (json.success) setCampaigns(json.data || []);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load campaigns', variant: 'destructive' });
    }
  }, []);

  return (
    <motion.div className="p-6 space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <PenTool className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Creative Generation</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                AI-powered ad creatives, UGC scripts, and social media content
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCampaigns}>
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

      {/* Creative Type Selector */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CREATIVE_TYPES.map((type) => {
            const Icon = type.icon;
            const isActive = creativeType === type.key;
            return (
              <button
                key={type.key}
                onClick={() => setCreativeType(type.key)}
                className={cn(
                  'p-4 rounded-xl border text-left transition-all duration-200',
                  isActive
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-lg mb-2',
                  isActive ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-slate-100 dark:bg-slate-800'
                )}>
                  <Icon className={cn('w-4 h-4', isActive ? 'text-blue-600' : 'text-slate-500')} />
                </div>
                <p className="text-sm font-medium">{type.label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{type.description}</p>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Generate Form */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Generate {CREATIVE_TYPES.find(t => t.key === creativeType)?.label}</CardTitle>
            <CardDescription className="text-xs">Describe your product and target audience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Describe your product or service..."
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              className="text-sm min-h-[80px]"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Target Audience</label>
                <Input
                  placeholder="e.g., Young professionals 25-40"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Platform</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="facebook">Facebook / Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="google">Google Ads</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="pinterest">Pinterest</option>
                </select>
              </div>
            </div>
            <Button onClick={handleGenerate} disabled={loading || !productDescription.trim()}>
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              )}
              Generate {CREATIVE_TYPES.find(t => t.key === creativeType)?.label}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Generated Output */}
      {generated && (
        <motion.div variants={itemVariants}>
          <Card className="border-blue-200 dark:border-blue-800/40 bg-blue-50/30 dark:bg-blue-950/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-500" />
                <CardTitle className="text-sm">Generated Creatives</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {generated.assets?.map((asset: any, idx: number) => (
                  <Card key={idx}>
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
                          {asset.type === 'video' ? (
                            <Play className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {asset.headline || `Creative ${idx + 1}`}
                          </p>
                          {asset.body && (
                            <p className="text-[11px] text-slate-500 mt-1">{asset.body}</p>
                          )}
                          {asset.script && (
                            <p className="text-[11px] text-slate-500 mt-1 italic">"{asset.script}"</p>
                          )}
                          {asset.prompt && (
                            <p className="text-[11px] text-slate-500 mt-1">{asset.prompt}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-[10px]">{asset.type || creativeType}</Badge>
                            {asset.cta && (
                              <span className="text-[10px] text-blue-500">{asset.cta}</span>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
                          <Copy className="w-3 h-3 text-slate-400" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Campaigns */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="campaigns">
            <Target className="w-3.5 h-3.5 mr-1.5" />
            Campaigns
            {campaigns.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">{campaigns.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-4 space-y-3">
          {campaigns.length > 0 ? (
            <div className="grid gap-3">
              {campaigns.map((campaign: any, idx: number) => (
                <Card key={idx}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Target className="w-4 h-4 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium">{campaign.name || 'Campaign'}</p>
                        <p className="text-[11px] text-slate-500">{campaign.platform} · {campaign.status}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{campaign.assetCount || 0} assets</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <PenTool className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No campaigns created yet</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Generate creatives to build your first campaign</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
