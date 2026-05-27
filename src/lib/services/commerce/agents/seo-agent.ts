// ═══════════════════════════════════════════════════════════════
// AMEO AI — SEO Agent
// Product listing optimization, SEO metadata, keyword analysis
// ═══════════════════════════════════════════════════════════════

import { BaseCommerceAgent, type AgentContext } from './base-agent';
import type { AgentExecutionResult } from './types';
import { db } from '@/lib/db';

export class SEOAgent extends BaseCommerceAgent {
  constructor() {
    super('seo-agent', 'SEO Agent');
  }

  async execute(ctx: AgentContext): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    const { workspaceId, input } = ctx;
    const artifacts: AgentExecutionResult['artifacts'] = [];

    try {
      const productId = (input.productId as string) || '';
      const productName = (input.productName as string) || '';
      const currentTitle = (input.currentTitle as string) || '';
      const currentDescription = (input.currentDescription as string) || '';
      const targetPlatform = (input.targetPlatform as string) || 'shopify';
      const keywords = (input.keywords as string[]) || [];

      await this.emitEvent(workspaceId, 'agent.seo-agent.start', {
        productId, productName, targetPlatform,
      });

      // Generate SEO-optimized content
      const seoPrompt = `You are an ecommerce SEO expert optimizing listings for ${targetPlatform}.

Product: "${productName || 'Product'}"
${currentTitle ? `Current Title: "${currentTitle}"` : ''}
${currentDescription ? `Current Description: "${currentDescription.trim().slice(0, 200)}"` : ''}
Target Keywords: ${keywords.length > 0 ? keywords.join(', ') : 'Auto-detect from product name'}

Generate optimized SEO content as JSON:
- optimizedTitle (string, max 70 chars, include primary keyword)
- metaDescription (string, max 160 chars, compelling with keyword)
- bulletPoints (array of 5-7 strings, feature-benefit format)
- richDescription (string, HTML-safe description with keyword density 1-2%)
- searchTags (array of 10-15 strings, relevant long-tail and short-tail keywords)
- keywordDensity (number, percentage)
- readabilityScore (0-100)
- completenessScore (0-100)
- recommendations: { onPageChanges: string[], offPageStrategy: string[], contentGaps: string[] }
- platformSpecific: { 
    ${targetPlatform === 'shopify' ? 'metaFields: Record<string,string>, collectionTags: string[]' : 'customFields: Record<string,string>'}
  }`;

      const raw = await this.runPrompt(seoPrompt, 'You are an expert ecommerce SEO strategist.');
      let seoData: Record<string, unknown> = {};
      try {
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        seoData = JSON.parse(cleaned);
      } catch {
        seoData = { optimizedTitle: productName, searchTags: keywords };
      }

      // Store SEO metadata
      if (productId) {
        await db.product.update({
          where: { id: productId },
          data: {
            seoData: JSON.stringify(seoData),
            optimizedAt: new Date(),
          },
        }).catch(() => {});
      }

      artifacts.push({
        type: 'analysis',
        title: `SEO Optimization - ${productName || 'Product'}`,
        content: JSON.stringify(seoData, null, 2),
        metadata: {
          readabilityScore: seoData.readabilityScore,
          keywordCount: Array.isArray(seoData.searchTags) ? seoData.searchTags.length : 0,
        },
      });

      await this.createArtifact(workspaceId, ctx.taskId, artifacts[0]);

      const durationMs = Date.now() - startTime;

      return {
        success: true,
        taskId: ctx.taskId,
        agentType: this.agentType,
        output: {
          optimizedTitle: seoData.optimizedTitle,
          metaDescription: seoData.metaDescription,
          bulletPoints: seoData.bulletPoints,
          richDescription: seoData.richDescription,
          searchTags: seoData.searchTags,
          scores: {
            readability: seoData.readabilityScore,
            keywordDensity: seoData.keywordDensity,
            completeness: seoData.completenessScore,
          },
          recommendations: seoData.recommendations,
          platformSpecific: seoData.platformSpecific,
        },
        confidence: productName ? 0.9 : 0.3,
        error: null,
        durationMs,
        artifacts,
        events: ['agent.seo-agent.complete'],
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
        events: ['agent.seo-agent.error'],
      };
    }
  }
}
