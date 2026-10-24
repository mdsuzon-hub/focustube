export type PageType =
  'home' | 'results' | 'watch' | 'channel' | 'subscriptions' | 'shorts' | 'other';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
export const isVideoId = (s: unknown): s is string => typeof s === 'string' && VIDEO_ID.test(s);

function toUrl(input: string): URL | null {
  try {
    return new URL(input, 'https://www.youtube.com');
  } catch {
    return null;
  }
}

export function isYouTubeHost(host: string): boolean {
  return host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be';
}

/** True for /shorts, /shorts/ and /shorts/<id> on YouTube hosts. */
export function isShortsUrl(input: string): boolean {
  const u = toUrl(input);
  if (!u || !isYouTubeHost(u.hostname)) return false;
  return /^\/shorts(\/|$)/.test(u.pathname);
}

export function extractShortsId(input: string): string | null {
  const u = toUrl(input);
  if (!u || !isYouTubeHost(u.hostname)) return null;
  const m = u.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})(?:[/]|$)/);
  return m?.[1] ?? null;
}

export function watchUrl(videoId: string, startSec?: number): string {
  const t = startSec && startSec > 5 ? `&t=${Math.floor(startSec)}s` : '';
  return `https://www.youtube.com/watch?v=${videoId}${t}`;
}

/** Converts a /shorts/<id> URL to the standard watch URL, or null when impossible. */
export function shortsToWatchUrl(input: string): string | null {
  const id = extractShortsId(input);
  return id ? watchUrl(id) : null;
}

const CHANNEL_SHORTS = /^(\/(?:@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+))\/shorts\/?$/;

/** /@name/shorts -> /@name/videos (the Shorts tab of a channel). */
export function channelShortsToVideosUrl(input: string): string | null {
  const u = toUrl(input);
  if (!u || !isYouTubeHost(u.hostname)) return null;
  const m = u.pathname.match(CHANNEL_SHORTS);
  return m?.[1] ? `${u.origin}${m[1]}/videos` : null;
}

export function parseVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (isVideoId(trimmed)) return trimmed;
  const u = toUrl(trimmed);
  if (!u || !isYouTubeHost(u.hostname)) return null;
  if (u.hostname === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    return isVideoId(id) ? id : null;
  }
  if (u.pathname === '/watch') {
    const id = u.searchParams.get('v');
    return isVideoId(id) ? id : null;
  }
  const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? null;
}

export function getPageType(input: string): PageType {
  const u = toUrl(input);
  if (!u || !isYouTubeHost(u.hostname)) return 'other';
  const p = u.pathname;
  if (p === '/' || p === '/feed/trending') return p === '/' ? 'home' : 'other';
  if (p === '/results') return 'results';
  if (p === '/watch') return 'watch';
  if (/^\/shorts(\/|$)/.test(p)) return 'shorts';
  if (p === '/feed/subscriptions') return 'subscriptions';
  if (/^\/(@[^/]+|channel\/|c\/|user\/)/.test(p)) return 'channel';
  return 'other';
}

const UPLOAD_SP: Record<string, string> = {
  today: 'EgIIAg%3D%3D',
  week: 'EgIIAw%3D%3D',
  month: 'EgIIBA%3D%3D',
  year: 'EgIIBQ%3D%3D',
};

/** Builds a native YouTube search URL. Upload date uses YouTube's own filter parameter. */
export function buildSearchUrl(query: string, uploadDate: string = 'any'): string {
  const q = encodeURIComponent(query.trim()).replace(/%20/g, '+');
  const sp = UPLOAD_SP[uploadDate];
  return `https://www.youtube.com/results?search_query=${q}${sp ? `&sp=${sp}` : ''}`;
}

export function searchQueryFromUrl(input: string): string | null {
  const u = toUrl(input);
  if (!u || u.pathname !== '/results') return null;
  return u.searchParams.get('search_query');
}

export function thumbnailFor(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}
