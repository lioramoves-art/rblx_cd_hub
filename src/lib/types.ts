export type Lang = 'en' | 'ru';

export interface GameSource {
  beebom?: string;
  tryhardguides?: string;
}

export interface GameEntry {
  slug: string;
  name: string;
  order: number;
  type?: 'promo' | 'music';
  sources: GameSource;
  desc: { en: string; ru: string };
}

export interface CodeItem {
  code: string;
  reward?: string;
  source?: string;
}

export interface GameCodes {
  active: CodeItem[];
  expired: string[];
  checkedAt: string | null;
  lastChangeAt?: string | null;
}

export interface CodesFile {
  updatedAt: string | null;
  games: Record<string, GameCodes>;
}

export interface RobloxGameMeta {
  placeId: number | null;
  universeId: number | null;
  name: string;
  icon: string | null;
  playing: number | null;
  visits: number | null;
  fetchedAt: string | null;
}

export interface RobloxFetchFile {
  updatedAt: string | null;
  games: Record<string, RobloxGameMeta>;
}
