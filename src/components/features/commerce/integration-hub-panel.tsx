'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Share2, Plus, Loader2, RefreshCcw, CheckCircle2,
  XCircle, AlertCircle, ExternalLink, Trash2, Settings,
  Webhook, Database, Link2, Plug, Unplug,
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

type Integration = {
  id: string;
  provider: string;
  status: string;
  config: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  lastSyncAt: string | null;
  errorMessage: string | null;
};

function IntegrationCard({ integration, onSync, onDelete, onReconnect }: {
  integration: Integration;
  onSync: (id: string) => void;
  onDelete: (id: string) => void;
  onReconnect: (id: string) => void;
}) {
  const statusColors: Record<string, string> = {
    connected: 'bg-blue-500',
    disconnected: 'bg-slate-400',
    error: 'bg-red-500',
    syncing: 'bg-amber-500',
  };

  return (
    <Card className="hover:shadow-md transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Plug className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {integration.provider.charAt(0).toUpperCase() + integration.provider.slice(1)}
                </p>
                <span className={cn('w-2 h-2 rounded-full', statusColors[integration.status] || 'bg-slate-400')} />
                <Badge variant="secondary" className="text-[10px]">{integration.status}</Badge>
              </div>
              {integration.lastSyncAt && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Last synced: {new Date(integration.lastSyncAt).toLocaleString()}
                </p>
              )}
              {integration.errorMessage && (
                <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {integration.errorMessage}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onSync(integration.id)} title="Sync now">
              <RefreshCcw className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onReconnect(integration.id)} title="Reconfigure">
              <Settings className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => onDelete(integration.id)} title="Disconnect">
              <Unplug className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function IntegrationHubPanel() {
  const [activeTab, setActiveTab] = useState('integrations');
  const [loading, setLoading] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [providerName, setProviderName] = useState('');
  const [providerType, setProviderType] = useState('shopify');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [intRes, webhookRes] = await Promise.all([
        fetch('/api/commerce/integrations?workspaceId=default'),
        fetch('/api/commerce/integrations?workspaceId=default&type=webhook'),
      ]);
      const intJson = await intRes.json();
      if (intJson.success) setIntegrations(intJson.data || []);
      const webhookJson = await webhookRes.json();
      if (webhookJson.success) setWebhookEvents(webhookJson.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load integrations';
      setError(message);
      toast({ title: 'Load failed', description: message, variant: 'destructive' });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleConnect = async () => {
    if (!providerName.trim()) return;
    try {
      const res = await fetch('/api/commerce/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerType, name: providerName, workspaceId: 'default' }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Integration created', description: `${providerType} integration connected` });
        setShowConnectForm(false);
        setProviderName('');
        fetchData();
      } else {
        toast({ title: 'Connection failed', description: json.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to create integration', variant: 'destructive' });
    }
  };

  const handleSync = async (id: string) => {
    try {
      const res = await fetch(`/api/commerce/integrations/${id}?action=sync`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', resource: 'all', workspaceId: 'default' }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Sync started', description: 'Integration syncing in background' });
        fetchData();
      }
    } catch (err) {
      toast({ title: 'Sync failed', description: 'Failed to start sync', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/commerce/integrations/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: 'default' }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Disconnected', description: 'Integration removed' });
        fetchData();
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to disconnect', variant: 'destructive' });
    }
  };

  const handleReconnect = async (id: string) => {
    toast({ title: 'Reconfigure', description: 'Opening integration settings' });
  };

  return (
    <motion.div className="p-6 space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Share2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Integration Hub</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Connect and manage your ecommerce platform integrations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCcw className={cn('w-3.5 h-3.5 mr-1.5', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowConnectForm(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Connect
            </Button>
          </div>
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

      {showConnectForm && (
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">New Integration</CardTitle>
              <CardDescription className="text-xs">Connect a new ecommerce platform or service</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {['shopify', 'woocommerce', 'bigcommerce', 'magento', 'custom'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setProviderType(type)}
                      className={cn(
                        'p-3 rounded-lg border text-center transition-all duration-150',
                        providerType === type
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      )}
                    >
                      <Plug className="w-5 h-5 mx-auto mb-1.5 text-slate-500" />
                      <p className="text-xs font-medium capitalize">{type}</p>
                    </button>
                  ))}
                </div>
                <Input
                  placeholder="Integration name (e.g., My Shopify Store)"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  className="text-sm"
                />
                <div className="flex items-center gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowConnectForm(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleConnect} disabled={!providerName.trim()}>
                    <Link2 className="w-3.5 h-3.5 mr-1.5" />
                    Connect
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="integrations">
            <Plug className="w-3.5 h-3.5 mr-1.5" />
            Integrations
            {integrations.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">{integrations.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="webhooks">
            <Webhook className="w-3.5 h-3.5 mr-1.5" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="sync-status">
            <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
            Sync Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="mt-4 space-y-3">
          {loading && integrations.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : integrations.length > 0 ? (
            <ScrollArea className="max-h-[600px]">
              <div className="space-y-3">
                {integrations.map((integration) => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    onSync={handleSync}
                    onDelete={handleDelete}
                    onReconnect={handleReconnect}
                  />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <Plug className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">No integrations connected</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Connect your first ecommerce platform to get started</p>
              <Button size="sm" onClick={() => setShowConnectForm(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Connect Platform
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="webhooks" className="mt-4 space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Webhook Events</CardTitle>
              <CardDescription className="text-xs">Real-time events from connected platforms</CardDescription>
            </CardHeader>
            <CardContent>
              {webhookEvents.length > 0 ? (
                <div className="space-y-2">
                  {webhookEvents.slice(0, 20).map((event: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <Webhook className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{event.type || 'webhook.received'}</p>
                        <p className="text-[10px] text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{event.status || 'received'}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-8">No webhook events yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync-status" className="mt-4 space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Sync History</CardTitle>
              <CardDescription className="text-xs">Data synchronization logs across all integrations</CardDescription>
            </CardHeader>
            <CardContent>
              {integrations.filter(i => i.lastSyncAt).length > 0 ? (
                <div className="space-y-2">
                  {integrations.filter(i => i.lastSyncAt).map((integration) => (
                    <div key={integration.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                        <p className="text-xs font-medium">{integration.provider}</p>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        {integration.lastSyncAt ? new Date(integration.lastSyncAt).toLocaleString() : 'Never'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-8">No sync history available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
