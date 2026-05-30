import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Two-collection, topic-first content model.
 *
 *   src/content/
 *     topics/<topic>.mdx          → landing page for a topic (id = "<topic>")
 *     articles/<topic>/<slug>.mdx → an article belonging to a topic
 *                                   (id = "<topic>/<slug>")
 *
 * Topics are navigable containers with their own URL and landing content;
 * articles are leaves that belong to exactly one topic. The owning topic is
 * derived from the article's folder, so it never has to be repeated in
 * frontmatter, and it is validated against the `topics` collection at build
 * time (see `src/lib/content.ts`).
 */

const topics = defineCollection({
  loader: glob({ pattern: '*.{md,mdx}', base: './src/content/topics' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // Manual sort weight for the topic list on the home page; lower comes first.
    order: z.number().default(0),
    // Optional cover image (root-relative, e.g. `/covers/cover-1.svg`).
    cover: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // Optional within-topic ordering; falls back to title sort when absent.
    order: z.number().optional(),
    // Knowledge-base surfaces favour "last updated" over "first published".
    updated: z.coerce.date().optional(),
    pubDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    cover: z.string().optional(),
  }),
});

export const collections = { topics, articles };
