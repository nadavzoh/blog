# Orbital Notes

A personal blog of explanatory **space & orbit physics** posts, with interactive
React components embedded directly in MDX. The series assumes **no prior
knowledge** of physics or the space domain and builds up one post at a time —
from "what is gravity?" all the way to interplanetary Hohmann transfers.

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
| `npm run build`       | Build the production site to `./dist/`   |
| `npm run preview`     | Preview the production build locally     |
| `npm run astro check` | Type-check Astro, MDX and TS files       |

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