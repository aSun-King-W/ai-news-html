import { Article } from '../types/article';
import { subHours, isAfter } from 'date-fns';

/**
 * 过滤最近 N 小时内的文章
 */
export function filterRecentArticles(articles: Article[], hoursBack: number): Article[] {
  const cutoffDate = subHours(new Date(), hoursBack);

  return articles.filter(article =>
    isAfter(article.pubDate, cutoffDate)
  );
}

/**
 * 去重 - 基于文章链接
 */
export function deduplicateArticles(articles: Article[]): Article[] {
  const seen = new Set<string>();
  const result: Article[] = [];

  for (const article of articles) {
    const normalizedLink = article.link.toLowerCase().trim();
    if (!seen.has(normalizedLink)) {
      seen.add(normalizedLink);
      result.push(article);
    }
  }

  return result;
}

/**
 * 过滤AI相关文章 - 基于标题和描述中的关键词
 */
export function filterAIArticles(articles: Article[]): Article[] {
  // AI相关关键词（中文和英文）
  const aiKeywords = [
    // 中文关键词
    'AI', '人工智能', 'AIGC', '大模型', '机器学习', '深度学习', '神经网络',
    'ChatGPT', 'GPT', 'Claude', '文心一言', '通义千问', '智谱', '字节跳动',
    '腾讯混元', '百度文心', '科大讯飞', '自动驾驶', '机器人', '智能驾驶',
    '生成式AI', '内容生成', '图像生成', '视频生成', '语音识别', '自然语言处理',
    '计算机视觉', '算法', '数据科学', '数据分析', '智能推荐', '个性化推荐',

    // 英文关键词
    'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
    'generative ai', 'llm', 'large language model', 'computer vision',
    'natural language processing', 'nlp', 'autonomous', 'self-driving',
    'robotics', 'chatbot', 'virtual assistant', 'smart assistant'
  ];

  return articles.filter(article => {
    const title = article.title.toLowerCase();
    const description = (article.description || '').toLowerCase();

    // 检查标题或描述中是否包含任何AI关键词
    return aiKeywords.some(keyword =>
      title.includes(keyword.toLowerCase()) ||
      description.includes(keyword.toLowerCase())
    );
  });
}