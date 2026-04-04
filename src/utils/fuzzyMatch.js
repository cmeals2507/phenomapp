/**
 * fuzzyMatch.js — locate a meaning-unit excerpt within a raw transcript.
 *
 * Because excerpts may be lightly edited or have minor whitespace / punctuation
 * differences, we use a sliding-window Levenshtein approach rather than exact
 * substring search.
 *
 * Algorithm:
 *  1. Normalize both strings (collapse whitespace, lowercase).
 *  2. Build a position map from the normalized transcript back to original indices.
 *  3. Slide a window of ≈excerptLength characters across the normalized transcript.
 *  4. Pre-filter: skip windows whose first N chars have similarity < 0.70.
 *  5. Compute Levenshtein similarity for survivors; track best.
 *  6. If best similarity ≥ 0.90, return { start, end } in original raw_text space.
 *  7. Otherwise return null (excerpt not found; no highlight).
 *
 * Performance: runs on the main thread. For transcripts > 10 000 chars a Web
 * Worker would avoid blocking the UI — add as a future optimization.
 *
 * Cache usage: callers should memoize per (muId, excerptText) to avoid
 * recomputation on every render.
 *
 * Exported: findExcerptInText(excerpt, rawText) → { start, end } | null
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function normalize(s) {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Build a normalized version of rawText plus a position map.
 * indexMap[normIdx] gives the original rawText character index.
 */
function buildNormalized(rawText) {
  let normalized = '';
  const indexMap = [];
  let lastWasSpace = true; // treat start as-if preceded by whitespace to trim leading

  for (let i = 0; i < rawText.length; i++) {
    const ch = rawText[i];
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

  // Trim trailing space that may have been added.
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Find the best-matching position of `excerpt` within `rawText`.
 *
 * @param {string} excerpt  Analyst-entered excerpt (may have minor differences).
 * @param {string} rawText  Full immutable transcript text.
 * @returns {{ start: number, end: number } | null}  Character indices in rawText.
 */
export function findExcerptInText(excerpt, rawText) {
  if (!excerpt || !rawText) return null;

  const normExcerpt = normalize(excerpt);
  if (normExcerpt.length === 0) return null;

  const { normalized: normRaw, indexMap } = buildNormalized(rawText);

  const eLen = normExcerpt.length;
  const minWin = Math.max(1, Math.floor(eLen * 0.80));
  const maxWin = Math.ceil(eLen * 1.20);
  const range = maxWin - minWin;

  // Test up to 4 evenly spaced window sizes.
  const winSizes = [...new Set([
    minWin,
    minWin + Math.floor(range / 3),
    minWin + Math.floor((2 * range) / 3),
    maxWin,
  ])].filter(s => s >= 1);

  // Pre-filter uses the first N chars of the normalized excerpt.
  const preLen = Math.min(10, Math.max(1, Math.floor(eLen / 3)));
  const excerptPre = normExcerpt.slice(0, preLen);

  let bestScore = 0;
  let bestNormStart = -1;
  let bestNormEnd = -1;

  for (let i = 0; i <= normRaw.length - minWin; i++) {
    // Pre-filter: bail early if the opening characters are too dissimilar.
    const windowPre = normRaw.slice(i, i + preLen);
    const preMaxLen = Math.max(excerptPre.length, windowPre.length);
    if (preMaxLen > 0) {
      const preSim = 1 - levenshtein(excerptPre, windowPre) / preMaxLen;
      if (preSim < 0.70) continue;
    }

    for (const winLen of winSizes) {
      if (i + winLen > normRaw.length) continue;
      const window = normRaw.slice(i, i + winLen);
      const maxL = Math.max(eLen, winLen);
      const score = 1 - levenshtein(normExcerpt, window) / maxL;
      if (score > bestScore) {
        bestScore = score;
        bestNormStart = i;
        bestNormEnd = i + winLen;
      }
    }
  }

  if (bestScore < 0.90 || bestNormStart === -1) return null;

  // Map normalized positions back to original rawText indices.
  const start = indexMap[bestNormStart] ?? 0;
  const lastNormIdx = Math.min(bestNormEnd - 1, indexMap.length - 1);
  const end = (indexMap[lastNormIdx] ?? 0) + 1;

  return { start, end };
}
