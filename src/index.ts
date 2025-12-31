import { Hono } from 'hono';
import { getJmComicInfo } from './api';
import { sites, extractTitle } from './util';
const app = new Hono();

app.get('/getInfo/:jmid', async (c) => {
  const { jmid } = c.req.param();
  const comicInfo = await getJmComicInfo(jmid);
  const title = comicInfo.name;
  let searchResult = [];
  if (title) {
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
    comicInfo,
    searchResult,
  });
});

app.onError((err, c) => {
  console.error(`${err}`);
  return c.json({ error: err.message }, 500);
});

export default app;
