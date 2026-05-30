# Orbital Notes

A personal blog of explanatory **space & orbit physics** posts, with interactive
React components embedded directly in MDX. The series assumes **no prior
knowledge** of physics or the space domain and builds up one post at a time —
from "what is gravity?" all the way to interplanetary transfers and the live
satellite viewer.

## Stack

- **[Astro 5](https://astro.build/)** with content collections
- **MDX** for posts that embed interactive components
- **React 19** islands, hydrated with `client:visible`
- **Tailwind v4** via the Vite plugin
- **[Motion](https://motion.dev/)** for entrance animations
- **KaTeX** for math (`remark-math` + `rehype-katex`)
- **[Recharts](https://recharts.org/)** for chart-based visualizations

## The series

1. **What Is Gravity, Really?** — Newton's inverse-square law (`GravityWell`)
2. **Newton's Cannonball** — what an orbit actually is (`OrbitSimulator`)
3. **Orbital Speed & Escape Velocity** — how fast is fast enough (`OrbitalVelocity`)
4. **Kepler's Laws** — the shape and rhythm of orbits (`KeplerThirdLaw`)
5. **Hohmann Transfers** — moving between orbits (`HohmannTransfer`)
6. **Gravity Assists** — stealing speed from planets (`GravityAssist`)
7. **Lagrange Points** — parking spots in space (`LagrangePoints`)
8. **Orbital Regimes** — LEO, MEO and GEO shells (`OrbitalRegimes`)
9. **Geostationary Orbits** — standing still in the sky (`GeostationaryOrbit`)
10. **Orbital Elements & TLEs** — an orbit in six numbers (`OrbitalElements`)
11. **Tracking Satellites with SGP4** — snapshot to live position (`SatelliteGlobe`)
12. **Inclination & Ground Tracks** — why orbits lean (`GroundTrack`)

## Design system

A clean, light, card-based design: a soft lavender background, crisp white
cards, a single confident blue brand colour, `Sora` display headings over
`Inter` body text, and bundled space-themed cover art. All design tokens live as
Tailwind v4 theme variables in `src/styles/global.css` (`--color-brand-*`,
`--color-ink-*`, `--color-line`, …), so the whole look can be retuned from one
place. The embedded interactive islands keep their own dark "console" styling,
which reads as intentional contrast on the light page.

## Adding a new post

Adding a post never requires touching any layout or infrastructure code — just
drop a new `.mdx` file into `src/content/posts/`:

```mdx
---
title: 'Your Post Title'
description: 'One-sentence summary shown on the card and post header.'
pubDate: 2025-04-01
order: 13
---

Write your post here. Import and drop in interactive islands as needed.
```

Only `title`, `description`, `pubDate` and `order` are required. Everything else
is optional and has a safe default, so the card grid never breaks:

| Field      | Default                                  |
| ---------- | ---------------------------------------- |
| `category` | `Fundamentals` (also used by the filter) |
| `author`   | `Orbital Notes`                          |
| `tags`     | `[]`                                     |
| `cover`    | a bundled cover picked from `order`      |
| `draft`    | `false`                                  |

To use your own cover image, set `cover: '/covers/your-image.svg'` (any file
placed in `public/covers/`). Otherwise one of the six bundled `public/covers/`
illustrations is chosen deterministically from `order`.

## Project structure

```text
public/covers/       # Bundled space-themed cover art (SVG)
src/
├── components/      # React island components (the interactive viz)
├── content/posts/   # MDX posts (the content collection)
├── layouts/         # Astro page + post layouts
├── lib/             # Small helpers (cover resolution, formatting)
├── pages/           # Routes (home, about, viewer, dynamic post route)
├── styles/          # Tailwind v4 entry + global styles
└── content.config.ts
```

## Commands

| Command               | Action                                   |
| --------------------- | ---------------------------------------- |
| `npm install`         | Install dependencies                     |
| `npm run dev`         | Start the dev server at `localhost:4321` |
| `npm run build`       | Build the production site to `./docs/`   |
| `npm run preview`     | Preview the production build locally     |
| `npm run astro check` | Type-check Astro, MDX and TS files       |

## Deployment (GitHub Pages)

The site is hosted on **GitHub Pages** at `https://nadavzoh.github.io/blog/`
using the **"Deploy from a branch"** source (no build runs on GitHub).

Because Pages serves prebuilt static files directly from the branch,
`npm run build` outputs the site into the committed **`docs/`** folder
(`outDir: './docs'` in `astro.config.mjs`), and an empty `docs/.nojekyll`
keeps GitHub from stripping the `_astro/` asset directory.

It is a *project* site served from the `/blog/` sub-path, so `astro.config.mjs`
sets `site` and `base: '/blog/'`. Posts can still use clean root-relative links
(e.g. `/posts/...`); a small rehype plugin rewrites them to include the base at
build time.

**To publish changes:** run `npm run build`, then commit the updated `docs/`
folder. In **Settings → Pages**, the source is set to this branch with the
**`/docs`** folder.

## How the interactivity works

Each post is an `.mdx` file. Interactive pieces are plain React components
imported at the top of the post and dropped into the prose with a hydration
directive, e.g.:

```mdx
import OrbitSimulator from '../../components/OrbitSimulator.tsx';

<OrbitSimulator client:visible />
```

`client:visible` means the JavaScript for that island is only shipped and
hydrated once the reader scrolls it into view, keeping pages fast.