interface EmptyStateProps {
  message?: string;
  onAction?: () => void;
  actionLabel?: string;
}

export function EmptyState({
  message = '暂无文章',
  onAction,
  actionLabel = '查看今天',
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-secondary mb-2">{message}</p>
      <p className="text-tertiary text-sm mb-4">该日期还没有抓取到新闻</p>
      {onAction && (
        <button
          onClick={() => onAction()}
          className="text-sm text-secondary hover:text-primary transition-colors"
        >
          {actionLabel} →
        </button>
      )}
    </div>
  );
}
