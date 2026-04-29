import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { parse } from 'date-fns';
import { Article, FetchResult, RssSource } from '../types/article';

/**
 * 获取并解析 HTML 页面
 */
async function fetchAndLoadHtml(url: string): Promise<cheerio.CheerioAPI> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} for ${url}`);
  }
  const html = await response.text();
  return cheerio.load(html);
}

/**
 * 解析相对链接为绝对 URL
 */
function resolveUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

// ---------- 日期解析 ----------

const DATE_FORMATS = [
  'MMMM d, yyyy',    // January 15, 2025
  'MMM d, yyyy',     // Jan 15, 2025
  'yyyy-MM-dd',      // 2025-01-15
  'yyyy/MM/dd',      // 2025/01/15
  'MM/dd/yyyy',      // 01/15/2025
  'dd MMMM yyyy',    // 15 January 2025
  'dd MMM yyyy',     // 15 Jan 2025
];

function parseDate(text: string): Date | null {
  const cleaned = text.replace(/[–—]/g, '-').trim();
  for (const fmt of DATE_FORMATS) {
    const parsed = parse(cleaned, fmt, new Date());
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function extractDate($: cheerio.CheerioAPI, el: any): Date {
  // 尝试从 <time> 元素的 datetime 属性获取
  const $el = $(el);
  const timeEl = $el.find('time');
  const datetime = timeEl.attr('datetime');
  if (datetime) {
    const d = new Date(datetime);
    if (!isNaN(d.getTime())) return d;
  }

  // 尝试从元素的文本中提取日期
  const text = $el.text();
  const dateMatch = text.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December|\d{1,2})[\s\-–—]+\d{1,2}[\s\-–—,]*\d{2,4}|\d{4}[\s\-–—]\d{1,2}[\s\-–—]\d{1,2}/i
  );
  if (dateMatch) {
    const parsed = parseDate(dateMatch[0]);
    if (parsed) return parsed;
  }

  return new Date();
}

// ---------- 提取文章链接 ----------

/**
 * 从元素中提取文章链接
 */
function extractLinks($: cheerio.CheerioAPI, baseUrl: string): Array<{ title: string; href: string }> {
  const links: Array<{ title: string; href: string }> = [];
  const seen = new Set<string>();

  // 收集页面中所有链接
  $('a[href]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href')?.trim();
    const title = $el.text().trim();

    // 过滤：必须有标题、有链接、不是纯符号/数字
    if (!href || !title || title.length < 5) return;
    if (/^(#|javascript:|mailto:|tel:)/.test(href)) return;
    if (/^\d+$/.test(title)) return;

    const absoluteHref = resolveUrl(baseUrl, href);
    const key = absoluteHref.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    links.push({ title, href: absoluteHref });
  });

  return links;
}

/**
 * 从链接列表中筛选出文章链接，按得分排序
 */
function scoreArticleLinks(
  links: Array<{ title: string; href: string }>
): Array<{ title: string; href: string; score: number }> {
  const scored: Array<{ title: string; href: string; score: number }> = [];
  for (const link of links) {
    let score = 0;
    const hrefLower = link.href.toLowerCase();
    const titleLower = link.title.toLowerCase();

    // 链接路径包含关键词加分
    if (/\/news\//.test(hrefLower)) score += 3;
    if (/\/blog\//.test(hrefLower)) score += 3;
    if (/\/updates?\//.test(hrefLower)) score += 2;
    if (/\/release\//.test(hrefLower)) score += 2;
    if (/\/announcement/.test(hrefLower)) score += 2;

    // 排除非文章路径
    if (/\/category\//.test(hrefLower)) score -= 2;
    if (/\/tag\//.test(hrefLower)) score -= 2;
    if (/\/author\//.test(hrefLower)) score -= 2;
    if (/page/.test(hrefLower)) score -= 1;

    // 标题特征加分
    if (titleLower.length > 10) score += 1;
    if (titleLower.length > 20) score += 1;

    scored.push({ ...link, score });
  }

  return scored.sort((a, b) => b.score - a.score);
}

// ---------- 站点爬取函数 ----------

/**
 * 爬取 Anthropic 新闻页面
 */
async function scrapeAnthropicNews(url: string): Promise<Article[]> {
  const $ = await fetchAndLoadHtml(url);
  const articles: Article[] = [];

  // 尝试多种选择器来定位文章卡片
  const cardSelectors = [
    'article',
    '[class*="post"]',
    '[class*="card"]',
    '[class*="news-item"]',
    '[class*="blog-item"]',
    'li a[href*="/news/"]',
  ];

  const visitedLinks = new Set<string>();

  for (const selector of cardSelectors) {
    $(selector).each((_, el) => {
      const $el = $(el);
      const linkEl = $el.is('a') ? $el : $el.find('a[href*="/news/"]').first();
      const href = linkEl.attr('href');
      const title = $el.find('h2, h3, h4, [class*="title"], [class*="heading"]').first().text().trim()
        || $el.find('a').first().text().trim()
        || linkEl.text().trim();

      if (!href || !title || title.length < 5) return;

      const absoluteHref = resolveUrl(url, href);
      if (visitedLinks.has(absoluteHref)) return;
      visitedLinks.add(absoluteHref);

      const date = extractDate($, el);

      articles.push({
        title,
        link: absoluteHref,
        pubDate: date,
        source: 'Anthropic',
        description: $el.find('p, [class*="description"], [class*="excerpt"]').first().text().trim().substring(0, 300) || undefined,
      });
    });

    if (articles.length > 0) break; // 找到文章，不再尝试后续选择器
  }

  // 如果卡片选择器都没命中，用通用链接评分兜底
  if (articles.length === 0) {
    const allLinks = extractLinks($, url);
    const scored = scoreArticleLinks(allLinks);
    const topLinks = scored.filter(l => l.score >= 3).slice(0, 20);

    for (const link of topLinks) {
      if (visitedLinks.has(link.href)) continue;
      visitedLinks.add(link.href);
      articles.push({
        title: link.title,
        link: link.href,
        pubDate: new Date(),
        source: 'Anthropic',
      });
    }
  }

  return articles;
}

/**
 * 爬取 DeepSeek 新闻/更新页面
 */
async function scrapeDeepSeekNews(url: string): Promise<Article[]> {
  const $ = await fetchAndLoadHtml(url);
  const articles: Article[] = [];

  // API 文档站通常是列表结构
  const cardSelectors = [
    'article',
    '[class*="post"]',
    '[class*="news"]',
    '[class*="card"]',
    'li',
    '[class*="list"] li',
    '[class*="item"]',
  ];

  const visitedLinks = new Set<string>();

  for (const selector of cardSelectors) {
    $(selector).each((_, el) => {
      const $el = $(el);
      const linkEl = $el.is('a') ? $el : $el.find('a').first();
      const href = linkEl.attr('href');
      const title = $el.find('h2, h3, h4, strong, [class*="title"]').first().text().trim()
        || linkEl.text().trim();

      if (!href || !title || title.length < 5) return;

      // 排除导航等非文章链接
      if (/^\/(docs|api|guide|intro)/.test(href) && !/news|release|update|changelog/i.test(href)) return;

      const absoluteHref = resolveUrl(url, href);
      if (visitedLinks.has(absoluteHref)) return;
      visitedLinks.add(absoluteHref);

      const date = extractDate($, el);

      articles.push({
        title,
        link: absoluteHref,
        pubDate: date,
        source: 'DeepSeek',
        description: $el.find('p, [class*="description"], [class*="summary"]').first().text().trim().substring(0, 300) || undefined,
      });
    });

    if (articles.length > 0) break;
  }

  return articles;
}

/**
 * 爬取单个 HTML 源
 */
export async function scrapeHtmlFeed(source: RssSource): Promise<FetchResult> {
  console.log(`  🌐 爬取 HTML 源: ${source.name} (${source.url})`);

  try {
    let articles: Article[];

    switch (source.type) {
      case 'anthropic':
        articles = await scrapeAnthropicNews(source.url);
        break;
      case 'deepseek':
        articles = await scrapeDeepSeekNews(source.url);
        break;
      default:
        throw new Error(`不支持的 HTML 源类型: ${source.type}`);
    }

    console.log(`  ✅ ${source.name}: 抓取到 ${articles.length} 篇文章`);
    return { source: source.name, articles, error: undefined };
  } catch (error) {
    console.error(`  ❌ ${source.name} 爬取失败:`, error instanceof Error ? error.message : error);
    return {
      source: source.name,
      articles: [],
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

/**
 * 串行爬取所有 HTML 源（避免触发反爬）
 */
export async function scrapeAllHtmlFeeds(sources: RssSource[]): Promise<FetchResult[]> {
  const results: FetchResult[] = [];

  for (const source of sources) {
    const result = await scrapeHtmlFeed(source);
    results.push(result);
    // 爬取间隔，避免触发目标站限流
    await new Promise(r => setTimeout(r, 1000));
  }

  return results;
}
