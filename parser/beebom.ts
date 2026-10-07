import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { fetchText } from './util';
import { type ArticleCodes, type CodeItem, isPlausibleCode, normalizeCode, cleanCodeText, extractReward } from './codes';

const SKIP_HEADING = /expired|not working|how to|redeem|why |when |where|get more|tips|faq|other ways|related|frequently/i;
const ACTIVE_HEADING = /code/i;

function isExpiredHeading(text: string): boolean {
  return /expired|not working/i.test(text);
}

function isCandidateHeading(text: string): boolean {
  if (!ACTIVE_HEADING.test(text)) return false;
  if (SKIP_HEADING.test(text)) return false;
  return true;
}

function parseListItems($: cheerio.CheerioAPI, list: cheerio.Cheerio<AnyNode>): CodeItem[] {
  const items: CodeItem[] = [];
  list.find('li').each((_, li) => {
    const $li = $(li);
    if ($li.find('a').length > 0 && !$li.find('strong, b, code').length) return;
    const raw = $li.text().replace(/\s+/g, ' ').trim();
    if (!raw || /tips|double-check|codes expire|capitalization|server glitch|game update|special event|community goal|apologies/i.test(raw)) return;

    const marked = $li.find('strong, b, code').first().text().trim();
    let code = '';
    let reward = '';
    if (marked && isPlausibleCode(marked)) {
      code = normalizeCode(marked);
      reward = extractReward(raw.slice(raw.indexOf(marked) + marked.length));
    } else {
      const idx = raw.indexOf(':');
      if (idx > 0) {
        const head = cleanCodeText(raw.slice(0, idx));
        if (isPlausibleCode(head)) {
          code = normalizeCode(head);
          reward = extractReward(raw.slice(idx + 1));
        }
      } else {
        const head = cleanCodeText(raw);
        if (isPlausibleCode(head)) code = normalizeCode(head);
      }
    }
    if (code) items.push({ code, reward: reward || undefined });
  });
  return items;
}

function parseTable($: cheerio.CheerioAPI, table: cheerio.Cheerio<AnyNode>): CodeItem[] {
  const items: CodeItem[] = [];
  table.find('tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 1) return;
    const codeRaw = cells.eq(0).text().replace(/\s+/g, ' ').trim();
    if (!isPlausibleCode(codeRaw)) return;
    const reward = cells.length > 1 ? extractReward(cells.eq(1).text()) : '';
    items.push({ code: normalizeCode(codeRaw), reward: reward || undefined });
  });
  return items;
}

function collectFromSection($: cheerio.CheerioAPI, heading: cheerio.Cheerio<AnyNode>): { items: CodeItem[] } {
  const items: CodeItem[] = [];
  let node = heading.next();
  while (node.length) {
    const tag = (node[0].tagName ?? '').toLowerCase();
    if (/^h[1-6]$/.test(tag)) break;
    if (node.is('ul, ol')) items.push(...parseListItems($, node));
    else if (node.is('table')) items.push(...parseTable($, node));
    else if (node.is('div')) {
      node.find('ul, ol').each((_, l) => {
        items.push(...parseListItems($, $(l)));
      });
    }
    node = node.next();
  }
  return { items };
}

export function parseBeebomArticle(html: string): ArticleCodes {
  const $ = cheerio.load(html);
  let placeId: number | null = null;
  $('a[href*="roblox.com/games/"]').each((_, a) => {
    if (placeId !== null) return;
    const m = ($(a).attr('href') ?? '').match(/roblox\.com\/games\/(\d+)/);
    if (m) placeId = Number(m[1]);
  });

  const active: CodeItem[] = [];
  const expired: string[] = [];

  $('h2, h3, h4').each((_, h) => {
    const heading = $(h);
    const text = heading.text().trim();
    if (!isCandidateHeading(text) && !isExpiredHeading(text)) return;
    const { items } = collectFromSection($, heading);
    if (isExpiredHeading(text)) {
      for (const it of items) expired.push(it.code);
    } else {
      active.push(...items);
    }
  });

  const dedupActive: CodeItem[] = [];
  const seenActive = new Set<string>();
  for (const it of active) {
    const key = it.code.toLowerCase();
    if (seenActive.has(key)) continue;
    seenActive.add(key);
    dedupActive.push(it);
  }
  const dedupExpired: string[] = [];
  const seenExpired = new Set<string>();
  for (const c of expired) {
    const key = c.toLowerCase();
    if (seenExpired.has(key) || seenActive.has(key)) continue;
    seenExpired.add(key);
    dedupExpired.push(c);
  }

  return {
    active: dedupActive,
    expired: dedupExpired,
    placeId,
    ok: dedupActive.length > 0 || dedupExpired.length > 0,
  };
}

export async function fetchBeebomArticle(url: string): Promise<ArticleCodes> {
  const html = await fetchText(url);
  return parseBeebomArticle(html);
}
