/**
 * 源类型 → 显示名称映射
 */

const SOURCE_TYPE_TO_DISPLAY: Record<string, string> = {
  'techcrunch': 'TechCrunch',
  'verge': 'The Verge',
  'hackernews': 'Hacker News',
  '36kr': '36Kr',
  'huxiu': 'Huxiu',
  'tmtpost': 'TMTPost',
  'jiqizhixin': 'JiQiZhiXin',
  'openai': 'OpenAI',
  'anthropic': 'Anthropic',
  'deepseek': 'DeepSeek',
};

export function sourceTypeToDisplayName(type: string): string {
  return SOURCE_TYPE_TO_DISPLAY[type] || 'TechCrunch';
}
