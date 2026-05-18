// ═══════════════════════════════════════════════════════════════
// AMEO AI — Enhanced Verification Engine
// Multi-dimensional response verification with hallucination
// scoring, refusal detection, repetition analysis, and authority
// actions (block / flag).
// ═══════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────

export interface CheckResult {
  name: string;
  passed: boolean;
  score: number;       // 0–100
  details: string;
}

export interface VerificationResult {
  passed: boolean;
  score: number;       // 0–100 overall
  checks: CheckResult[];
  notes: string;
}

export interface VerificationContext {
  prompt?: string;
  requestType?: string;
  providerType?: string;
}

// ─── Refusal & Error Patterns ────────────────────────────────

const REFUSAL_PATTERNS: readonly RegExp[] = [
  /\bi cannot\b/i,
  /\bi can'?t\b/i,
  /\bi'?m sorry\b/i,
  /\bim sorry\b/i,
  /\bas an ai\b/i,
  /\bas a language model\b/i,
  /\bi don'?t have (access|information|knowledge|the ability)\b/i,
  /\bi'?m (not able|unable) to\b/i,
  /\bi am (not able|unable) to\b/i,
  /\bthis (request|prompt|query) (is|falls) (outside|beyond) (my|the)\b/i,
  /\bi must (decline|refuse|inform you)\b/i,
  /\bagainst my (guidelines|policies|programming)\b/i,
  /\bcontent policy\b/i,
  /\bsafety guidelines?\b/i,
  /\bi will not\b/i,
  /\bi'?m not going to\b/i,
  /\bi am not going to\b/i,
];

const JSON_ERROR_PATTERNS: readonly RegExp[] = [
  /^\s*\{[\s\S]*"error"[\s\S]*\}\s*$/,
  /^\s*\{[\s\S]*"message"[\s\S]*"status"\s*:\s*\d{3}[\s\S]*\}\s*$/,
  /internal server error/i,
  /rate limit/i,
  /too many requests/i,
  /unauthorized/i,
  /forbidden/i,
  /bad request/i,
  /service unavailable/i,
  /gateway timeout/i,
];

// ─── Runtime Verifier ────────────────────────────────────────

export class RuntimeVerifier {
  // ═══════════════════════════════════════════════════════════
  // VERIFY RESPONSE — Run all check dimensions
  // ═══════════════════════════════════════════════════════════

  verifyResponse(
    content: string,
    context?: VerificationContext
  ): VerificationResult {
    const checks: CheckResult[] = [];

    // 1. Output consistency
    checks.push(this.checkOutputConsistency(content));

    // 2. Refusal detection
    checks.push(this.checkRefusalDetection(content));

    // 3. Repetition detection
    checks.push(this.checkRepetitionDetection(content));

    // 4. Structure validation
    checks.push(this.checkStructureValidation(content));

    // 5. Hallucination scoring
    checks.push(this.checkHallucinationScoring(content, checks));

    // 6. API response validation
    checks.push(this.checkApiResponseValidation(content));

    // Calculate overall score as weighted average of all check scores
    const weights = [15, 20, 15, 10, 25, 15]; // weights for each check
    let weightedSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < checks.length; i++) {
      weightedSum += checks[i].score * weights[i];
      totalWeight += weights[i];
    }

    const overallScore = Math.round(weightedSum / totalWeight);

    // Determine overall pass/fail
    const failedChecks = checks.filter((c) => !c.passed);
    const passed = failedChecks.length === 0 && overallScore >= 60;

    // Generate summary notes
    const notes = this.generateNotes(checks, overallScore);

    return {
      passed,
      score: overallScore,
      checks,
      notes,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK 1: Output Consistency
  // Not empty, reasonable length
  // ═══════════════════════════════════════════════════════════

  private checkOutputConsistency(content: string): CheckResult {
    const trimmed = content.trim();

    // Empty check
    if (!trimmed) {
      return {
        name: 'output_consistency',
        passed: false,
        score: 0,
        details: 'Response is empty or whitespace-only',
      };
    }

    // Very short (likely incomplete)
    if (trimmed.length < 20) {
      return {
        name: 'output_consistency',
        passed: false,
        score: 30,
        details: `Response is very short (${trimmed.length} chars), likely incomplete`,
      };
    }

    // Short but acceptable
    if (trimmed.length < 50) {
      return {
        name: 'output_consistency',
        passed: true,
        score: 65,
        details: `Response is short (${trimmed.length} chars) but contains content`,
      };
    }

    // Good length
    if (trimmed.length < 200) {
      return {
        name: 'output_consistency',
        passed: true,
        score: 80,
        details: `Response length is reasonable (${trimmed.length} chars)`,
      };
    }

    // Substantial
    return {
      name: 'output_consistency',
      passed: true,
      score: 95,
      details: `Response is substantial (${trimmed.length} chars)`,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK 2: Refusal Detection
  // Detect patterns like "I cannot", "I'm sorry", "As an AI"
  // ═══════════════════════════════════════════════════════════

  private checkRefusalDetection(content: string): CheckResult {
    const trimmed = content.trim();

    const matchedPatterns: string[] = [];
    for (const pattern of REFUSAL_PATTERNS) {
      if (pattern.test(trimmed)) {
        matchedPatterns.push(pattern.source);
      }
    }

    if (matchedPatterns.length === 0) {
      return {
        name: 'refusal_detection',
        passed: true,
        score: 100,
        details: 'No refusal patterns detected',
      };
    }

    // Multiple refusal patterns — strong signal
    if (matchedPatterns.length >= 2) {
      return {
        name: 'refusal_detection',
        passed: false,
        score: 20,
        details: `Multiple refusal patterns detected: ${matchedPatterns.join(', ')}`,
      };
    }

    // Single refusal pattern — check if the response is more than just a refusal
    const sentences = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length <= 2) {
      // Short response with refusal = likely just a refusal
      return {
        name: 'refusal_detection',
        passed: false,
        score: 30,
        details: `Refusal pattern detected and response is very short: ${matchedPatterns[0]}`,
      };
    }

    // Longer response with a refusal pattern — might have useful content after
    return {
      name: 'refusal_detection',
      passed: true,
      score: 60,
      details: `Refusal pattern detected but response has additional content: ${matchedPatterns[0]}`,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK 3: Repetition Detection
  // Duplicate sentences (>40% repetition = warning)
  // ═══════════════════════════════════════════════════════════

  private checkRepetitionDetection(content: string): CheckResult {
    const trimmed = content.trim();

    if (trimmed.length < 50) {
      return {
        name: 'repetition_detection',
        passed: true,
        score: 90,
        details: 'Content too short for meaningful repetition analysis',
      };
    }

    // Split into sentences
    const sentences = trimmed
      .split(/[.!?]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 5); // ignore very short fragments

    if (sentences.length < 3) {
      return {
        name: 'repetition_detection',
        passed: true,
        score: 90,
        details: `Not enough sentences (${sentences.length}) for repetition analysis`,
      };
    }

    const totalSentences = sentences.length;
    const uniqueSentences = new Set(sentences);
    const uniqueCount = uniqueSentences.size;

    // Calculate repetition ratio
    const repetitionRatio = 1 - uniqueCount / totalSentences;

    // No repetition
    if (repetitionRatio === 0) {
      return {
        name: 'repetition_detection',
        passed: true,
        score: 100,
        details: `No repetition detected across ${totalSentences} sentences`,
      };
    }

    // Mild repetition (< 20%)
    if (repetitionRatio < 0.2) {
      return {
        name: 'repetition_detection',
        passed: true,
        score: 85,
        details: `Minor repetition detected (${Math.round(repetitionRatio * 100)}% duplicate sentences)`,
      };
    }

    // Moderate repetition (20-40%)
    if (repetitionRatio < 0.4) {
      return {
        name: 'repetition_detection',
        passed: true,
        score: 60,
        details: `Moderate repetition detected (${Math.round(repetitionRatio * 100)}% duplicate sentences out of ${totalSentences})`,
      };
    }

    // High repetition (>= 40%) — likely hallucination or loop
    return {
      name: 'repetition_detection',
      passed: false,
      score: 25,
      details: `High repetition detected (${Math.round(repetitionRatio * 100)}% duplicate sentences out of ${totalSentences}), possible hallucination loop`,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK 4: Structure Validation
  // Has paragraphs/sentences, not just whitespace
  // ═══════════════════════════════════════════════════════════

  private checkStructureValidation(content: string): CheckResult {
    const trimmed = content.trim();

    if (!trimmed) {
      return {
        name: 'structure_validation',
        passed: false,
        score: 0,
        details: 'Response is empty',
      };
    }

    // Check for paragraphs (multiple lines)
    const lines = trimmed.split('\n').filter((l) => l.trim().length > 0);
    const hasParagraphs = lines.length >= 2;

    // Check for sentences (ending with . ! ?)
    const sentenceEnders = trimmed.match(/[.!?]+/g);
    const sentenceCount = sentenceEnders ? sentenceEnders.length : 0;
    const hasSentences = sentenceCount >= 1;

    // Check for code blocks
    const hasCodeBlocks = /```[\s\S]*?```/.test(trimmed);

    // Check for lists
    const hasLists = /^[\s]*[-*•]/m.test(trimmed) || /^[\s]*\d+[.)]/m.test(trimmed);

    let score = 50; // base score for having non-empty content

    if (hasSentences) score += 15;
    if (hasParagraphs) score += 10;
    if (hasCodeBlocks) score += 10;
    if (hasLists) score += 5;

    // Check for single-word or single-character responses
    const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 1) {
      score = Math.min(score, 30);
    } else if (words.length <= 3) {
      score = Math.min(score, 50);
    }

    // Penalize if nothing but whitespace-separated characters
    const meaningfulChars = trimmed.replace(/[\s\n\r\t]/g, '').length;
    if (meaningfulChars < 10) {
      score = Math.min(score, 20);
    }

    score = Math.min(score, 100);

    const structureElements: string[] = [];
    if (hasParagraphs) structureElements.push('paragraphs');
    if (hasSentences) structureElements.push(`${sentenceCount} sentence(s)`);
    if (hasCodeBlocks) structureElements.push('code blocks');
    if (hasLists) structureElements.push('lists');

    return {
      name: 'structure_validation',
      passed: score >= 60,
      score,
      details: structureElements.length > 0
        ? `Response has: ${structureElements.join(', ')}`
        : `Response lacks clear structure (${words.length} words)`,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK 5: Hallucination Scoring
  // 0–100 confidence score based on multiple signals
  // ═══════════════════════════════════════════════════════════

  private checkHallucinationScoring(
    content: string,
    priorChecks: CheckResult[]
  ): CheckResult {
    const trimmed = content.trim();

    // Empty — definite failure
    if (!trimmed) {
      return {
        name: 'hallucination_scoring',
        passed: false,
        score: 0,
        details: 'Empty response — definite failure',
      };
    }

    // Very short (<20 chars)
    if (trimmed.length < 20) {
      return {
        name: 'hallucination_scoring',
        passed: false,
        score: 40,
        details: `Very short response (${trimmed.length} chars) — likely incomplete or error`,
      };
    }

    // Check if prior checks found refusal patterns
    const refusalCheck = priorChecks.find((c) => c.name === 'refusal_detection');
    if (refusalCheck && !refusalCheck.passed) {
      return {
        name: 'hallucination_scoring',
        passed: false,
        score: 50,
        details: 'Contains refusal patterns — response not useful',
      };
    }

    // Check if prior checks found high repetition
    const repetitionCheck = priorChecks.find((c) => c.name === 'repetition_detection');
    if (repetitionCheck && !repetitionCheck.passed) {
      return {
        name: 'hallucination_scoring',
        passed: false,
        score: 55,
        details: 'High repetition detected — possible hallucination loop',
      };
    }

    // Check for API error patterns in the content itself
    const apiCheck = priorChecks.find((c) => c.name === 'check_api_response_validation');
    if (apiCheck && !apiCheck.passed) {
      return {
        name: 'hallucination_scoring',
        passed: false,
        score: 35,
        details: 'Response appears to be a JSON/API error, not actual content',
      };
    }

    // Substantial content with variety (>500 chars)
    if (trimmed.length > 500) {
      // Check for varied vocabulary
      const words = trimmed.split(/\s+/);
      const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
      const vocabularyRichness = uniqueWords.size / words.length;

      if (vocabularyRichness > 0.6) {
        return {
          name: 'hallucination_scoring',
          passed: true,
          score: 95,
          details: `Substantial content (${trimmed.length} chars) with rich vocabulary (${Math.round(vocabularyRichness * 100)}% unique words)`,
        };
      }

      return {
        name: 'hallucination_scoring',
        passed: true,
        score: 85,
        details: `Substantial content (${trimmed.length} chars) with moderate vocabulary diversity (${Math.round(vocabularyRichness * 100)}% unique words)`,
      };
    }

    // Normal content (20–500 chars)
    return {
      name: 'hallucination_scoring',
      passed: true,
      score: 85,
      details: `Normal content (${trimmed.length} chars) — no hallucination signals`,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK 6: API Response Validation
  // Check if response looks like a JSON error from the provider
  // ═══════════════════════════════════════════════════════════

  private checkApiResponseValidation(content: string): CheckResult {
    const trimmed = content.trim();

    if (!trimmed) {
      return {
        name: 'check_api_response_validation',
        passed: false,
        score: 0,
        details: 'Empty response',
      };
    }

    // Try to parse as JSON
    let isJson = false;
    let jsonParsed: unknown = null;
    try {
      jsonParsed = JSON.parse(trimmed);
      isJson = true;
    } catch {
      // Not JSON
    }

    if (!isJson) {
      // Check for text-based error patterns
      for (const pattern of JSON_ERROR_PATTERNS) {
        if (pattern.test(trimmed)) {
          return {
            name: 'check_api_response_validation',
            passed: false,
            score: 15,
            details: `Response contains API error pattern: ${pattern.source}`,
          };
        }
      }

      return {
        name: 'check_api_response_validation',
        passed: true,
        score: 100,
        details: 'Response does not appear to be an API error',
      };
    }

    // It's JSON — check if it's an error response
    if (jsonParsed && typeof jsonParsed === 'object') {
      const obj = jsonParsed as Record<string, unknown>;

      // Check for common error fields
      if ('error' in obj) {
        return {
          name: 'check_api_response_validation',
          passed: false,
          score: 10,
          details: 'Response is a JSON object with an "error" field',
        };
      }

      if ('statusCode' in obj && typeof obj.statusCode === 'number' && obj.statusCode >= 400) {
        return {
          name: 'check_api_response_validation',
          passed: false,
          score: 10,
          details: `Response is a JSON object with error statusCode: ${obj.statusCode}`,
        };
      }

      if ('code' in obj && (obj.code === 'RATE_LIMIT' || obj.code === 'UNAUTHORIZED' || obj.code === 'FORBIDDEN')) {
        return {
          name: 'check_api_response_validation',
          passed: false,
          score: 10,
          details: `Response is a JSON object with error code: ${obj.code}`,
        };
      }
    }

    // JSON but not obviously an error — could be valid structured response
    return {
      name: 'check_api_response_validation',
      passed: true,
      score: 90,
      details: 'Response is JSON but does not contain obvious error fields',
    };
  }

  // ═══════════════════════════════════════════════════════════
  // AUTHORITY — Should Block
  // Block if score < 30 or specific critical failures
  // ═══════════════════════════════════════════════════════════

  shouldBlock(result: VerificationResult): boolean {
    // Score below 30 → definite block
    if (result.score < 30) {
      return true;
    }

    // Specific critical failures that warrant blocking
    const criticalFailures = result.checks.filter(
      (c) =>
        !c.passed &&
        c.score <= 10 &&
        (c.name === 'output_consistency' ||
          c.name === 'check_api_response_validation')
    );

    if (criticalFailures.length > 0) {
      return true;
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════════
  // AUTHORITY — Should Flag
  // Flag if score < 60 (needs attention)
  // ═══════════════════════════════════════════════════════════

  shouldFlag(result: VerificationResult): boolean {
    return result.score < 60;
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE — Generate summary notes
  // ═══════════════════════════════════════════════════════════

  private generateNotes(checks: CheckResult[], overallScore: number): string {
    const failedChecks = checks.filter((c) => !c.passed);
    const warningChecks = checks.filter((c) => c.passed && c.score < 70);

    const parts: string[] = [];

    parts.push(`Overall score: ${overallScore}/100`);

    if (failedChecks.length === 0 && warningChecks.length === 0) {
      parts.push('All checks passed');
    } else {
      if (failedChecks.length > 0) {
        parts.push(`${failedChecks.length} check(s) failed: ${failedChecks.map((c) => c.name).join(', ')}`);
      }
      if (warningChecks.length > 0) {
        parts.push(`${warningChecks.length} check(s) have warnings: ${warningChecks.map((c) => c.name).join(', ')}`);
      }
    }

    return parts.join('. ') + '.';
  }
}

// ═══════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════

let verifierInstance: RuntimeVerifier | null = null;

export function getVerifier(): RuntimeVerifier {
  if (!verifierInstance) {
    verifierInstance = new RuntimeVerifier();
  }
  return verifierInstance;
}
