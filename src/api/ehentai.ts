import { ISearch, SearchResult } from './search';

class EHentai implements ISearch {
  site = 'EHentai';

  host = 'e-hentai.org';

  searchUrl = `https://${this.host}/?f_search=`;
  async search(query: string): Promise<SearchResult[]> {
    const url = `${this.searchUrl}"${formatQuery(query)}"`;
    console.log(url);
    // const res = await fetch(url);
    // const html = await res.text();
    // console.log(html);
    return [
      {
        title: query,
        cover: '',
        url: url,
      },
    ];
  }
}

function formatQuery(query: string) {
  query = query.trim();
  query = query.replace(/\s+/g, '+');
  return encodeURIComponent(query).replace(/%2B/g, '+');
}

export const ehentai = new EHentai();
