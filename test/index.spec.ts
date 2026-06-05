import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import CryptoJS from 'crypto-js';
import { describe, expect, it, vi } from 'vitest';
import worker from '../src';
import { formatId, resetJmComicCaches } from '../src/api/jmcomic';
import { extractTitle, hasComicResult } from '../src/util/searchUtils';

interface ComicInfo {
  id: number;
  name: string | null;
  cover_base64?: string;
}

interface ResponseData {
  hasComicResult: boolean;
  comicInfo: ComicInfo;
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const APP_DATA_SECRET = '185Hcomic3PAPP7R';
const API_DOMAIN_SERVER_SECRET = 'diosfjckwpqpdfjkvnqQjsik';
const TEST_CASES: Map<string, ResponseData> = new Map([
  [
    'JM12345',
    {
      hasComicResult: true,
      comicInfo: {
        id: 12345,
        name: '[奥寺千秋] 家出少女 (コミックゼロス #56) [童贞未泯汉化] [DL版]',
      },
    },
  ],
  [
    '45678',
    {
      hasComicResult: true,
      comicInfo: {
        id: 45678,
        name: '[おとちち] 我慢出来ない牝穴',
      },
    },
  ],
]);

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function encryptPayload(payload: unknown, ts: number | string, secret = APP_DATA_SECRET): string {
  const key = CryptoJS.MD5(`${ts}${secret}`).toString();
  return CryptoJS.AES.encrypt(JSON.stringify(payload), CryptoJS.enc.Utf8.parse(key), {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  }).toString();
}

function createJsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json',
    },
    ...init,
  });
}

function createTextResponse(content: string, init?: ResponseInit): Response {
  return new Response(content, init);
}

describe('fuck-jm-id worker', () => {
  describe('request for /getInfo/:jmid', () => {
    for (const [jmid, expectedResponse] of TEST_CASES) {
      it(`responds with comic info for jmid: ${jmid}`, async () => {
        const request = new Request(`http://example.com/getInfo/${jmid}`);
        const ctx = createExecutionContext();
        const response = await worker.fetch(request, env, ctx);
        await waitOnExecutionContext(ctx);

        expect(response.status).toBe(200);
        const actualResponse = (await response.json()) as ResponseData;

        expect(actualResponse).toHaveProperty('comicInfo');
        expect(actualResponse.hasComicResult).toBe(expectedResponse.hasComicResult);
        expect(actualResponse.comicInfo.name).toBe(expectedResponse.comicInfo.name);
        expect(actualResponse.comicInfo.cover_base64).toEqual(expect.any(String));
      });
    }
  });

  describe('request for /getInfo with invalid jmid', () => {
    it('responds with 400 for invalid jmid', async () => {
      const request = new Request('http://example.com/getInfo/invalid');
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const errorResponse = await response.json();
      expect(errorResponse).toHaveProperty('error', '无效的jmid');
    });
  });

  describe('request for non-existent route', () => {
    it('responds with 404 for non-existent route', async () => {
      const request = new Request('http://example.com/nonexistent');
      const response = await SELF.fetch(request);
      expect(response.status).toBe(404);
    });
  });
});

describe('jmcomic helpers', () => {
  it('formats ids correctly', () => {
    expect(formatId('JM12345')).toBe('12345');
    expect(formatId('jm 987')).toBe('987');
    expect(formatId('abc-456-7')).toBe('4567');
    expect(formatId('invalid')).toBe('');
  });

  it('extracts a clean searchable title', () => {
    expect(extractTitle('[奥寺千秋] 家出少女 (コミックゼロス #56) [童贞未泯汉化] [DL版]')).toBe('家出少女');
    expect(extractTitle('Romaji Title | English Title')).toBe('Romaji Title ');
    expect(extractTitle(null)).toBeNull();
  });

  it('detects whether comic info contains a real result', () => {
    expect(hasComicResult({
      id: 123212121,
      name: null,
      images: [],
      addtime: null,
      description: '',
      total_views: null,
      likes: null,
      series: [],
      series_id: null,
      comment_total: true,
      author: [''],
      tags: [''],
      works: [],
      actors: [],
      related_list: [],
      liked: false,
      is_favorite: false,
      is_aids: false,
      price: '',
      purchased: '',
      cover_base64: '',
    })).toBe(false);

    expect(hasComicResult({
      id: 12345,
      name: 'Test Title',
      images: [],
      addtime: null,
      description: '',
      total_views: null,
      likes: null,
      series: [],
      series_id: null,
      comment_total: false,
      author: [],
      tags: [],
      works: [],
      actors: [],
      related_list: [],
      liked: false,
      is_favorite: false,
      is_aids: false,
      price: '',
      purchased: '',
    })).toBe(true);
  });
});
