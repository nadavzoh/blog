// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// Project is served from https://nadavzoh.github.io/blog/, so it lives under
// the "/blog" path. Keeping this in one place lets us reuse it below.
const BASE = '/blog';

/**
 * Rehype plugin: rewrite root-absolute links and asset URLs inside MDX/Markdown
 * (e.g. `/posts/...` or `/favicon.svg`) so they are prefixed with the site base.
 * Posts can keep writing clean root-relative links and still work when the site
 * is hosted under a sub-path on GitHub Pages.
 */
function rehypeBaseLinks() {
  const attrs = ['href', 'src'];
  /** @param {any} node */
  const walk = (node) => {
    if (node.type === 'element' && node.properties) {
      for (const attr of attrs) {
        const val = node.properties[attr];
        if (typeof val === 'string' && val.startsWith('/') && !val.startsWith('//')) {
          node.properties[attr] = BASE + val;
        }
      }
    }
    if (Array.isArray(node.children)) node.children.forEach(walk);
  };
  /** @param {any} tree */
  return (tree) => walk(tree);
}

// https://astro.build/config
export default defineConfig({
  site: 'https://nadavzoh.github.io',
  base: `${BASE}/`,
  // GitHub Pages is configured to "Deploy from a branch" and serve the site
  // from the /docs folder, so build the static output straight into ./docs.
  outDir: './docs',
  integrations: [
    mdx(),
    react(),
  ],
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex, rehypeBaseLinks],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
