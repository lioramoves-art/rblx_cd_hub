import * as cheerio from 'cheerio';
import { fetchText } from './util';
import { isPlausibleCode, normalizeCode } from './codes';

const HUB_URL = 'https://tryhardguides.com/roblox-game-codes-list/';

export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/^roblox\s+/i, '')
    .replace(/[^a-z0-9]+/g, '');
}

export async function fetchThgIndex(): Promise<Map<string, string>> {
  const html = await fetchText(HUB_URL);
  const $ = cheerio.load(html);
  const map = new Map<string, string>();
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    const text = $(a).text().replace(/\s+/g, ' ').trim();
    if (!/tryhardguides\.com\/[a-z0-9-]+-codes\//i.test(href)) return;
    if (!/codes/i.test(text)) return;
    const key = normalizeTitle(text.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, ''));
    if (key && !map.has(key)) map.set(key, href);
  });
  return map;
}

export function findThgUrl(gameName: string, index: Map<string, string>): string | null {
  const key = normalizeTitle(gameName);
  if (!key) return null;
  if (index.has(key)) return index.get(key)!;
  for (const [k, url] of index) {
    if (k.startsWith(key) || key.startsWith(k)) return url;
  }
  return null;
}

const SKIP_HEADING = /expired|not working|how to|redeem|why |when |where|get more|tips|faq|not working/i;

export interface ThgArticleCodes {
  active: string[];
  expired: string[];
  ok: boolean;
}

export function parseThgArticle(html: string): ThgArticleCodes {
  const $ = cheerio.load(html);
  const active: string[] = [];
  const expired: string[] = [];

  const headingSelector = 'h2, h3, h4';
  $(headingSelector).each((_, h) => {
    const text = $(h).text().trim();
    const isExpired = /expired|not working/i.test(text);
    const isActive = /code/i.test(text) && !SKIP_HEADING.test(text);
    if (!isExpired && !isActive) return;

    let node = $(h).next();
    while (node.length) {
      const tag = (node[0].tagName ?? '').toLowerCase();
      if (/^h[1-6]$/.test(tag)) break;
      if (node.is('ul, ol')) {
        node.find('li').each((_, li) => {
          const raw = $(li).text().replace(/\s+/g, ' ').trim();
          if ($(li).find('a').length > 0) return;
          const candidate = raw.split(/[:–—-]/)[0].trim();
          if (!isPlausibleCode(candidate)) return;
          const code = normalizeCode(candidate);
          if (isExpired) expired.push(code);
          else active.push(code);
        });
      }
      node = node.next();
    }
  });

  const uniq = (arr: string[]) => [...new Set(arr.map((c) => c.toLowerCase()))];
  const activeKeys = new Set(uniq(active));
  return {
    active: [...activeKeys],
    expired: expired.filter((c) => !activeKeys.has(c.toLowerCase())),
    ok: active.length > 0 || expired.length > 0,
  };
}

export async function fetchThgArticle(url: string): Promise<ThgArticleCodes> {
  const html = await fetchText(url);
  return parseThgArticle(html);
}
