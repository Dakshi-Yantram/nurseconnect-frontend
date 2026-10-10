/**
 * Tiny typo-tolerant search for the care-package catalogue (no dependencies).
 *
 *  - every word you type must match somewhere in the package's text
 *  - a word matches if it is contained in a catalogue word, starts one, or is
 *    within 1–2 typos of one ("injecton" still finds "Injection at Home")
 *  - when nothing matches, `didYouMean` offers a corrected query that does
 */
export const normalize = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

function lev(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

const tolerance = (t: string) => (t.length >= 8 ? 2 : t.length >= 4 ? 1 : 0);

/** 0 = no match, otherwise higher is better. */
function tokenScore(token: string, hay: string, words: string[]): number {
  if (hay.includes(token)) return words.includes(token) ? 3 : 2;
  const tol = tolerance(token);
  if (tol === 0) return 0;
  for (const w of words) {
    if (w.length >= 3 && token.length >= 3 && (w.startsWith(token) || token.startsWith(w))) return 1.5;
    if (lev(token, w, tol) <= tol) return 1;
  }
  return 0;
}

export interface SearchResult<T> {
  items: T[];
  didYouMean: string | null;
}

export function searchItems<T>(items: T[], query: string, text: (item: T) => string): SearchResult<T> {
  const q = normalize(query);
  if (!q) return { items, didYouMean: null };
  const tokens = q.split(" ");

  const prepared = items.map((item) => {
    const hay = normalize(text(item));
    return { item, hay, words: Array.from(new Set(hay.split(" "))) };
  });

  const run = (toks: string[]) =>
    prepared
      .map((p) => {
        let total = 0;
        for (const t of toks) {
          const sc = tokenScore(t, p.hay, p.words);
          if (sc === 0) return null;
          total += sc;
        }
        return { item: p.item, total };
      })
      .filter((x): x is { item: T; total: number } => x !== null)
      .sort((a, b) => b.total - a.total)
      .map((x) => x.item);

  const found = run(tokens);
  if (found.length > 0) return { items: found, didYouMean: null };

  // Nothing matched: try to repair each word against the catalogue vocabulary.
  const vocab = Array.from(new Set(prepared.flatMap((p) => p.words))).filter((w) => w.length >= 3);
  const fixed = tokens.map((t) => {
    if (vocab.includes(t)) return t;
    let best = t;
    let bestD = 3;
    for (const w of vocab) {
      const d = lev(t, w, 2);
      if (d < bestD) { bestD = d; best = w; }
    }
    return best;
  });
  const fixedQuery = fixed.join(" ");
  if (fixedQuery !== q && run(fixed).length > 0) return { items: [], didYouMean: fixedQuery };
  return { items: [], didYouMean: null };
}
