// ─── AMEO AI — Creative Generation API Routes ───

import { NextRequest, NextResponse } from 'next/server';
import { CreativeGenerationSystem } from '@/lib/services/commerce/creative-generator';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const campaignId = searchParams.get('campaignId');

    const generator = new CreativeGenerationSystem(workspaceId);
    const stats = await generator.getStats();

    if (campaignId) {
      const assets = await db.creativeAsset.findMany({
        where: { campaignId, workspaceId },
        orderBy: { createdAt: 'desc' },
      });
      const campaign = await db.campaign.findFirst({ where: { id: campaignId } });
      return NextResponse.json({ success: true, data: { campaign, assets, stats } });
    }

    const campaigns = await db.campaign.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ success: true, data: { campaigns, stats } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch creatives' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId = 'default', action, ...params } = body;

    const generator = new CreativeGenerationSystem(workspaceId);

    switch (action) {
      case 'generate-ad-copy': {
        const copies = generator.generateAdCopy(params);
        return NextResponse.json({ success: true, data: copies });
      }
      case 'generate-ugc-script': {
        const script = generator.generateUgcScript(params);
        return NextResponse.json({ success: true, data: script });
      }
      case 'generate-social': {
        const posts = generator.generateSocialContent(params);
        return NextResponse.json({ success: true, data: posts });
      }
      case 'generate-images': {
        const prompts = generator.generateImagePrompts(params);
        return NextResponse.json({ success: true, data: prompts });
      }
      case 'generate-videos': {
        const prompts = generator.generateVideoPrompts(params);
        return NextResponse.json({ success: true, data: prompts });
      }
      case 'generate-batch': {
        const result = await generator.generateFullCreativeBatch(params);
        return NextResponse.json({ success: true, data: result }, { status: 201 });
      }
      case 'create-campaign': {
        const campaign = await generator.createCampaign(params);
        return NextResponse.json({ success: true, data: campaign }, { status: 201 });
      }
      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action. Use: generate-ad-copy, generate-ugc-script, generate-social, generate-images, generate-videos, generate-batch, or create-campaign' },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Creative generation failed' },
      { status: 500 }
    );
  }
}
