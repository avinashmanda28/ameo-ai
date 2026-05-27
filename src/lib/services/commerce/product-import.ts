// ═══════════════════════════════════════════════════════════════
// AMEO AI — Product Import Pipeline (System 2)
// Autonomous product import system with AI normalization,
// pricing logic, margin calculations, variant generation,
// and store publishing pipeline.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getEventBus } from '@/lib/services/event-bus';

// ─── Types ───

export interface ImportRequest {
  supplierId?: string;
  productIds?: string[];
  sourceUrl?: string;
  sourcePlatform?: string;
  importAll?: boolean;
  targetStoreId?: string;
  options?: {
    autoOptimize?: boolean;
    autoPublish?: boolean;
    generateVariants?: boolean;
    pricingStrategy?: 'competitive' | 'premium' | 'economy' | 'cost_plus';
    targetMargin?: number;
  };
}

export interface ImportResult {
  productId: string;
  name: string;
  status: 'imported' | 'failed' | 'skipped';
  error?: string;
  optimized?: boolean;
  published?: boolean;
  variantCount?: number;
}

export interface OptimizationResult {
  title: string;
  description: string;
  bulletPoints: string[];
  suggestedPrice: number;
  suggestedComparePrice: number | null;
  marginEstimate: number;
  seoKeywords: string[];
  category: string;
  tags: string[];
}

// ─── Product Import Pipeline ───

export class ProductImportPipeline {
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  // ─── Main Import ───

  async importProducts(request: ImportRequest): Promise<ImportResult[]> {
    const eventBus = getEventBus();
    const results: ImportResult[] = [];
    const targetMargin = request.options?.targetMargin ?? 0.4; // 40% default margin
    const pricingStrategy = request.options?.pricingStrategy || 'cost_plus';

    let products: Array<{ id: string; name: string; price: number | null; costPrice: number | null; description: string | null; category: string | null; imageUrl: string | null; supplierId: string | null }> = [];

    if (request.productIds && request.productIds.length > 0) {
      const fetched = await db.product.findMany({
        where: { id: { in: request.productIds }, workspaceId: this.workspaceId },
      });
      products = fetched as unknown as typeof products;
    } else if (request.supplierId) {
      const fetched = await db.product.findMany({
        where: { supplierId: request.supplierId, workspaceId: this.workspaceId },
      });
      products = fetched as unknown as typeof products;
    } else if (request.importAll) {
      const fetched = await db.product.findMany({
        where: {
          workspaceId: this.workspaceId,
          status: { in: ['discovered', 'analyzed'] },
        },
      });
      products = fetched as unknown as typeof products;
    }

    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'product-import.started',
      source: 'product-import',
      level: 'info',
      payload: { count: products.length, targetStoreId: request.targetStoreId },
      resourceType: 'product-import',
    });

    for (const product of products) {
      try {
        const result = await this.importSingleProduct(product, {
          targetMargin,
          pricingStrategy,
          autoOptimize: request.options?.autoOptimize ?? true,
          autoPublish: request.options?.autoPublish ?? false,
          generateVariants: request.options?.generateVariants ?? true,
          targetStoreId: request.targetStoreId,
        });
        results.push(result);
      } catch (error) {
        results.push({
          productId: product.id,
          name: product.name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Import failed',
        });
      }
    }

    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'product-import.completed',
      source: 'product-import',
      level: 'info',
      payload: {
        total: results.length,
        imported: results.filter((r) => r.status === 'imported').length,
        failed: results.filter((r) => r.status === 'failed').length,
      },
      resourceType: 'product-import',
    });

    return results;
  }

  private async importSingleProduct(
    product: { id: string; name: string; price: number | null; costPrice: number | null; description: string | null; category: string | null; imageUrl: string | null; supplierId: string | null },
    options: {
      targetMargin: number;
      pricingStrategy: string;
      autoOptimize: boolean;
      autoPublish: boolean;
      generateVariants: boolean;
      targetStoreId?: string;
    }
  ): Promise<ImportResult> {
    // Step 1: Optimize product
    let optimization: OptimizationResult | null = null;
    if (options.autoOptimize) {
      optimization = this.optimizeProduct(product, options);
    }

    // Step 2: Calculate pricing
    const costPrice = product.costPrice || (product.price ?? 0) * 0.5;
    const pricing = this.calculatePricing(costPrice, options);

    // Step 3: Update product with optimized data
    const updateData: Record<string, unknown> = {
      status: 'imported',
      costPrice,
    };

    if (optimization) {
      updateData.price = pricing.suggestedPrice;
      updateData.comparePrice = pricing.comparePrice;
      updateData.name = optimization.title;
      updateData.description = optimization.description;
      updateData.category = optimization.category;
      updateData.seoData = JSON.stringify({
        title: optimization.title,
        description: optimization.description,
        keywords: optimization.seoKeywords,
        tags: optimization.tags,
      });
      updateData.aiSummary = optimization.description;
    }

    await db.product.update({
      where: { id: product.id },
      data: updateData,
    });

    // Step 4: Generate variants
    let variantCount = 0;
    if (options.generateVariants) {
      variantCount = await this.generateVariants(product.id);
    }

    // Step 5: Optionally publish to store
    let published = false;
    if (options.autoPublish && options.targetStoreId) {
      published = await this.publishToStore(product.id, options.targetStoreId);
    }

    return {
      productId: product.id,
      name: optimization?.title || product.name,
      status: 'imported',
      optimized: !!optimization,
      published,
      variantCount,
    };
  }

  // ─── AI Optimization ───

  private optimizeProduct(
    product: { name: string; description: string | null; category: string | null },
    options: { pricingStrategy: string }
  ): OptimizationResult {
    // AI-driven product optimization
    const baseName = product.name;
    const basePrice = 0; // will be calculated

    // Title optimization — remove filler words, add key info
    const optimizedTitle = this.optimizeTitle(baseName);

    // Description enhancement
    const optimizedDescription = product.description
      ? this.enhanceDescription(product.description)
      : `Premium ${baseName.toLowerCase()} — quality crafted for modern lifestyle.`;

    // Bullet points generation
    const bulletPoints = this.generateBulletPoints(product, optimizedDescription);

    // SEO keyword extraction
    const seoKeywords = this.extractSeoKeywords(baseName, product.category || '');

    // Category mapping
    const category = product.category || this.inferCategory(baseName);

    // Tags
    const tags = [...seoKeywords.slice(0, 5), category.toLowerCase().replace(/\s+/g, '-')];

    return {
      title: optimizedTitle,
      description: optimizedDescription,
      bulletPoints,
      suggestedPrice: basePrice,
      suggestedComparePrice: null,
      marginEstimate: 0,
      seoKeywords,
      category,
      tags,
    };
  }

  private optimizeTitle(title: string): string {
    // Remove common filler patterns
    let optimized = title
      .replace(/^new\s+/i, '')
      .replace(/^hot\s+(sale|deal|offer)\s+/i, '')
      .replace(/\s+(free shipping|best price|wholesale|bulk)\s*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Capitalize properly
    optimized = optimized
      .split(' ')
      .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
      .join(' ');

    return optimized || title;
  }

  private enhanceDescription(description: string): string {
    // Remove excessive whitespace and format
    let clean = description
      .replace(/<[^>]*>/g, '') // Strip HTML
      .replace(/\s+/g, ' ')
      .trim();

    // Ensure minimum length
    if (clean.length < 100) {
      clean = `${clean}\n\nCrafted with premium materials and designed for lasting performance. This product combines functionality with modern aesthetics to deliver exceptional value.`;
    }

    return clean;
  }

  private generateBulletPoints(
    product: { name: string; description: string | null },
    description: string
  ): string[] {
    const bullets: string[] = [];

    // Extract key features from description
    const sentences = description.split(/[.!?]+/).filter((s) => s.trim().length > 20);
    for (const sentence of sentences.slice(0, 3)) {
      bullets.push(sentence.trim());
    }

    // Add default bullets if not enough
    if (bullets.length < 3) {
      const defaults = [
        `Premium quality ${product.name.toLowerCase()} — designed for lasting durability`,
        `Versatile and practical for everyday use`,
        `Excellent value with premium features at an accessible price point`,
      ];
      bullets.push(...defaults.slice(0, 3 - bullets.length));
    }

    return bullets;
  }

  private extractSeoKeywords(name: string, category: string): string[] {
    const keywords = new Set<string>();
    const words = name.toLowerCase().split(/[\s,-]+/);
    words.forEach((w) => {
      if (w.length > 2) keywords.add(w);
    });
    if (category) {
      keywords.add(category.toLowerCase());
    }
    return Array.from(keywords);
  }

  private inferCategory(name: string): string {
    const nameLower = name.toLowerCase();
    if (nameLower.match(/shirt|pants|dress|jacket|shoe|hat|socks?|hoodie|sweater/)) return 'Clothing';
    if (nameLower.match(/phone|case|charger|cable|earphone|headphone|speaker/)) return 'Electronics';
    if (nameLower.match(/bag|backpack|wallet|purse|luggage/)) return 'Accessories';
    if (nameLower.match(/toy|game|puzzle|plush/)) return 'Toys';
    if (nameLower.match(/home|kitchen|cook|pan|pot|plate|cup/)) return 'Home & Kitchen';
    if (nameLower.match(/beauty|cream|lotion|makeup|skincare|hair/)) return 'Beauty';
    if (nameLower.match(/sport|fitness|gym|yoga|exercise/)) return 'Sports';
    return 'General';
  }

  // ─── Pricing Logic ───

  private calculatePricing(
    costPrice: number,
    options: { targetMargin: number; pricingStrategy: string }
  ): { suggestedPrice: number; comparePrice: number | null; margin: number } {
    let suggestedPrice: number;

    switch (options.pricingStrategy) {
      case 'premium':
        suggestedPrice = costPrice / (1 - (options.targetMargin + 0.15));
        break;
      case 'economy':
        suggestedPrice = costPrice / (1 - (options.targetMargin - 0.15));
        break;
      case 'competitive':
        suggestedPrice = costPrice / (1 - options.targetMargin);
        break;
      case 'cost_plus':
      default:
        suggestedPrice = costPrice * (1 + options.targetMargin + 0.3);
        break;
    }

    // Round to .99 or .95
    suggestedPrice = Math.ceil(suggestedPrice) - 0.01;
    if (suggestedPrice < 0) suggestedPrice = 0.99;

    const margin = ((suggestedPrice - costPrice) / suggestedPrice) * 100;
    const comparePrice = margin > 50 ? suggestedPrice * 1.3 : null;

    return {
      suggestedPrice: Math.round(suggestedPrice * 100) / 100,
      comparePrice: comparePrice ? Math.round(comparePrice * 100) / 100 : null,
      margin: Math.round(margin * 100) / 100,
    };
  }

  // ─── Variant Generation ───

  private async generateVariants(productId: string): Promise<number> {
    // Default variant generation for common product types
    const product = await db.product.findUnique({
      where: { id: productId },
    });
    if (!product) return 0;

    // Simple variant generation based on common attributes
    const variants: Array<{ name: string; sku: string; price: number | null }> = [];
    const basePrice = product.price || 0;

    // Size variants for apparel/category products
    const sizes = ['S', 'M', 'L', 'XL'];
    const baseSku = product.sku || `VAR-${productId.slice(-6)}`;

    // Only generate variants for products likely to have sizes/colors
    const category = product.category?.toLowerCase() || '';
    if (
      category.includes('cloth') ||
      category.includes('shoe') ||
      category.includes('apparel') ||
      category.includes('accessor')
    ) {
      for (const size of sizes) {
        variants.push({
          name: `${product.name} - ${size}`,
          sku: `${baseSku}-${size}`,
          price: basePrice,
        });
      }
    }

    // Store variants as product metadata
    if (variants.length > 0) {
      const existingMetadata = product.metadata ? JSON.parse(product.metadata) : {};
      await db.product.update({
        where: { id: productId },
        data: {
          metadata: JSON.stringify({
            ...existingMetadata,
            variants,
          }),
        },
      });
    }

    return variants.length;
  }

  // ─── Store Publishing ───

  private async publishToStore(productId: string, storeId: string): Promise<boolean> {
    const store = await db.store.findFirst({
      where: { id: storeId, workspaceId: this.workspaceId },
    });
    if (!store || store.status !== 'connected') return false;

    const product = await db.product.findUnique({
      where: { id: productId },
    });
    if (!product) return false;

    // For Shopify stores, create the product via API
    if (store.platform === 'shopify' && store.accessToken && store.platformUrl) {
      try {
        const shop = store.platformUrl.replace('https://', '').replace('.myshopify.com', '');
        const client = new (await import('./shopify-integration').then((m) => m.ShopifyClient))(shop, store.accessToken);

        const seoData = product.seoData ? JSON.parse(product.seoData) : {};
        const shopifyProduct = await client.createProduct({
          title: product.name,
          body_html: product.description || '',
          vendor: product.brand || 'Ameo AI',
          product_type: product.category || '',
          status: 'active',
          variants: [
            {
              price: product.price?.toString() || '0',
              sku: product.sku || '',
              inventory_management: 'shopify',
            },
          ],
          metafields_global_title_tag: seoData.title || product.name,
          metafields_global_description_tag: seoData.description || '',
        });

        const shopifyProductRecord = shopifyProduct as Record<string, unknown>;
        await db.product.update({
          where: { id: productId },
          data: {
            storeProductId: String(shopifyProductRecord.id),
            status: 'imported',
          },
        });

        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  // ─── Import from URL ───

  async importFromUrl(
    url: string,
    sourcePlatform: string,
    targetStoreId?: string
  ): Promise<ImportResult | null> {
    // Parse product data from URL (simplified — in production this would use
    // platform-specific scrapers or APIs)
    const urlLower = url.toLowerCase();

    const productData: Record<string, unknown> = {
      workspaceId: this.workspaceId,
      name: `Product from ${sourcePlatform}`,
      sourcePlatform,
      sourceId: url,
      supplierUrl: url,
      status: 'discovered',
    };

    // Extract product name from URL
    const urlParts = url.split('/');
    const lastSegment = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || '';
    const cleanName = lastSegment
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .replace(/\.html?$/, '')
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    if (cleanName && cleanName.length > 3) {
      productData.name = cleanName;
    }

    const product = await db.product.create({ data: productData as any });

    const result = await this.importProducts({
      productIds: [product.id],
      targetStoreId,
      options: {
        autoOptimize: true,
        autoPublish: !!targetStoreId,
        generateVariants: true,
      },
    });

    return result[0] || null;
  }

  // ─── Stats ───

  async getStats(): Promise<{
    pending: number;
    imported: number;
    failed: number;
    totalVariants: number;
    averageMargin: number;
  }> {
    const pending = await db.product.count({
      where: { workspaceId: this.workspaceId, status: { in: ['discovered', 'analyzed'] } },
    });
    const imported = await db.product.count({
      where: { workspaceId: this.workspaceId, status: 'imported' },
    });
    const failed = await db.product.count({
      where: { workspaceId: this.workspaceId, status: 'archived' },
    });

    const products = await db.product.findMany({
      where: { workspaceId: this.workspaceId, costPrice: { not: null }, price: { not: null } },
    });
    const margins = products
      .map((p) => {
        if (p.costPrice && p.price && p.price > 0) {
          return ((p.price - p.costPrice) / p.price) * 100;
        }
        return 0;
      })
      .filter((m) => m > 0);

    const averageMargin =
      margins.length > 0
        ? margins.reduce((sum, m) => sum + m, 0) / margins.length
        : 0;

    return {
      pending,
      imported,
      failed,
      totalVariants: 0, // Would need variant model to count
      averageMargin: Math.round(averageMargin * 100) / 100,
    };
  }
}
