export interface Article {
  title: string;
  link: string;
  pubDate: Date;
  source: 'TechCrunch' | 'The Verge' | 'Hacker News' | '36Kr' | 'Huxiu' | 'TMTPost' | 'JiQiZhiXin' | 'OpenAI' | 'Anthropic' | 'DeepSeek';
  description?: string;
  aiSummary?: string; // AI生成的一句话摘要
}

export interface RssSource {
  name: string;
  url: string;
  type: 'techcrunch' | 'verge' | 'hackernews' | '36kr' | 'huxiu' | 'tmtpost' | 'jiqizhixin' | 'openai' | 'anthropic' | 'deepseek';
}

export interface FetchResult {
  source: string;
  articles: Article[];
  error?: string;
}