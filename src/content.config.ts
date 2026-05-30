import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    // Order in the learning series; lower numbers come first.
    order: z.number(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    // Optional presentation metadata. Every field has a safe default so a new
    // post only needs title/description/pubDate/order — the rest is filled in
    // automatically and the card grid never breaks.
    category: z.string().default('Fundamentals'),
    author: z.string().default('Orbital Notes'),
    // Path (relative to the site base) to a cover image. When omitted, a
    // bundled space-themed cover is picked deterministically from `order`.
    cover: z.string().optional(),
  }),
});

export const collections = { posts };
