// ═══════════════════════════════════════════════════════════════
// AMEO AI — Operational Revenue Engine (System 7)
// Monetization infrastructure with subscriptions, credit metering,
// Stripe-ready billing, coupon systems, and referral tracking.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getEventBus } from '@/lib/services/event-bus';

// ─── Types ───

export interface SubscriptionData {
  id: string;
  workspaceId: string;
  planId: string;
  tier: string;
  status: string;
  billingPeriod: string;
  amount: number;
  currency: string;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  stripePriceId?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  trialEndsAt?: Date | null;
  cancelledAt?: Date | null;
  cancelAtPeriodEnd: boolean;
  includedCredits?: number | null;
  usedCredits?: number | null;
  overageRate?: number | null;
  features?: Record<string, unknown> | null;
  limits?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

export interface InvoiceData {
  id: string;
  workspaceId: string;
  subscriptionId?: string | null;
  invoiceNumber?: string | null;
  description?: string | null;
  amount: number;
  currency: string;
  tax?: number | null;
  total: number;
  paidAmount?: number | null;
  balanceDue?: number | null;
  status: string;
  stripeInvoiceId?: string | null;
  stripePaymentIntentId?: string | null;
  hostedInvoiceUrl?: string | null;
  invoicePdfUrl?: string | null;
  dueDate?: Date | null;
  paidAt?: Date | null;
  lineItems?: Record<string, unknown>[] | null;
  createdAt: Date;
}

export interface CreditAccountData {
  id: string;
  workspaceId: string;
  balance: number;
  lifetimeCredits: number;
  usedCredits: number;
  autoRefill: boolean;
  refillThreshold?: number | null;
  refillAmount?: number | null;
  dailyLimit?: number | null;
  monthlyLimit?: number | null;
  rateLimit?: number | null;
  createdAt: Date;
}

export interface RevenueEngineStats {
  activeSubscriptions: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  totalInvoices: number;
  paidInvoices: number;
  totalRevenue: number;
  creditAccounts: number;
  totalCreditsUsed: number;
  activeCoupons: number;
  activeReferrals: number;
}

// ─── Revenue Engine Service ───

export class RevenueEngineService {
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  // ─── Subscriptions ───

  async getSubscription(): Promise<SubscriptionData | null> {
    const sub = await db.subscription.findFirst({
      where: { workspaceId: this.workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return sub as unknown as SubscriptionData | null;
  }

  async createSubscription(data: {
    planId: string;
    tier: string;
    billingPeriod?: string;
    amount: number;
    currency?: string;
    trialEndsAt?: Date;
    includedCredits?: number;
    overageRate?: number;
    features?: Record<string, unknown>;
    limits?: Record<string, unknown>;
    stripeSubscriptionId?: string;
    stripeCustomerId?: string;
    stripePriceId?: string;
  }): Promise<SubscriptionData> {
    const sub = await db.subscription.create({
      data: {
        workspaceId: this.workspaceId,
        planId: data.planId,
        tier: data.tier,
        billingPeriod: data.billingPeriod || 'monthly',
        amount: data.amount,
        currency: data.currency || 'USD',
        trialEndsAt: data.trialEndsAt || null,
        includedCredits: data.includedCredits ?? 0,
        overageRate: data.overageRate || null,
        features: data.features ? JSON.stringify(data.features) : null,
        limits: data.limits ? JSON.stringify(data.limits) : null,
        stripeSubscriptionId: data.stripeSubscriptionId || null,
        stripeCustomerId: data.stripeCustomerId || null,
        stripePriceId: data.stripePriceId || null,
        status: data.trialEndsAt ? 'trialing' : 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'revenue.subscription.created',
      source: 'revenue-engine',
      level: 'info',
      payload: { subscriptionId: sub.id, tier: data.tier, planId: data.planId },
      resourceType: 'subscription',
      resourceId: sub.id,
    });

    return sub as unknown as SubscriptionData;
  }

  async updateSubscription(
    id: string,
    data: Partial<{
      tier: string;
      planId: string;
      billingPeriod: string;
      amount: number;
      includedCredits: number;
      overageRate: number;
      features: Record<string, unknown>;
      limits: Record<string, unknown>;
      cancelAtPeriodEnd: boolean;
      status: string;
    }>
  ): Promise<SubscriptionData | null> {
    const updateData: Record<string, unknown> = {};
    if (data.tier) updateData.tier = data.tier;
    if (data.planId) updateData.planId = data.planId;
    if (data.billingPeriod) updateData.billingPeriod = data.billingPeriod;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.includedCredits !== undefined) updateData.includedCredits = data.includedCredits;
    if (data.overageRate !== undefined) updateData.overageRate = data.overageRate;
    if (data.features) updateData.features = JSON.stringify(data.features);
    if (data.limits) updateData.limits = JSON.stringify(data.limits);
    if (data.cancelAtPeriodEnd !== undefined) updateData.cancelAtPeriodEnd = data.cancelAtPeriodEnd;
    if (data.status) updateData.status = data.status;

    if (data.status === 'cancelled') {
      updateData.cancelledAt = new Date();
    }

    const sub = await db.subscription.update({
      where: { id, workspaceId: this.workspaceId },
      data: updateData,
    });
    return sub as unknown as SubscriptionData;
  }

  async cancelSubscription(id: string, immediate?: boolean): Promise<SubscriptionData | null> {
    if (immediate) {
      return this.updateSubscription(id, { status: 'cancelled' });
    }
    return this.updateSubscription(id, { cancelAtPeriodEnd: true });
  }

  // ─── Invoices ───

  async listInvoices(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ invoices: InvoiceData[]; total: number }> {
    const where: Record<string, unknown> = { workspaceId: this.workspaceId };
    if (params?.status) where.status = params.status;

    const limit = params?.limit ?? 20;
    const offset = params?.offset ?? 0;

    const [invoices, total] = await Promise.all([
      db.invoice.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
      db.invoice.count({ where }),
    ]);
    return { invoices: invoices as unknown as InvoiceData[], total };
  }

  async createInvoice(data: {
    subscriptionId?: string;
    description?: string;
    amount: number;
    currency?: string;
    tax?: number;
    dueDate?: Date;
    lineItems?: Record<string, unknown>[];
  }): Promise<InvoiceData> {
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const tax = data.tax ?? 0;
    const total = data.amount + tax;

    const invoice = await db.invoice.create({
      data: {
        workspaceId: this.workspaceId,
        subscriptionId: data.subscriptionId || null,
        invoiceNumber,
        description: data.description || null,
        amount: data.amount,
        currency: data.currency || 'USD',
        tax,
        total,
        dueDate: data.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lineItems: data.lineItems ? JSON.stringify(data.lineItems) : null,
      },
    });

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'revenue.invoice.created',
      source: 'revenue-engine',
      level: 'info',
      payload: { invoiceId: invoice.id, amount: total, invoiceNumber },
      resourceType: 'invoice',
      resourceId: invoice.id,
    });

    return invoice as unknown as InvoiceData;
  }

  async markInvoicePaid(invoiceId: string): Promise<InvoiceData | null> {
    const invoice = await db.invoice.update({
      where: { id: invoiceId, workspaceId: this.workspaceId },
      data: { status: 'paid', paidAt: new Date(), paidAmount: { set: db.invoice.fields.total } },
    });
    return invoice as unknown as InvoiceData;
  }

  // ─── Credits ───

  async getOrCreateCreditAccount(): Promise<CreditAccountData> {
    let account = await db.creditAccount.findFirst({
      where: { workspaceId: this.workspaceId },
    });
    if (account) return account as unknown as CreditAccountData;

    account = await db.creditAccount.create({
      data: { workspaceId: this.workspaceId },
    });
    return account as unknown as CreditAccountData;
  }

  async addCredits(amount: number): Promise<CreditAccountData | null> {
    const account = await this.getOrCreateCreditAccount();
    const updated = await db.creditAccount.update({
      where: { id: account.id },
      data: {
        balance: { increment: amount },
        lifetimeCredits: { increment: amount },
      },
    });
    return updated as unknown as CreditAccountData;
  }

  async consumeCredits(amount: number, description?: string, type?: string): Promise<boolean> {
    const account = await this.getOrCreateCreditAccount();
    if (account.balance < amount) return false;

    await db.creditAccount.update({
      where: { id: account.id },
      data: {
        balance: { increment: -amount },
        usedCredits: { increment: amount },
      },
    });

    await db.usageRecord.create({
      data: {
        accountId: account.id,
        workspaceId: this.workspaceId,
        credits: amount,
        description: description || 'Credit consumption',
        type: type || 'api_call',
        meteredAt: new Date(),
      },
    });

    return true;
  }

  async getUsageHistory(params?: {
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ records: Record<string, unknown>[]; total: number }> {
    const where: Record<string, unknown> = {
      workspaceId: this.workspaceId,
    };
    if (params?.type) where.type = params.type;

    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;

    const [records, total] = await Promise.all([
      db.usageRecord.findMany({ where, orderBy: { meteredAt: 'desc' }, take: limit, skip: offset }),
      db.usageRecord.count({ where }),
    ]);
    return { records: records as unknown as Record<string, unknown>[], total };
  }

  // ─── Coupons ───

  async createCoupon(data: {
    code: string;
    description?: string;
    discountType: string;
    discountValue: number;
    maxDiscount?: number;
    maxUses?: number;
    maxUsesPerUser?: number;
    minAmount?: number;
    applicablePlans?: string[];
    firstTimeOnly?: boolean;
    startsAt?: Date;
    expiresAt?: Date;
  }): Promise<Record<string, unknown>> {
    const coupon = await db.coupon.create({
      data: {
        workspaceId: this.workspaceId,
        code: data.code.toUpperCase(),
        description: data.description || null,
        discountType: data.discountType,
        discountValue: data.discountValue,
        maxDiscount: data.maxDiscount || null,
        maxUses: data.maxUses || null,
        maxUsesPerUser: data.maxUsesPerUser ?? 1,
        minAmount: data.minAmount || null,
        applicablePlans: data.applicablePlans ? JSON.stringify(data.applicablePlans) : null,
        firstTimeOnly: data.firstTimeOnly ?? false,
        startsAt: data.startsAt || null,
        expiresAt: data.expiresAt || null,
      },
    });
    return coupon as unknown as Record<string, unknown>;
  }

  async validateCoupon(code: string, amount?: number): Promise<{ valid: boolean; discount?: number; message?: string }> {
    const coupon = await db.coupon.findUnique({ where: { code: code.toUpperCase() } });
    if (!coupon) return { valid: false, message: 'Coupon not found' };
    if (!coupon.isActive) return { valid: false, message: 'Coupon is inactive' };
    if (coupon.expiresAt && coupon.expiresAt < new Date()) return { valid: false, message: 'Coupon has expired' };
    if (coupon.startsAt && coupon.startsAt > new Date()) return { valid: false, message: 'Coupon not yet active' };
    if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) return { valid: false, message: 'Coupon usage limit reached' };
    if (coupon.minAmount && amount && amount < coupon.minAmount) return { valid: false, message: `Minimum amount of $${coupon.minAmount} required` };

    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = Math.min(coupon.discountValue, coupon.maxDiscount || Infinity);
    } else {
      discount = coupon.discountValue;
    }

    return { valid: true, discount };
  }

  // ─── Referrals ───

  async createReferral(code: string, data?: {
    referrerReward?: number;
    referrerRewardType?: string;
    refereeReward?: number;
    refereeRewardType?: string;
    expiresAt?: Date;
  }): Promise<Record<string, unknown>> {
    const referral = await db.referral.create({
      data: {
        workspaceId: this.workspaceId,
        code: code.toLowerCase(),
        referrerReward: data?.referrerReward || null,
        referrerRewardType: data?.referrerRewardType || null,
        refereeReward: data?.refereeReward || null,
        refereeRewardType: data?.refereeRewardType || null,
        expiresAt: data?.expiresAt || null,
      },
    });
    return referral as unknown as Record<string, unknown>;
  }

  // ─── Stats ───

  async getStats(): Promise<RevenueEngineStats> {
    const subscriptions = await db.subscription.findMany({
      where: { workspaceId: this.workspaceId },
    });

    const activeSubs = subscriptions.filter((s) => s.status === 'active' || s.status === 'trialing');
    const mrr = activeSubs
      .filter((s) => s.billingPeriod === 'monthly')
      .reduce((sum, s) => sum + s.amount, 0);
    const arr = activeSubs
      .filter((s) => s.billingPeriod === 'yearly')
      .reduce((sum, s) => sum + s.amount, 0) + mrr * 12;

    const invoices = await db.invoice.findMany({ where: { workspaceId: this.workspaceId } });
    const paidInvoices = invoices.filter((i) => i.status === 'paid');
    const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.total, 0);

    const creditAccount = await db.creditAccount.findFirst({ where: { workspaceId: this.workspaceId } });

    const activeCoupons = await db.coupon.count({
      where: { workspaceId: this.workspaceId, isActive: true },
    });
    const activeReferrals = await db.referral.count({
      where: { workspaceId: this.workspaceId, status: 'active' },
    });

    return {
      activeSubscriptions: activeSubs.length,
      monthlyRecurringRevenue: mrr,
      annualRecurringRevenue: arr,
      totalInvoices: invoices.length,
      paidInvoices: paidInvoices.length,
      totalRevenue,
      creditAccounts: creditAccount ? 1 : 0,
      totalCreditsUsed: creditAccount?.usedCredits || 0,
      activeCoupons,
      activeReferrals,
    };
  }
}

// ─── Singleton Factory ───

const revenueEngineInstances = new Map<string, RevenueEngineService>();

export function getRevenueEngineService(workspaceId: string): RevenueEngineService {
  let instance = revenueEngineInstances.get(workspaceId);
  if (!instance) {
    instance = new RevenueEngineService(workspaceId);
    revenueEngineInstances.set(workspaceId, instance);
  }
  return instance;
}
