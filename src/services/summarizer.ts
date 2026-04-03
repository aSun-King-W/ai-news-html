import OpenAI from 'openai';
import { Article } from '../types/article';
import { AI_MODEL, AI_MAX_TOKENS, AI_TEMPERATURE } from '../config';

export class AISummarizer {
  private client: OpenAI;
  private rateLimitDelay: number = 1000; // 1秒延迟避免速率限制

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com'
    });
  }

  /**
   * 为单篇文章生成AI摘要
   */
  async summarizeArticle(article: Article): Promise<string | null> {
    const prompt = this.buildPrompt(article);

    try {
      const response = await this.client.chat.completions.create({
        model: AI_MODEL,
        max_tokens: AI_MAX_TOKENS,
        temperature: AI_TEMPERATURE,
        messages: [{ role: 'user', content: prompt }]
      });

      const summary = response.choices[0]?.message?.content?.trim();
      return summary || null;
    } catch (error) {
      console.error(`AI摘要失败 (${article.title}):`, error instanceof Error ? error.message : error);
      return null; // 返回null表示失败
    }
  }

  /**
   * 批量生成文章摘要（带速率限制）
   */
  async summarizeArticles(articles: Article[]): Promise<Article[]> {
    const results: Article[] = [];

    console.log(`🤖 开始为 ${articles.length} 篇文章生成AI摘要...`);

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];

      // 显示进度
      if (i % 5 === 0 || i === articles.length - 1) {
        console.log(`  处理中: ${i + 1}/${articles.length}`);
      }

      const summary = await this.summarizeArticle(article);
      if (summary) {
        results.push({ ...article, aiSummary: summary });
      } else {
        results.push(article); // 保持原样
      }

      // 速率限制延迟（最后一篇不需要延迟）
      if (i < articles.length - 1) {
        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
      }
    }

    const successCount = results.filter(a => a.aiSummary).length;
    console.log(`✅ AI摘要完成: ${successCount}/${articles.length} 篇文章`);

    return results;
  }

  /**
   * 构建Claude API提示词
   */
  private buildPrompt(article: Article): string {
    // 清理描述文本
    const cleanDescription = article.description
      ? article.description
          .replace(/<[^>]*>/g, '') // 移除HTML标签
          .replace(/\s+/g, ' ') // 合并多余空格
          .trim()
          .substring(0, 500) // 限制长度
      : '';

    return `请为以下AI相关新闻生成一句简洁的中文摘要（不超过50字）：

标题：${article.title}
${cleanDescription ? `描述：${cleanDescription}` : ''}

要求：
1. 用一句话概括核心内容
2. 专注于AI技术、应用或影响
3. 使用自然流畅的中文
4. 避免重复标题内容
5. 保持客观准确

一句话摘要：`;
  }
}