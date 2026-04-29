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
 * 检测文本是否包含某个关键词（英文关键词使用词边界匹配，中文使用子串匹配）
 */
function textMatchesKeyword(text: string, keyword: string): boolean {
  // 纯英文关键词使用正则 \b 词边界，避免匹配单词内部的子串（如 "Gmail" 中的 "ai"）
  if (/^[a-zA-Z][a-zA-Z\s]*$/.test(keyword)) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 兼容复数形式（如 "large language models" 匹配 "large language model"）
    return new RegExp(`\\b${escaped}s?\\b`, 'i').test(text);
  }
  // 中文等关键词保持子串匹配
  return text.includes(keyword.toLowerCase());
}

/**
 * 过滤AI相关文章 - 基于标题和描述中的关键词
 */
export function filterAIArticles(articles: Article[]): Article[] {
  // AI相关关键词（中文和英文）
  const aiKeywords = [
    // 中文关键词
    'AI', 'OpenAI', '人工智能', 'AIGC', '大模型', '机器学习', '深度学习', '神经网络',
    'ChatGPT', 'GPT', 'Claude', '文心一言', '通义千问', '智谱', '字节跳动',
    '腾讯混元', '百度文心', '科大讯飞', '自动驾驶', '机器人', '智能驾驶',
    '生成式AI', '内容生成', '图像生成', '视频生成', '语音识别', '自然语言处理',
    '计算机视觉', '算法', '数据科学', '数据分析', '智能推荐', '个性化推荐',
    '具身智能', 'token',

    // 英文关键词
    'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
    'generative ai', 'llm', 'large language model', 'computer vision',
    'natural language processing', 'nlp', 'autonomous', 'self-driving',
    'robotics', 'chatbot', 'virtual assistant', 'smart assistant', 'agent',
  ];

  // 已知的误报排除模式（在命中关键词后二次过滤，减少 FP）
  // 使用原因：这些模式虽然包含 AI 关键词，但文章本身并非 AI 主题
  const exclusionPatterns: Array<{ field: 'title' | 'description'; pattern: RegExp; reason: string }> = [
    { field: 'title', pattern: /^\d点\d氪/, reason: '36Kr 新闻汇总格式' },
    { field: 'title', pattern: /^氪星晚报/, reason: '36Kr 晚报汇总格式' },
    { field: 'description', pattern: /扫地机器人/, reason: '产品品类非 AI 主题' },
    { field: 'description', pattern: /正大机器人/, reason: '投资方公司名' },
  ];

  return articles.filter(article => {
    const title = article.title;
    const description = (article.description || '');

    // 检查标题或描述中是否包含任何AI关键词
    const matchesAI = aiKeywords.some(keyword =>
      textMatchesKeyword(title, keyword) ||
      textMatchesKeyword(description, keyword)
    );
    if (!matchesAI) return false;

    // 二次过滤：排除已知的非 AI 模式（如新闻汇总、产品品类等）
    for (const { field, pattern } of exclusionPatterns) {
      const text = field === 'title' ? title : description;
      if (pattern.test(text)) return false;
    }

    return true;
  });
}