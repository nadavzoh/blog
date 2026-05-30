# Knowledge Base

A self-hosted, **topic-first knowledge platform** — a permanent, searchable,
linkable home for technical notes, articles, references and experiments. Content
is organised by **topic** rather than by date, closer to a personal technical
wiki than to a chronological blog.

## Stack

- **[Astro 5](https://astro.build/)** with content collections (`topics` + `articles`)
- **MDX** for articles that embed interactive components
- **React 19** islands, hydrated with `client:visible`
- **Tailwind v4** via the Vite plugin
- **KaTeX** for math (`remark-math` + `rehype-katex`)
- **[Recharts](https://recharts.org/)** for chart-based visualizations
- **[Pagefind](https://pagefind.app/)** for static, scalable full-text search
- **RSS** (`@astrojs/rss`) and **sitemap** (`@astrojs/sitemap`)

## Content model

Two collections power a `Topic → Article` hierarchy:

```
src/content/
├── topics/
│   ├── python.mdx          # topic landing page  (/python)
│   ├── system-design.mdx
│   └── frontend.mdx
└── articles/
    ├── python/
    │   ├── asyncio.mdx      # article            (/python/asyncio)
    │   └── type-hints.mdx
    ├── system-design/
    │   └── caching.mdx
    └── frontend/
        └── react.mdx
```

- A topic file in `topics/<topic>.mdx` is the landing page for that topic.
- Articles live under `articles/<topic>/<slug>.mdx`; the owning topic is derived
  from the folder, so it is never repeated in frontmatter. A build-time check
  fails if an article has no matching topic.

### URL structure

| URL | Page |
|---|---|
| `/` | Home — browse topics + recently updated |
| `/<topic>` | Topic landing page + its articles |
| `/<topic>/<article>` | Article |
| `/tags` and `/tags/<tag>` | Cross-topic tag indexes |
| `/search` | Full-text search (Pagefind) |
| `/rss.xml`, `/sitemap-index.xml` | Feeds / SEO |

## Configuration

All site identity (name, description, navigation, base path, social links) lives
in **`src/site.config.ts`** — there are no branding literals in the layouts, so
the whole site can be re-skinned from one file. Design tokens live as Tailwind v4
theme variables in `src/styles/global.css`.

## Adding content

1. Create a topic: add `src/content/topics/<topic>.mdx` with `title` and
   `description`.
2. Add articles under `src/content/articles/<topic>/<slug>.mdx`.
3. Embed interactive React islands by importing a component and rendering it with
   `client:visible`.

## Develop & build

```bash
npm install
npm run dev      # local dev server
npm run build    # static build into ./docs (Pagefind index generated automatically)
```

The site is static and deploys from the `./docs` folder to GitHub Pages. The
deployment base path is configured once via `SITE.base` in `src/site.config.ts`.
