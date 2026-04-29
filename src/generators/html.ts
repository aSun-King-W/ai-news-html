import { Article } from '../types/article';
import { format } from 'date-fns';
import { groupArticlesBySource } from '../processors/sorter';

/**
 * 生成美观的HTML日报页面
 */
export function generateHtml(articles: Article[]): string {
  const now = new Date();
  const dateStr = format(now, 'yyyy年MM月dd日');
  const timeStr = format(now, 'HH:mm');

  // 按来源分组
  const grouped = groupArticlesBySource(articles);
  const sourceStats = Object.entries(grouped).map(([source, articles]) =>
    `${source}(${articles.length})`
  ).join(', ');

  // 统计总数
  const totalArticles = articles.length;

  // 生成HTML
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>鹤野无岸 · AI技术日报 (${dateStr})</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --primary-color: #667eea;
      --secondary-color: #764ba2;
      --accent-color: #f093fb;
      --text-color: #333;
      --text-light: #666;
      --bg-color: #f8f9fa;
      --card-bg: #ffffff;
      --border-color: #e9ecef;
      --shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      --radius: 16px;
      --transition: all 0.3s ease;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      color: var(--text-color);
      line-height: 1.6;
      min-height: 100vh;
      padding: 20px;
      background-attachment: fixed;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
    }

    /* 头部样式 */
    .header {
      background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
      color: white;
      padding: 30px;
      border-radius: var(--radius);
      margin-bottom: 30px;
      box-shadow: var(--shadow);
      position: relative;
      overflow: hidden;
    }

    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px);
      background-size: 20px 20px;
      opacity: 0.2;
    }

    .site-title {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .site-title i {
      color: var(--accent-color);
    }

    .page-title {
      font-size: 28px;
      font-weight: 800;
      margin-bottom: 15px;
      line-height: 1.3;
    }

    .date-info {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      font-size: 15px;
      opacity: 0.9;
    }

    .date-info span {
      background: rgba(255, 255, 255, 0.15);
      padding: 6px 12px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* 统计卡片 */
    .stats-card {
      background: var(--card-bg);
      border-radius: var(--radius);
      padding: 25px;
      margin-bottom: 30px;
      box-shadow: var(--shadow);
      border-left: 5px solid var(--accent-color);
    }

    .stats-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 15px;
      color: var(--primary-color);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
    }

    .stat-item {
      background: var(--bg-color);
      padding: 15px;
      border-radius: 12px;
      transition: var(--transition);
    }

    .stat-item:hover {
      transform: translateY(-3px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
    }

    .stat-label {
      font-size: 14px;
      color: var(--text-light);
      margin-bottom: 5px;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: var(--primary-color);
    }

    /* 来源标签 */
    .source-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 30px;
    }

    .source-tab {
      background: var(--card-bg);
      border: 2px solid var(--border-color);
      padding: 12px 24px;
      border-radius: 30px;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .source-tab:hover {
      border-color: var(--primary-color);
      transform: translateY(-2px);
    }

    .source-tab.active {
      background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
      color: white;
      border-color: transparent;
    }

    .source-count {
      background: rgba(255, 255, 255, 0.2);
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 14px;
    }

    /* 文章卡片 */
    .article-list {
      display: flex;
      flex-direction: column;
      gap: 25px;
    }

    .article-card {
      background: var(--card-bg);
      border-radius: var(--radius);
      padding: 25px;
      box-shadow: var(--shadow);
      transition: var(--transition);
      position: relative;
      overflow: hidden;
      border-top: 3px solid transparent;
    }

    .article-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
      border-top-color: var(--accent-color);
    }

    .article-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: linear-gradient(to bottom, var(--primary-color), var(--accent-color));
    }

    .article-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15px;
      gap: 15px;
    }

    .article-title {
      font-size: 18px;
      font-weight: 700;
      line-height: 1.4;
      color: var(--text-color);
      flex: 1;
      text-decoration: none;
      transition: var(--transition);
    }

    .article-title:hover {
      color: var(--primary-color);
    }

    .source-badge {
      background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
    }

    .article-meta {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 15px;
      font-size: 14px;
      color: var(--text-light);
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .article-summary {
      background: var(--bg-color);
      padding: 18px;
      border-radius: 12px;
      margin-top: 15px;
      position: relative;
    }

    .summary-label {
      font-size: 14px;
      font-weight: 600;
      color: var(--primary-color);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .summary-text {
      font-size: 15px;
      line-height: 1.5;
    }

    /* 页脚 */
    .footer {
      text-align: center;
      margin-top: 50px;
      padding: 30px;
      color: var(--text-light);
      font-size: 14px;
      border-top: 1px solid var(--border-color);
    }

    .footer a {
      color: var(--primary-color);
      text-decoration: none;
      transition: var(--transition);
    }

    .footer a:hover {
      text-decoration: underline;
    }

    /* 响应式设计 */
    @media (max-width: 768px) {
      body {
        padding: 15px;
      }

      .header {
        padding: 25px 20px;
      }

      .page-title {
        font-size: 24px;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }

      .article-card {
        padding: 20px;
      }

      .article-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .source-tab {
        padding: 10px 18px;
        font-size: 14px;
      }
    }

    @media (max-width: 480px) {
      .date-info {
        flex-direction: column;
        gap: 10px;
      }

      .article-meta {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }
    }

    /* 动画 */
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .article-card {
      animation: fadeIn 0.5s ease-out;
    }

    /* 滚动条美化 */
    ::-webkit-scrollbar {
      width: 8px;
    }

    ::-webkit-scrollbar-track {
      background: var(--bg-color);
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb {
      background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: linear-gradient(135deg, var(--secondary-color), var(--accent-color));
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- 头部 -->
    <header class="header">
      <div class="site-title">
        <i class="fas fa-mountain"></i>
        <span>鹤野无岸</span>
      </div>
      <h1 class="page-title">AI技术日报</h1>
      <div class="date-info">
        <span><i class="far fa-calendar"></i> ${dateStr}</span>
        <span><i class="far fa-clock"></i> ${timeStr} 更新</span>
        <span><i class="fas fa-wifi"></i> ${totalArticles}篇文章</span>
      </div>
    </header>

    <!-- 统计卡片 -->
    <div class="stats-card">
      <div class="stats-title">
        <i class="fas fa-chart-pie"></i>
        <span>今日数据概览</span>
      </div>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-label">文章总数</div>
          <div class="stat-value">${totalArticles}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">来源数量</div>
          <div class="stat-value">${Object.keys(grouped).length}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">时间范围</div>
          <div class="stat-value">24小时</div>
        </div>
      </div>
    </div>

    <!-- 来源标签 -->
    <div class="source-tabs" id="sourceTabs">
      ${Object.entries(grouped).map(([source, articles], index) => `
        <div class="source-tab ${index === 0 ? 'active' : ''}"
             onclick="filterArticles('${source.replace(/'/g, "\\'")}')"
             data-source="${source}">
          <i class="fas fa-newspaper"></i>
          <span>${source}</span>
          <span class="source-count">${articles.length}</span>
        </div>
      `).join('')}
    </div>

    <!-- 文章列表 -->
    <div class="article-list" id="articleList">
      ${generateArticleCards(grouped)}
    </div>

    <!-- 页脚 -->
    <footer class="footer">
      <p>本日报由 AI 新闻聚合工具自动生成 · 每天上午 8:30 更新</p>
      <p>关注公众号 <strong>鹤野无岸</strong> 获取每日推送</p>
      <p>数据来源：${Object.keys(grouped).join('、')}</p>
      <p style="margin-top: 10px; font-size: 12px; opacity: 0.7;">
        <i class="fas fa-code"></i> 自由风格 · 设计灵感源于山野与科技的交融
      </p>
    </footer>
  </div>

  <script>
    // 文章筛选功能
    function filterArticles(source) {
      // 更新标签状态
      document.querySelectorAll('.source-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.source === source) {
          tab.classList.add('active');
        }
      });

      // 显示/隐藏文章
      document.querySelectorAll('.article-card').forEach(card => {
        if (source === 'all' || card.dataset.source === source) {
          card.style.display = 'block';
          setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, 10);
        } else {
          card.style.opacity = '0';
          card.style.transform = 'translateY(20px)';
          setTimeout(() => {
            card.style.display = 'none';
          }, 300);
        }
      });
    }

    // 平滑滚动
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    // 页面加载动画
    document.addEventListener('DOMContentLoaded', function() {
      const cards = document.querySelectorAll('.article-card');
      cards.forEach((card, index) => {
        card.style.animationDelay = \`\${index * 0.1}s\`;
      });
    });

    // 复制链接功能（可选）
    function copyArticleLink(link) {
      navigator.clipboard.writeText(link).then(() => {
        alert('链接已复制到剪贴板');
      }).catch(err => {
        console.error('复制失败:', err);
      });
    }
  </script>
</body>
</html>
`;
}

/**
 * 生成所有文章卡片
 */
function generateArticleCards(grouped: Record<string, Article[]>): string {
  let cardsHtml = '';

  for (const [source, articles] of Object.entries(grouped)) {
    for (const article of articles) {
      cardsHtml += generateArticleCard(article, source);
    }
  }

  return cardsHtml;
}

/**
 * 生成单个文章卡片
 */
function generateArticleCard(article: Article, source: string): string {
  const dateStr = format(article.pubDate, 'yyyy-MM-dd HH:mm');
  const summary = article.aiSummary || article.description || '';

  // 截断过长的描述
  const maxSummaryLength = 200;
  let displaySummary = summary;
  if (displaySummary.length > maxSummaryLength) {
    displaySummary = displaySummary.substring(0, maxSummaryLength) + '...';
  }

  // 清理摘要中的多余空格
  displaySummary = displaySummary.replace(/\s+/g, ' ').trim();

  // 获取来源图标
  const sourceIcon = getSourceIcon(source);

  return `
    <div class="article-card" data-source="${source}">
      <div class="article-header">
        <a href="${article.link}" target="_blank" class="article-title">
          ${article.title}
        </a>
        <div class="source-badge">
          <i class="${sourceIcon}"></i>
          <span>${source}</span>
        </div>
      </div>

      <div class="article-meta">
        <div class="meta-item">
          <i class="far fa-clock"></i>
          <span>${dateStr}</span>
        </div>
        <div class="meta-item">
          <i class="fas fa-external-link-alt"></i>
          <a href="${article.link}" target="_blank">阅读原文</a>
        </div>
      </div>

      ${summary ? `
      <div class="article-summary">
        <div class="summary-label">
          <i class="fas fa-robot"></i>
          <span>${article.aiSummary ? 'AI摘要' : '内容摘要'}</span>
        </div>
        <div class="summary-text">${displaySummary}</div>
      </div>
      ` : ''}
    </div>
  `;
}

/**
 * 根据来源获取对应的图标
 */
function getSourceIcon(source: string): string {
  const iconMap: Record<string, string> = {
    'Huxiu': 'fas fa-paw',
    'Hacker News': 'fab fa-hacker-news',
    '36Kr': 'fas fa-chart-line',
    'The Verge': 'fas fa-satellite',
    'TechCrunch': 'fas fa-bolt',
    'OpenAI': 'fas fa-microchip',
    'Hugging Face': 'fas fa-face-smile',
    'Anthropic': 'fas fa-shield',
    'DeepSeek': 'fas fa-ship',
    'JiQiZhiXin': 'fas fa-heart',
  };

  return iconMap[source] || 'fas fa-newspaper';
}

/**
 * 生成HTML文件名
 */
export function generateHtmlFilename(): string {
  const now = new Date();
  return `ai-news-${format(now, 'yyyy-MM-dd')}.html`;
}