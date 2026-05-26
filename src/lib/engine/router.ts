// ═══════════════════════════════════════════════════════════════
// AMEO AI — Runtime Router
// Intelligent provider selection based on role, health, and governance
// ═══════════════════════════════════════════════════════════════

import type { RouterResult } from './types';

// Minimal provider shape needed for routing — compatible with both
// the frontend RuntimeProvider type and Prisma's runtimeProvider model
interface RoutableProvider {
  id: string;
  name: string;
  type: string;
  status: string;
  role: string | null;
  apiKey: string | null;
  modelId: string | null;
  healthScore: number;
  rating: number;
}

/**
 * Role priority order — primary providers are preferred first,
 * then secondary, then fallback as last resort.
 */
const ROLE_PRIORITY: Record<string, number> = {
  primary: 0,
  secondary: 1,
  fallback: 2,
};

/**
 * Default role priority for providers without an explicit role
 */
const DEFAULT_ROLE_PRIORITY = 3;

export class RuntimeRouter {
  /**
   * Select the best provider for a runtime request.
   *
   * Selection algorithm:
   *  1. If a specific providerId is requested and it's active, use it
   *  2. Filter to only active providers
   *  3. Sort by:
   *     a. Role priority (primary > secondary > fallback)
   *     b. Health score (higher is better)
   *     c. Rating (higher is better)
   *  4. Return the top-ranked provider or null if none available
   */
  async route(
    providers: RoutableProvider[],
    options?: { providerId?: string }
  ): Promise<RouterResult | null> {
    if (providers.length === 0) {
      return null;
    }

    // ── Step 1: If a specific provider is requested ──
    if (options?.providerId) {
      const requested = providers.find((p) => p.id === options.providerId);
      if (requested && requested.status === 'active' && requested.apiKey) {
        return {
          providerId: requested.id,
          providerName: requested.name,
          providerType: requested.type,
          modelId: requested.modelId || 'default',
          reason: `Explicitly requested provider "${requested.name}"`,
        };
      }

      // Requested provider is not active or missing API key
      // Fall through to automatic routing
    }

    // ── Step 2: Filter active providers with API keys ──
    const eligible = providers.filter(
      (p) => p.status === 'active' && p.apiKey
    );

    if (eligible.length === 0) {
      return null;
    }

    // ── Step 3: Sort by role priority, health score, rating ──
    const sorted = [...eligible].sort((a, b) => {
      // Primary sort: role priority
      const roleA = a.role ? ROLE_PRIORITY[a.role] ?? DEFAULT_ROLE_PRIORITY : DEFAULT_ROLE_PRIORITY;
      const roleB = b.role ? ROLE_PRIORITY[b.role] ?? DEFAULT_ROLE_PRIORITY : DEFAULT_ROLE_PRIORITY;
      if (roleA !== roleB) return roleA - roleB;

      // Secondary sort: health score (descending)
      if (a.healthScore !== b.healthScore) return b.healthScore - a.healthScore;

      // Tertiary sort: rating (descending)
      return b.rating - a.rating;
    });

    // ── Step 4: Return the best provider ──
    const best = sorted[0];
    const reasonParts: string[] = [];

    if (best.role) {
      reasonParts.push(`${best.role} provider`);
    }
    if (best.healthScore > 0) {
      reasonParts.push(`health: ${best.healthScore.toFixed(1)}`);
    }
    if (best.rating > 0) {
      reasonParts.push(`rating: ${best.rating.toFixed(1)}`);
    }

    return {
      providerId: best.id,
      providerName: best.name,
      providerType: best.type,
      modelId: best.modelId || 'default',
      reason: reasonParts.length > 0 ? reasonParts.join(', ') : 'Best available provider',
    };
  }
}
