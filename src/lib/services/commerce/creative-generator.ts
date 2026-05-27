// ═══════════════════════════════════════════════════════════════
// AMEO AI — AI Creative Generation System (System 4)
// Creative operations infrastructure for image/video prompts,
// ad creative generation, UGC scripts, social media content,
// and campaign asset management.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getEventBus } from '@/lib/services/event-bus';

// ─── Types ───

export type AssetType = 'image' | 'video' | 'copy' | 'script' | 'social_post' | 'ad_copy' | 'ugc_script';
export type AssetStatus = 'draft' | 'generated' | 'reviewed' | 'approved' | 'rejected' | 'published';
export type CreativeProvider = 'openai' | 'stability' | 'midjourney' | 'runway' | 'elevenlabs';

export interface CreativeGenerationRequest {
  campaignId?: string;
  productId?: string;
  type: AssetType;
  name: string;
  description?: string;
  platform: string;
  tone?: string;
  targetAudience?: string;
  count?: number;
  parameters?: Record<string, unknown>;
}

export interface CreativeOutput {
  id: string;
  type: AssetType;
  name: string;
  content: string;
  headline?: string;
  primaryText?: string;
  callToAction?: string;
  score: number;
  provider?: string;
}

export interface CampaignBrief {
  name: string;
  type: string;
  platform: string;
  budget?: number;
  dailyBudget?: number;
  targetAudience?: string;
  startDate?: Date;
  endDate?: Date;
}

// ─── Creative Generation System ───

export class CreativeGenerationSystem {
  private workspaceId: string;
  private static readonly PROVIDER_PRIORITY: CreativeProvider[] = ['openai', 'stability', 'midjourney', 'runway', 'elevenlabs'];

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  // ─── Ad Copy Generation ───

  generateAdCopy(params: {
    productName: string;
    platform: string;
    tone?: string;
    features?: string[];
    targetAudience?: string;
  }): CreativeOutput[] {
    const tone = params.tone || 'professional';
    const productName = params.productName;
    const features = params.features || [];
    const platform = params.platform;

    const copies: CreativeOutput[] = [];

    // Primary ad copy
    copies.push({
      id: `ad-copy-${Date.now()}-primary`,
      type: 'ad_copy',
      name: `Primary Ad Copy - ${productName}`,
      content: this.generatePrimaryText(productName, tone, features, platform),
      headline: this.generateHeadline(productName, tone),
      primaryText: this.generatePrimaryText(productName, tone, features, platform),
      callToAction: this.generateCta(platform, tone),
      score: 85,
      provider: 'openai',
    });

    // Alternative headline
    copies.push({
      id: `ad-copy-${Date.now()}-alt`,
      type: 'ad_copy',
      name: `Alternative Headline - ${productName}`,
      content: this.generateHeadline(productName, tone),
      headline: this.generateAltHeadline(productName, tone),
      primaryText: this.generatePrimaryText(productName, tone, features, platform).substring(0, 125),
      callToAction: this.generateCta(platform, 'playful'),
      score: 78,
      provider: 'openai',
    });

    return copies;
  }

  // ─── UGC Script Generation ───

  generateUgcScript(params: {
    productName: string;
    platform: string;
    duration?: number;
    hook?: string;
    features?: string[];
  }): CreativeOutput {
    const productName = params.productName;
    const platform = params.platform;
    const duration = params.duration || 30;
    const features = params.features || [];
    const platformUpper = platform.toUpperCase();

    const hook = params.hook || `You won't believe what I just found! 😱`;
    const featureHighlights = features.length > 0
      ? features.map((f) => `• ${f}`).join('\n')
      : '• Premium quality you can feel\n• Incredible value for money\n• Perfect for everyday use';

    const script = `[HOOK: ${hook}]

[SCENE 1: INTRO — 0:00-0:0${Math.min(5, Math.floor(duration / 6))}]
*Excited close-up, holding product*
"Okay guys, I just got this and I HAD to share it with you right away!"

[SCENE 2: PRODUCT SHOWCASE — 0:0${Math.min(5, Math.floor(duration / 6))}-0:${Math.floor(duration * 0.6)}]
*Product shots, close-ups, use demonstration*
"Let me show you why this is absolutely game-changing..."

Key Features:
${featureHighlights}

[SCENE 3: RESULTS/TRANSFORMATION — 0:${Math.floor(duration * 0.6)}-0:${Math.floor(duration * 0.85)}]
*Before/after or lifestyle shot*
"Here's the thing — I've tried so many ${productName.toLowerCase()} alternatives, but NOTHING compares to this."

[SCENE 4: CTA — 0:${Math.floor(duration * 0.85)}-0:${duration}]
*Smiling, holding product, pointing to link*
"You NEED this in your life! Link in bio — grab yours before they sell out! 🏃‍♂️💨"

#ad #${productName.replace(/\s+/g, '')} #musthave #${platformUpper}MadeMeBuyIt`;

    return {
      id: `ugc-script-${Date.now()}`,
      type: 'ugc_script',
      name: `UGC Script - ${productName} (${duration}s)`,
      content: script,
      score: 82,
      provider: 'openai',
    };
  }

  // ─── Social Media Content ───

  generateSocialContent(params: {
    productName: string;
    platform: string;
    campaignName?: string;
    tone?: string;
    features?: string[];
  }): CreativeOutput[] {
    const productName = params.productName;
    const tone = params.tone || 'casual';
    const platform = params.platform;

    const posts: CreativeOutput[] = [];

    // Instagram/post
    posts.push({
      id: `social-${Date.now()}-ig`,
      type: 'social_post',
      name: `Instagram Post - ${productName}`,
      content: this.generateSocialPost(productName, platform, tone, 'instagram'),
      score: 80,
      provider: 'openai',
    });

    // Twitter/X short
    posts.push({
      id: `social-${Date.now()}-tw`,
      type: 'social_post',
      name: `Twitter/X Post - ${productName}`,
      content: this.generateSocialPost(productName, platform, tone, 'twitter'),
      score: 75,
      provider: 'openai',
    });

    // Facebook/medium
    posts.push({
      id: `social-${Date.now()}-fb`,
      type: 'social_post',
      name: `Facebook Post - ${productName}`,
      content: this.generateSocialPost(productName, platform, tone, 'facebook'),
      score: 77,
      provider: 'openai',
    });

    return posts;
  }

  // ─── Image Prompt Generation ───

  generateImagePrompts(params: {
    productName: string;
    productDescription?: string;
    style?: string;
    platform: string;
    count?: number;
  }): CreativeOutput[] {
    const productName = params.productName;
    const description = params.productDescription || 'A premium modern product';
    const style = params.style || 'professional';
    const count = params.count || 3;
    const prompts: CreativeOutput[] = [];

    const styleModifiers: Record<string, string> = {
      professional: 'Professional product photography, clean white background, studio lighting, 8K',
      lifestyle: 'Lifestyle shot, natural lighting, modern setting, candid moment',
      luxury: 'Luxury aesthetic, gold accents, dramatic lighting, premium feel',
      minimal: 'Minimalist composition, neutral tones, clean lines, soft shadows',
      vibrant: 'Vibrant colors, dynamic composition, energetic feel, bold contrast',
    };

    const modifier = styleModifiers[style] || styleModifiers.professional;

    for (let i = 0; i < count; i++) {
      const variations = [
        `${productName} — ${modifier}`,
        `${productName} in use, ${modifier}, showcasing features and design`,
        `${productName} with lifestyle elements, ${modifier}, editorial style`,
      ];

      prompts.push({
        id: `image-prompt-${Date.now()}-${i}`,
        type: 'image',
        name: `Image Prompt ${i + 1} - ${productName}`,
        content: variations[i % variations.length],
        score: 70 + Math.floor(Math.random() * 20),
        provider: params.platform.includes('midjourney') ? 'midjourney' : 'openai',
      });
    }

    return prompts;
  }

  // ─── Video Prompt Generation ───

  generateVideoPrompts(params: {
    productName: string;
    productDescription?: string;
    duration?: number;
    style?: string;
  }): CreativeOutput[] {
    const productName = params.productName;
    const style = params.style || 'promotional';
    const duration = params.duration || 30;

    const prompts: CreativeOutput[] = [
      {
        id: `video-prompt-${Date.now()}-main`,
        type: 'video',
        name: `Video Ad Concept - ${productName}`,
        content: `A ${duration}-second ${style} video showcasing ${productName}. Opening with an attention-grabbing visual of the product in an elegant setting. Slow-motion shots highlighting key features and design details. Warm, inviting color grade. Text overlay highlighting key benefits. Ends with a clear call to action and brand logo. Background music: upbeat and modern.`,
        score: 80,
        provider: 'runway',
      },
      {
        id: `video-prompt-${Date.now()}-alt`,
        type: 'video',
        name: `Alternative Video - ${productName} UGC Style`,
        content: `UGC-style ${duration}-second video for ${productName}. Opens with a genuine reaction shot. Fast-paced cuts showing the product in real-life use. Natural lighting, handheld feel. Authentic voiceover explaining why this product is a game-changer. Ends with a discount code and CTA.`,
        score: 75,
        provider: 'runway',
      },
    ];

    return prompts;
  }

  // ─── Campaign Creation ───

  async createCampaign(brief: CampaignBrief): Promise<Record<string, unknown>> {
    const eventBus = getEventBus();

    const campaign = await db.campaign.create({
      data: {
        workspaceId: this.workspaceId,
        name: brief.name,
        type: brief.type,
        platform: brief.platform,
        status: 'draft',
        budget: brief.budget,
        dailyBudget: brief.dailyBudget,
        targetAudience: brief.targetAudience,
        startDate: brief.startDate,
        endDate: brief.endDate,
      },
    });

    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'creative.campaign.created',
      source: 'creative-generation',
      level: 'info',
      payload: { campaignId: campaign.id, name: brief.name },
      resourceType: 'campaign',
      resourceId: campaign.id,
    });

    return campaign as unknown as Record<string, unknown>;
  }

  // ─── Asset Storage ───

  async saveAsset(
    campaignId: string,
    asset: CreativeOutput
  ): Promise<Record<string, unknown>> {
    const saved = await db.creativeAsset.create({
      data: {
        campaignId,
        workspaceId: this.workspaceId,
        type: asset.type,
        name: asset.name,
        content: asset.content,
        headline: asset.headline,
        primaryText: asset.primaryText,
        callToAction: asset.callToAction,
        provider: asset.provider,
        score: asset.score,
        status: 'generated',
        format: asset.type === 'image' ? 'png' : asset.type === 'video' ? 'mp4' : 'text',
      },
    });

    return saved as unknown as Record<string, unknown>;
  }

  // ─── Full Creative Workflow ───

  async generateFullCreativeBatch(request: CreativeGenerationRequest): Promise<{
    adCopies: CreativeOutput[];
    ugcScripts: CreativeOutput;
    socialPosts: CreativeOutput[];
    imagePrompts: CreativeOutput[];
    videoPrompts: CreativeOutput[];
    campaignId?: string;
  }> {
    const product = request.productId
      ? await db.product.findUnique({ where: { id: request.productId } })
      : null;

    const productName = product?.name || request.name;
    const productDescription = product?.description || request.description;
    const features: string[] = [];

    if (product?.seoData) {
      try {
        const seoData = JSON.parse(product.seoData) as Record<string, unknown>;
        if (Array.isArray(seoData.keywords)) {
          features.push(...(seoData.keywords as string[]).slice(0, 3));
        }
      } catch {
        // ignore
      }
    }

    const platform = request.platform;
    const tone = request.tone || 'professional';
    const targetAudience = request.targetAudience || 'general';

    // Generate all creative types in parallel
    const [adCopies, ugcScripts, socialPosts, imagePrompts, videoPrompts] = await Promise.all([
      Promise.resolve(this.generateAdCopy({ productName, platform, tone, features, targetAudience })),
      Promise.resolve(this.generateUgcScript({ productName, platform, features })),
      Promise.resolve(this.generateSocialContent({ productName, platform, tone, features })),
      Promise.resolve(this.generateImagePrompts({ productName, productDescription, platform })),
      Promise.resolve(this.generateVideoPrompts({ productName, productDescription })),
    ]);

    let campaignId = request.campaignId;

    // Create campaign if not provided
    if (!campaignId) {
      const campaign = await this.createCampaign({
        name: `${productName} - ${platform} Campaign`,
        type: 'ad',
        platform,
        targetAudience,
      });
      campaignId = campaign.id as string;
    }

    // Save all assets
    const allAssets = [...adCopies, ugcScripts, ...socialPosts, ...imagePrompts, ...videoPrompts];
    await Promise.allSettled(
      allAssets.map((asset) => this.saveAsset(campaignId!, asset))
    );

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'creative.batch.generated',
      source: 'creative-generation',
      level: 'info',
      payload: { campaignId, totalAssets: allAssets.length },
      resourceType: 'campaign',
      resourceId: campaignId,
    });

    return { adCopies, ugcScripts, socialPosts, imagePrompts, videoPrompts, campaignId };
  }

  // ─── Content Generation Helpers ───

  private generateHeadline(name: string, tone: string): string {
    switch (tone) {
      case 'luxury': return `Discover ${name} — Where Elegance Meets Innovation`;
      case 'playful': return `You Need ${name} in Your Life! 🔥`;
      case 'casual': return `Meet Your New Favorite ${this.getProductCategory(name)}`;
      case 'urgent': return `⏰ Limited Time: ${name} at ${Math.floor(Math.random() * 30 + 10)}% Off`;
      default: return `${name} — Premium Quality, Unbeatable Value`;
    }
  }

  private generateAltHeadline(name: string, tone: string): string {
    switch (tone) {
      case 'luxury': return `Elevate Your Style with ${name}`;
      case 'playful': return `${name}: The One Product You Didn't Know You Needed!`;
      case 'casual': return `${name} — Because You Deserve the Best`;
      case 'urgent': return `Don't Miss Out — ${name} Deal Ends Soon`;
      default: return `Why ${name} Is the Best Investment You'll Make Today`;
    }
  }

  private generatePrimaryText(name: string, tone: string, features: string[], platform: string): string {
    const platformLimit = platform === 'facebook' || platform === 'instagram' ? 125 : platform === 'tiktok' ? 150 : 90;
    const featureBullets = features.length > 0
      ? features.slice(0, 3).map((f) => `✨ ${f}`).join('\n')
      : '✨ Premium quality that speaks for itself';

    const texts: Record<string, string> = {
      luxury: `Experience the extraordinary with ${name}. Crafted for those who demand nothing but the best.\n\n${featureBullets}\n\nLimited edition — elevate your collection today.`,
      playful: `OMG! ${name} is HERE and it's EVERYTHING! 🙌\n\n${featureBullets}\n\nTrust us, you're going to want this in your cart ASAP! 🛒`,
      casual: `Just dropped ${name} and we're obsessed! 💙\n\n${featureBullets}\n\nPerfect for everyday — you'll wonder how you lived without it.`,
      urgent: `⚠️ FLASH SALE: ${name}\n\n${featureBullets}\n\nOffer ends soon — grab yours before they're gone!`,
    };

    const text = texts[tone] || texts.professional;

    // Truncate to platform limits
    if (text.length > platformLimit) {
      return text.substring(0, platformLimit - 3) + '...';
    }
    return text;
  }

  private generateCta(platform: string, tone: string): string {
    const ctas: Record<string, Record<string, string>> = {
      professional: { default: 'Shop Now', meta: 'Learn More', tiktok: 'Get Yours' },
      playful: { default: 'Grab Yours! 🎉', meta: 'Check It Out 👀', tiktok: 'Link in Bio! 🔗' },
      luxury: { default: 'Discover Now', meta: 'Explore Collection', tiktok: 'Shop the Look' },
      urgent: { default: 'Shop Sale ⏰', meta: 'Claim Offer', tiktok: 'Buy Now 🔥' },
    };

    const toneCtAs = ctas[tone] || ctas.professional;
    const platformKey = platform === 'meta_ads' || platform === 'facebook' ? 'meta' : platform;

    return toneCtAs[platformKey] || toneCtAs.default || 'Shop Now';
  }

  private generateSocialPost(name: string, platform: string, tone: string, socialPlatform: string): string {
    const hashtags = `#${name.replace(/\s+/g, '')} #MustHave #DailyEssential #ShopNow`;

    switch (socialPlatform) {
      case 'twitter':
        return `${name} has completely changed my daily routine! ${tone === 'playful' ? '🤯 ' : ''}The quality is unmatched. Check it out! 🛍️\n\n${hashtags}`;
      case 'facebook':
        return `I just discovered ${name} and I am absolutely loving it! 🎉\n\nThe quality is incredible and the value is unbeatable. This is going to be your new favorite thing!\n\n👉 Shop now at the link below!\n\n${hashtags}`;
      case 'instagram':
      default:
        return `${name} — the perfect addition to your collection ✨\n\nPremium quality that elevates your everyday experience. This is more than just a product — it's an investment in quality.\n\n📍 Link in bio to shop\n\n${hashtags}`;
    }
  }

  private getProductCategory(name: string): string {
    const lower = name.toLowerCase();
    if (lower.match(/shirt|tee/i)) return 'T-Shirt';
    if (lower.match(/bag|backpack/i)) return 'Bag';
    if (lower.match(/shoe|sneaker/i)) return 'Pair of Shoes';
    if (lower.match(/accessory|jewelry|watch/i)) return 'Accessory';
    return 'Product';
  }

  // ─── Stats ───

  async getStats(): Promise<{
    totalCampaigns: number;
    activeCampaigns: number;
    totalAssets: number;
    byType: Record<string, number>;
  }> {
    const campaigns = await db.campaign.findMany({
      where: { workspaceId: this.workspaceId },
    });
    const assets = await db.creativeAsset.findMany({
      where: { workspaceId: this.workspaceId },
    });

    const byType: Record<string, number> = {};
    for (const asset of assets) {
      byType[asset.type] = (byType[asset.type] || 0) + 1;
    }

    return {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter((c) => c.status === 'active').length,
      totalAssets: assets.length,
      byType,
    };
  }
}
