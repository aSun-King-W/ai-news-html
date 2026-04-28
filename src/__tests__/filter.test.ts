import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { filterRecentArticles, deduplicateArticles, filterAIArticles } from '../processors/filter';
import type { Article } from '../types/article';

function createArticle(overrides: Partial<Article> = {}): Article {
  return {
    title: 'Test Article',
    link: 'https://example.com/test',
    pubDate: new Date(),
    source: 'TechCrunch' as const,
    description: 'Test description',
    ...overrides,
  };
}

describe('filterRecentArticles', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-28T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns articles within specified hours', () => {
    const articles = [
      createArticle({ pubDate: new Date('2026-04-28T10:00:00Z') }),
      createArticle({ pubDate: new Date('2026-04-28T07:00:00Z') }),
    ];

    const result = filterRecentArticles(articles, 3);

    expect(result).toHaveLength(1);
  });

  it('returns all articles when all are recent', () => {
    const articles = [
      createArticle({ pubDate: new Date('2026-04-28T11:00:00Z') }),
      createArticle({ pubDate: new Date('2026-04-28T11:30:00Z') }),
    ];

    const result = filterRecentArticles(articles, 5);

    expect(result).toHaveLength(2);
  });

  it('returns empty array when no articles are recent', () => {
    const articles = [
      createArticle({ pubDate: new Date('2026-04-27T12:00:00Z') }),
    ];

    const result = filterRecentArticles(articles, 1);

    expect(result).toHaveLength(0);
  });

  it('handles empty input', () => {
    expect(filterRecentArticles([], 24)).toEqual([]);
  });

  it('includes articles just after the cutoff boundary', () => {
    const articles = [
      createArticle({ pubDate: new Date('2026-04-28T09:00:01Z') }),
    ];

    const result = filterRecentArticles(articles, 3);

    expect(result).toHaveLength(1);
  });

  it('excludes articles at the cutoff boundary', () => {
    const articles = [
      createArticle({ pubDate: new Date('2026-04-28T09:00:00Z') }),
    ];

    const result = filterRecentArticles(articles, 3);

    expect(result).toHaveLength(0);
  });
});

describe('deduplicateArticles', () => {
  it('removes articles with duplicate links', () => {
    const articles = [
      createArticle({ link: 'https://example.com/a' }),
      createArticle({ link: 'https://example.com/b' }),
      createArticle({ link: 'https://example.com/a' }),
    ];

    const result = deduplicateArticles(articles);

    expect(result).toHaveLength(2);
    expect(result.map(a => a.link)).toEqual([
      'https://example.com/a',
      'https://example.com/b',
    ]);
  });

  it('keeps first occurrence of duplicate link', () => {
    const articles = [
      createArticle({ link: 'https://example.com/a', title: 'First' }),
      createArticle({ link: 'https://example.com/a', title: 'Second' }),
    ];

    const result = deduplicateArticles(articles);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('First');
  });

  it('is case-insensitive when comparing links', () => {
    const articles = [
      createArticle({ link: 'https://Example.com/A' }),
      createArticle({ link: 'https://example.com/a' }),
    ];

    const result = deduplicateArticles(articles);

    expect(result).toHaveLength(1);
  });

  it('trims whitespace from links', () => {
    const articles = [
      createArticle({ link: '  https://example.com/a  ' }),
      createArticle({ link: 'https://example.com/a' }),
    ];

    const result = deduplicateArticles(articles);

    expect(result).toHaveLength(1);
  });

  it('handles empty input', () => {
    expect(deduplicateArticles([])).toEqual([]);
  });

  it('handles single article', () => {
    const articles = [createArticle()];

    expect(deduplicateArticles(articles)).toEqual(articles);
  });
});

describe('filterAIArticles', () => {
  it('filters articles with AI-related Chinese title keywords', () => {
    const articles = [
      createArticle({ title: '人工智能的最新进展' }),
      createArticle({ title: '某个完全无关的新闻' }),
    ];

    const result = filterAIArticles(articles);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('人工智能的最新进展');
  });

  it('filters articles with AI-related English title keywords', () => {
    const articles = [
      createArticle({ title: 'GPT-5: The Next Generation' }),
      createArticle({ title: 'Weather forecast for today' }),
    ];

    const result = filterAIArticles(articles);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('GPT-5: The Next Generation');
  });

  it('matches keywords in description', () => {
    const articles = [
      createArticle({ title: 'Some News', description: 'This article discusses large language models and their impact.' }),
      createArticle({ title: 'Other News', description: 'Local sports scores and highlights.' }),
    ];

    const result = filterAIArticles(articles);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Some News');
  });

  it('is case-insensitive in English keywords', () => {
    const articles = [
      createArticle({ title: 'The Rise of ARTIFICIAL INTELLIGENCE' }),
    ];

    const result = filterAIArticles(articles);

    expect(result).toHaveLength(1);
  });

  it('returns empty array when no articles match', () => {
    const articles = [
      createArticle({ title: 'Local News', description: 'Weather and traffic updates.' }),
      createArticle({ title: 'Sports', description: 'Game results and highlights.' }),
    ];

    const result = filterAIArticles(articles);

    expect(result).toHaveLength(0);
  });

  it('handles empty input', () => {
    expect(filterAIArticles([])).toEqual([]);
  });

  it('handles undefined description gracefully', () => {
    const articles = [
      createArticle({ title: 'AI in Healthcare', description: undefined }),
    ];

    const result = filterAIArticles(articles);

    expect(result).toHaveLength(1);
  });

  it('matches Claude keyword', () => {
    const articles = [
      createArticle({ title: 'Claude 4 announced by Anthropic' }),
    ];

    const result = filterAIArticles(articles);

    expect(result).toHaveLength(1);
  });

  it('matches autonomous keyword', () => {
    const articles = [
      createArticle({ title: '', description: 'Autonomous vehicles are the future' }),
    ];

    const result = filterAIArticles(articles);

    expect(result).toHaveLength(1);
  });
});
