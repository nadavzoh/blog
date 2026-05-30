import type { CollectionEntry } from 'astro:content';

/** Number of bundled cover images in `public/covers/`. */
const COVER_COUNT = 6;

/**
 * Resolve the cover image URL for a post.
 *
 * Authors can set `cover` in frontmatter (root-relative, e.g. `/covers/x.svg`).
 * If they don't, we deterministically pick one of the bundled space-themed
 * covers from the post's `order`, so every post always has a nice image and the
 * card layout never breaks — even for a brand-new MDX file with minimal
 * frontmatter.
 */
export function coverFor(post: CollectionEntry<'posts'>, base: string): string {
  const { cover, order } = post.data;
  if (cover) {
    const path = cover.startsWith('/') ? cover.slice(1) : cover;
    return base + path;
  }
  const index = (((order - 1) % COVER_COUNT) + COVER_COUNT) % COVER_COUNT;
  return `${base}covers/cover-${index + 1}.svg`;
}

/** Format a publication date the same way everywhere. */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Unique, ordered list of categories present in the given posts. */
export function categoriesOf(posts: CollectionEntry<'posts'>[]): string[] {
  const seen = new Set<string>();
  for (const post of posts) seen.add(post.data.category);
  return [...seen];
}
