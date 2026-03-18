import { useState, useCallback } from 'react';
import { useAuth } from './hooks/useAuth';
import { useArticles } from './hooks/useArticles';
import { api } from './api/client';
import { LoadingScreen } from './components/Layout/LoadingScreen';
import { Header } from './components/Layout/Header';
import { LoginPage } from './components/Auth/LoginPage';
import { ArticleList } from './components/Articles/ArticleList';
import { EmptyState } from './components/Articles/EmptyState';
import { ErrorState } from './components/Articles/ErrorState';

function App() {
  const { user, isLoading: authLoading, login, logout, error: authError } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data: articlesData,
    isLoading: articlesLoading,
    error: articlesError,
    refetch,
  } = useArticles({
    days: 7,
    pageSize: 50,
    enabled: !!user,
  });

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await api.refresh();
      refetch();
    } catch (error) {
      console.error('刷新失败:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

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
        {articlesLoading && (
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

        {!articlesLoading && articlesError && (
          <ErrorState
            message={articlesError.message || '加载失败'}
            onRetry={() => refetch()}
          />
        )}

        {!articlesLoading && !articlesError && articles.length === 0 && (
          <EmptyState
            message="暂无文章"
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        )}

        {!articlesLoading && !articlesError && articles.length > 0 && (
          <ArticleList articles={articles} />
        )}
      </main>
    </div>
  );
}

export default App;
