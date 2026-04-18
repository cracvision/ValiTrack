// ValiTrack — AI Severity Mapping
// Single source of truth for mapping LLM severity strings to internal FindingSeverity enum.
//
// Compliance rationale: The LLM may return non-standard severity vocabulary
// (HIGH/MEDIUM/LOW etc). Silently downgrading unknown values to "observation"
// is a non-recoverable accuracy failure (ALCOA+, 21 CFR Part 11 §11.10(e)).
// Fail-safe: unknown values escalate to 'major' for human review, never down.

import type { FindingSeverity } from '@/types/findings';

export const AI_SEVERITY_MAPPING: Record<string, FindingSeverity> = {
  // Direct GxP vocabulary
  CRITICAL: 'critical',
  MAJOR: 'major',
  MINOR: 'minor',
  OBSERVATION: 'observation',

  // Alternate LLM vocabulary mapped to closest GxP equivalent
  HIGH: 'major',          // HIGH = significant impact = Major in GxP
  MEDIUM: 'minor',        // MEDIUM = moderate impact = Minor
  LOW: 'observation',     // LOW = minimal impact = Observation
  INFO: 'observation',
  INFORMATIONAL: 'observation',
  NOTE: 'observation',
  WARNING: 'minor',
};

export interface MappedSeverity {
  /** Mapped internal severity enum value. Always valid. */
  mapped: FindingSeverity;
  /**
   * The EXACT input string as received — preserves casing, whitespace, and
   * any surrounding formatting. Used for traceability in `findings.ai_severity_raw`.
   * Only `null` when the input itself was null/undefined or non-string.
   */
  raw: string | null;
  /** True if the raw value did not match any key in the mapping (after normalization). */
  wasUnknown: boolean;
}

/**
 * Maps a raw AI severity string to the internal FindingSeverity enum.
 *
 * - Lookup is case-insensitive and whitespace-tolerant (`trim().toUpperCase()`).
 * - Normalization applies ONLY to the dictionary lookup. The returned `raw`
 *   field preserves the EXACT input string (including original casing and
 *   surrounding whitespace) so audit records reflect the LLM output verbatim.
 * - Unknown / missing values fail-safe to 'major' (NOT 'observation') and
 *   emit a console.warn so prompt-template drift is visible.
 */
export function mapAiSeverity(rawSeverity: unknown): MappedSeverity {
  if (rawSeverity === null || rawSeverity === undefined || typeof rawSeverity !== 'string') {
    console.warn(
      `[aiSeverityMapping] Missing or non-string AI severity (got ${typeof rawSeverity}) — defaulting to 'major' for safety.`
    );
    return {
      mapped: 'major',
      raw: typeof rawSeverity === 'string' ? rawSeverity : null,
      wasUnknown: true,
    };
  }

  const normalized = rawSeverity.trim().toUpperCase();
  const mapped = AI_SEVERITY_MAPPING[normalized];

  if (!mapped) {
    console.warn(
      `[aiSeverityMapping] Unknown AI severity "${rawSeverity}" — ` +
      `defaulting to 'major' for safety. Add to AI_SEVERITY_MAPPING if this value is valid.`
    );
    return { mapped: 'major', raw: rawSeverity, wasUnknown: true };
  }

  return { mapped, raw: rawSeverity, wasUnknown: false };
}
