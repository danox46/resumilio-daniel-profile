# Personal resume deployment

This repository is Daniel's profile implementation. Its public home is
`https://danienremoto.com/dani/`. The separate open-source Resumilio product
owns `https://resumilio.danienremoto.com/`; do not deploy this repository there.

`npm run build:personal` generates a static Astro site under `personal-dist/dani/`
with `/dani/`-prefixed links, assets, metadata, and machine endpoints. The
`resumilio-daniel-profile` Cloudflare Worker serves only `/dani` and `/dani/*`
on the apex and `www` hosts. All other paths remain with the Dani En Remoto
website. Cloudflare's static-asset HTML handling redirects `/dani` to `/dani/`.

## Release sequence

1. Run `npm run phase6`, `npm run build:personal`,
   `npm run verify:personal-build`, and `git diff --check`.
2. Run `npx wrangler dev --local` and verify `/dani/`, `/dani/classic/`,
   `/dani/es/`, assets, media, and machine endpoints in a browser.
3. Record the current Worker version as the rollback target. Run
   `npm run deploy:preview` and verify its returned preview URL.
4. At the approved production repair gate, run `npm run deploy:public`.
   Independently verify apex and `www`, slashless and slash routes, classic
   view, stylesheet and JavaScript MIME types, avatar media, and interaction.
5. If live verification fails, roll back to the recorded Worker version.
