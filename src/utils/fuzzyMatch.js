/**
 * fuzzyMatch.js — locate a meaning-unit excerpt within a raw transcript.
 *
 * Algorithm:
 *  1. Split excerpt on ellipsis delimiters ('...' or '…') into one or more parts.
 *  2. Normalize each part (collapse whitespace, lowercase).
 *  3. Build a position map from the normalized transcript back to original indices.
 *  4. For each part, slide a fixed-width window (exact excerpt length) across the
 *     normalized transcript. Pre-filter: skip windows whose first N chars differ
 *     from the part's prefix (similarity < 1.0).
 *  5. Compute Levenshtein similarity for survivors; require exact match (≥ 1.0).
 *  6. If ALL parts match, return an array of { start, end } ranges in raw_text space.
 *  7. If any part fails to match, return null (no highlight for this excerpt).
 *
 * Exported: findExcerptInText(excerpt, rawText) → { start, end }[] | null
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Replace typographic variants with ASCII equivalents before comparison.
 * All substitutions are 1-to-1 (one Unicode code point → one ASCII char) so
 * character positions are preserved — indexMap entries stay valid offsets
 * into the original rawText string.
 */
function canonicalize(s) {
  return s
    .replace(/[‘’‚‛′‵ʼ]/g, "'") // curly/typographic single quotes
    .replace(/[“”„‟″‶]/g, '"')        // curly/typographic double quotes
    .replace(/[–—―−‐‑﹘﹣－]/g, '-'); // en-dash, em-dash, variants
}

function normalize(s) {
  return canonicalize(s).replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Build a normalized version of rawText plus a position map.
 * indexMap[normIdx] gives the original rawText character index.
 */
function buildNormalized(rawText) {
  // Canonicalize first — 1-to-1 substitution so all positions are preserved.
  const text = canonicalize(rawText);
  let normalized = '';
  const indexMap = [];
  let lastWasSpace = true;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (!lastWasSpace) {
        normalized += ' ';
        indexMap.push(i);
        lastWasSpace = true;
      }
    } else {
      normalized += ch.toLowerCase();
      indexMap.push(i);
      lastWasSpace = false;
    }
  }

  if (normalized.endsWith(' ')) {
    normalized = normalized.slice(0, -1);
    indexMap.pop();
  }

  return { normalized, indexMap };
}

/**
 * Two-row Levenshtein distance (memory-efficient).
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/**
 * Find a single normalized part within a pre-built normalized transcript.
 * Returns { start, end } in original rawText space, or null.
 */
function findPart(normPart, normRaw, indexMap) {
  const eLen = normPart.length;
  if (eLen === 0 || eLen > normRaw.length) return null;

  const preLen = Math.min(10, Math.max(1, Math.floor(eLen / 3)));
  const partPre = normPart.slice(0, preLen);

  let bestScore = 0;
  let bestNormStart = -1;
  let bestNormEnd = -1;

  for (let i = 0; i <= normRaw.length - eLen; i++) {
    // Pre-filter: opening characters must match exactly.
    const windowPre = normRaw.slice(i, i + preLen);
    const preMaxLen = Math.max(partPre.length, windowPre.length);
    if (preMaxLen > 0) {
      const preSim = 1 - levenshtein(partPre, windowPre) / preMaxLen;
      if (preSim < 1.0) continue;
    }

    const window = normRaw.slice(i, i + eLen);
    const score = 1 - levenshtein(normPart, window) / eLen;
    if (score > bestScore) {
      bestScore = score;
      bestNormStart = i;
      bestNormEnd = i + eLen;
    }
  }

  if (bestScore < 1.0 || bestNormStart === -1) return null;

  const start = indexMap[bestNormStart] ?? 0;
  const lastNormIdx = Math.min(bestNormEnd - 1, indexMap.length - 1);
  const end = (indexMap[lastNormIdx] ?? 0) + 1;

  return { start, end };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Find all parts of `excerpt` within `rawText`.
 * Parts are separated by ellipsis ('...' or '…'); each must match exactly
 * (after normalization). All parts must match or null is returned.
 *
 * @param {string} excerpt  Analyst-entered excerpt; may contain '...' separators.
 * @param {string} rawText  Full immutable transcript text.
 * @returns {{ start: number, end: number }[] | null}
 */
export function findExcerptInText(excerpt, rawText) {
  if (!excerpt || !rawText) return null;

  // Split on '...' or the unicode ellipsis character '…'
  const parts = excerpt.split(/\.{3}|…/).map(p => normalize(p)).filter(Boolean);
  if (parts.length === 0) return null;

  const { normalized: normRaw, indexMap } = buildNormalized(rawText);

  const results = [];
  for (const part of parts) {
    const match = findPart(part, normRaw, indexMap);
    if (!match) return null; // all parts must match
    results.push(match);
  }

  return results;
}
