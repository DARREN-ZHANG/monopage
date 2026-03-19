import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../api/client';
import type { RefreshTaskProgress, RefreshResponse } from '../types';

interface UseRefreshStatusOptions {
  onCompleted?: (result: RefreshResponse['data']) => void;
  onFailed?: (error: string) => void;
}

interface UseRefreshStatusReturn {
  isRefreshing: boolean;
  progress: RefreshTaskProgress | null;
  startRefresh: () => Promise<void>;
}

const POLL_INTERVAL = 5000; // 5 秒
const INITIAL_POLL_DELAY = 15000; // 15 秒后开始轮询
const MAX_RETRIES = 3;

export function useRefreshStatus(options?: UseRefreshStatusOptions): UseRefreshStatusReturn {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [progress, setProgress] = useState<RefreshTaskProgress | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCountRef = useRef(0);
  const taskIdRef = useRef<string | null>(null);
  const isRefreshingRef = useRef(false); // 同步锁，防止 StrictMode 双重调用

  // 清理轮询
  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // 处理任务完成
  const handleCompleted = useCallback(
    (result: RefreshResponse['data']) => {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      setProgress(null);
      clearPolling();

      toast.success(`刷新完成，新增 ${result.articles_found} 篇文章`, {
        duration: 3000,
      });

      options?.onCompleted?.(result);
    },
    [clearPolling, options]
  );

  // 处理任务失败
  const handleFailed = useCallback(
    (error: string) => {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      setProgress(null);
      clearPolling();

      toast.error(`刷新失败: ${error}`, {
        duration: 3000,
      });

      options?.onFailed?.(error);
    },
    [clearPolling, options]
  );

  // 轮询任务状态
  const pollStatus = useCallback(async () => {
    if (!taskIdRef.current) return;

    try {
      const response = await api.getRefreshStatus(taskIdRef.current);
      const { status, progress: taskProgress, result, error } = response.data;

      // 重置重试计数
      retryCountRef.current = 0;

      // 更新进度
      if (taskProgress) {
        setProgress(taskProgress);
      }

      // 处理不同状态
      switch (status) {
        case 'completed':
          if (result) {
            handleCompleted(result);
          }
          break;
        case 'failed':
          handleFailed(error || '未知错误');
          break;
        case 'running':
        case 'pending':
          // 继续轮询
          break;
      }
    } catch (err) {
      retryCountRef.current += 1;

      if (retryCountRef.current >= MAX_RETRIES) {
        handleFailed(err instanceof Error ? err.message : '查询状态失败');
      }
      // 否则继续重试
    }
  }, [handleCompleted, handleFailed]);

  // 开始刷新
  const startRefresh = useCallback(async () => {
    // 使用 ref 进行同步检查，防止 StrictMode 双重调用
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;

    setIsRefreshing(true);
    setProgress(null);
    retryCountRef.current = 0;

    try {
      // 触发刷新任务
      const response = await api.triggerRefresh();
      taskIdRef.current = response.data.taskId;

      // 延迟 15 秒后开始轮询
      setTimeout(() => {
        pollingRef.current = setInterval(pollStatus, POLL_INTERVAL);
        pollStatus();
      }, INITIAL_POLL_DELAY);
    } catch (err) {
      handleFailed(err instanceof Error ? err.message : '触发刷新失败');
    }
  }, [pollStatus, handleFailed]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, [clearPolling]);

  // 页面关闭时清理
  useEffect(() => {
    const handleBeforeUnload = () => {
      clearPolling();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [clearPolling]);

  return {
    isRefreshing,
    progress,
    startRefresh,
  };
}
