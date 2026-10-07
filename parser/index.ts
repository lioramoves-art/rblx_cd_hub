import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fetchBeebomArticle } from './beebom';
import { fetchThgIndex, findThgUrl, fetchThgArticle } from './thg';
import { mergeCodes, type GameCodesState } from './merge';
import { resolveUniverse, fetchGamesBatch, fetchIconsBatch, type RobloxGameMeta } from './roblox';
import { sleep } from './util';

interface GameEntry {
  slug: string;
  name: string;
  order: number;
  sources: { beebom?: string; tryhardguides?: string };
  desc: { en: string; ru: string };
}

interface CodesFile {
  updatedAt: string | null;
  games: Record<string, GameCodesState>;
}

interface MetaFile {
  updatedAt: string | null;
  games: Record<string, RobloxGameMeta>;
}

interface BacklogFile {
  updatedAt: string | null;
  items: { title: string; url: string; addedAt: string }[];
}

const EMPTY_CODES: GameCodesState = { active: [], expired: [], checkedAt: null, lastChangeAt: null };

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function writeIfChanged(path: string, data: unknown): boolean {
  const next = JSON.stringify(data, null, 2) + '\n';
  const prev = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (prev === next) return false;
  writeFileSync(path, next, 'utf8');
  return true;
}

async function main() {
  const discover = process.argv.includes('--discover');
  const now = new Date().toISOString();

  const games = readJson<GameEntry[]>('data/games.json', []);
  const codesFile = readJson<CodesFile>('data/codes.json', { updatedAt: null, games: {} });
  const metaFile = readJson<MetaFile>('data/roblox-meta.json', { updatedAt: null, games: {} });

  console.log(`Parsing ${games.length} games...`);

  let thgIndex: Map<string, string> | null = null;
  try {
    thgIndex = await fetchThgIndex();
    console.log(`TryHardGuides index: ${thgIndex.size} articles`);
  } catch (e) {
    console.warn('TryHardGuides index unavailable:', e);
  }

  let updatedCount = 0;
  const errors: string[] = [];

  for (const [i, game] of games.entries()) {
    const prev = codesFile.games[game.slug] ?? EMPTY_CODES;
    let beebomResult = null;
    try {
      if (game.sources.beebom) {
        beebomResult = await fetchBeebomArticle(game.sources.beebom);
      }
    } catch (e) {
      errors.push(`${game.slug}: beebom - ${(e as Error).message}`);
    }

    let thgActive: string[] | null = null;
    let thgExpired: string[] | null = null;
    try {
      const thgUrl = game.sources.tryhardguides ?? (thgIndex ? findThgUrl(game.name, thgIndex) : null);
      if (thgUrl) {
        const thg = await fetchThgArticle(thgUrl);
        if (thg.ok) {
          thgActive = thg.active;
          thgExpired = thg.expired;
        }
      }
    } catch (e) {
      errors.push(`${game.slug}: thg - ${(e as Error).message}`);
    }

    const { state, changedCodes } = mergeCodes({ prev, beebom: beebomResult, thgActive, thgExpired, now });
    codesFile.games[game.slug] = state;
    if (changedCodes) updatedCount++;

    if (beebomResult?.placeId) {
      const existing = metaFile.games[game.slug];
      if (!existing || existing.placeId !== beebomResult.placeId) {
        metaFile.games[game.slug] = {
          placeId: beebomResult.placeId,
          universeId: existing?.universeId ?? null,
          name: existing?.name ?? game.name,
          icon: existing?.icon ?? null,
          playing: existing?.playing ?? null,
          visits: existing?.visits ?? null,
          fetchedAt: existing?.fetchedAt ?? null,
        };
      }
    }

    const summary = `${String(i + 1).padStart(2)}/${games.length} ${game.slug}: ${state.active.length} active, ${state.expired.length} expired${changedCodes ? ' [CHANGED]' : ''}`;
    console.log(summary);
    await sleep(400);
  }

  codesFile.updatedAt = now;
  const codesWritten = writeIfChanged('data/codes.json', codesFile);
  console.log(`codes.json ${codesWritten ? 'updated' : 'unchanged'} (${updatedCount} games with code changes)`);

  // Resolve missing universe ids
  for (const game of games) {
    const meta = metaFile.games[game.slug];
    if (meta?.placeId && !meta.universeId) {
      meta.universeId = await resolveUniverse(meta.placeId);
      await sleep(250);
    }
  }

  const universeIds = [
    ...new Set(
      Object.values(metaFile.games)
        .map((m) => m.universeId)
        .filter((id): id is number => typeof id === 'number'),
    ),
  ];
  if (universeIds.length) {
    const [gameInfo, icons] = await Promise.all([fetchGamesBatch(universeIds), fetchIconsBatch(universeIds)]);
    for (const [slug, meta] of Object.entries(metaFile.games)) {
      if (!meta.universeId) continue;
      const info = gameInfo.get(meta.universeId);
      const icon = icons.get(meta.universeId);
      metaFile.games[slug] = {
        ...meta,
        name: info?.name ?? meta.name,
        icon: icon ?? meta.icon,
        playing: info?.playing ?? meta.playing,
        visits: info?.visits ?? meta.visits,
        fetchedAt: now,
      };
    }
    metaFile.updatedAt = now;
    const metaWritten = writeIfChanged('data/roblox-meta.json', metaFile);
    console.log(`roblox-meta.json ${metaWritten ? 'updated' : 'unchanged'} for ${universeIds.length} universes`);
  }

  if (discover) {
    await discoverNew(now);
  }

  if (errors.length) {
    console.warn('\nErrors:');
    for (const e of errors) console.warn('  -', e);
  }
  console.log('\nDone.');
}

async function discoverNew(now: string) {
  const { fetchText } = await import('./util');
  const cheerio = await import('cheerio');
  const games = readJson<GameEntry[]>('data/games.json', []);
  const backlog = readJson<BacklogFile>('data/backlog.json', { updatedAt: null, items: [] });
  const knownUrls = new Set(
    games.flatMap((g) => Object.values(g.sources).filter(Boolean) as string[]).concat(backlog.items.map((i) => i.url)),
  );

  let added = 0;
  for (const page of ['', 'page/2/']) {
    try {
      const html = await fetchText(`https://beebom.com/tag/roblox-codes/${page}`);
      const $ = cheerio.load(html);
      $('h2 a, h3 a').each((_, el) => {
        const href = $(el).attr('href');
        const title = ($(el).attr('title') || $(el).text()).trim();
        if (!href || !title || knownUrls.has(href)) return;
        knownUrls.add(href);
        backlog.items.push({ title, url: href, addedAt: now });
        added++;
      });
    } catch (e) {
      console.warn('discover failed:', (e as Error).message);
    }
  }
  backlog.updatedAt = now;
  writeIfChanged('data/backlog.json', backlog);
  console.log(`discover: ${added} new article(s) -> data/backlog.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
