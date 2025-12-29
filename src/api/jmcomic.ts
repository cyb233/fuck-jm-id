import CryptoJS from 'crypto-js';

const DOMAIN_API_LIST = ['www.cdnaspa.vip', 'www.cdnaspa.club', 'www.cdnplaystation6.vip', 'www.cdnplaystation6.cc'];

const client_key = 'api';
const APP_VERSION = '2.0.6';
const APP_TOKEN_SECRET = '18comicAPP';
const APP_DATA_SECRET = '185Hcomic3PAPP7R';
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

export async function getJmComicInfo(jmid: string): Promise<JmComicInfo> {
	// 随机选择一个域名
	const domain = DOMAIN_API_LIST[Math.floor(Math.random() * DOMAIN_API_LIST.length)];
	const baseUrl = `https://${domain}`;
	const url = `${baseUrl}/${API_ALBUM}?id=${jmid}`;
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
			console.error('HTTP error! status:', resp.status);
			throw new Error(`HTTP error! status: ${resp.status}`);
		}
	} catch (error) {
		if (resp) {
			console.error(await resp.text());
		}
		console.error('Error fetching data:', error);
		throw error;
	}
	const json: { code: number; data: string } = await resp.json();
	console.log('json:', json);
	const data = json.data;

	// 解密数据
	const decryptedData = decodeRespData(data, timestamp);
	const parsedData = JSON.parse(decryptedData);
	console.log('parsedData:', parsedData);

	// 映射 API 响应到 JmComicInfo 结构
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
}

function decodeRespData(data: string, ts: number, secret?: string): string {
	if (!secret) secret = APP_DATA_SECRET;
	const key = CryptoJS.MD5(`${ts}${secret}`).toString();
	const decrypted = CryptoJS.AES.decrypt(data, CryptoJS.enc.Utf8.parse(key), {
		mode: CryptoJS.mode.ECB,
		padding: CryptoJS.pad.Pkcs7,
	});
	return decrypted.toString(CryptoJS.enc.Utf8);
}
