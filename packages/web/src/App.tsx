import { useState, useCallback } from 'react';
import { useAuth } from './hooks/useAuth';
import { useArticles } from './hooks/useArticles';
import { formatDateISO } from './utils/date';
import { LoadingScreen } from './components/Layout/LoadingScreen';
import { Header } from './components/Layout/Header';
import { LoginPage } from './components/Auth/LoginPage';
import { ArticleList } from './components/Articles/ArticleList';
import { EmptyState } from './components/Articles/EmptyState';
import { ErrorState } from './components/Articles/ErrorState';

function App() {
  const { user, isLoading: authLoading, login, logout, error: authError } = useAuth();
  const [date, setDate] = useState(formatDateISO(new Date()));

  const {
    data: articlesData,
    isLoading: articlesLoading,
    error: articlesError,
    refetch,
  } = useArticles({
    date,
    days: 7,
    enabled: !!user,
  });

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginPage onLogin={login} isLoading={authLoading} error={authError} />;
  }

  const articles = articlesData?.data.articles || [];
  const handleDateChange = useCallback((newDate: string) => {
    setDate(newDate);
  }, []);

  const handleGoToToday = useCallback(() => {
    setDate(formatDateISO(new Date()));
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header
        username={user}
        currentDate={date}
        onDateChange={handleDateChange}
        onLogout={logout}
      />

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
            onAction={handleGoToToday}
            actionLabel="查看今天"
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
