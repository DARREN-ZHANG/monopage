import ReactMarkdown from 'react-markdown';
import type { Article } from '../../types';
import { getRelativeTime } from '../../utils/date';

interface ArticleCardProps {
  article: Article;
}

export function ArticleCard({ article }: ArticleCardProps) {
  const sourceLabel = article.source === 'openai' ? 'OpenAI' : 'Anthropic';

  return (
    <article className="bg-bg-primary border border-border rounded-lg p-6 hover:bg-bg-secondary transition-colors duration-200">
      <span className="inline-block px-2 py-0.5 text-xs font-medium text-secondary bg-bg-secondary rounded mb-3">
        {sourceLabel}
      </span>

      <h2 className="text-lg font-semibold text-primary mb-1 leading-snug">
        {article.title}
      </h2>

      <p className="text-xs text-tertiary mb-4">
        {getRelativeTime(article.published_at)}
      </p>

      <div className="prose prose-sm prose-gray max-w-none text-secondary leading-relaxed">
        <ReactMarkdown>{article.summary_md}</ReactMarkdown>
      </div>

      <a
        href={article.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 mt-4 text-sm text-secondary hover:text-primary transition-colors"
      >
        阅读原文
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </a>
    </article>
  );
}
