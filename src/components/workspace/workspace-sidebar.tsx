'use client';

import React from 'react';
import {
  Hexagon,
  LayoutDashboard,
  GitBranch,
  Cpu,
  Workflow,
  Shield,
  Bot,
  TerminalSquare,
  Terminal,
  BarChart3,
  Hammer,
  Activity,
  Compass,
  Zap,
  FileCode,
  ListOrdered,
  AlertOctagon,
  Eye,
} from 'lucide-react';
import { useWorkspaceStore } from '@/lib/store/workspace-store';
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

// ─── Navigation Items ──────────────────────────────────────────

interface NavItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, group: 'OVERVIEW' },
  { key: 'company-graph', label: 'Company Graph', icon: GitBranch, group: 'SYSTEMS' },
  { key: 'runtime-hub', label: 'Runtime Hub', icon: Cpu, group: 'SYSTEMS' },
  { key: 'workflows', label: 'Workflows', icon: Workflow, group: 'SYSTEMS' },
  { key: 'governance', label: 'Governance', icon: Shield, group: 'SYSTEMS' },
  { key: 'execution', label: 'Execution', icon: Zap, group: 'SYSTEMS' },
  { key: 'queue', label: 'Queue', icon: ListOrdered, group: 'SYSTEMS' },
  { key: 'artifacts', label: 'Artifacts', icon: FileCode, group: 'SYSTEMS' },
  { key: 'developer-console', label: 'Developer Console', icon: Terminal, group: 'OPERATIONS' },
  { key: 'observability', label: 'Observability', icon: Eye, group: 'OPERATIONS' },
  { key: 'agents', label: 'Agents', icon: Bot, group: 'INTELLIGENCE' },
  { key: 'terminal', label: 'Terminal', icon: TerminalSquare, group: 'INTELLIGENCE' },
  { key: 'reports', label: 'Reports', icon: BarChart3, group: 'INTELLIGENCE' },
  { key: 'runtime-metrics', label: 'Runtime Metrics', icon: Activity, group: 'INTELLIGENCE' },
  { key: 'failures', label: 'Failures', icon: AlertOctagon, group: 'INTELLIGENCE' },
];

const NAV_GROUPS = ['OVERVIEW', 'SYSTEMS', 'OPERATIONS', 'INTELLIGENCE'] as const;

const MODE_ICONS: Record<WorkspaceMode, React.ComponentType<{ className?: string }>> = {
  builder: Hammer,
  operations: Activity,
  strategy: Compass,
  governance: Shield,
};

// ─── Sidebar Component ─────────────────────────────────────────

export function WorkspaceSidebar() {
  const activePanel = useWorkspaceStore((s) => s.activePanel);
  const setActivePanel = useWorkspaceStore((s) => s.setActivePanel);
  const workspace = useWorkspaceStore((s) => s.workspace);
  const setWorkspaceMode = useWorkspaceStore((s) => s.setWorkspaceMode);
  const agents = useWorkspaceStore((s) => s.agents);

  const currentMode = workspace?.mode ?? 'builder';
  const activeAgents = agents.filter((a) => a.status === 'active' || a.status === 'busy').length;

  return (
    <Sidebar collapsible="icon" className="bg-zinc-950 text-zinc-300 border-r border-zinc-800/60">
      {/* ─── Branding ─── */}
      <SidebarHeader className="p-4 pb-2">
        <div className="flex items-center gap-2.5 px-1">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800/80 ring-1 ring-zinc-700/50">
            <Hexagon className="w-4.5 h-4.5 text-zinc-400" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight text-zinc-100">
              Ameo AI
            </span>
            <span className="text-[10px] font-medium text-zinc-500 tracking-wider uppercase">
              Governed AI Platform
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator className="bg-zinc-800/60 mx-3" />

      {/* ─── Mode Switcher ─── */}
      <div className="px-3 pt-3 pb-1 group-data-[collapsible=icon]:px-2">
        <div className="group-data-[collapsible=icon]:hidden">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest px-1 mb-2">
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
                    'hover:bg-zinc-800/80 hover:text-zinc-200',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600',
                    isActive
                      ? 'bg-zinc-800 text-zinc-100 ring-1 ring-zinc-700/60'
                      : 'text-zinc-500'
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

      <SidebarSeparator className="bg-zinc-800/60 mx-3" />

      {/* ─── Navigation ─── */}
      <ScrollArea className="flex-1 px-3 py-1">
        <SidebarContent className="p-0 gap-0">
          {NAV_GROUPS.map((group) => {
            const groupItems = NAV_ITEMS.filter((item) => item.group === group);
            return (
              <SidebarGroup key={group} className="px-0">
                <SidebarGroupLabel className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest px-1">
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
                              'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80',
                              isActive && 'text-zinc-100 bg-zinc-800 font-medium'
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
                workspace?.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-500'
              )}
            />
            <span
              className={cn(
                'relative inline-flex h-2 w-2 rounded-full',
                workspace?.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-600'
              )}
            />
          </span>
          <span className="text-[11px] text-zinc-500 truncate group-data-[collapsible=icon]:hidden">
            {workspace?.status === 'active' ? 'System Online' : 'System Offline'}
          </span>
          {activeAgents > 0 && (
            <Badge
              variant="secondary"
              className="ml-auto text-[10px] h-4 px-1.5 bg-zinc-800 text-zinc-400 border-zinc-700 group-data-[collapsible=icon]:hidden"
            >
              {activeAgents}
            </Badge>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
