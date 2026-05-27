'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, Search, Clock, Star, Tag, Filter,
  Loader2, RefreshCcw, AlertCircle, Bookmark,
  Trash2, Sparkles, Database,
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

const AGENTS = ['seo-agent', 'pricing-agent', 'product-hunter', 'ad-creative-agent', 'analytics-agent', 'verification-agent'];

export function CommerceMemoryPanel() {
  const [activeTab, setActiveTab] = useState('search');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [memories, setMemories] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/commerce/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, workspaceId: 'default', limit: 20 }),
      });
      const json = await res.json();
      if (json.success) setResults(json.data || []);
      else setError(json.error);
    } catch (err) {
      setError('Failed to search memory');
    }
    setLoading(false);
  }, [searchQuery]);

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/commerce/memory?workspaceId=default&limit=50');
      const json = await res.json();
      if (json.success) setMemories(json.data || []);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load memories', variant: 'destructive' });
    }
    setLoading(false);
  }, []);

  const handleRecordMemory = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch('/api/commerce/memory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'default',
          key: `manual.${Date.now()}`,
          value: { content: searchQuery, source: 'manual' },
          agentType: 'analytics-agent',
          tags: ['manual', 'note'],
          ttl: 86400 * 7,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Memory saved', description: 'Agent memory recorded' });
        setSearchQuery('');
        fetchMemories();
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save memory', variant: 'destructive' });
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      const res = await fetch(`/api/commerce/memory?id=${id}&workspaceId=default`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Deleted', description: 'Memory removed' });
        fetchMemories();
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete memory', variant: 'destructive' });
    }
  };

  return (
    <motion.div className="p-6 space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Brain className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Commerce Memory</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Agent knowledge base — search, record, and manage AI agent memory
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchMemories} disabled={loading}>
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

      {/* Search Bar */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search agent memory (e.g., 'pricing strategy for electronics')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9 text-sm"
            />
          </div>
          <Button size="sm" onClick={handleSearch} disabled={loading || !searchQuery.trim()}>
            <Search className="w-3.5 h-3.5 mr-1.5" />
            Search
          </Button>
          <Button variant="outline" size="sm" onClick={handleRecordMemory} disabled={!searchQuery.trim()}>
            <Bookmark className="w-3.5 h-3.5 mr-1.5" />
            Record
          </Button>
        </div>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="search">
            <Search className="w-3.5 h-3.5 mr-1.5" />
            Search Results
            {results.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">{results.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="recent">
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            Recent
          </TabsTrigger>
          <TabsTrigger value="by-agent">
            <Tag className="w-3.5 h-3.5 mr-1.5" />
            By Agent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="mt-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : results.length > 0 ? (
            <ScrollArea className="max-h-[600px]">
              <div className="space-y-2">
                {results.map((memory: any, idx: number) => (
                  <Card key={idx} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <Brain className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{memory.key}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                            {typeof memory.value === 'string' ? memory.value : JSON.stringify(memory.value)}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="secondary" className="text-[10px]">{memory.agentType || 'unknown'}</Badge>
                            {memory.tags?.map((tag: string) => (
                              <span key={tag} className="text-[10px] text-slate-400">#{tag}</span>
                            ))}
                            {memory.confidence && (
                              <span className="text-[10px] text-slate-400 ml-auto">
                                {(memory.confidence * 100).toFixed(0)}% confidence
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <Brain className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Search agent memory or browse recent entries</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="recent" className="mt-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {memories.slice(0, 20).map((memory: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <Database className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{memory.key}</p>
                      <p className="text-[10px] text-slate-500">
                        {memory.agentType} · {memory.createdAt ? new Date(memory.createdAt).toLocaleDateString() : 'recent'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {memory.confidence && memory.confidence > 0.8 && (
                      <Star className="w-3 h-3 text-amber-400" />
                    )}
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleDeleteMemory(memory.id)}>
                      <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
              {memories.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-8">No memories recorded yet</p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="by-agent" className="mt-4 space-y-4">
          {AGENTS.map((agent) => {
            const agentMemories = memories.filter((m: any) => m.agentType === agent);
            return (
              <Card key={agent}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm capitalize">{agent.replace(/-/g, ' ')}</CardTitle>
                    <Badge variant="secondary" className="text-[10px]">{agentMemories.length} memories</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {agentMemories.length > 0 ? (
                    <div className="space-y-1">
                      {agentMemories.slice(0, 5).map((memory: any, idx: number) => (
                        <p key={idx} className="text-[11px] text-slate-500 truncate">{memory.key}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400">No memories recorded</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
