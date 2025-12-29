export interface ISearch {
  site: string;
  search(query: string): Promise<SearchResult[]>;
}

export type SearchResult = {
  title: string;
  cover: string;
  url: string;
};
