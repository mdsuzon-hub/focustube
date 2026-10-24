// Explainable, text-only relevance scoring. It looks ONLY at text that YouTube
// already shows on the results page (title, channel, snippet). It does not and
// cannot analyse the actual video content.

export interface Candidate {
  title: string;
  channel?: string;
  description?: string;
}

export interface RelevanceOptions {
  negativeKeywords: string[];
  preferredChannels: string[];
}

export interface RelevanceResult {
  /** 0-100. */
  score: number;
  excluded: boolean;
  reasons: string[];
}

const STOPWORDS = new Set(
  'a an and are as at be by for from how in is it of on or the to what why with your you this that into about'.split(
    ' ',
  ),
);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function stem(t: string): string {
  return t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t;
}

export function tokenize(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((t) => t.length > 0 && !STOPWORDS.has(t))
    .map(stem);
}

function containsPhrase(haystack: string, phrase: string): boolean {
  const p = normalize(phrase);
  if (!p) return false;
  return ` ${normalize(haystack)} `.includes(` ${p} `);
}

function coverage(topicTokens: string[], textTokens: Set<string>): { hit: number; ratio: number } {
  if (topicTokens.length === 0) return { hit: 0, ratio: 0 };
  const hit = topicTokens.filter((t) => textTokens.has(t)).length;
  return { hit, ratio: hit / topicTokens.length };
}

export function scoreRelevance(
  topic: string,
  c: Candidate,
  opts: RelevanceOptions,
): RelevanceResult {
  const fields = [c.title, c.channel ?? '', c.description ?? ''];
  for (const kw of opts.negativeKeywords) {
    if (fields.some((f) => containsPhrase(f, kw))) {
      return { score: 0, excluded: true, reasons: [`Contains excluded keyword "${kw}"`] };
    }
  }

  const reasons: string[] = [];
  let score = 0;
  const topicTokens = [...new Set(tokenize(topic))];

  if (topicTokens.length === 0) {
    return { score: 50, excluded: false, reasons: ['No active topic, so results are not scored'] };
  }

  const title = coverage(topicTokens, new Set(tokenize(c.title)));
  if (title.hit > 0) {
    score += Math.round(65 * title.ratio);
    reasons.push(`Title matches ${title.hit} of ${topicTokens.length} topic words`);
  } else {
    reasons.push('Title shares no words with the topic');
  }

  if (normalize(topic) && containsPhrase(c.title, topic)) {
    score += 15;
    reasons.push('Exact topic phrase appears in the title');
  }

  if (c.description) {
    const desc = coverage(topicTokens, new Set(tokenize(c.description)));
    if (desc.hit > 0) {
      score += Math.round(15 * desc.ratio);
      reasons.push(`Snippet matches ${desc.hit} of ${topicTokens.length} topic words`);
    }
  }

  const channel = (c.channel ?? '').toLowerCase();
  if (channel && opts.preferredChannels.some((p) => channel.includes(p.toLowerCase()))) {
    score += 10;
    reasons.push('From a preferred channel');
  }

  return { score: Math.min(100, score), excluded: false, reasons };
}

export function rankResults<T extends Candidate>(
  topic: string,
  items: T[],
  opts: RelevanceOptions,
): Array<{ item: T; result: RelevanceResult; index: number }> {
  return items
    .map((item, index) => ({ item, index, result: scoreRelevance(topic, item, opts) }))
    .sort((a, b) => b.result.score - a.result.score || a.index - b.index);
}
