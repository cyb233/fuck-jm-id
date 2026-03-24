import CryptoJS from 'crypto-js';

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

const client_key = 'api';
const APP_VERSION = '2.0.6';
const APP_TOKEN_SECRET = '18comicAPP';
const APP_DATA_SECRET = '185Hcomic3PAPP7R';
const API_DOMAIN_SERVER_SECRET = 'diosfjckwpqpdfjkvnqQjsik';
const API_SEARCH = '/search';
const API_CATEGORIES_FILTER = '/categories/filter';
const API_ALBUM = '/album';
const API_CHAPTER = '/chapter';
const API_SCRAMBLE = '/chapter_view_template';
const API_FAVORITE = '/favorite';
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_HEADERS = {
  'Accept-Encoding': 'gzip, deflate',
  'user-agent':
    'Mozilla/5.0 (Linux; Android 9; V1938CT Build/PQ3A.190705.11211812; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Safari/537.36',
};

export type JmComicInfo = {
  id: number;
  name: string | null;
  images: unknown[];
  addtime: string | null;
  description: string;
  total_views: number | null;
  likes: number | null;
  series: unknown[];
  series_id: number | null;
  comment_total: boolean;
  author: string[];
  tags: string[];
  works: unknown[];
  actors: unknown[];
  related_list: unknown[];
  liked: boolean;
  is_favorite: boolean;
  is_aids: boolean;
  price: string;
  purchased: string;
  // 额外添加封面图片base64字段
  cover_base64?: string;
};

type ConcurrentRequestOptions<TItem, TResult> = {
  items: TItem[];
  concurrency?: number;
  getItemLabel?: (item: TItem) => string;
  run: (item: TItem, signal: AbortSignal) => Promise<TResult>;
};

async function getJMApiList(): Promise<string[]> {
  for (const url of API_URL_DOMAIN_SERVER_LIST) {
    try {
      console.log('Fetching', url);
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          ...DEFAULT_HEADERS,
        },
      });
      if (!resp.ok) {
        console.error('HTTP error! status:', resp.status);
        continue;
      }
      let text = await resp.text();
      // todo 解密
      text = text.replace(/^[^A-Za-z]+/, '');
      const decrypted = decodeRespData(text, '', API_DOMAIN_SERVER_SECRET);
      console.log('decrypted:', decrypted);
      // 解析JSON
      const data = JSON.parse(decrypted);
      if (!data || !data.Server) {
        console.error('Invalid JSON:', data);
        continue;
      }
      // 返回JSON
      return data.Server;
    } catch (error) {
      console.error(error);
      continue;
    }
  }
  return DOMAIN_API_LIST;
}

async function loadCoverBase64(jmid: string): Promise<string> {
  try {
    return await requestWithConcurrency({
      items: shuffleArray(DOMAIN_IMAGE_LIST),
      run: async (domain, signal) => {
        const coverUrl = `https://${domain}/media/albums/${jmid}.jpg`;
        console.log(`Fetching ${coverUrl}`);

        const resp = await fetch(coverUrl, {
          method: 'GET',
          headers: {
            ...DEFAULT_HEADERS,
          },
          signal,
        });

        if (!resp.ok) {
          throw new Error(`HTTP error! status: ${resp.status}`);
        }

        const imageBuffer = await resp.arrayBuffer();
        return arrayBufferToBase64(imageBuffer);
      },
    });
  } catch (error) {
    console.error(error);
  }
  return '';
}

export async function getJmComicInfo(jmid: string): Promise<JmComicInfo> {
  const id = formatId(jmid);
  if (!id) {
    throw new Error('无效的jmid');
  }

  // 获取API列表并打乱顺序以保证随机性
  const apiList = await getJMApiList();
  if (!apiList || apiList.length === 0) {
    throw new Error('No API domains available');
  }
  console.log('API domains:', apiList);

  const result = await requestWithConcurrency({
    items: shuffleArray(apiList),
    run: async (domain, signal): Promise<JmComicInfo> => {
      const baseUrl = `https://${domain}`;
      const params = new URLSearchParams({ id: id }).toString();
      const url = `${baseUrl}${API_ALBUM}?${params}`;
      console.log(`Fetching ${url}`);

      // 每个请求使用独立的时间戳
      const timestamp = Math.floor(Date.now() / 1000);
      const tokenparam = `${timestamp},${APP_VERSION}`;
      const token = CryptoJS.MD5(`${timestamp},${APP_TOKEN_SECRET}`).toString();

      let resp;
      try {
        resp = await fetch(url, {
          method: 'GET',
          headers: {
            ...DEFAULT_HEADERS,
            token: token,
            tokenparam: tokenparam,
          },
          signal,
        });

        if (!resp.ok) {
          const errorMsg = `HTTP error! status: ${resp.status}`;
          console.error(errorMsg);
          throw new Error(errorMsg);
        }
      } catch (error) {
        if ((error as any)?.name === 'AbortError') {
          throw new Error(`Request aborted for domain ${domain}`);
        }
        if (resp) {
          try {
            const text = await resp.text();
            console.error(text);
          } catch (e) {
            // ignore
          }
        }
        throw new Error(`Fetch failed for domain ${domain}: ${error}`);
      }

      const json: { code: number; data: string } = await resp.json();
      console.log(domain, 'json:', json);
      const data = json.data;

      const decryptedData = decodeRespData(data, timestamp);
      let parsedData;
      try {
        parsedData = JSON.parse(decryptedData);
      } catch (error) {
        console.error('Error parsing JSON:', error);
        console.log('data:', data);
        console.log('decryptedData:', decryptedData);
        throw new Error(`Failed to parse decrypted data from domain ${domain}: ${error}`);
      }
      console.log('parsedData:', parsedData);

      return {
        id: parsedData.id || 0,
        name: parsedData.name || null,
        images: parsedData.images || [],
        addtime: parsedData.addtime || null,
        description: parsedData.description || '',
        total_views: parsedData.total_views || null,
        likes: parsedData.likes || null,
        series: parsedData.series || [],
        series_id: parsedData.series_id || null,
        comment_total: parsedData.comment_total || false,
        author: parsedData.author || [],
        tags: parsedData.tags || [],
        works: parsedData.works || [],
        actors: parsedData.actors || [],
        related_list: parsedData.related_list || [],
        liked: parsedData.liked || false,
        is_favorite: parsedData.is_favorite || false,
        is_aids: parsedData.is_aids || false,
        price: parsedData.price || '',
        purchased: parsedData.purchased || '',
      };
    },
  });

  const coverBase64 = await loadCoverBase64(id);
  result.cover_base64 = coverBase64;
  return result;
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
        } catch (e) {
          // ignore
        }
      });
      return result;
    } catch (err) {
      const agg = err as AggregateError;
      if (agg && Array.isArray((agg as any).errors)) {
        const batchErrors = (agg as any).errors;
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
        } catch (e) {
          // ignore
        }
      });
    }
  }

  const errorSummary = errors.map((entry) => `${entry.item}: ${entry.error}`).join('; ');
  throw new Error(`All concurrent requests failed. Errors: ${errorSummary}`);
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

function formatId(jmid: string): string {
  // 去除字符，如果存在文本"JM"，提取后面的数字部分，否则去除所有非数字字符
  if (jmid.includes('JM')) {
    return jmid.replace(/JM\s*(\d+)/i, '$1');
  }
  return jmid.replace(/\D/g, '');
}
