import { fetchJson, sleep } from './util';

export interface RobloxGameMeta {
  placeId: number | null;
  universeId: number | null;
  name: string;
  icon: string | null;
  playing: number | null;
  visits: number | null;
  fetchedAt: string | null;
}

interface UniverseResponse {
  universeId: number;
}

interface GamesResponse {
  data: {
    id: number;
    name: string;
    playing: number;
    visits: number;
  }[];
}

interface IconsResponse {
  data: { targetId: number; imageUrl: string | null }[];
}

export async function resolveUniverse(placeId: number): Promise<number | null> {
  try {
    const res = await fetchJson<UniverseResponse>(
      `https://apis.roblox.com/universes/v1/places/${placeId}/universe`,
    );
    return res.universeId ?? null;
  } catch {
    return null;
  }
}

export async function fetchGamesBatch(universeIds: number[]): Promise<Map<number, { name: string; playing: number; visits: number }>> {
  const out = new Map<number, { name: string; playing: number; visits: number }>();
  for (let i = 0; i < universeIds.length; i += 50) {
    const chunk = universeIds.slice(i, i + 50);
    try {
      const res = await fetchJson<GamesResponse>(
        `https://games.roblox.com/v1/games?universeIds=${chunk.join(',')}`,
      );
      for (const g of res.data) out.set(g.id, { name: g.name, playing: g.playing, visits: g.visits });
    } catch (e) {
      console.warn('games batch failed:', e);
    }
    await sleep(300);
  }
  return out;
}

export async function fetchIconsBatch(universeIds: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  for (let i = 0; i < universeIds.length; i += 50) {
    const chunk = universeIds.slice(i, i + 50);
    try {
      const res = await fetchJson<IconsResponse>(
        `https://thumbnails.roblox.com/v1/games/icons?universeIds=${chunk.join(',')}&size=512x512&format=Png&isCircular=false`,
      );
      for (const ic of res.data) if (ic.imageUrl) out.set(ic.targetId, ic.imageUrl);
    } catch (e) {
      console.warn('icons batch failed:', e);
    }
    await sleep(300);
  }
  return out;
}
