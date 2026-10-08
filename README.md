# GameCodesHub

Fan site with promo codes for popular Roblox games. Static site on [Astro](https://astro.build), deployed on Vercel, data updated by a GitHub Actions parser every 8 hours.

- English + Russian (`/en/`, `/ru/`), sitemap, hreflang, JSON-LD
- Codes from public sources (Beebom, Try Hard Guides), cross-checked for relevance
- Game icons and online players from publicly available Roblox services
- Placeholders for Google AdSense (Auto Ads) and Search Console verification

## Commands

```bash
npm ci            # install
npm run dev       # dev server
npm run build     # production build -> dist/
npm run typecheck # astro check
npm run parse     # run parser once (updates data/*.json)
npm run discover  # find new articles -> data/backlog.json
```

## Data files

| File | Owner | Purpose |
| --- | --- | --- |
| `data/games.json` | manual | Catalog of games: slug, name, RU/EN descriptions, source URLs |
| `data/codes.json` | parser | Active/expired codes, check timestamps |
| `data/roblox-meta.json` | parser | placeId, universeId, icon, online players |
| `data/backlog.json` | parser (`--discover`) | Newly found articles waiting for a hand-written description |

### Add a game

1. Add an entry to `data/games.json` (slug, name, `sources.beebom`, original `desc.en` / `desc.ru`).
2. Run `npm run parse` — it will fill codes and Roblox metadata.
3. Commit; Vercel rebuilds automatically.

## Automation

`.github/workflows/parse.yml` runs every 8 hours (`0 */8 * * *`) and after manual dispatch. It runs the parser and commits `data/` only when something changed; the push triggers a Vercel rebuild.

If Vercel does not redeploy on pushes made with the default `GITHUB_TOKEN`, create a fine-grained PAT (contents: read/write), add it as a repository secret `VERCEL_DEPLOY_TOKEN`... or simply add a second workflow step using `ad-m/github-push-action` with that PAT.

## Environment variables (Vercel → Settings → Environment Variables)

| Variable | Purpose |
| --- | --- |
| `PUBLIC_ADSENSE_CLIENT_ID` | e.g. `ca-pub-XXXXXXXXXXXXXXXX` — enables the AdSense script (Auto Ads) |
| `PUBLIC_GOOGLE_SITE_VERIFICATION` | Google Search Console meta verification token |

`public/ads.txt` must contain your real publisher line after AdSense approval.

## Legal

Independent fan project, not affiliated with Roblox Corporation. See `/en/disclaimer/` and `/en/privacy/` (texts in `src/pages/[lang]/`).
