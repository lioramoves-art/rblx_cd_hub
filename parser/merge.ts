import type { CodeItem, ArticleCodes } from './codes';

export interface GameCodesState {
  active: CodeItem[];
  expired: string[];
  checkedAt: string | null;
  lastChangeAt?: string | null;
}

export interface MergeInput {
  prev: GameCodesState;
  beebom: ArticleCodes | null;
  thgActive: string[] | null;
  thgExpired: string[] | null;
  now: string;
}

export interface MergeResult {
  state: GameCodesState;
  changedCodes: boolean;
}

function key(c: string): string {
  return c.toLowerCase();
}

export function mergeCodes({ prev, beebom, thgActive, thgExpired, now }: MergeInput): MergeResult {
  const prevActiveKeys = new Set(prev.active.map((c) => key(c.code)));
  const prevByCode = new Map(prev.active.map((c) => [key(c.code), c]));

  const expiredUnion = new Set<string>([...prev.expired, ...(beebom?.expired ?? []), ...(thgExpired ?? [])].map(key));

  const merged = new Map<string, CodeItem>();
  if (beebom) {
    for (const item of beebom.active) merged.set(key(item.code), { ...item });
  }
  if (thgActive) {
    for (const code of thgActive) {
      const k = key(code);
      if (!merged.has(k)) merged.set(k, { code });
    }
  }

  // Carry over previously active codes not seen this run, unless a source explicitly expired them
  // or all sources parsed successfully and simply dropped them.
  const sourcesParsed = beebom !== null && beebom.ok;
  for (const [k, item] of prevByCode) {
    if (merged.has(k)) continue;
    const explicitlyExpired = (beebom?.expired ?? []).some((c) => key(c) === k) || (thgExpired ?? []).some((c) => key(c) === k);
    if (explicitlyExpired) continue;
    if (sourcesParsed) continue;
    merged.set(k, { ...item });
  }

  const active: CodeItem[] = [];
  const activeKeys = new Set<string>();
  for (const [k, item] of merged) {
    if (expiredUnion.has(k)) continue;
    activeKeys.add(k);
    active.push(item);
  }
  active.sort((a, b) => a.code.toLowerCase().localeCompare(b.code.toLowerCase()));

  const expired = [...new Set([...prev.expired, ...(beebom?.expired ?? []), ...(thgExpired ?? [])])]
    .filter((c) => !activeKeys.has(key(c)))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const changedCodes =
    activeKeys.size !== prevActiveKeys.size || [...activeKeys].some((k) => !prevActiveKeys.has(k));

  const parsedOk = (beebom?.ok ?? false) || (thgActive !== null && (thgActive.length > 0 || (thgExpired?.length ?? 0) > 0));

  const state: GameCodesState = {
    active,
    expired,
    checkedAt: parsedOk ? now : prev.checkedAt,
    lastChangeAt: changedCodes ? now : (prev.lastChangeAt ?? null),
  };

  return { state, changedCodes };
}
