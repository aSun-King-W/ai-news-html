import { Article } from '../types/article';
import { format } from 'date-fns';
import { groupArticlesBySource } from '../processors/sorter';

/**
 * 生成带目录的Markdown文档
 */
export function generateMarkdown(articles: Article[]): string {
  const now = new Date();
  const dateStr = format(now, 'yyyy年MM月dd日');
  const timeStr = format(now, 'HH:mm');

  // 按来源分组
  const grouped = groupArticlesBySource(articles);
  const sourceStats = Object.entries(grouped).map(([source, articles]) =>
    `${source}(${articles.length})`
  ).join(', ');

  // 生成目录
  const toc = generateTableOfContents(grouped);

  // 生成Markdown内容
  let markdown = `# AI新闻日报 (${dateStr})\n\n`;
  markdown += `**生成时间**: ${timeStr}\n\n`;

  markdown += `## 目录\n`;
  markdown += toc + '\n\n';

  markdown += `## 今日摘要\n`;
  markdown += `- **共收集 ${articles.length} 篇文章**\n`;
  markdown += `- **来源分布**: ${sourceStats}\n`;
  markdown += `- **时间范围**: 最近24小时\n\n`;

  markdown += `## 文章列表\n\n`;

  // 按来源分组显示文章
  for (const [source, sourceArticles] of Object.entries(grouped)) {
    markdown += `### ${source}\n\n`;

    for (const article of sourceArticles) {
      markdown += generateArticleSection(article);
    }

    markdown += '\n';
  }

  markdown += `---\n`;
  markdown += `*本日报由 AI 新闻聚合工具自动生成*\n`;

  return markdown;
}

/**
 * 生成目录
 */
function generateTableOfContents(grouped: Record<string, Article[]>): string {
  let toc = '';

  toc += `1. [今日摘要](#今日摘要)\n`;

  let sectionIndex = 2;
  for (const [source] of Object.entries(grouped)) {
    const anchor = source.toLowerCase().replace(/\s+/g, '-');
    toc += `${sectionIndex}. [${source}](#${anchor})\n`;
    sectionIndex++;
  }

  return toc;
}

/**
 * 生成单个文章部分
 */
function generateArticleSection(article: Article): string {
  const dateStr = format(article.pubDate, 'yyyy-MM-dd HH:mm');

  let section = `#### [${article.title}](${article.link})\n\n`;
  section += `**发布时间**: ${dateStr}\n\n`;

  // 优先显示AI摘要
  if (article.aiSummary) {
    section += `**AI摘要**: ${article.aiSummary}\n\n`;
  } else if (article.description) {
    // 截取描述，避免过长
    const maxDescLength = 300;
    let description = article.description;

    if (description.length > maxDescLength) {
      description = description.substring(0, maxDescLength) + '...';
    }

    // 清理描述中的多余空格和换行
    description = description.replace(/\s+/g, ' ').trim();
    section += `**内容摘要**: ${description}\n\n`;
  }

  section += `---\n\n`;

  return section;
}

/**
 * 生成文件名
 */
export function generateFilename(): string {
  const now = new Date();
  return `ai-news-${format(now, 'yyyy-MM-dd')}.md`;
}