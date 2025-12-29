// API 模块导出
import { ISearch } from './search';
import { ehentai } from './ehentai';
import { nhentai } from './nhentai';

const searchs: ISearch[] = [ehentai, nhentai];

export { searchs };
export { getJmComicInfo } from './jmcomic';
export type { ISearch, SearchResult } from './search';
