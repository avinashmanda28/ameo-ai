'use client';

import React from 'react';
import {
  Hexagon,
  LayoutDashboard,
  Target,
  TrendingUp,
  Truck,
  DollarSign,
  Search,
  Store,
  PenTool,
  BarChart3,
  Package,
  ShieldCheck,
  Bot,
  Activity,
  Zap,
  Eye,
  Settings,
  Share2,
  Brain,
  FileText,
  Eye as EyeIcon,
  Play,
  BarChart4,
} from 'lucide-react';
import { useWorkspaceStore } from '@/lib/stores/workspace-store';
import { WORKSPACE_MODES, type WorkspaceMode } from '@/lib/types';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// ─── Commerce Navigation Items ────────────────────────────────

interface NavItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  // COMMAND CENTER
  { key: 'overview', label: 'Command Center', icon: LayoutDashboard, group: 'COMMAND CENTER' },

  // COMMERCE INTELLIGENCE
  { key: 'product-intelligence', label: 'Product Intelligence', icon: Target, group: 'COMMERCE INTELLIGENCE' },
  { key: 'trend-discovery', label: 'Trend Discovery', icon: TrendingUp, group: 'COMMERCE INTELLIGENCE' },
  { key: 'supplier-analysis', label: 'Supplier Analysis', icon: Truck, group: 'COMMERCE INTELLIGENCE' },
  { key: 'competitor-intelligence', label: 'Competitor Intel', icon: EyeIcon, group: 'COMMERCE INTELLIGENCE' },
  { key: 'commerce-memory', label: 'Commerce Memory', icon: Brain, group: 'COMMERCE INTELLIGENCE' },

  // COMMERCE OPERATIONS
  { key: 'integration-hub', label: 'Integration Hub', icon: Share2, group: 'COMMERCE OPERATIONS' },
  { key: 'store-automation', label: 'Store Automation', icon: Store, group: 'COMMERCE OPERATIONS' },
  { key: 'pricing', label: 'Pricing', icon: DollarSign, group: 'COMMERCE OPERATIONS' },
  { key: 'seo', label: 'SEO & Listings', icon: Search, group: 'COMMERCE OPERATIONS' },
  { key: 'ad-creative', label: 'Ad Creative', icon: PenTool, group: 'COMMERCE OPERATIONS' },
  { key: 'creative-generation', label: 'Creative Gen', icon: PenTool, group: 'COMMERCE OPERATIONS' },
  { key: 'product-pages', label: 'Product Pages', icon: FileText, group: 'COMMERCE OPERATIONS' },
  { key: 'fulfillment', label: 'Fulfillment', icon: Package, group: 'COMMERCE OPERATIONS' },

  // AGI SWARM
  { key: 'agent-swarm', label: 'Agent Swarm', icon: Bot, group: 'AGI SWARM' },
  { key: 'autonomous-execution', label: 'Autonomous', icon: Play, group: 'AGI SWARM' },
  { key: 'analytics', label: 'Analytics', icon: BarChart3, group: 'AGI SWARM' },
  { key: 'revenue-operations', label: 'Revenue Ops', icon: BarChart4, group: 'AGI SWARM' },
  { key: 'verification', label: 'Verification', icon: ShieldCheck, group: 'AGI SWARM' },

  // SYSTEM
  { key: 'execution-center', label: 'Execution Center', icon: Zap, group: 'SYSTEM' },
  { key: 'runtime-hub', label: 'Runtime Hub', icon: Activity, group: 'SYSTEM' },
  { key: 'observability', label: 'Observability', icon: Eye, group: 'SYSTEM' },
  { key: 'governance', label: 'Governance', icon: Settings, group: 'SYSTEM' },
];

const NAV_GROUPS = ['COMMAND CENTER', 'COMMERCE INTELLIGENCE', 'COMMERCE OPERATIONS', 'AGI SWARM', 'SYSTEM'] as const;

const MODE_ICONS: Record<WorkspaceMode, React.ComponentType<{ className?: string }>> = {
  builder: Zap,
  operations: Activity,
  strategy: TrendingUp,
  governance: ShieldCheck,
};

// ─── Sidebar Component ─────────────────────────────────────────

export function WorkspaceSidebar() {
  const activePanel = useWorkspaceStore((s) => s.activePanel);
  const setActivePanel = useWorkspaceStore((s) => s.setActivePanel);
  const workspace = useWorkspaceStore((s) => s.workspace);
  const setWorkspaceMode = useWorkspaceStore((s) => s.setWorkspaceMode);
  const agents = useWorkspaceStore((s) => s.agents);

  const currentMode = workspace?.mode ?? 'operations';
  const activeAgents = agents.filter((a) => a.status === 'active' || a.status === 'busy').length;

  return (
    <Sidebar collapsible="icon" className="bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800/60">
      {/* ─── Branding ─── */}
      <SidebarHeader className="p-4 pb-3">
        <div className="flex items-center gap-3 px-1">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 shadow-sm">
            <Hexagon className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Ameo AI
            </span>
            <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 tracking-wider uppercase">
              Commerce OS
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator className="bg-slate-200 dark:bg-slate-800/60 mx-3" />

      {/* ─── Mode Switcher ─── */}
      <div className="px-3 pt-3 pb-1 group-data-[collapsible=icon]:px-2">
        <div className="group-data-[collapsible=icon]:hidden">
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 mb-2">
            Mode
          </p>
          <div className="flex flex-col gap-0.5">
            {WORKSPACE_MODES.map((mode) => {
              const ModeIcon = MODE_ICONS[mode.key];
              const isActive = currentMode === mode.key;
              return (
                <button
                  key={mode.key}
                  onClick={() => setWorkspaceMode(mode.key)}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150',
                    'hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-700 dark:hover:text-slate-300',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50',
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200/60 dark:ring-blue-800/40'
                      : 'text-slate-500 dark:text-slate-400'
                  )}
                >
                  <ModeIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <SidebarSeparator className="bg-slate-200 dark:bg-slate-800/60 mx-3" />

      {/* ─── Navigation ─── */}
      <ScrollArea className="flex-1 px-3 py-1">
        <SidebarContent className="p-0 gap-0">
          {NAV_GROUPS.map((group) => {
            const groupItems = NAV_ITEMS.filter((item) => item.group === group);
            return (
              <SidebarGroup key={group} className="px-0">
                <SidebarGroupLabel className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">
                  {group}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {groupItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activePanel === item.key;
                      return (
                        <SidebarMenuItem key={item.key}>
                          <SidebarMenuButton
                            isActive={isActive}
                            tooltip={item.label}
                            onClick={() => setActivePanel(item.key)}
                            className={cn(
                              'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80',
                              isActive && 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 font-medium'
                            )}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })}
        </SidebarContent>
      </ScrollArea>

      {/* ─── Footer Status ─── */}
      <SidebarFooter className="p-3 pt-0">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md group-data-[collapsible=icon]:justify-center">
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                workspace?.status === 'active' ? 'bg-blue-500' : 'bg-slate-400'
              )}
            />
            <span
              className={cn(
                'relative inline-flex h-2 w-2 rounded-full',
                workspace?.status === 'active' ? 'bg-blue-500' : 'bg-slate-400'
              )}
            />
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate group-data-[collapsible=icon]:hidden">
            {workspace?.status === 'active' ? 'Commerce OS Online' : 'Offline'}
          </span>
          {activeAgents > 0 && (
            <Badge
              variant="secondary"
              className="ml-auto text-[10px] h-4 px-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 group-data-[collapsible=icon]:hidden"
            >
              {activeAgents}
            </Badge>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
