import { describe, expect, it } from 'vitest';
import {
  buildSearchUrl,
  channelShortsToVideosUrl,
  extractShortsId,
  getPageType,
  isShortsUrl,
  parseVideoId,
  shortsToWatchUrl,
} from '../src/shared/urls';

describe('Shorts URL detection', () => {
  it('detects direct Shorts URLs', () => {
    expect(isShortsUrl('https://www.youtube.com/shorts/abcDEF12345')).toBe(true);
    expect(isShortsUrl('https://youtube.com/shorts/abcDEF12345?feature=share')).toBe(true);
    expect(isShortsUrl('https://www.youtube.com/shorts')).toBe(true);
  });
  it('does not flag normal pages or other hosts', () => {
    expect(isShortsUrl('https://www.youtube.com/watch?v=abcDEF12345')).toBe(false);
    expect(isShortsUrl('https://www.youtube.com/results?search_query=shorts')).toBe(false);
    expect(isShortsUrl('https://example.com/shorts/abcDEF12345')).toBe(false);
    expect(isShortsUrl('https://www.youtube.com/@shortsfan/videos')).toBe(false);
  });
  it('converts to a watch URL when the id is valid', () => {
    expect(shortsToWatchUrl('https://www.youtube.com/shorts/abcDEF12345')).toBe(
      'https://www.youtube.com/watch?v=abcDEF12345',
    );
    expect(extractShortsId('https://www.youtube.com/shorts/abcDEF12345/')).toBe('abcDEF12345');
  });
  it('returns null when conversion is impossible', () => {
    expect(shortsToWatchUrl('https://www.youtube.com/shorts/')).toBeNull();
    expect(shortsToWatchUrl('https://www.youtube.com/shorts/short')).toBeNull();
    expect(shortsToWatchUrl('not a url at all %%%')).toBeNull();
  });
  it('maps a channel Shorts tab to its videos tab', () => {
    expect(channelShortsToVideosUrl('https://www.youtube.com/@mkbhd/shorts')).toBe(
      'https://www.youtube.com/@mkbhd/videos',
    );
    expect(channelShortsToVideosUrl('https://www.youtube.com/channel/UC123/shorts')).toBe(
      'https://www.youtube.com/channel/UC123/videos',
    );
    expect(channelShortsToVideosUrl('https://www.youtube.com/@mkbhd/videos')).toBeNull();
  });
});

describe('page + video parsing', () => {
  it('classifies pages', () => {
    expect(getPageType('https://www.youtube.com/')).toBe('home');
    expect(getPageType('https://www.youtube.com/results?search_query=x')).toBe('results');
    expect(getPageType('https://www.youtube.com/watch?v=abcDEF12345')).toBe('watch');
    expect(getPageType('https://www.youtube.com/@name')).toBe('channel');
    expect(getPageType('https://www.youtube.com/feed/subscriptions')).toBe('subscriptions');
    expect(getPageType('https://www.youtube.com/shorts/abcDEF12345')).toBe('shorts');
    expect(getPageType('https://example.com/')).toBe('other');
  });
  it('parses video ids from common URL forms', () => {
    expect(parseVideoId('https://www.youtube.com/watch?v=abcDEF12345&t=5')).toBe('abcDEF12345');
    expect(parseVideoId('https://youtu.be/abcDEF12345')).toBe('abcDEF12345');
    expect(parseVideoId('abcDEF12345')).toBe('abcDEF12345');
    expect(parseVideoId('https://evil.example/watch?v=abcDEF12345')).toBeNull();
  });
  it('builds a search URL with the native upload-date filter', () => {
    expect(buildSearchUrl('react hooks')).toBe(
      'https://www.youtube.com/results?search_query=react+hooks',
    );
    expect(buildSearchUrl('react hooks', 'week')).toContain('&sp=EgIIAw%3D%3D');
  });
});
