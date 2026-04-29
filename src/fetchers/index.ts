import { Article, FetchResult, RssSource } from '../types/article';
import { sourceTypeToDisplayName } from './source-map';
import Parser from 'rss-parser';
import fetch from 'node-fetch';

/**
 * 清理文章描述
 */
function cleanDescription(description: string | undefined, sourceType: string): string | undefined {
  if (!description) return undefined;

  // 清理Hacker News的描述
  if (sourceType === 'hackernews') {
    // 尝试提取文章URL
    const articleUrlMatch = description.match(/Article URL: (https?:\/\/[^\s]+)/);
    const pointsMatch = description.match(/Points: (\d+)/);
    const commentsMatch = description.match(/# Comments: (\d+)/);

    if (articleUrlMatch) {
      const url = articleUrlMatch[1];
      const points = pointsMatch ? pointsMatch[1] : '0';
      const comments = commentsMatch ? commentsMatch[1] : '0';

      return `Hacker News 文章 | ${points} 点赞 | ${comments} 评论 | 链接: ${url}`;
    }

    // 如果无法提取URL，返回简化版本
    return `Hacker News 文章 - ${description.substring(0, 100)}...`;
  }

  // 其他源的通用清理
  return description
    .replace(/\s+/g, ' ') // 合并多余空格
    .trim()
    .substring(0, 300); // 限制长度
}

export async function fetchRssFeed(source: RssSource): Promise<FetchResult> {
  const parser = new Parser();

  try {
    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const xml = await response.text();
    const feed = await parser.parseString(xml);

    const articles: Article[] = [];

    for (const item of feed.items) {
      try {
        let pubDate: Date;

        if (source.type === 'hackernews' && item.isoDate) {
          // Hacker News 使用 ISO 日期格式
          pubDate = new Date(item.isoDate);
        } else if (item.pubDate) {
          // 尝试解析各种日期格式
          pubDate = new Date(item.pubDate);
        } else {
          pubDate = new Date();
        }

        // 如果日期无效，使用当前日期
        if (isNaN(pubDate.getTime())) {
          pubDate = new Date();
        }

        const rawDescription = item.contentSnippet || item.content || undefined;
        const cleanedDescription = rawDescription ? cleanDescription(rawDescription, source.type) : undefined;

        const article: Article = {
          title: item.title || '无标题',
          link: item.link || '',
          pubDate,
          source: sourceTypeToDisplayName(source.type) as Article['source'],
          description: cleanedDescription
        };

        articles.push(article);
      } catch (error) {
        console.error(`解析文章失败 (${source.name}):`, error);
        // 跳过无效文章
      }
    }

    return {
      source: source.name,
      articles,
      error: undefined
    };
  } catch (error) {
    console.error(`抓取源失败 (${source.name}):`, error);
    return {
      source: source.name,
      articles: [],
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

export async function fetchAllFeeds(sources: RssSource[]): Promise<FetchResult[]> {
  const promises = sources.map(source => fetchRssFeed(source));
  return Promise.all(promises);
}