export const sites = [
  {
    logo: 'https://18comic.vip/favicon.ico',
    name: 'JmComic',
    search: (title: string) => `https://18comic.vip/search/photos?main_tag=0&search_query=${encodeURIComponent(title)}`,
  },
  {
    logo: 'https://e-hentai.org/favicon.ico',
    name: 'E-Hentai',
    search: (title: string) => `https://e-hentai.org/?f_search=${encodeURIComponent(title)}`,
  },
  {
    logo: 'https://exhentai.org/favicon.ico',
    name: 'Exhentai',
    search: (title: string) => `https://exhentai.org/?f_search=${encodeURIComponent(title)}`,
  },
  {
    logo: 'https://nhentai.net/favicon.ico',
    name: 'nhentai',
    search: (title: string) => `https://nhentai.net/search/?q=${encodeURIComponent(title)}`,
  },
  {
    logo: 'https://ltn.gold-usergeneratedcontent.net/favicon-192x192.png',
    name: 'Hitomi',
    search: (title: string) => `https://hitomi.la/search.html?${encodeURIComponent(title)}`,
  },
  {
    logo: 'https://www.dlsite.com/images/web/common/favicon.ico',
    name: 'DLsite',
    search: (title: string) => `https://www.dlsite.com/home/topsearch/=/keyword/${title.split(' ').map(encodeURIComponent).join('+')}`,
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
