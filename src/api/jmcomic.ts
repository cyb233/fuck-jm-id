import CryptoJS from 'crypto-js';
import type { JmComicInfo } from '../types/comic';

const API_URL_DOMAIN_SERVER_LIST = [
  'https://rup4a04-c01.tos-ap-southeast-1.bytepluses.com/newsvr-2025.txt',
  'https://rup4a04-c02.tos-cn-hongkong.bytepluses.com/newsvr-2025.txt',
];
const DOMAIN_API_LIST = ['www.cdnzack.cc', 'www.cdnsha.org', 'www.cdnbea.club', 'www.cdnbea.net', 'www.cdn-mspjmapiproxy.xyz'];

//   # 移动端图片域名
const DOMAIN_IMAGE_LIST = [
  'cdn-msp.jmapiproxy1.cc',
  'cdn-msp.jmapiproxy2.cc',
  'cdn-msp2.jmapiproxy2.cc',
  'cdn-msp3.jmapiproxy2.cc',
  'cdn-msp.jmapinodeudzn.net',
  'cdn-msp3.jmapinodeudzn.net',
];

const APP_VERSION = '2.0.6';
const APP_TOKEN_SECRET = '18comicAPP';
const APP_DATA_SECRET = '185Hcomic3PAPP7R';
const API_DOMAIN_SERVER_SECRET = 'diosfjckwpqpdfjkvnqQjsik';
const API_ALBUM = '/album';
const DEFAULT_CONCURRENCY = 3;
const API_LIST_TIMEOUT_MS = 5000;
const REQUEST_TIMEOUT_MS = 8000;
const API_LIST_CACHE_TTL_MS = 10 * 60 * 1000;
const API_LIST_FALLBACK_CACHE_TTL_MS = 60 * 1000;
const COMIC_INFO_CACHE_TTL_MS = 5 * 60 * 1000;
const COVER_BASE64_CACHE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_HEADERS = {
  'Accept-Encoding': 'gzip, deflate',
  'user-agent':
    'Mozilla/5.0 (Linux; Android 9; V1938CT Build/PQ3A.190705.11211812; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Safari/537.36',
};

type ConcurrentRequestOptions<TItem, TResult> = {
  items: TItem[];
  concurrency?: number;
  getItemLabel?: (item: TItem) => string;
  run: (item: TItem, signal: AbortSignal) => Promise<TResult>;
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

let apiListCache: CacheEntry<string[]> | null = null;
let apiListPromise: Promise<string[]> | null = null;
const comicInfoCache = new Map<string, CacheEntry<JmComicInfo>>();
const coverBase64Cache = new Map<string, CacheEntry<string>>();
const comicInfoPromises = new Map<string, Promise<JmComicInfo>>();
const coverBase64Promises = new Map<string, Promise<string>>();

async function getJMApiList(): Promise<string[]> {
  const cachedApiList = getCacheValue(apiListCache);
  if (cachedApiList) {
    return cachedApiList;
  }

  if (apiListPromise) {
    return apiListPromise;
  }

  apiListPromise = loadJMApiList().finally(() => {
    apiListPromise = null;
  });

  return apiListPromise;
}

async function loadJMApiList(): Promise<string[]> {
  for (const url of API_URL_DOMAIN_SERVER_LIST) {
    try {
      const resp = await fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: {
            ...DEFAULT_HEADERS,
          },
        },
        API_LIST_TIMEOUT_MS,
      );

      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }

      let text = await resp.text();
      text = text.replace(/^[^A-Za-z]+/, '');
      const decrypted = decodeRespData(text, '', API_DOMAIN_SERVER_SECRET);
      const data = JSON.parse(decrypted) as { Server?: unknown };
      const apiList = Array.isArray(data.Server)
        ? data.Server.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
        : [];

      if (apiList.length === 0) {
        throw new Error('Invalid API domain list response');
      }

      apiListCache = {
        value: apiList,
        expiresAt: Date.now() + API_LIST_CACHE_TTL_MS,
      };
      return apiList;
    } catch (error) {
      console.error(`Failed to load API domain list from ${url}:`, error);
    }
  }

  apiListCache = {
    value: DOMAIN_API_LIST,
    expiresAt: Date.now() + API_LIST_FALLBACK_CACHE_TTL_MS,
  };
  return DOMAIN_API_LIST;
}

async function loadCoverBase64(jmid: string): Promise<string> {
  const cachedCoverBase64 = getMapCacheValue(coverBase64Cache, jmid);
  if (cachedCoverBase64 !== undefined) {
    return cachedCoverBase64;
  }

  const pendingPromise = coverBase64Promises.get(jmid);
  if (pendingPromise) {
    return pendingPromise;
  }

  const promise = (async () => {
    try {
      const coverBase64 = await requestWithConcurrency({
        items: shuffleArray(DOMAIN_IMAGE_LIST),
        run: async (domain, signal) => {
          const coverUrl = `https://${domain}/media/albums/${jmid}.jpg`;
          const resp = await fetchWithTimeout(
            coverUrl,
            {
              method: 'GET',
              headers: {
                ...DEFAULT_HEADERS,
              },
            },
            REQUEST_TIMEOUT_MS,
            signal,
          );

          if (!resp.ok) {
            throw new Error(`HTTP error! status: ${resp.status}`);
          }

          const imageBuffer = await resp.arrayBuffer();
          return arrayBufferToBase64(imageBuffer);
        },
      });

      setMapCacheValue(coverBase64Cache, jmid, coverBase64, COVER_BASE64_CACHE_TTL_MS);
      return coverBase64;
    } catch (error) {
      console.error(`Failed to load cover image for JM ${jmid}:`, error);
      setMapCacheValue(coverBase64Cache, jmid, '', API_LIST_FALLBACK_CACHE_TTL_MS);
      return '';
    }
  })().finally(() => {
    coverBase64Promises.delete(jmid);
  });

  coverBase64Promises.set(jmid, promise);
  return promise;
}

export async function getJmComicInfo(jmid: string): Promise<JmComicInfo> {
  const id = formatId(jmid);
  if (!id) {
    throw new HttpError(400, '无效的jmid');
  }

  const [comicInfo, coverBase64] = await Promise.all([
    loadComicInfo(id),
    loadCoverBase64(id),
  ]);

  return {
    ...comicInfo,
    cover_base64: coverBase64,
  };
}

async function loadComicInfo(id: string): Promise<JmComicInfo> {
  const cachedComicInfo = getMapCacheValue(comicInfoCache, id);
  if (cachedComicInfo) {
    return cachedComicInfo;
  }

  const pendingPromise = comicInfoPromises.get(id);
  if (pendingPromise) {
    return pendingPromise;
  }

  const promise = (async () => {
    const apiList = await getJMApiList();
    if (apiList.length === 0) {
      throw new HttpError(502, 'No API domains available');
    }

    try {
      const comicInfo = await requestWithConcurrency({
        items: shuffleArray(apiList),
        run: async (domain, signal): Promise<JmComicInfo> => {
          const baseUrl = `https://${domain}`;
          const params = new URLSearchParams({ id }).toString();
          const url = `${baseUrl}${API_ALBUM}?${params}`;

          const timestamp = Math.floor(Date.now() / 1000);
          const tokenparam = `${timestamp},${APP_VERSION}`;
          const token = CryptoJS.MD5(`${timestamp},${APP_TOKEN_SECRET}`).toString();

          const resp = await fetchWithTimeout(
            url,
            {
              method: 'GET',
              headers: {
                ...DEFAULT_HEADERS,
                token,
                tokenparam,
              },
            },
            REQUEST_TIMEOUT_MS,
            signal,
          );

          if (!resp.ok) {
            throw new Error(`HTTP error! status: ${resp.status}`);
          }

          const json = (await resp.json()) as { code?: number; data?: unknown };
          if (typeof json.data !== 'string' || json.data.length === 0) {
            throw new Error('Missing encrypted response data');
          }

          const decryptedData = decodeRespData(json.data, timestamp);
          const parsedData = JSON.parse(decryptedData);
          return normalizeComicInfo(parsedData);
        },
      });

      setMapCacheValue(comicInfoCache, id, comicInfo, COMIC_INFO_CACHE_TTL_MS);
      return comicInfo;
    } catch (error) {
      throw new HttpError(502, `获取漫画信息失败: ${getErrorMessage(error)}`);
    }
  })().finally(() => {
    comicInfoPromises.delete(id);
  });

  comicInfoPromises.set(id, promise);
  return promise;
}

function decodeRespData(data: string, ts: number | string, secret?: string): string {
  if (!secret) secret = APP_DATA_SECRET;
  const key = CryptoJS.MD5(`${ts}${secret}`).toString();
  const decrypted = CryptoJS.AES.decrypt(data, CryptoJS.enc.Utf8.parse(key), {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

async function requestWithConcurrency<TItem, TResult>({
  items,
  concurrency = DEFAULT_CONCURRENCY,
  getItemLabel = (item) => String(item),
  run,
}: ConcurrentRequestOptions<TItem, TResult>): Promise<TResult> {
  const pendingItems = items.slice();
  const errors: Array<{ item: string; error: unknown }> = [];

  while (pendingItems.length > 0) {
    const batch = pendingItems.splice(0, concurrency);
    const controllers: AbortController[] = [];

    const promises = batch.map((item) => {
      const controller = new AbortController();
      controllers.push(controller);
      return run(item, controller.signal);
    });

    try {
      const result = await Promise.any(promises);
      controllers.forEach((controller) => {
        try {
          controller.abort();
        } catch {
          // ignore
        }
      });
      return result;
    } catch (err) {
      const agg = err as AggregateError;
      if (Array.isArray((agg as { errors?: unknown[] }).errors)) {
        const batchErrors = (agg as { errors: unknown[] }).errors;
        for (let i = 0; i < batchErrors.length; i++) {
          errors.push({ item: getItemLabel(batch[i]), error: batchErrors[i] });
        }
      } else {
        errors.push({ item: batch.map(getItemLabel).join(', '), error: err });
      }
    } finally {
      controllers.forEach((controller) => {
        try {
          controller.abort();
        } catch {
          // ignore
        }
      });
    }
  }

  const errorSummary = errors.map((entry) => `${entry.item}: ${getErrorMessage(entry.error)}`).join('; ');
  throw new Error(`All concurrent requests failed. Errors: ${errorSummary}`);
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  parentSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  const abortFromParent = () => {
    controller.abort(parentSignal?.reason ?? new DOMException('Aborted', 'AbortError'));
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      abortFromParent();
    } else {
      parentSignal.addEventListener('abort', abortFromParent, { once: true });
    }
  }

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    if (parentSignal) {
      parentSignal.removeEventListener('abort', abortFromParent);
    }
  }
}

function normalizeComicInfo(parsedData: Record<string, unknown>): JmComicInfo {
  return {
    id: typeof parsedData.id === 'number' ? parsedData.id : Number(parsedData.id) || 0,
    name: typeof parsedData.name === 'string' ? parsedData.name : null,
    images: Array.isArray(parsedData.images) ? parsedData.images : [],
    addtime: typeof parsedData.addtime === 'string' ? parsedData.addtime : null,
    description: typeof parsedData.description === 'string' ? parsedData.description : '',
    total_views: typeof parsedData.total_views === 'number' ? parsedData.total_views : Number(parsedData.total_views) || null,
    likes: typeof parsedData.likes === 'number' ? parsedData.likes : Number(parsedData.likes) || null,
    series: Array.isArray(parsedData.series) ? parsedData.series : [],
    series_id: typeof parsedData.series_id === 'number' ? parsedData.series_id : Number(parsedData.series_id) || null,
    comment_total: Boolean(parsedData.comment_total),
    author: Array.isArray(parsedData.author) ? parsedData.author.filter((item): item is string => typeof item === 'string') : [],
    tags: Array.isArray(parsedData.tags) ? parsedData.tags.filter((item): item is string => typeof item === 'string') : [],
    works: Array.isArray(parsedData.works) ? parsedData.works : [],
    actors: Array.isArray(parsedData.actors) ? parsedData.actors : [],
    related_list: Array.isArray(parsedData.related_list) ? parsedData.related_list : [],
    liked: Boolean(parsedData.liked),
    is_favorite: Boolean(parsedData.is_favorite),
    is_aids: Boolean(parsedData.is_aids),
    price: typeof parsedData.price === 'string' ? parsedData.price : '',
    purchased: typeof parsedData.purchased === 'string' ? parsedData.purchased : '',
  };
}

function getCacheValue<T>(cacheEntry: CacheEntry<T> | null): T | null {
  if (!cacheEntry) {
    return null;
  }
  if (cacheEntry.expiresAt <= Date.now()) {
    return null;
  }
  return cacheEntry.value;
}

function getMapCacheValue<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const cacheEntry = cache.get(key);
  if (!cacheEntry) {
    return undefined;
  }
  if (cacheEntry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return cacheEntry.value;
}

function setMapCacheValue<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number): void {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

// Fisher-Yates shuffle
function shuffleArray<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

export function formatId(jmid: string): string {
  const prefixedId = jmid.match(/JM\s*(\d+)/i);
  if (prefixedId) {
    return prefixedId[1];
  }
  return jmid.replace(/\D/g, '');
}

export function resetJmComicCaches(): void {
  apiListCache = null;
  apiListPromise = null;
  comicInfoCache.clear();
  coverBase64Cache.clear();
  comicInfoPromises.clear();
  coverBase64Promises.clear();
}
