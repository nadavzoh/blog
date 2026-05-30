/**
 * Central site identity and configuration.
 *
 * Everything platform-specific (name, description, social links, navigation,
 * deployment base path) lives here so layouts and pages stay generic and the
 * whole site can be re-skinned from one file — no branding literals scattered
 * across the codebase.
 */

export interface NavItem {
  href: string;
  label: string;
}

export interface SiteConfig {
  /** Public site name, shown in the header, footer and page titles. */
  name: string;
  /** Short tagline used as the default meta description. */
  description: string;
  /** Absolute production origin (no trailing slash), used for canonical URLs and feeds. */
  site: string;
  /** Path the site is served from, e.g. "/blog/". Must start and end with "/". */
  base: string;
  /** Primary navigation, rendered relative to `base`. */
  nav: NavItem[];
  /** Optional source-repository URL shown in the footer. */
  repoUrl?: string;
  /** Author/owner used for RSS and as a default byline. */
  author: string;
}

export const SITE: SiteConfig = {
  name: 'Knowledge Base',
  description:
    'A self-hosted, topic-first knowledge platform for technical notes, articles, references and experiments.',
  site: 'https://nadavzoh.github.io',
  base: '/blog/',
  nav: [
    { href: '', label: 'Home' },
    { href: 'tags', label: 'Tags' },
    { href: 'about', label: 'About' },
  ],
  repoUrl: 'https://github.com/nadavzoh/blog',
  author: 'Knowledge Base',
};

/**
 * Top-level slugs that are reserved for real pages and must never be used as a
 * topic slug. Routing guards against collisions using this list.
 */
export const RESERVED_SLUGS = ['about', 'tags', 'search', 'rss.xml', 'sitemap-index.xml'];
