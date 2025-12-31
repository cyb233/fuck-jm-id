import { Hono } from 'hono';
import { getJmComicInfo } from './api';
import { sites, extractTitle } from './util';
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
  let extractedTitle = extractTitle(title);
  if (!extractedTitle) {
    extractedTitle = title;
  }
  for (const site of sites) {
    results.push({
      logo: site.logo,
      site: site.name,
      title: extractedTitle,
      search: site.search(extractedTitle),
    });
  }
  return c.json(results);
});

app.onError((err, c) => {
  console.error(`${err}`);
  return c.json({ error: err.message }, 500);
});

export default app;
