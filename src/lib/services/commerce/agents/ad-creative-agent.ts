// ═══════════════════════════════════════════════════════════════
// AMEO AI — Ad Creative Agent
// Ad copy generation, creative concepts, campaign optimization
// ═══════════════════════════════════════════════════════════════

import { BaseCommerceAgent, type AgentContext } from './base-agent';
import type { AgentExecutionResult } from './types';

export class AdCreativeAgent extends BaseCommerceAgent {
  constructor() {
    super('ad-creative-agent', 'Ad Creative Agent');
  }

  async execute(ctx: AgentContext): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    const { workspaceId, input } = ctx;
    const artifacts: AgentExecutionResult['artifacts'] = [];

    try {
      const productName = (input.productName as string) || '';
      const productDescription = (input.productDescription as string) || '';
      const targetAudience = (input.targetAudience as string) || 'general consumers';
      const platform = (input.platform as string) || 'facebook'; // facebook | tiktok | google
      const adObjective = (input.adObjective as string) || 'conversions';
      const budget = (input.budget as number) || 0;
      const brandVoice = (input.brandVoice as string) || 'professional';

      await this.emitEvent(workspaceId, 'agent.ad-creative.start', {
        productName, platform, adObjective,
      });

      // Generate ad creative strategy
      const creativePrompt = `You are a top-performing ecommerce ad creative strategist for ${platform} ads.

Product: "${productName}"
${productDescription ? `Description: "${productDescription.slice(0, 300)}"` : ''}
Target Audience: ${targetAudience}
Objective: ${adObjective}
Brand Voice: ${brandVoice}
${budget > 0 ? `Daily Budget: $${budget}` : ''}

Generate a comprehensive ad creative strategy as JSON:
- headlineVariants: string[] (5-7 options, max 40 chars each)
- primaryText: string (main ad copy, max 125 chars)
- descriptionVariants: string[] (3-5 options)
- creativeConcepts: {
    conceptName: string,
    visualDescription: string,
    hook: string,
    angle: string,
    expectedCTR: number (0-100),
    targetAudienceFit: number (0-100)
  }[]
- callToAction: string (compelling CTA)
- visualSuggestions: { type: string, description: string, format: string }[]
- targetDemographics: { ageRange: string, interests: string[], behaviors: string[] }
- platformSpecific: Record<string, any>
  ${platform === 'facebook' ? '- placementRecommendations: string[]\n- adFormat: string' : ''}
  ${platform === 'tiktok' ? '- viralHooks: string[]\n- soundSuggestions: string[]' : ''}
  ${platform === 'google' ? '- keywordThemes: string[]\n- audienceSegments: string[]' : ''}
- estimatedPerformance: { ctr: number, conversionRate: number, cpc: number, roas: number }
- abTestSuggestions: { variant: string, hypothesis: string, expectedWinner: string }[]
- totalAdCount: number (recommended number of ad creatives to test)`;

      const raw = await this.runPrompt(creativePrompt);
      let creative: Record<string, unknown> = {};
      try {
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        creative = JSON.parse(cleaned);
      } catch {
        creative = { headlineVariants: [`Buy ${productName} Now`], primaryText: 'Shop now' };
      }

      artifacts.push({
        type: 'analysis',
        title: `Ad Creative - ${productName} on ${platform}`,
        content: JSON.stringify(creative, null, 2),
        metadata: {
          platform,
          objective: adObjective,
          creativeCount: Array.isArray(creative.creativeConcepts) ? creative.creativeConcepts.length : 0,
        },
      });

      await this.createArtifact(workspaceId, ctx.taskId, artifacts[0]);

      const durationMs = Date.now() - startTime;

      return {
        success: true,
        taskId: ctx.taskId,
        agentType: this.agentType,
        output: {
          creativeStrategy: creative,
          platform,
          adObjective,
          recommendedAds: creative.totalAdCount || 5,
          topHeadline: Array.isArray(creative.headlineVariants) ? creative.headlineVariants[0] : '',
          abTestPlan: creative.abTestSuggestions,
          estimatedPerformance: creative.estimatedPerformance,
        },
        confidence: productName ? 0.85 : 0.4,
        error: null,
        durationMs,
        artifacts,
        events: ['agent.ad-creative.complete'],
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
        events: ['agent.ad-creative.error'],
      };
    }
  }
}
