import { ISearch, SearchResult } from './search';

class NHentai implements ISearch {
  site = 'NHentai';

  host = 'nhentai.net';

  searchUrl = `https://${this.host}/search/?q=`;
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
  return query;
}

export const nhentai = new NHentai();
