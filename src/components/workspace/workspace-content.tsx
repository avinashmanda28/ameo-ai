'use client';

import React from 'react';
import {
  LayoutDashboard,
  Target,
  TrendingUp,
  Truck,
  Store,
  DollarSign,
  Search,
  PenTool,
  Package,
  Bot,
  BarChart3,
  ShieldCheck,
  Zap,
  Activity,
  Eye,
  Settings,
  Share2,
  Brain,
  FileText,
  Play,
  BarChart4,
} from 'lucide-react';
import { useWorkspaceStore } from '@/lib/stores/workspace-store';
import { OverviewPanel } from './overview-panel';
import { RuntimeHubPanel } from '@/components/features/runtime/runtime-hub-panel';
import { GovernancePanel } from '@/components/features/governance/governance-panel';
import { ObservabilityPanel } from '@/components/features/monitoring/observability-panel';
import { ProductIntelligencePanel } from '@/components/features/commerce/product-intelligence-panel';
import { TrendDiscoveryPanel } from '@/components/features/commerce/trend-discovery-panel';
import { SupplierAnalysisPanel } from '@/components/features/commerce/supplier-analysis-panel';
import { StoreAutomationPanel } from '@/components/features/commerce/store-automation-panel';
import { PricingPanel } from '@/components/features/commerce/pricing-panel';
import { SEOPanel } from '@/components/features/commerce/seo-panel';
import { AdCreativePanel } from '@/components/features/commerce/ad-creative-panel';
import { FulfillmentPanel } from '@/components/features/commerce/fulfillment-panel';
import { AgentSwarmPanel } from '@/components/features/commerce/agent-swarm-panel';
import { AnalyticsPanel } from '@/components/features/commerce/analytics-panel';
import { VerificationPanel } from '@/components/features/commerce/verification-panel';
import { ExecutionCenterPanel } from '@/components/features/commerce/execution-center-panel';
import { IntegrationHubPanel } from '@/components/features/commerce/integration-hub-panel';
import { CommerceMemoryPanel } from '@/components/features/commerce/commerce-memory-panel';
import { ProductPageGeneratorPanel } from '@/components/features/commerce/product-page-generator-panel';
import { CreativeGenerationPanel } from '@/components/features/commerce/creative-generation-panel';
import { CompetitorIntelligencePanel } from '@/components/features/commerce/competitor-intelligence-panel';
import { AutonomousExecutionPanel } from '@/components/features/commerce/autonomous-execution-panel';
import { RevenueOperationsPanel } from '@/components/features/commerce/revenue-operations-panel';

// ─── Panel Configuration ───────────────────────────────────────

interface PanelConfig {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PANEL_CONFIGS: PanelConfig[] = [
  { key: 'overview', label: 'Command Center', description: 'Commerce operations command center', icon: LayoutDashboard },
  { key: 'product-intelligence', label: 'Product Intelligence', description: 'Winning product discovery and analysis', icon: Target },
  { key: 'trend-discovery', label: 'Trend Discovery', description: 'Viral trend intelligence and momentum tracking', icon: TrendingUp },
  { key: 'supplier-analysis', label: 'Supplier Analysis', description: 'Supplier trust scoring and comparison', icon: Truck },
  { key: 'store-automation', label: 'Store Automation', description: 'Automated store and product management', icon: Store },
  { key: 'pricing', label: 'Pricing', description: 'Dynamic pricing optimization', icon: DollarSign },
  { key: 'seo', label: 'SEO & Listings', description: 'Product listing optimization', icon: Search },
  { key: 'ad-creative', label: 'Ad Creative', description: 'Ad copy and campaign generation', icon: PenTool },
  { key: 'creative-generation', label: 'Creative Gen', description: 'AI ad creative generation and UGC scripts', icon: PenTool },
  { key: 'product-pages', label: 'Product Pages', description: 'AI product page generation', icon: FileText },
  { key: 'fulfillment', label: 'Fulfillment', description: 'Order fulfillment and tracking', icon: Package },
  { key: 'agent-swarm', label: 'Agent Swarm', description: 'AGI commerce agent orchestration', icon: Bot },
  { key: 'autonomous-execution', label: 'Autonomous', description: 'AI-driven autonomous commerce operations', icon: Play },
  { key: 'analytics', label: 'Analytics', description: 'Commerce intelligence and metrics', icon: BarChart3 },
  { key: 'revenue-operations', label: 'Revenue Ops', description: 'Executive revenue dashboard and KPIs', icon: BarChart4 },
  { key: 'verification', label: 'Verification', description: 'AI output verification and quality', icon: ShieldCheck },
  { key: 'integration-hub', label: 'Integration Hub', description: 'Ecommerce platform integrations and sync', icon: Share2 },
  { key: 'commerce-memory', label: 'Commerce Memory', description: 'Agent knowledge base and memory search', icon: Brain },
  { key: 'competitor-intelligence', label: 'Competitor Intel', description: 'Market analysis and competitor tracking', icon: Eye },
  { key: 'execution-center', label: 'Execution Center', description: 'Runtime execution and orchestration', icon: Zap },
  { key: 'runtime-hub', label: 'Runtime Hub', description: 'AI runtime providers and health', icon: Activity },
  { key: 'observability', label: 'Observability', description: 'System observability and debugging', icon: Eye },
  { key: 'governance', label: 'Governance', description: 'Rules, permissions, and compliance', icon: Settings },
];

// ─── Content Router ────────────────────────────────────────────

export function WorkspaceContent() {
  const activePanel = useWorkspaceStore((s) => s.activePanel);

  switch (activePanel) {
    // Command Center
    case 'overview':
      return <OverviewPanel />;

    // Commerce Intelligence
    case 'product-intelligence':
      return <ProductIntelligencePanel />;
    case 'trend-discovery':
      return <TrendDiscoveryPanel />;
    case 'supplier-analysis':
      return <SupplierAnalysisPanel />;

    // Commerce Operations
    case 'store-automation':
      return <StoreAutomationPanel />;
    case 'pricing':
      return <PricingPanel />;
    case 'seo':
      return <SEOPanel />;
    case 'ad-creative':
      return <AdCreativePanel />;
    case 'creative-generation':
      return <CreativeGenerationPanel />;
    case 'product-pages':
      return <ProductPageGeneratorPanel />;
    case 'fulfillment':
      return <FulfillmentPanel />;

    // AGI Swarm
    case 'agent-swarm':
      return <AgentSwarmPanel />;
    case 'autonomous-execution':
      return <AutonomousExecutionPanel />;
    case 'analytics':
      return <AnalyticsPanel />;
    case 'revenue-operations':
      return <RevenueOperationsPanel />;
    case 'verification':
      return <VerificationPanel />;

    // System
    case 'execution-center':
      return <ExecutionCenterPanel />;
    case 'runtime-hub':
      return <RuntimeHubPanel />;
    case 'observability':
      return <ObservabilityPanel />;
    case 'governance':
      return <GovernancePanel />;

    // New Commerce Systems
    case 'integration-hub':
      return <IntegrationHubPanel />;
    case 'commerce-memory':
      return <CommerceMemoryPanel />;
    case 'competitor-intelligence':
      return <CompetitorIntelligencePanel />;

    default:
      return <OverviewPanel />;
  }
}
