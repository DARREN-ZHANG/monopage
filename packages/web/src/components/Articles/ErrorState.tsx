interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = '加载失败', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-secondary mb-2">{message}</p>
      <p className="text-tertiary text-sm mb-4">请稍后重试</p>
      {onRetry && (
        <button
          onClick={() => onRetry()}
          className="text-sm text-secondary hover:text-primary transition-colors"
        >
          重试 →
        </button>
      )}
    </div>
  );
}
