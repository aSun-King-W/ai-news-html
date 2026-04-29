import { RssSource } from './types/article';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// RSS源配置
export const RSS_SOURCES: RssSource[] = [
  {
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    type: 'techcrunch'
  },
  {
    name: 'The Verge AI',
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    type: 'verge'
  },
  {
    name: 'Hacker News AI',
    url: 'https://hnrss.org/newest?q=AI&count=30',
    type: 'hackernews'
  },
  {
    name: '36氪',
    url: 'https://36kr.com/feed',
    type: '36kr'
  },
  {
    name: '虎嗅',
    url: 'https://rss.huxiu.com/',
    type: 'huxiu'
  },
  {
    name: 'OpenAI',
    url: 'https://openai.com/news/rss.xml',
    type: 'openai'
  },
];

// HTML 爬取源（无 RSS，需解析 HTML）
export const HTML_SOURCES: RssSource[] = [
  {
    name: 'Anthropic',
    url: 'https://www.anthropic.com/news',
    type: 'anthropic'
  },
  {
    name: 'DeepSeek',
    url: 'https://api-docs.deepseek.com/news/',
    type: 'deepseek'
  }
];

export const HOURS_BACK = 24; // 抓取最近多少小时的文章

// AI摘要配置
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY; // 支持DeepSeek等OpenAI兼容API
export const AI_SUMMARY_ENABLED = process.env.AI_SUMMARY_ENABLED === 'true';
export const AI_MODEL = process.env.AI_MODEL || 'deepseek-chat';
export const AI_MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS || '100');
export const AI_TEMPERATURE = parseFloat(process.env.AI_TEMPERATURE || '0.7');