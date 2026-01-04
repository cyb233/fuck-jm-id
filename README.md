# fuck-jm-id

本项目诞生是因为我不喜欢有人在其他平台发本子（成人漫画）的出处时使用禁漫天堂的本子ID编号，因为这样的话我不能方便地使用本子名在我自己常用的平台搜索。

## 项目目的

这是一个基于 Cloudflare Workers 的边缘计算项目，旨在通过 JMComic 漫画 ID 获取其详细信息，并提供跨平台（如 E-Hentai、nhentai、Hitomi）的相似内容搜索功能。

## 功能特性

- 根据 JM ID（数字或带 "JM" 前缀）获取漫画详情
- 自动清洗标题，去除冗余前缀/后缀，提升搜索准确率
- 在 E-Hentai、nhentai、Hitomi 等站点生成带清理标题的搜索链接
- 提供低延迟、高可用的全球分布式服务

## 使用方法

### 本地开发

```bash
npm install
npm run dev
```

### 部署到 Cloudflare Workers

```bash
npm run deploy
```

## API 接口

### 获取漫画信息

```
GET /getInfo/:jmid
```

根据 JM ID 获取漫画详细信息，包含原始漫画信息和外部搜索建议。

## 技术栈

- Cloudflare Workers
- Hono
- TypeScript
- crypto-js
- Web Components

## 注意事项

- 本项目仅用于学习和研究目的
- 禁止用于非法用途
- 控制 API 调用频率，避免对目标服务器造成压力
