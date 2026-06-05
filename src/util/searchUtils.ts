import type { JmComicInfo } from '../types/comic';

export const sites = [
  {
    logo: 'https://www.google.com/s2/favicons?sz=64&domain=18comic.vip',
    name: 'JmComic',
    search: (title: string) => `https://18comic.vip/search/photos?main_tag=0&search_query=${encodeURIComponent(title)}`,
  },
  {
    logo: 'https://www.google.com/s2/favicons?sz=64&domain=e-hentai.org',
    name: 'E-Hentai',
    search: (title: string) => `https://e-hentai.org/?f_search=${encodeURIComponent(title)}`,
  },
  {
    logo: 'https://exhentai.org/favicon.ico',
    name: 'Exhentai',
    search: (title: string) => `https://exhentai.org/?f_search=${encodeURIComponent(title)}`,
  },
  {
    logo: 'https://www.google.com/s2/favicons?sz=64&domain=nhentai.net',
    name: 'nhentai',
    search: (title: string) => `https://nhentai.net/search/?q=${encodeURIComponent(title)}`,
  },
  {
    logo: 'https://www.google.com/s2/favicons?sz=64&domain=hitomi.la',
    name: 'Hitomi',
    search: (title: string) => `https://hitomi.la/search.html?${encodeURIComponent(title)}`,
  },
  {
    logo: 'https://www.google.com/s2/favicons?sz=64&domain=dlsite.com',
    name: 'DLsite',
    search: (title: string) => `https://www.dlsite.com/home/topsearch/=/keyword/${title.split(' ').map(encodeURIComponent).join('+')}`,
  },
  {
    logo: 'https://www.google.com/s2/favicons?sz=64&domain=pixiv.net',
    name: 'Pixiv',
    search: (title: string) => `https://www.pixiv.net/tags/${encodeURIComponent(title)}/artworks?p=1&s_mode=s_tag`,
  },
  {
    logo: 'https://www.gstatic.com/images/branding/searchlogo/ico/favicon.ico',
    name: 'Google',
    search: (title: string) => `https://www.google.com/search?q=${encodeURIComponent(title)}`,
  },
];

// @see https://github.com/xiaojieonly/Ehviewer_CN_SXJ/blob/ba92ff0c6d4dff04327f17139e0ceb4b4ce7c8ec/app/src/main/java/com/hippo/ehviewer/client/EhUtils.kt#L159
// Remove [XXX], (XXX), {XXX}, ~XXX~ stuff at prefix
const PATTERN_TITLE_PREFIX = new RegExp('^(?:(?:\\([^\\)]*\\))|(?:\\[[^\\]]*\\])|(?:\\{[^\\}]*\\})|(?:~[^~]*~)|\\s+)*');

// Remove [XXX], (XXX), {XXX}, ~XXX~ stuff and something like ch. 1-23 at suffix
const PATTERN_TITLE_SUFFIX = new RegExp(
  '(?:\\s+ch.[\\s\\d-]+)?(?:(?:\\([^\\)]*\\))|(?:\\[[^\\]]*\\])|(?:\\{[^\\}]*\\})|(?:~[^~]*~)|\\s+)*$',
  'i', // CASE_INSENSITIVE
);

export function extractTitle(title?: string | null): string | null {
  if (title == null) {
    return null;
  }

  // 等价于 matcher.replaceFirst("")
  title = title.replace(PATTERN_TITLE_PREFIX, '');
  title = title.replace(PATTERN_TITLE_SUFFIX, '');

  // Sometimes title is combined by romaji and english translation.
  // Only need romaji.
  const index = title.indexOf('|');
  if (index >= 0) {
    title = title.substring(0, index);
  }

  if (title.length === 0) {
    return null;
  }

  return title;
}

function hasNonEmptyString(value?: string | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasNonEmptyArray(value?: unknown[]): boolean {
  return Array.isArray(value) && value.length > 0;
}

function hasNonEmptyStringArray(value?: unknown[]): boolean {
  return Array.isArray(value) && value.some(item => hasNonEmptyString(typeof item === 'string' ? item : null));
}

export function hasComicResult(comicInfo?: JmComicInfo | null): boolean {
  if (!comicInfo) {
    return false;
  }

  return (
    hasNonEmptyString(comicInfo.name)
    || hasNonEmptyArray(comicInfo.images)
    || hasNonEmptyString(comicInfo.addtime)
    || hasNonEmptyString(comicInfo.description)
    || comicInfo.total_views != null
    || comicInfo.likes != null
    || hasNonEmptyArray(comicInfo.series)
    || comicInfo.series_id != null
    || hasNonEmptyStringArray(comicInfo.author)
    || hasNonEmptyStringArray(comicInfo.tags)
    || hasNonEmptyArray(comicInfo.works)
    || hasNonEmptyArray(comicInfo.actors)
    || hasNonEmptyArray(comicInfo.related_list)
    || hasNonEmptyString(comicInfo.price)
    || hasNonEmptyString(comicInfo.purchased)
  );
}
