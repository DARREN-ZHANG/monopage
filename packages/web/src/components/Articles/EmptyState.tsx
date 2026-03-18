interface EmptyStateProps {
  message?: string;
  onRefresh?: () => void;
  onGoToToday?: () => void;
  isRefreshing?: boolean;
  isToday?: boolean;
}

export function EmptyState({
  message = '暂无文章',
  onRefresh,
  onGoToToday,
  isRefreshing = false,
  isToday = true,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 text-4xl">📭</div>
      <p className="text-secondary text-lg mb-2">{message}</p>
      <p className="text-tertiary text-sm mb-6">
        {isToday ? '今天还没有抓取到新闻，点击刷新尝试获取最新内容' : '该日期还没有抓取到新闻'}
      </p>
      <div className="flex gap-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRefreshing ? '刷新中...' : '刷新数据'}
          </button>
        )}
        {onGoToToday && !isToday && (
          <button
            onClick={onGoToToday}
            className="px-4 py-2 border border-border text-secondary rounded-lg hover:bg-bg-secondary transition-colors"
          >
            查看今天
          </button>
        )}
      </div>
    </div>
  );
}
