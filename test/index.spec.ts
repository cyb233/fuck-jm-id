import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

// 定义响应数据类型
interface ComicInfo {
  id: number;
  name: string;
}

interface ResponseData {
  comicInfo: ComicInfo;
}

// 定义测试用例映射，jmid为key，期望响应为value
const TEST_CASES: Map<string, ResponseData> = new Map([
  [
    'JM12345',
    {
      comicInfo: {
        id: 12345,
        name: '[奥寺千秋] 家出少女 (コミックゼロス #56) [童贞未泯汉化] [DL版]',
      },
    },
  ],
  [
    '45678',
    {
      comicInfo: {
        id: 45678,
        name: '[おとちち] 我慢出来ない牝穴',
      },
    },
  ],
]);

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

        // 验证响应结构
        expect(actualResponse).toHaveProperty('comicInfo');

        // 验证comicInfo的id
        expect(actualResponse.comicInfo.name).toBe(expectedResponse.comicInfo.name);
      });
    }
  });

  describe('request for /getInfo with invalid jmid', () => {
    it('responds with error for invalid jmid', async () => {
      const request = new Request('http://example.com/getInfo/invalid');
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(500); // 错误处理会返回500状态码
      const errorResponse = await response.json();
      expect(errorResponse).toHaveProperty('error');
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
