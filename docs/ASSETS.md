# Assets, sources and licences

Everything that is in the repository or in the built app that somebody made, and on what terms it is used.
Nothing here needs a paid licence, an account, or a credit line on the wall.

## Made for this project

| What | Where | Notes |
| --- | --- | --- |
| Every drawing: the house and its rooms, the sky and weather, Tock, 119 pictures (40 things to do, 18 rewards, 37 things to buy, 12 kinds of day, 12 animals), 13 badges, the demo's sample "photographs" | `src/art/**` | Original vector art written as code (SVG in React). No photographs, no stock or icon-library artwork, no generated bitmaps, nothing traced |
| The three early directions that were compared | `design/explorations/**`, `docs/review/directions/*.jpg` | Original; kept as a record of the choice |
| The app icons | `public/icons/*.png`, `public/favicon.svg` | Drawn by `scripts/generate-icons.ts` from the project's own house |
| Sounds | `src/wall/sound.ts` | Synthesised in the browser from a few notes. There are no audio files |
| The made-up family (Maple Street: June, Milo, Bea and their grown-ups) | `server/domain/seed.ts` | Invented. No real person, address or event. Their "town" is a made-up position |
| Screenshots | `docs/review/screens/*.jpg` | Taken from the app running with the made-up family (`npm run screens`) |

The voice Tock speaks with is the device's own (the Web Speech API): nothing is bundled, recorded or sent.

## Fonts

Both are bundled into the build and served from the same address as the app; no font service is contacted.

| Font | Used for | Licence | Source |
| --- | --- | --- | --- |
| Fredoka (variable) | Headings, the wall's few words | SIL Open Font License 1.1 | `@fontsource-variable/fredoka` |
| Andika (400, 700, Latin) | Anything read at length | SIL Open Font License 1.1 | `@fontsource/andika` |

The OFL allows bundling and redistribution with software; the licence texts ship inside each package.

## Data

| What | Where | Licence | Source |
| --- | --- | --- | --- |
| US ZIP Code Tabulation Areas, each with the middle of its area rounded to two decimal places (33,791 rows, 270 KB) | `public/data/zcta.bin` | Public domain (a work of the U.S. government) | U.S. Census Bureau gazetteer files; built by `scripts/build-zcta.ts`, which says how |

It lets a parent's phone turn a ZIP code into a rough position **on the phone**; the ZIP code itself is never
sent or stored.

## Services reached while running (none are needed)

| Service | When | Terms |
| --- | --- | --- |
| U.S. National Weather Service (`api.weather.gov`) | Only if a household switches the weather on, for places in the US | Public data, no key. Asks callers to name themselves: HOMEBASE sends a generic application name, never an e-mail address or anything about the household |
| Open-Meteo (`api.open-meteo.com`) | The same, elsewhere | Free for non-commercial use; data under CC BY 4.0. Credited on the page where the weather is switched on |
| Anthropic or OpenAI | Only if the person running the server sets a key **and** a parent switches the planning helper on | The provider's own terms; paid by use ([`integrations/AI.md`](integrations/AI.md)) |
| The Training Academy | When a child taps the boat | The family's own separate site; visited, never embedded |

Details, and exactly what is sent to each: [`INTEGRATIONS.md`](INTEGRATIONS.md) and `docs/integrations/`.

## Software the app is built from

What ships to a browser or runs on the server:

| Package | Licence | What for |
| --- | --- | --- |
| react, react-dom | MIT | The interface |
| hono, @hono/node-server | MIT | The API |
| drizzle-orm | Apache-2.0 | Talking to the database |
| pg | MIT | PostgreSQL driver |
| @electric-sql/pglite | Apache-2.0 | PostgreSQL built to WebAssembly: the database for development, tests and the demo |
| valibot | MIT | Checking what comes in, on both sides |
| idb | ISC | The device's offline store |
| uqr | MIT | Drawing QR codes on the device |
| @vercel/functions | Apache-2.0 | Finishing background work after a response, on Vercel |
| @fontsource-variable/fredoka, @fontsource/andika | OFL-1.1 | The fonts |

Used only to build and test (nothing of them is shipped): vite, @vitejs/plugin-react, typescript, tsx, vitest,
happy-dom, fake-indexeddb, fast-check, @testing-library/react and /dom, @playwright/test, eslint and its plugins,
typescript-eslint, prettier, drizzle-kit, sharp, globals, and the `@types/*` packages — MIT or Apache-2.0 — and
@axe-core/playwright (MPL-2.0), which runs the accessibility scans.

`npm ls --all` lists everything those bring with them. No dependency is fetched at run time; the content
security policy allows scripts, styles and fonts from the app's own address only (`server/http/security.ts`).

## This repository

The repository is public and marked `"private": true` in `package.json` (so it cannot be published to npm by
accident). **It has no licence file**: nobody has yet decided on what terms others may reuse the code and
drawings. That is the owner's decision to make.

## What must never be added

Real family names or photographs, calendar contents, addresses or positions of a real home, exports from a real
household, API keys, database addresses, device tokens. The repository holds code, documents and the made-up
family only (`README.md`).
