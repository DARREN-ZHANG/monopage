interface EmptyStateProps {
  message?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function EmptyState({
  message = '暂无文章',
  onRefresh,
  isRefreshing = false,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 text-4xl">📭</div>
      <p className="text-secondary text-lg mb-2">{message}</p>
      <p className="text-tertiary text-sm mb-6">
        还没有抓取到新闻，点击刷新尝试获取最新内容
      </p>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRefreshing ? '刷新中...' : '刷新数据'}
        </button>
      )}
    </div>
  );
}
