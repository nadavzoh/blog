import { getCollection, type CollectionEntry } from 'astro:content';

export type Topic = CollectionEntry<'topics'>;
export type Article = CollectionEntry<'articles'>;

/** Number of bundled cover images in `public/covers/`. */
const COVER_COUNT = 6;

/** Stable, non-negative hash of a string, used to pick deterministic covers. */
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** The owning topic slug of an article, derived from its folder. */
export function topicOf(article: Article): string {
  return article.id.split('/')[0];
}

/** The article's own slug (the file name without the topic folder). */
export function articleSlug(article: Article): string {
  const parts = article.id.split('/');
  return parts[parts.length - 1];
}

/**
 * Resolve a cover image URL. Authors may set `cover` in frontmatter
 * (root-relative, e.g. `/covers/cover-1.svg`); otherwise one of the bundled
 * neutral covers is picked deterministically from the entry id so every card
 * always has an image and the layout never breaks.
 */
export function coverFor(
  entry: { id: string; data: { cover?: string } },
  base: string,
): string {
  const { cover } = entry.data;
  if (cover) {
    const path = cover.startsWith('/') ? cover.slice(1) : cover;
    return base + path;
  }
  const index = hash(entry.id) % COVER_COUNT;
  return `${base}covers/cover-${index + 1}.svg`;
}

/** Format a date the same way everywhere. */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Best-effort "last touched" date for an article (updated, else published). */
export function articleDate(article: Article): Date | undefined {
  return article.data.updated ?? article.data.pubDate;
}

/** All published topics, sorted by `order` then title. */
export async function getTopics(): Promise<Topic[]> {
  const topics = await getCollection('topics', ({ data }) => !data.draft);
  return topics.sort(
    (a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title),
  );
}

/** All published articles. */
export async function getArticles(): Promise<Article[]> {
  return getCollection('articles', ({ data }) => !data.draft);
}

/** Published articles belonging to a topic, ordered then alphabetised. */
export async function getArticlesByTopic(topicId: string): Promise<Article[]> {
  const articles = await getArticles();
  return articles
    .filter((a) => topicOf(a) === topicId)
    .sort(
      (a, b) =>
        (a.data.order ?? Infinity) - (b.data.order ?? Infinity) ||
        a.data.title.localeCompare(b.data.title),
    );
}

/** Unique, sorted list of tags across the given articles. */
export function tagsOf(articles: Article[]): string[] {
  const seen = new Set<string>();
  for (const a of articles) for (const t of a.data.tags) seen.add(t);
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/** Turn a tag into a URL-safe slug. */
export function tagSlug(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Validate that every article lives under a folder matching a real topic.
 * Throws at build time with a clear message if an article is orphaned, which
 * keeps the topic→article relationship honest without repeating it in
 * frontmatter.
 */
export async function assertArticlesHaveTopics(): Promise<void> {
  const [topics, articles] = await Promise.all([getTopics(), getArticles()]);
  const known = new Set(topics.map((t) => t.id));
  const orphans = articles
    .map((a) => ({ id: a.id, topic: topicOf(a) }))
    .filter((a) => !known.has(a.topic));
  if (orphans.length > 0) {
    const list = orphans.map((o) => `  - ${o.id} (no topic "${o.topic}")`).join('\n');
    throw new Error(
      `Found article(s) with no matching topic landing page in src/content/topics/:\n${list}`,
    );
  }
}
