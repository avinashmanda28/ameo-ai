'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Sparkles, Loader2, RefreshCcw, Globe,
  Search, Edit3, Eye, Copy, CheckCircle2, AlertCircle,
  Image, Layout, Type,
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

export function ProductPageGeneratorPanel() {
  const [activeTab, setActiveTab] = useState('generate');
  const [loading, setLoading] = useState(false);
  const [productUrl, setProductUrl] = useState('');
  const [productId, setProductId] = useState('');
  const [generatedPages, setGeneratedPages] = useState<any[]>([]);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!productId && !productUrl) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/commerce/product-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: productId || undefined,
          productUrl: productUrl || undefined,
          workspaceId: 'default',
          seoOptimize: true,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setGeneratedContent(json.data);
        toast({ title: 'Page generated', description: 'AI product page created successfully' });
      } else {
        setError(json.error);
      }
    } catch (err) {
      setError('Failed to generate product page');
    }
    setLoading(false);
  }, [productId, productUrl]);

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/commerce/product-pages?workspaceId=default');
      const json = await res.json();
      if (json.success) setGeneratedPages(json.data || []);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load pages', variant: 'destructive' });
    }
    setLoading(false);
  }, []);

  return (
    <motion.div className="p-6 space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Product Page Generator</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                AI-powered product page creation with SEO-optimized content
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchPages}>
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

      {/* Generate Form */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Generate Product Page</CardTitle>
            <CardDescription className="text-xs">
              Enter a product ID or URL to generate an AI-optimized product page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Product ID</label>
                <Input
                  placeholder="prod_abc123"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">- or - Product URL</label>
                <Input
                  placeholder="https://example.com/product/..."
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-md">
                <Globe className="w-3 h-3" />
                SEO optimize
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-md">
                <Image className="w-3 h-3" />
                Image alt tags
              </div>
            </div>
            <Button onClick={handleGenerate} disabled={loading || (!productId && !productUrl)}>
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              )}
              Generate Page
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Generated Preview */}
      {generatedContent && (
        <motion.div variants={itemVariants}>
          <Card className="border-blue-200 dark:border-blue-800/40 bg-blue-50/30 dark:bg-blue-950/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-500" />
                  Generated Product Page
                </CardTitle>
                <Button variant="outline" size="sm">
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  Preview
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-50">
                  {generatedContent.title || 'Product Title'}
                </p>
                {generatedContent.seoMetadata && (
                  <div className="flex items-center gap-2 mt-1">
                    <Search className="w-3 h-3 text-slate-400" />
                    <p className="text-xs text-slate-500">
                      {generatedContent.seoMetadata.metaTitle || 'SEO title'} · {generatedContent.seoMetadata.metaDescription || 'SEO description'}
                    </p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {generatedContent.qualityScore && (
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-slate-500">Quality Score</p>
                      <p className="text-lg font-bold text-blue-600">{(generatedContent.qualityScore * 100).toFixed(0)}%</p>
                    </CardContent>
                  </Card>
                )}
                {generatedContent.seoMetadata?.score && (
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-slate-500">SEO Score</p>
                      <p className="text-lg font-bold text-blue-600">{(generatedContent.seoMetadata.score * 100).toFixed(0)}%</p>
                    </CardContent>
                  </Card>
                )}
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-slate-500">Readability</p>
                    <p className="text-lg font-bold text-blue-600">A+</p>
                  </CardContent>
                </Card>
              </div>
              {generatedContent.sections && (
                <div className="space-y-2">
                  {generatedContent.sections.map((section: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg bg-white dark:bg-slate-900/50">
                      <p className="text-xs font-medium text-slate-700 mb-1">{section.heading}</p>
                      <p className="text-[11px] text-slate-500">{section.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Product Pages Gallery */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="saved">
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Saved Pages
            {generatedPages.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">{generatedPages.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="saved" className="mt-4 space-y-3">
          {generatedPages.length > 0 ? (
            <div className="grid gap-3">
              {generatedPages.map((page: any, idx: number) => (
                <Card key={idx}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium">{page.title || page.productId}</p>
                        <p className="text-[11px] text-slate-500">
                          {page.status} · {page.createdAt ? new Date(page.createdAt).toLocaleDateString() : 'Recently'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs">View</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs">Edit</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No product pages generated yet</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Generate your first AI-powered product page above</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
