import type { Lang } from './types';
import en from '../i18n/en.json';
import ru from '../i18n/ru.json';

export type { Lang };

const dicts: Record<Lang, Record<string, string>> = { en, ru };

export const LANGS: Lang[] = ['en', 'ru'];
export const DEFAULT_LANG: Lang = 'en';

export function isLang(value: string): value is Lang {
  return value === 'en' || value === 'ru';
}

export function getLangFromUrl(url: URL): Lang {
  const seg = url.pathname.split('/')[1];
  return isLang(seg) ? seg : DEFAULT_LANG;
}

export function t(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let str = dicts[lang][key] ?? dicts[DEFAULT_LANG][key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{{${k}}}`, String(v));
  }
  return str;
}

export function localizePath(path: string, toLang: Lang): string {
  const clean = path.replace(/^\/(en|ru)(?=\/|$)/, '');
  return `/${toLang}${clean}` === `/${toLang}/` ? `/${toLang}/` : `/${toLang}${clean}`;
}
