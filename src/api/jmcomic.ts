import CryptoJS from 'crypto-js';

const API_URL_DOMAIN_SERVER_LIST = [
  'https://rup4a04-c01.tos-ap-southeast-1.bytepluses.com/newsvr-2025.txt',
  'https://rup4a04-c02.tos-cn-hongkong.bytepluses.com/newsvr-2025.txt',
];
const DOMAIN_API_LIST = ['www.cdnzack.cc', 'www.cdnsha.org', 'www.cdnbea.club', 'www.cdnbea.net', 'www.cdn-mspjmapiproxy.xyz'];

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
};

async function getJMApiList(): Promise<string[]> {
  for (const url of API_URL_DOMAIN_SERVER_LIST) {
    try {
      console.log('Fetching', url);
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept-Encoding': 'gzip, deflate',
          'user-agent':
            'Mozilla/5.0 (Linux; Android 9; V1938CT Build/PQ3A.190705.11211812; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Safari/537.36',
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

export async function getJmComicInfo(jmid: string): Promise<JmComicInfo> {
  const id = formatId(jmid);
  if (!id) {
    throw new Error('无效的jmid');
  }

  // 获取API列表
  const apiList = await getJMApiList();
  const errors: Array<{ domain: string; error: unknown }> = [];

  // 循环尝试每个域名直到成功或全部失败
  while (apiList.length > 0) {
    // 随机选择一个域名
    const randomIndex = Math.floor(Math.random() * apiList.length);
    const domain = apiList[randomIndex];

    // 从列表中移除该域名
    apiList.splice(randomIndex, 1);

    try {
      const baseUrl = `https://${domain}`;
      const params = new URLSearchParams({
        id: id,
      }).toString();
      const url = `${baseUrl}${API_ALBUM}?${params}`;
      console.log(`Fetching ${url}`);

      // 获取10位时间戳
      const timestamp = Math.floor(Date.now() / 1000);
      const tokenparam = `${timestamp},${APP_VERSION}`;
      const token = CryptoJS.MD5(`${timestamp},${APP_TOKEN_SECRET}`).toString();

      let resp;
      try {
        resp = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept-Encoding': 'gzip, deflate',
            'user-agent':
              'Mozilla/5.0 (Linux; Android 9; V1938CT Build/PQ3A.190705.11211812; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Safari/537.36',
            token: token,
            tokenparam: tokenparam,
          },
        });
        if (!resp.ok) {
          const errorMsg = `HTTP error! status: ${resp.status}`;
          console.error(errorMsg);
          throw new Error(errorMsg);
        }
      } catch (error) {
        if (resp) {
          console.error(await resp.text());
        }
        throw error;
      }

      const json: { code: number; data: string } = await resp.json();
      console.log('json:', json);
      const data = json.data;

      // 解密数据
      const decryptedData = decodeRespData(data, timestamp);
      let parsedData;
      try {
        parsedData = JSON.parse(decryptedData);
      } catch (error) {
        console.error('Error parsing JSON:', error);
        console.log('data:', data);
        console.log('decryptedData:', decryptedData);
        throw error;
      }
      console.log('parsedData:', parsedData);

      // 成功获取数据，返回结果
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
    } catch (error) {
      // 记录错误并尝试下一个域名
      console.error(`Failed with domain ${domain}:`, error);
      errors.push({ domain, error });
    }
  }

  // 所有域名都已失败
  const errorSummary = errors.map((e) => `${e.domain}: ${e.error}`).join('; ');
  throw new Error(`All domains failed. Errors: ${errorSummary}`);
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

function formatId(jmid: string): string {
  // 去除字符，如果存在文本"JM"，提取后面的数字部分，否则去除所有非数字字符
  if (jmid.includes('JM')) {
    return jmid.replace(/JM\s*(\d+)/i, '$1');
  }
  return jmid.replace(/\D/g, '');
}
