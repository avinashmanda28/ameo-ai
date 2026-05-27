'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Store, Sparkles, Loader2, RefreshCcw, Package,
  ShoppingCart, Settings, Download, Upload,
} from 'lucide-react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function StoreAutomationPanel() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <motion.div className="p-6 space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Store className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Store Automation</h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Automated store management, product importing, and inventory sync
        </p>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="import">Import Products</TabsTrigger>
          <TabsTrigger value="sync">Sync Status</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5 text-center">
                <Package className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-slate-500">Products in Store</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-center">
                <ShoppingCart className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-slate-500">Active Orders</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-center">
                <Download className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-slate-500">Pending Imports</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Connected Stores</CardTitle>
              <CardDescription className="text-xs">Your ecommerce platform integrations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Store className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Shopify</p>
                    <p className="text-xs text-slate-500">Ready for integration</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px]">Not Connected</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Import Products from Analysis</CardTitle>
              <CardDescription className="text-xs">Import winning products discovered by the Product Hunter agent</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400 text-center py-8">
                Run Product Intelligence first to find products, then import them here
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Automation Rules</CardTitle>
              <CardDescription className="text-xs">Configure auto-sync and inventory management</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {['Auto-import top scoring products', 'Sync inventory every 6 hours', 'Update pricing daily', 'Fulfill orders automatically'].map((rule) => (
                  <div key={rule} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <div className="w-4 h-4 rounded border-2 border-slate-300 dark:border-slate-600" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">{rule}</p>
                    <Badge variant="secondary" className="text-[10px] ml-auto">Pending</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Platform Configuration</CardTitle>
              <CardDescription className="text-xs">Configure your ecommerce platform connections</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {['Shopify', 'WooCommerce', 'Custom API'].map((platform) => (
                  <div key={platform} className="flex items-center justify-between p-3 rounded-lg border">
                    <p className="text-sm font-medium">{platform}</p>
                    <Button variant="outline" size="sm" className="text-xs">Configure</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
