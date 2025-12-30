import { Hono } from 'hono';
import { getJmComicInfo } from './api';
import { searchs } from './api';
const app = new Hono();

app.get('/getInfo/:jmid', async (c) => {
  const { jmid } = c.req.param();
  return c.json(await getJmComicInfo(jmid));
});

app.get('/search', async (c) => {
  const { jmid, title } = c.req.query();
  if (!title) {
    throw new Error('请输入名称');
  }
  const results = [];
  results.push({
    site: '*',
    results: [
      {
        title: '该功能暂未正确实现',
        cover: '',
        url: `https://18comic.vip/album/${jmid || ''}`,
      },
    ],
  });
  for (const search of searchs) {
    results.push({
      site: search.site,
      results: await search.search(title),
    });
  }
  return c.json(results);
});

app.onError((err, c) => {
  console.error(`${err}`);
  return c.json({ error: err.message }, 500);
});

export default app;
