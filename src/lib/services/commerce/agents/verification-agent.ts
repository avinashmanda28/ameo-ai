// ═══════════════════════════════════════════════════════════════
// AMEO AI — Verification Agent
// Validates AI outputs, detects hallucinations, verifies execution
// ═══════════════════════════════════════════════════════════════

import { BaseCommerceAgent, type AgentContext } from './base-agent';
import type { AgentExecutionResult } from './types';

export class VerificationAgent extends BaseCommerceAgent {
  constructor() {
    super('verification-agent', 'Verification Agent');
  }

  async execute(ctx: AgentContext): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    const { workspaceId, input } = ctx;
    const artifacts: AgentExecutionResult['artifacts'] = [];

    try {
      const targetData = (input.targetData as Record<string, unknown>) || {};
      const dataType = (input.dataType as string) || 'product_analysis';
      const sourceAgent = (input.sourceAgent as string) || '';
      const strictness = (input.strictness as string) || 'normal'; // normal | strict | relaxed

      await this.emitEvent(workspaceId, 'agent.verification-agent.start', {
        dataType, sourceAgent, strictness,
      });

      // Build verification rules based on data type
      const verificationRules = this.getVerificationRules(dataType);

      // Run verification
      const issues: string[] = [];
      const warnings: string[] = [];
      let confidenceScore = 100;
      let hallucinationRisk = 0;

      // Check each rule against the data
      for (const rule of verificationRules) {
        const result = this.checkRule(rule, targetData, strictness);
        if (result.issue) issues.push(result.issue);
        if (result.warning) warnings.push(result.warning);
        if (result.penalty) {
          confidenceScore -= result.penalty;
          hallucinationRisk += result.penalty * 0.5;
        }
      }

      // AI-driven verification for complex patterns
      const dataString = JSON.stringify(targetData).slice(0, 1000);
      if (dataString.length > 50) {
        const verificationPrompt = `You are an AI verification expert. Review this data for hallucination risks and factual accuracy:

Data type: ${dataType}
Source agent: ${sourceAgent}
Strictness: ${strictness}

Data to verify:
${dataString.slice(0, 500)}

Analyze for:
1. Unrealistic claims (e.g., 100% profit margins, guaranteed results)
2. Made-up numbers or statistics
3. Contradictions within the data
4. Missing critical fields
5. Generic/gpt-sounding text that lacks specificity

Output as JSON:
- hallucinationRisk: number (0-100)
- confidenceScore: number (0-100)
- issuesFound: { severity: "critical" | "high" | "medium" | "low", description: string }[]
- warnings: string[]
- overallVerdict: "pass" | "needs_review" | "fail"
- recommendations: string[]`;

        const raw = await this.runPrompt(verificationPrompt, 'You are a strict AI output verifier. Prefer to flag suspicious content.');
        try {
          const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const aiVerdict = JSON.parse(cleaned);
          hallucinationRisk = Math.max(hallucinationRisk, aiVerdict.hallucinationRisk || 0);
          confidenceScore = Math.min(confidenceScore, aiVerdict.confidenceScore || 50);

          if (aiVerdict.issuesFound) {
            for (const issue of aiVerdict.issuesFound) {
              if (issue.severity === 'critical' || issue.severity === 'high') {
                issues.push(issue.description);
              } else {
                warnings.push(issue.description);
              }
            }
          }
          if (aiVerdict.warnings) warnings.push(...aiVerdict.warnings);
        } catch {
          // AI verification failed; use rule-based results
        }
      }

      const verdict = confidenceScore >= 80 && hallucinationRisk <= 20
        ? 'pass'
        : confidenceScore >= 50 ? 'needs_review' : 'fail';

      artifacts.push({
        type: 'analysis',
        title: `Verification Report - ${dataType}`,
        content: JSON.stringify({
          dataType,
          sourceAgent,
          strictness,
          verdict,
          confidenceScore: Math.max(0, Math.round(confidenceScore)),
          hallucinationRisk: Math.min(100, Math.round(hallucinationRisk)),
          issues,
          warnings,
          rulesChecked: verificationRules.length,
          aiVerificationApplied: dataString.length > 50,
        }, null, 2),
        metadata: { verdict, confidenceScore, hallucinationRisk, issuesFound: issues.length },
      });

      await this.createArtifact(workspaceId, ctx.taskId, artifacts[0]);

      const durationMs = Date.now() - startTime;

      await this.emitEvent(workspaceId, 'agent.verification-agent.complete', {
        verdict,
        confidenceScore,
        hallucinationRisk,
        issuesFound: issues.length,
        durationMs,
      });

      return {
        success: true,
        taskId: ctx.taskId,
        agentType: this.agentType,
        output: {
          verdict,
          confidenceScore: Math.max(0, Math.round(confidenceScore)),
          hallucinationRisk: Math.min(100, Math.round(hallucinationRisk)),
          issues,
          warnings,
          rulesChecked: verificationRules.length,
          aiVerificationApplied: dataString.length > 50,
          recommendations: this.getRecommendations(verdict, issues),
        },
        confidence: confidenceScore / 100,
        error: null,
        durationMs,
        artifacts,
        events: ['agent.verification-agent.complete'],
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      return {
        success: false,
        taskId: ctx.taskId,
        agentType: this.agentType,
        output: {},
        confidence: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs,
        artifacts,
        events: ['agent.verification-agent.error'],
      };
    }
  }

  private getVerificationRules(dataType: string): Array<{ field: string; type: string; penalty: number; description: string }> {
    const commonRules = [
      { field: 'name', type: 'required-string', penalty: 15, description: 'Missing name field' },
      { field: 'confidence', type: 'range:0-100', penalty: 10, description: 'Confidence out of valid range' },
    ];

    const typeRules: Record<string, Array<{ field: string; type: string; penalty: number; description: string }>> = {
      'product_analysis': [
        ...commonRules,
        { field: 'demandScore', type: 'range:0-100', penalty: 15, description: 'Demand score out of range' },
        { field: 'profitMargin', type: 'range:0-100', penalty: 15, description: 'Profit margin unrealistic' },
        { field: 'overallScore', type: 'range:0-100', penalty: 10, description: 'Overall score out of range' },
      ],
      'trend_analysis': [
        ...commonRules,
        { field: 'viralScore', type: 'range:0-100', penalty: 15, description: 'Viral score out of range' },
        { field: 'momentumScore', type: 'range:0-100', penalty: 10, description: 'Momentum score out of range' },
        { field: 'marketTiming', type: 'enum:early,growth,peak,saturation,decline', penalty: 10, description: 'Invalid market timing value' },
      ],
      'supplier_analysis': [
        ...commonRules,
        { field: 'trustScore', type: 'range:0-100', penalty: 15, description: 'Trust score out of range' },
        { field: 'riskScore', type: 'range:0-100', penalty: 15, description: 'Risk score out of range' },
      ],
      'pricing': [
        { field: 'suggestedRetailPrice', type: 'required-number', penalty: 20, description: 'No retail price suggested' },
        { field: 'optimalMargin', type: 'range:0-100', penalty: 15, description: 'Invalid margin percentage' },
      ],
    };
    return typeRules[dataType] || commonRules;
  }

  private checkRule(
    rule: { field: string; type: string; penalty: number; description: string },
    data: Record<string, unknown>,
    strictness: string,
  ): { issue?: string; warning?: string; penalty?: number } {
    const value = data[rule.field];
    const penaltyMultiplier = strictness === 'strict' ? 1.5 : strictness === 'relaxed' ? 0.5 : 1;

    if (rule.type === 'required-string') {
      if (!value || typeof value !== 'string' || value.trim().length === 0) {
        return { issue: rule.description, penalty: Math.round(rule.penalty * penaltyMultiplier) };
      }
    }

    if (rule.type.startsWith('range:')) {
      const [min, max] = rule.type.replace('range:', '').split('-').map(Number);
      const numVal = typeof value === 'number' ? value : Number(value);
      if (isNaN(numVal) || numVal < min || numVal > max) {
        return { warning: `${rule.description} (value: ${value})`, penalty: Math.round(rule.penalty * penaltyMultiplier) };
      }
    }

    if (rule.type.startsWith('enum:')) {
      const valid = rule.type.replace('enum:', '').split(',');
      if (value && !valid.includes(String(value))) {
        return { issue: `${rule.description} (got: ${value}, expected: ${valid.join('|')})`, penalty: Math.round(rule.penalty * penaltyMultiplier) };
      }
    }

    if (rule.type === 'required-number') {
      if (typeof value !== 'number' || isNaN(value) || value <= 0) {
        return { issue: rule.description, penalty: Math.round(rule.penalty * penaltyMultiplier) };
      }
    }

    return {};
  }

  private getRecommendations(verdict: string, issues: string[]): string[] {
    if (verdict === 'pass') {
      return ['Data quality verified', 'No hallucination risks detected'];
    }
    const recs: string[] = [];
    if (issues.length > 0) recs.push('Review and correct specific issues before using data');
    if (issues.length > 3) recs.push('Consider regenerating the analysis with stricter parameters');
    recs.push('Manual review recommended for critical decisions');
    return recs;
  }
}
