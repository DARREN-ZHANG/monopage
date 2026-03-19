import { useState, useCallback } from 'react';
import { Toaster } from 'sonner';
import { useAuth } from './hooks/useAuth';
import { useArticles } from './hooks/useArticles';
import { useRefreshStatus } from './hooks/useRefreshStatus';
import { LoadingScreen } from './components/Layout/LoadingScreen';
import { Header } from './components/Layout/Header';
import { LoginPage } from './components/Auth/LoginPage';
import { ArticleList } from './components/Articles/ArticleList';
import { EmptyState } from './components/Articles/EmptyState';
import { ErrorState } from './components/Articles/ErrorState';
import { FilterBar } from './components/Articles/FilterBar';
import { ALL_SOURCES, SourceType } from './types';

function App() {
  const { user, isLoading: authLoading, login, logout, error: authError } = useAuth();
  const [selectedSources, setSelectedSources] = useState<SourceType[]>(ALL_SOURCES);

  const {
    data: articlesData,
    isLoading: articlesLoading,
    error: articlesError,
    refetch,
  } = useArticles({
    days: 7,
    pageSize: 50,
    sources: selectedSources.length > 0 && selectedSources.length < ALL_SOURCES.length ? selectedSources : undefined,
    // 全不选时不请求
    enabled: !!user && selectedSources.length > 0,
  });

  // 刷新状态管理
  const { isRefreshing, progress, startRefresh } = useRefreshStatus({
    onCompleted: () => {
      refetch();
    },
  });

  const handleRefresh = useCallback(async () => {
    await startRefresh();
  }, [startRefresh]);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  // 条件返回必须在所有 hooks 之后
  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginPage onLogin={login} isLoading={authLoading} error={authError} />;
  }

  const articles = articlesData?.data?.articles || [];

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header username={user} onLogout={handleLogout} />

      <main className="max-w-content mx-auto px-4 py-8">
        <FilterBar
          selectedSources={selectedSources}
          onSourcesChange={setSelectedSources}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          progress={progress}
        />

        {/* 全不选时的空状态 */}
        {!articlesLoading && !articlesError && selectedSources.length === 0 && (
          <EmptyState
            message="请选择至少一个数据源"
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        )}

        {/* 加载中 */}
        {selectedSources.length > 0 && articlesLoading && (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-bg-primary border border-border rounded-lg p-6">
                <div className="h-4 bg-gray-200 rounded w-16 mb-4 animate-pulse"></div>
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
                <div className="h-3 bg-gray-200 rounded w-24 mb-4 animate-pulse"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-full animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-full animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3 animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 错误状态 */}
        {selectedSources.length > 0 && !articlesLoading && articlesError && (
          <ErrorState
            message={articlesError.message || '加载失败'}
            onRetry={() => refetch()}
          />
        )}

        {/* 无文章 */}
        {selectedSources.length > 0 && !articlesLoading && !articlesError && articles.length === 0 && (
          <EmptyState
            message="暂无文章"
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        )}

        {/* 文章列表 */}
        {selectedSources.length > 0 && !articlesLoading && !articlesError && articles.length > 0 && (
          <ArticleList articles={articles} />
        )}
      </main>

      {/* Toast 通知 */}
      <Toaster position="top-center" richColors duration={3000} closeButton />
    </div>
  );
}

export default App;
