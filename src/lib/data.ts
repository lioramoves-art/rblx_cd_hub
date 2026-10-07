import type { GameEntry, CodesFile, RobloxFetchFile, GameCodes, RobloxGameMeta } from './types';
import gamesRaw from '@data/games.json';
import codesRaw from '@data/codes.json';
import metaRaw from '@data/roblox-meta.json';

export const games: GameEntry[] = (gamesRaw as GameEntry[]).slice().sort((a, b) => a.order - b.order);
const codes = codesRaw as CodesFile;
const meta = metaRaw as RobloxFetchFile;

export function getCodes(slug: string): GameCodes {
  return codes.games[slug] ?? { active: [], expired: [], checkedAt: null };
}

export function getMeta(slug: string): RobloxGameMeta | null {
  return meta.games[slug] ?? null;
}

export function getCodesUpdatedAt(): string | null {
  return codes.updatedAt;
}

export function countActive(slug: string): number {
  return getCodes(slug).active.length;
}
