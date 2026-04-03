import { Article } from '../types/article';

/**
 * 按发布时间倒序排序
 */
export function sortArticlesByDate(articles: Article[]): Article[] {
  return [...articles].sort((a, b) =>
    b.pubDate.getTime() - a.pubDate.getTime()
  );
}

/**
 * 按来源分组
 */
export function groupArticlesBySource(articles: Article[]): Record<string, Article[]> {
  const grouped: Record<string, Article[]> = {};

  for (const article of articles) {
    if (!grouped[article.source]) {
      grouped[article.source] = [];
    }
    grouped[article.source].push(article);
  }

  return grouped;
}