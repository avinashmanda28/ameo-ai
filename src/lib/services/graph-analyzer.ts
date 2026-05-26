// ═══════════════════════════════════════════════════════════════
// AMEO AI — Workflow Graph Intelligence (Phase 1.7)
// Dependency analysis and graph operations for the workflow
// engine. Detects circular dependencies, deadlocks, orphans,
// and generates execution plans via topological sort.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  GraphAnalysisResult,
  GraphIssue,
  GraphIssueType,
  Workflow,
  WorkflowDependency,
} from '@/lib/types';

// ─── Types ───

/** Adjacency list representation of the workflow graph */
export interface WorkflowGraphData {
  nodes: Map<string, Workflow>;
  adjacency: Map<string, string[]>;       // source → [targets]
  reverseAdjacency: Map<string, string[]>; // target → [sources]
  dependencies: WorkflowDependency[];
}

// ─── GraphAnalyzer Class ───

class GraphAnalyzer {
  /**
   * Full graph analysis for a workspace.
   * Returns comprehensive analysis including cycle detection, deadlocks,
   * orphans, execution plan, and integrity score.
   */
  async analyzeGraph(workspaceId: string): Promise<GraphAnalysisResult> {
    const graphData = await this.getWorkflowGraphData(workspaceId);

    const issues: GraphIssue[] = [];

    // Run all detection algorithms
    const circularIssues = await this.detectCircularDependencies(workspaceId, graphData);
    issues.push(...circularIssues);

    const deadlockIssues = await this.detectDeadlocks(workspaceId, graphData);
    issues.push(...deadlockIssues);

    const orphanIssues = await this.findOrphans(workspaceId, graphData);
    issues.push(...orphanIssues);

    // Check for self-references
    for (const dep of graphData.dependencies) {
      if (dep.sourceId === dep.targetId) {
        issues.push({
          type: 'self_reference',
          severity: 'error',
          description: `Workflow ${dep.sourceId} has a self-referencing dependency`,
          affectedNodes: [dep.sourceId],
        });
      }
    }

    // Check for missing dependency targets
    for (const dep of graphData.dependencies) {
      if (!graphData.nodes.has(dep.targetId)) {
        issues.push({
          type: 'missing_dependency',
          severity: 'warning',
          description: `Dependency from ${dep.sourceId} targets non-existent workflow ${dep.targetId}`,
          affectedNodes: [dep.sourceId, dep.targetId],
        });
      }
      if (!graphData.nodes.has(dep.sourceId)) {
        issues.push({
          type: 'missing_dependency',
          severity: 'warning',
          description: `Dependency source ${dep.sourceId} does not exist, targets ${dep.targetId}`,
          affectedNodes: [dep.sourceId, dep.targetId],
        });
      }
    }

    // Generate execution plan
    const executionPlan = this.generateExecutionPlan(graphData);

    // Calculate integrity score
    const integrityScore = this.calculateIntegrityScore({
      isValid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
      nodeCount: graphData.nodes.size,
      edgeCount: graphData.dependencies.length,
      executionPlan,
      integrityScore: 0, // will be set by calculateIntegrityScore
    });

    const hasErrors = issues.some((i) => i.severity === 'error');

    return {
      isValid: !hasErrors,
      issues,
      nodeCount: graphData.nodes.size,
      edgeCount: graphData.dependencies.length,
      executionPlan,
      integrityScore,
    };
  }

  /**
   * DFS-based circular dependency detection.
   * Returns GraphIssue[] for each cycle found.
   */
  async detectCircularDependencies(
    workspaceId: string,
    graphData?: WorkflowGraphData,
  ): Promise<GraphIssue[]> {
    if (!graphData) {
      graphData = await this.getWorkflowGraphData(workspaceId);
    }

    const issues: GraphIssue[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    function dfs(nodeId: string, path: string[]): void {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = graphData!.adjacency.get(nodeId) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        } else if (recursionStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor);
          const cycle = [...path.slice(cycleStart), neighbor];
          cycles.push(cycle);
        }
      }

      recursionStack.delete(nodeId);
    }

    // Run DFS from every unvisited node
    for (const nodeId of graphData.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }

    // Deduplicate cycles (same cycle can be found from different starting points)
    const seenCycleSets = new Set<string>();
    for (const cycle of cycles) {
      const cycleNodes = cycle.slice(0, -1).sort();
      const cycleKey = cycleNodes.join(',');
      if (!seenCycleSets.has(cycleKey)) {
        seenCycleSets.add(cycleKey);
        const nodeNames = cycle.map((id) => {
          const workflow = graphData.nodes.get(id);
          return workflow ? `${workflow.name}(${id})` : id;
        });
        issues.push({
          type: 'circular_dependency',
          severity: 'error',
          description: `Circular dependency detected: ${nodeNames.join(' → ')}`,
          affectedNodes: cycle.slice(0, -1),
        });
      }
    }

    return issues;
  }

  /**
   * Detect deadlocked workflows — workflows in 'blocked' or 'active' state
   * that are waiting on each other through dependency chains.
   */
  async detectDeadlocks(
    workspaceId: string,
    graphData?: WorkflowGraphData,
  ): Promise<GraphIssue[]> {
    if (!graphData) {
      graphData = await this.getWorkflowGraphData(workspaceId);
    }

    const issues: GraphIssue[] = [];

    // Get workflows that are in blocked or active state
    const blockedWorkflows = Array.from(graphData.nodes.values()).filter(
      (w) => w.state === 'blocked' || w.state === 'active',
    );

    for (const blocked of blockedWorkflows) {
      // Check if this workflow is waiting on another blocked workflow
      const deps = graphData.reverseAdjacency.get(blocked.id) ?? [];

      for (const depSourceId of deps) {
        const depWorkflow = graphData.nodes.get(depSourceId);
        if (
          depWorkflow &&
          (depWorkflow.state === 'blocked' || depWorkflow.state === 'active')
        ) {
          // Check reverse: does the dependency also depend on this blocked workflow?
          const reverseDeps = graphData.reverseAdjacency.get(depSourceId) ?? [];
          if (reverseDeps.includes(blocked.id)) {
            issues.push({
              type: 'deadlock',
              severity: 'error',
              description: `Deadlock detected between '${blocked.name}' and '${depWorkflow.name}' — both are blocked/active and depend on each other`,
              affectedNodes: [blocked.id, depSourceId],
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Find orphan workflows — those with no dependencies (no incoming or outgoing edges).
   */
  async findOrphans(
    workspaceId: string,
    graphData?: WorkflowGraphData,
  ): Promise<GraphIssue[]> {
    if (!graphData) {
      graphData = await this.getWorkflowGraphData(workspaceId);
    }

    const issues: GraphIssue[] = [];

    for (const [nodeId, workflow] of graphData.nodes) {
      const outgoing = graphData.adjacency.get(nodeId) ?? [];
      const incoming = graphData.reverseAdjacency.get(nodeId) ?? [];

      if (outgoing.length === 0 && incoming.length === 0) {
        // Only flag as orphan if not in draft state (drafts are expected to be disconnected)
        if (workflow.state !== 'draft' && workflow.state !== 'archived') {
          issues.push({
            type: 'orphan',
            severity: 'warning',
            description: `Workflow '${workflow.name}' (${workflow.state}) has no dependencies — it's disconnected from the workflow graph`,
            affectedNodes: [nodeId],
          });
        }
      }
    }

    return issues;
  }

  /**
   * Generate execution plan via topological sort (Kahn's algorithm).
   * Returns layers of workflow IDs that can be executed in parallel.
   * If cycles exist, returns an empty plan with the cycle-affected nodes excluded.
   */
  generateExecutionPlan(graphData: WorkflowGraphData): string[][] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // Initialize
    for (const nodeId of graphData.nodes.keys()) {
      inDegree.set(nodeId, 0);
      adjacency.set(nodeId, []);
    }

    // Build in-degree counts (only count edges where both nodes exist)
    for (const dep of graphData.dependencies) {
      if (graphData.nodes.has(dep.sourceId) && graphData.nodes.has(dep.targetId)) {
        inDegree.set(dep.targetId, (inDegree.get(dep.targetId) ?? 0) + 1);
        const neighbors = adjacency.get(dep.sourceId) ?? [];
        neighbors.push(dep.targetId);
        adjacency.set(dep.sourceId, neighbors);
      }
    }

    // Start with nodes that have no incoming edges
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    const plan: string[][] = [];
    const processed = new Set<string>();

    while (queue.length > 0) {
      // All nodes currently in the queue can be executed in parallel
      plan.push([...queue]);

      const nextQueue: string[] = [];

      for (const nodeId of queue) {
        processed.add(nodeId);
        const neighbors = adjacency.get(nodeId) ?? [];
        for (const neighbor of neighbors) {
          const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
          inDegree.set(neighbor, newDegree);
          if (newDegree === 0 && !processed.has(neighbor)) {
            nextQueue.push(neighbor);
          }
        }
      }

      // Replace queue with next level
      queue.length = 0;
      queue.push(...nextQueue);
    }

    // If not all nodes were processed, there's a cycle
    if (processed.size < graphData.nodes.size) {
      const unprocessed = Array.from(graphData.nodes.keys()).filter(
        (id) => !processed.has(id),
      );
      // Append remaining nodes as a fallback layer (they're in cycles)
      if (unprocessed.length > 0) {
        plan.push(unprocessed);
      }
    }

    return plan;
  }

  /**
   * Calculate an integrity score (0-100) based on graph health.
   * Factors: error issues (-15 each), warning issues (-5 each),
   * cycle detection (-20), orphan ratio, node/edge ratio.
   */
  calculateIntegrityScore(analysis: GraphAnalysisResult): number {
    let score = 100;

    const errorIssues = analysis.issues.filter((i) => i.severity === 'error');
    const warningIssues = analysis.issues.filter((i) => i.severity === 'warning');

    // Deduct for errors
    score -= errorIssues.length * 15;
    // Deduct for warnings
    score -= warningIssues.length * 5;

    // Additional penalty for circular dependencies
    const circularCount = analysis.issues.filter((i) => i.type === 'circular_dependency').length;
    if (circularCount > 0) {
      score -= 20;
    }

    // Additional penalty for deadlocks
    const deadlockCount = analysis.issues.filter((i) => i.type === 'deadlock').length;
    if (deadlockCount > 0) {
      score -= 15;
    }

    // Orphan penalty (ratio-based)
    if (analysis.nodeCount > 0) {
      const orphanCount = analysis.issues.filter((i) => i.type === 'orphan').length;
      const orphanRatio = orphanCount / analysis.nodeCount;
      score -= Math.round(orphanRatio * 20);
    }

    // Ensure valid graph has at least 50 if there are nodes
    if (analysis.nodeCount > 0 && score < 50 && analysis.isValid) {
      score = Math.max(score, 50);
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Build the full graph data structure for a workspace.
   * Returns adjacency list, reverse adjacency, node map, and all dependencies.
   */
  async getWorkflowGraphData(workspaceId: string): Promise<WorkflowGraphData> {
    const [workflows, dependencies] = await Promise.all([
      db.workflow.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'asc' },
      }),
      db.workflowDependency.findMany({
        where: {
          OR: [
            { source: { workspaceId } },
            { target: { workspaceId } },
          ],
        },
      }),
    ]);

    const nodes = new Map<string, Workflow>();
    for (const w of workflows) {
      nodes.set(w.id, w as unknown as Workflow);
    }

    const adjacency = new Map<string, string[]>();
    const reverseAdjacency = new Map<string, string[]>();

    for (const w of workflows) {
      adjacency.set(w.id, []);
      reverseAdjacency.set(w.id, []);
    }

    for (const dep of dependencies) {
      // Forward edge: source → target
      const forwardList = adjacency.get(dep.sourceId) ?? [];
      forwardList.push(dep.targetId);
      adjacency.set(dep.sourceId, forwardList);

      // Reverse edge: target → source (for dead end detection)
      const reverseList = reverseAdjacency.get(dep.targetId) ?? [];
      reverseList.push(dep.sourceId);
      reverseAdjacency.set(dep.targetId, reverseList);
    }

    return {
      nodes,
      adjacency,
      reverseAdjacency,
      dependencies: dependencies as unknown as WorkflowDependency[],
    };
  }
}

// ─── Singleton ───

let instance: GraphAnalyzer | null = null;

/**
 * Get the singleton GraphAnalyzer instance.
 */
export function getGraphAnalyzer(): GraphAnalyzer {
  if (!instance) {
    instance = new GraphAnalyzer();
  }
  return instance;
}
