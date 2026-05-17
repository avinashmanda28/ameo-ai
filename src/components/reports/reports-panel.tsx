'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Workflow,
  Bot,
  Star,
  TrendingUp,
  Plus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useWorkspaceStore } from '@/lib/store/workspace-store';
import {
  RATING_DIMENSIONS,
  type BuildRating,
  type RatingTargetType,
  type ApiResponse,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Animation Variants ────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.4, 0.25, 1] as const },
  },
};

// ─── Types ─────────────────────────────────────────────────────

interface RatingStats {
  totalRatings: number;
  averageOverallScore: number | null;
  dimensions: Record<string, { avg: number; min: number; max: number; count: number }>;
  ratingsByTargetType: Record<string, number>;
}

interface DistributionBucket {
  range: string;
  count: number;
  fill: string;
}

// ─── Helpers ───────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (score === null) return 'text-zinc-400';
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBgColor(score: number | null): string {
  if (score === null) return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
  if (score >= 80) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
  if (score >= 50) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
}

function barColor(value: number): string {
  if (value >= 80) return 'bg-emerald-500';
  if (value >= 60) return 'bg-sky-500';
  if (value >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

function getDistribution(ratings: BuildRating[]): DistributionBucket[] {
  const buckets = [
    { range: '0–20', min: 0, max: 20, count: 0, fill: '#ef4444' },
    { range: '20–40', min: 20, max: 40, count: 0, fill: '#f97316' },
    { range: '40–60', min: 40, max: 60, count: 0, fill: '#f59e0b' },
    { range: '60–80', min: 60, max: 80, count: 0, fill: '#06b6d4' },
    { range: '80–100', min: 80, max: 100, count: 0, fill: '#10b981' },
  ];

  for (const r of ratings) {
    if (r.overallScore !== null && r.overallScore !== undefined) {
      const s = Math.floor(r.overallScore);
      for (const b of buckets) {
        if (s >= b.min && s < b.max) {
          b.count++;
          break;
        }
        // Handle edge case for 100
        if (s === 100 && b.max === 100) {
          b.count++;
          break;
        }
      }
    }
  }

  return buckets;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ─── Metric Card (reuse pattern from overview) ─────────────────

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

function MetricCard({ title, value, subtitle, icon: Icon, accentColor }: MetricCardProps) {
  return (
    <motion.div variants={itemVariants}>
      <Card className="relative overflow-hidden hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                {title}
              </p>
              <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            </div>
            <div
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-xl shrink-0',
                accentColor
              )}
            >
              <Icon className="w-5 h-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Submit Rating Dialog ──────────────────────────────────────

function SubmitRatingDialog({ onSubmitted }: { onSubmitted: () => void }) {
  const workspace = useWorkspaceStore((s) => s.workspace);

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [targetType, setTargetType] = useState<RatingTargetType>('workflow');
  const [notes, setNotes] = useState('');
  const [dimensions, setDimensions] = useState<Record<string, number>>({
    architectureQuality: 50,
    runtimeStability: 50,
    uiIntegrity: 50,
    workflowQuality: 50,
    verificationConfidence: 50,
    hallucinationRisk: 50,
    operationalStability: 50,
  });

  const overallScore = Object.values(dimensions).reduce((a, b) => a + b, 0) / 7;

  const handleSubmit = async () => {
    if (!targetId.trim()) {
      toast.error('Please enter a Target ID');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace?.id,
          targetId: targetId.trim(),
          targetType,
          ...dimensions,
          notes: notes.trim() || undefined,
        }),
      });
      const data: ApiResponse<BuildRating> = await res.json();

      if (data.success) {
        toast.success('Rating submitted successfully');
        setOpen(false);
        // Reset form
        setTargetId('');
        setNotes('');
        setDimensions({
          architectureQuality: 50,
          runtimeStability: 50,
          uiIntegrity: 50,
          workflowQuality: 50,
          verificationConfidence: 50,
          hallucinationRisk: 50,
          operationalStability: 50,
        });
        onSubmitted();
      } else {
        toast.error(data.error ?? 'Failed to submit rating');
      }
    } catch {
      toast.error('Network error — failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Submit Rating
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Build Rating</DialogTitle>
          <DialogDescription>
            Rate a build target across 7 quality dimensions. The overall score is auto-calculated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Target Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Target ID</label>
              <Input
                placeholder="e.g. wf-build-001"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Type</label>
              <Select
                value={targetType}
                onValueChange={(v) => setTargetType(v as RatingTargetType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="workflow">Workflow</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="runtime">Runtime</SelectItem>
                  <SelectItem value="build">Build</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Overall Score Preview */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
            <span className="text-sm font-medium">Auto-Calculated Overall Score</span>
            <span className={cn('text-lg font-bold tabular-nums', scoreColor(overallScore))}>
              {overallScore.toFixed(1)}
            </span>
          </div>

          {/* Dimension Sliders */}
          <div className="space-y-4">
            {RATING_DIMENSIONS.map((dim) => (
              <div key={dim.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{dim.label}</label>
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums min-w-[2.5rem] text-right',
                      scoreColor(dimensions[dim.key])
                    )}
                  >
                    {dimensions[dim.key]}
                  </span>
                </div>
                <Slider
                  value={[dimensions[dim.key]]}
                  onValueChange={([v]) =>
                    setDimensions((prev) => ({ ...prev, [dim.key]: v }))
                  }
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea
              placeholder="Add observations, issues, or context for this rating..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !targetId.trim()}>
            {submitting ? 'Submitting...' : 'Submit Rating'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Loading Skeleton ──────────────────────────────────────────

function LoadingReports() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

// ─── Custom Tooltip for Chart ──────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: DistributionBucket }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border rounded-lg px-3 py-2 shadow-md text-sm">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">
        {payload[0].value} rating{payload[0].value !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

// ─── Reports Panel ─────────────────────────────────────────────

export function ReportsPanel() {
  const workflows = useWorkspaceStore((s) => s.workflows);
  const agents = useWorkspaceStore((s) => s.agents);
  const buildRatings = useWorkspaceStore((s) => s.buildRatings);
  const setBuildRatings = useWorkspaceStore((s) => s.setBuildRatings);
  const addBuildRating = useWorkspaceStore((s) => s.addBuildRating);

  const [stats, setStats] = useState<RatingStats | null>(null);
  const [ratings, setRatings] = useState<BuildRating[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [ratingsRes, statsRes] = await Promise.all([
        fetch('/api/ratings'),
        fetch('/api/ratings/stats'),
      ]);
      const ratingsData: ApiResponse<BuildRating[]> = await ratingsRes.json();
      const statsData: ApiResponse<RatingStats> = await statsRes.json();

      if (ratingsData.success && ratingsData.data) {
        setRatings(ratingsData.data);
        setBuildRatings(ratingsData.data);
      }
      if (statsData.success && statsData.data) {
        setStats(statsData.data);
      }
    } catch {
      // silent fail — use store data
      setRatings(buildRatings);
    } finally {
      setLoading(false);
    }
  }, [buildRatings, setBuildRatings]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <LoadingReports />;

  const distribution = getDistribution(ratings);
  const avgScore = stats?.averageOverallScore ?? null;

  return (
    <motion.div
      className="p-6 space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* ─── Header ─── */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-6 h-6 text-foreground" />
            <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            System-wide reporting and build quality ratings
          </p>
        </div>
        <SubmitRatingDialog onSubmitted={fetchData} />
      </motion.div>

      {/* ─── Overview Metrics ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Workflows"
          value={workflows.length}
          subtitle={`${workflows.filter((w) => w.state === 'active').length} active`}
          icon={Workflow}
          accentColor="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
        />
        <MetricCard
          title="Total Agents"
          value={agents.length}
          subtitle={`${agents.filter((a) => a.status === 'active' || a.status === 'busy').length} active`}
          icon={Bot}
          accentColor="bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
        />
        <MetricCard
          title="Total Ratings"
          value={stats?.totalRatings ?? ratings.length}
          subtitle="Across all targets"
          icon={Star}
          accentColor="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
        />
        <MetricCard
          title="Avg Overall Score"
          value={avgScore !== null ? avgScore.toFixed(1) : '—'}
          subtitle={avgScore !== null ? (avgScore >= 80 ? 'Excellent' : avgScore >= 50 ? 'Fair' : 'Needs Work') : 'No data'}
          icon={TrendingUp}
          accentColor="bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400"
        />
      </div>

      {/* ─── Distribution + Dimensions ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rating Distribution Chart */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">Rating Distribution</CardTitle>
              </div>
              <CardDescription>Count of ratings by overall score range</CardDescription>
            </CardHeader>
            <CardContent>
              {ratings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BarChart3 className="w-8 h-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No ratings data yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    Submit a rating to see the distribution
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={distribution} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="range"
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {distribution.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Dimension Scores Table */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">Dimension Scores</CardTitle>
              </div>
              <CardDescription>Average scores per rating dimension</CardDescription>
            </CardHeader>
            <CardContent>
              {!stats || stats.totalRatings === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <TrendingUp className="w-8 h-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No dimension data yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    Submit ratings to see dimension breakdowns
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {RATING_DIMENSIONS.map((dim) => {
                    const dimStat = stats.dimensions[dim.key];
                    const value = dimStat?.count && dimStat.count > 0 ? dimStat.avg : 0;
                    return (
                      <div key={dim.key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground truncate max-w-[60%]">
                            {dim.label}
                          </span>
                          <span
                            className={cn(
                              'text-xs font-semibold tabular-nums',
                              scoreColor(value)
                            )}
                          >
                            {value.toFixed(1)}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className={cn('h-full rounded-full', barColor(value))}
                            initial={{ width: 0 }}
                            animate={{ width: `${value}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── Latest Ratings ─── */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">Latest Ratings</CardTitle>
              </div>
              <Badge variant="secondary" className="text-[10px] h-5">
                {ratings.length} total
              </Badge>
            </div>
            <CardDescription>Recent build quality assessments</CardDescription>
          </CardHeader>
          <CardContent>
            {ratings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Star className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No ratings submitted yet</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  Click &quot;Submit Rating&quot; to add your first assessment
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Target</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead className="hidden md:table-cell">Notes</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {ratings.map((rating) => (
                        <motion.tr
                          key={rating.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.3 }}
                          className="hover:bg-muted/50 border-b transition-colors"
                        >
                          <TableCell className="font-mono text-xs">{rating.targetId}</TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className="text-[10px] h-5 px-1.5 capitalize"
                            >
                              {rating.targetType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={cn(
                                'inline-flex items-center justify-center min-w-[3rem] px-2 py-0.5 rounded-md text-xs font-bold tabular-nums',
                                scoreBgColor(rating.overallScore)
                              )}
                            >
                              {rating.overallScore !== null
                                ? rating.overallScore.toFixed(1)
                                : '—'}
                            </span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell max-w-[200px] truncate text-xs text-muted-foreground">
                            {rating.notes || '—'}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(rating.createdAt)}
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
