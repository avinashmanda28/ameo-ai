// ═══════════════════════════════════════════════════════════════
// AMEO AI — Store Builder Agent
// Automated store setup, product importing, listing optimization
// ═══════════════════════════════════════════════════════════════

import { BaseCommerceAgent, type AgentContext } from './base-agent';
import type { AgentExecutionResult } from './types';
import { db } from '@/lib/db';

export class StoreBuilderAgent extends BaseCommerceAgent {
  constructor() {
    super('store-builder', 'Store Builder');
  }

  async execute(ctx: AgentContext): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    const { workspaceId, input } = ctx;
    const artifacts: AgentExecutionResult['artifacts'] = [];

    try {
      const storeId = (input.storeId as string) || '';
      const action = (input.action as string) || 'setup'; // setup | import | optimize
      const productIds = (input.productIds as string[]) || [];
      const storeName = (input.storeName as string) || '';

      await this.emitEvent(workspaceId, 'agent.store-builder.start', {
        storeId, action, storeName,
      });

      let output: Record<string, unknown> = {};

      if (action === 'setup') {
        // Generate store setup plan
        const setupPrompt = `You are an ecommerce store setup expert for ${storeName || 'a new store'}.

Generate a complete store setup plan as JSON:
- storeName (string)
- recommendedTheme (string)
- navigationStructure: { mainMenu: string[], footerMenu: string[], collections: string[] }
- requiredPages: string[]
- recommendedApps: string[]
- designGuidelines: { primaryColor: string, secondaryColor: string, fontPairing: string, style: string }
- productCategories: string[]
- initialSetupSteps: string[]
- estimatedTimeToLaunch: string
- checklist: { category: string, items: string[], completed: boolean }[]`;

        const raw = await this.runPrompt(setupPrompt);
        try {
          const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const plan = JSON.parse(cleaned);
          output = { setupPlan: plan, action: 'setup' };

          await this.storeMemory(workspaceId, `store_setup_${storeId}`, JSON.stringify(plan), 'store_setup', 86400000);
        } catch {
          output = { setupPlan: { error: 'Failed to generate plan' }, action: 'setup' };
        }
      } else if (action === 'import' && productIds.length > 0) {
        // Generate import plan for products
        const productRecords = await Promise.all(
          productIds.map((pid) => db.product.findUnique({ where: { id: pid } }))
        );
        const products = productRecords.filter((p): p is NonNullable<typeof p> => p !== null);

        output = {
          action: 'import',
          productsToImport: products.length,
          importPlan: products.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            category: p.category,
            status: 'pending_import',
          })),
          steps: [
            'Download product images',
            'Generate optimized titles',
            'Set pricing rules',
            'Configure inventory tracking',
            'Create product collections',
            'Set shipping profiles',
          ],
        };

        await this.emitEvent(workspaceId, 'agent.store-builder.import', {
          productCount: products.length, storeId,
        });
      } else if (action === 'optimize') {
        // Generate listing optimization plan
        const optimizePrompt = `Generate a store optimization plan for ${storeName || 'the store'}.

Focus on:
- Conversion rate optimization
- Mobile responsiveness
- Page load speed
- Checkout flow
- Product page layout
- Trust signals (reviews, badges, guarantees)
- Abandoned cart recovery

Output as JSON with actionable steps, estimated impact scores, and priority levels.`;

        const raw = await this.runPrompt(optimizePrompt, 'You are an ecommerce conversion optimization expert.');
        try {
          const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          output = { optimizationPlan: JSON.parse(cleaned), action: 'optimize' };
        } catch {
          output = { optimizationPlan: 'Generated', action: 'optimize' };
        }
      }

      artifacts.push({
        type: 'plan',
        title: `Store ${action} - ${storeName || 'Store'}`,
        content: JSON.stringify(output, null, 2),
        metadata: { action, storeId },
      });

      await this.createArtifact(workspaceId, ctx.taskId, artifacts[0]);

      const durationMs = Date.now() - startTime;

      return {
        success: true,
        taskId: ctx.taskId,
        agentType: this.agentType,
        output,
        confidence: action !== 'setup' ? 0.85 : 0.75,
        error: null,
        durationMs,
        artifacts,
        events: ['agent.store-builder.complete'],
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
        events: ['agent.store-builder.error'],
      };
    }
  }
}
