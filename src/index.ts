import { Hono } from 'hono';
import { getJmComicInfo } from './api';
import { sites, extractTitle, hasComicResult as detectComicResult } from './util';

const app = new Hono();

app.get('/getInfo/:jmid', async (c) => {
  const { jmid } = c.req.param();
  const comicInfo = await getJmComicInfo(jmid);
  const hasComicResult = detectComicResult(comicInfo);
  const title = comicInfo.name;
  const searchResult = [];

  if (hasComicResult && title) {
    // 解析标题
    let extractedTitle = extractTitle(title);
    if (!extractedTitle) {
      extractedTitle = title;
    }

    for (const site of sites) {
      searchResult.push({
        logo: site.logo,
        site: site.name,
        title: extractedTitle,
        search: site.search(extractedTitle),
      });
    }
  }

  return c.json({
    hasComicResult,
    comicInfo,
    searchResult,
  });
});

app.onError((err, c) => {
  const statusCandidate = (err as unknown as { status?: unknown }).status;
  const status = typeof statusCandidate === 'number' ? statusCandidate : 500;

  console.error(err);
  return c.json({ error: err.message }, { status: status as 400 | 404 | 500 | 502 });
});

export default app;
