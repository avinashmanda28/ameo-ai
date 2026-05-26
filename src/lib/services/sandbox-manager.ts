// ═══════════════════════════════════════════════════════════════
// AMEO AI — Sandbox Manager (Phase 1.7)
// Runtime execution boundaries and permission scopes.
// Pure logic module (no DB model needed). Manages sandbox
// profiles that define what executions are allowed to do.
// ═══════════════════════════════════════════════════════════════

import type {
  SandboxProfile,
  SandboxPermission,
} from '@/lib/types';
import { DEFAULT_SANDBOX_PROFILE } from '@/lib/types';

// ─── Types ───

/** Parameters for validating an execution against a sandbox profile */
export interface ExecutionValidationParams {
  requestedPermissions: SandboxPermission[];
  executionTimeMs?: number;
  memoryMb?: number;
  filePaths?: string[];
  networkAccess?: boolean;
  profileId?: string;
}

/** Result of execution validation */
export interface ValidationResult {
  allowed: boolean;
  violations: string[];
  warnings: string[];
  effectivePermissions: SandboxPermission[];
  resourceLimits: {
    maxExecutionTimeMs: number;
    maxMemoryMb: number;
  };
}

/** Parameters for creating a custom sandbox profile */
export interface CreateProfileParams {
  id: string;
  name: string;
  description: string;
  permissions: SandboxPermission[];
  restrictedPaths: string[];
  maxExecutionTimeMs?: number;
  maxMemoryMb?: number;
}

// ─── Pre-built sandbox profiles ───

const RESTRICTED_PROFILE: SandboxProfile = {
  id: 'restricted',
  name: 'Restricted',
  description: 'Read-only sandbox for untrusted executions. No network or file system access.',
  permissions: ['read'],
  restrictedPaths: ['*'],
  maxExecutionTimeMs: 30000,
  maxMemoryMb: 256,
};

const STANDARD_PROFILE: SandboxProfile = {
  id: 'standard',
  name: 'Standard',
  description: 'Standard sandbox with read/write access, limited network and file system.',
  permissions: ['read', 'write'],
  restrictedPaths: ['/etc/*', '/var/*', '/root/*'],
  maxExecutionTimeMs: 60000,
  maxMemoryMb: 512,
};

const ELEVATED_PROFILE: SandboxProfile = {
  id: 'elevated',
  name: 'Elevated',
  description: 'Elevated sandbox with execute, network, and file system permissions.',
  permissions: ['read', 'write', 'execute', 'network', 'file_system'],
  restrictedPaths: [],
  maxExecutionTimeMs: 120000,
  maxMemoryMb: 1024,
};

const UNRESTRICTED_PROFILE: SandboxProfile = {
  id: 'unrestricted',
  name: 'Unrestricted',
  description: 'Unrestricted sandbox with all permissions. Admin only.',
  permissions: ['read', 'write', 'execute', 'network', 'file_system'],
  restrictedPaths: [],
  maxExecutionTimeMs: 300000,
  maxMemoryMb: 2048,
};

// ─── All built-in profiles ───

const BUILT_IN_PROFILES = new Map<string, SandboxProfile>([
  [RESTRICTED_PROFILE.id, RESTRICTED_PROFILE],
  [STANDARD_PROFILE.id, STANDARD_PROFILE],
  [ELEVATED_PROFILE.id, ELEVATED_PROFILE],
  [UNRESTRICTED_PROFILE.id, UNRESTRICTED_PROFILE],
]);

// ─── Custom profiles registry (in-memory) ───

const customProfiles = new Map<string, SandboxProfile>();

// ─── SandboxManager Class ───

class SandboxManager {
  /**
   * Validate whether an execution's parameters comply with a sandbox profile.
   * Checks permissions, resource limits, and path restrictions.
   */
  validateExecution(
    profile: SandboxProfile,
    params: ExecutionValidationParams,
  ): ValidationResult {
    const violations: string[] = [];
    const warnings: string[] = [];

    // Check each requested permission
    for (const perm of params.requestedPermissions) {
      if (!profile.permissions.includes(perm)) {
        violations.push(`Permission '${perm}' is not granted in profile '${profile.name}'`);
      }
    }

    // Check network access
    if (params.networkAccess && !profile.permissions.includes('network')) {
      violations.push('Network access requested but not permitted by sandbox profile');
    }

    // Check execution time
    if (params.executionTimeMs !== undefined && params.executionTimeMs > profile.maxExecutionTimeMs) {
      violations.push(
        `Requested execution time ${params.executionTimeMs}ms exceeds limit of ${profile.maxExecutionTimeMs}ms`,
      );
    }

    // Check memory usage
    if (params.memoryMb !== undefined && params.memoryMb > profile.maxMemoryMb) {
      violations.push(
        `Requested memory ${params.memoryMb}MB exceeds limit of ${profile.maxMemoryMb}MB`,
      );
    }

    // Check file paths against restrictions
    if (params.filePaths && params.filePaths.length > 0) {
      if (!profile.permissions.includes('file_system') && !profile.permissions.includes('write')) {
        for (const filePath of params.filePaths) {
          if (this.isPathRestricted(profile, filePath)) {
            violations.push(`File path '${filePath}' is restricted by sandbox profile`);
          }
        }
      } else if (profile.restrictedPaths.length > 0) {
        for (const filePath of params.filePaths) {
          if (this.isPathRestricted(profile, filePath)) {
            violations.push(`File path '${filePath}' is restricted by sandbox profile`);
          }
        }
      }
    }

    // Warnings for edge cases
    if (profile.id === 'restricted' && params.requestedPermissions.includes('execute')) {
      warnings.push('Attempting to execute in restricted sandbox — consider using elevated profile');
    }

    if (params.executionTimeMs !== undefined && params.executionTimeMs > profile.maxExecutionTimeMs * 0.9) {
      warnings.push(
        `Execution time ${params.executionTimeMs}ms is close to limit ${profile.maxExecutionTimeMs}ms`,
      );
    }

    if (params.memoryMb !== undefined && params.memoryMb > profile.maxMemoryMb * 0.9) {
      warnings.push(
        `Memory usage ${params.memoryMb}MB is close to limit ${profile.maxMemoryMb}MB`,
      );
    }

    // Warn about unrestricted
    if (profile.id === 'unrestricted') {
      warnings.push('Running with unrestricted profile — ensure this is intentional (admin only)');
    }

    return {
      allowed: violations.length === 0,
      violations,
      warnings,
      effectivePermissions: profile.permissions,
      resourceLimits: {
        maxExecutionTimeMs: profile.maxExecutionTimeMs,
        maxMemoryMb: profile.maxMemoryMb,
      },
    };
  }

  /**
   * Get a sandbox profile by ID.
   * Searches built-in profiles first, then custom profiles.
   */
  getProfile(id: string): SandboxProfile | null {
    // Check built-in profiles first
    const builtIn = BUILT_IN_PROFILES.get(id);
    if (builtIn) return builtIn;

    // Then check custom profiles
    const custom = customProfiles.get(id);
    if (custom) return custom;

    // Fall back to DEFAULT_SANDBOX_PROFILE
    return DEFAULT_SANDBOX_PROFILE;
  }

  /**
   * Create a new custom sandbox profile.
   * Validates the profile parameters before creation.
   */
  createProfile(params: CreateProfileParams): SandboxProfile {
    // Validate ID
    if (!params.id || typeof params.id !== 'string') {
      throw new Error('Profile ID is required and must be a string');
    }

    // Check for conflicts with built-in profiles
    if (BUILT_IN_PROFILES.has(params.id)) {
      throw new Error(`Cannot overwrite built-in profile: ${params.id}`);
    }

    // Validate permissions
    const validPermissions: SandboxPermission[] = ['read', 'write', 'execute', 'network', 'file_system'];
    for (const perm of params.permissions) {
      if (!validPermissions.includes(perm)) {
        throw new Error(`Invalid permission: ${perm}. Valid permissions: ${validPermissions.join(', ')}`);
      }
    }

    // Validate resource limits
    const maxTime = params.maxExecutionTimeMs ?? 30000;
    const maxMem = params.maxMemoryMb ?? 256;

    if (maxTime < 1000) {
      throw new Error('maxExecutionTimeMs must be at least 1000ms (1 second)');
    }
    if (maxTime > 600000) {
      throw new Error('maxExecutionTimeMs cannot exceed 600000ms (10 minutes)');
    }
    if (maxMem < 32) {
      throw new Error('maxMemoryMb must be at least 32MB');
    }
    if (maxMem > 4096) {
      throw new Error('maxMemoryMb cannot exceed 4096MB');
    }

    const profile: SandboxProfile = {
      id: params.id,
      name: params.name,
      description: params.description,
      permissions: params.permissions,
      restrictedPaths: params.restrictedPaths,
      maxExecutionTimeMs: maxTime,
      maxMemoryMb: maxMem,
    };

    customProfiles.set(params.id, profile);
    return profile;
  }

  /**
   * Get the default sandbox profile (restricted).
   */
  getDefaultProfile(): SandboxProfile {
    return DEFAULT_SANDBOX_PROFILE;
  }

  /**
   * Check if a specific permission is granted in a profile.
   */
  checkPermission(profile: SandboxProfile, permission: SandboxPermission): boolean {
    return profile.permissions.includes(permission);
  }

  /**
   * Get all effective permissions for a profile by ID.
   * Returns null if profile doesn't exist.
   */
  getEffectivePermissions(profileId: string): SandboxPermission[] | null {
    const profile = this.getProfile(profileId);
    if (!profile) return null;
    return [...profile.permissions];
  }

  /**
   * Check if a file path is restricted by a sandbox profile.
   * Supports glob patterns: '*' matches everything, '/etc/*' matches any path under /etc.
   */
  restrictPath(profile: SandboxProfile, path: string): boolean {
    return this.isPathRestricted(profile, path);
  }

  /**
   * Serialize a sandbox profile to JSON metadata for storage.
   * Produces a clean JSON object without any non-serializable data.
   */
  toMetadata(profile: SandboxProfile): Record<string, unknown> {
    return {
      sandboxProfileId: profile.id,
      sandboxProfileName: profile.name,
      permissions: [...profile.permissions],
      restrictedPaths: [...profile.restrictedPaths],
      maxExecutionTimeMs: profile.maxExecutionTimeMs,
      maxMemoryMb: profile.maxMemoryMb,
      isCustom: !BUILT_IN_PROFILES.has(profile.id),
    };
  }

  /**
   * List all available profile IDs.
   */
  listProfiles(): { id: string; name: string; isBuiltIn: boolean }[] {
    const profiles: { id: string; name: string; isBuiltIn: boolean }[] = [];

    for (const [id, profile] of BUILT_IN_PROFILES) {
      profiles.push({ id, name: profile.name, isBuiltIn: true });
    }

    for (const [id, profile] of customProfiles) {
      profiles.push({ id, name: profile.name, isBuiltIn: false });
    }

    return profiles;
  }

  /**
   * Delete a custom profile. Cannot delete built-in profiles.
   */
  deleteProfile(id: string): boolean {
    if (BUILT_IN_PROFILES.has(id)) {
      return false;
    }
    return customProfiles.delete(id);
  }

  // ─── Private helpers ───

  /**
   * Check if a path matches any restricted path pattern.
   * Supports:
   *   '*' — matches all paths
   *   '/dir/*' — matches any path starting with '/dir/'
   *   '/dir/file.ext' — exact match
   */
  private isPathRestricted(profile: SandboxProfile, path: string): boolean {
    for (const restrictedPath of profile.restrictedPaths) {
      if (restrictedPath === '*') {
        // Wildcard: all paths are restricted
        return true;
      }

      if (restrictedPath.endsWith('/*')) {
        // Directory wildcard: matches any path under the directory
        const dirPrefix = restrictedPath.slice(0, -2);
        if (path.startsWith(dirPrefix + '/') || path === dirPrefix) {
          return true;
        }
      }

      if (path === restrictedPath) {
        // Exact match
        return true;
      }
    }

    return false;
  }
}

// ─── Singleton ───

let instance: SandboxManager | null = null;

/**
 * Get the singleton SandboxManager instance.
 */
export function getSandboxManager(): SandboxManager {
  if (!instance) {
    instance = new SandboxManager();
  }
  return instance;
}
