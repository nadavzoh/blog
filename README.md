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

## Project structure

```text
src/
├── components/      # React island components (the interactive viz)
├── content/posts/   # MDX posts (the content collection)
├── layouts/         # Astro page + post layouts
├── pages/           # Routes (home, about, dynamic post route)
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