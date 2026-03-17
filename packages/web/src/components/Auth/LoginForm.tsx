import { useState, FormEvent } from 'react';

interface LoginFormProps {
  onSubmit: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  error: string | null;
}

export function LoginForm({ onSubmit, isLoading, error }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!username.trim() || !password.trim()) {
      setSubmitError('请输入用户名和密码');
      return;
    }

    const result = await onSubmit(username.trim(), password);
    if (!result.success) {
      setSubmitError(result.error || '登录失败');
    }
  };

  const displayError = submitError || error;

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="用户名"
          disabled={isLoading}
          className="w-full px-4 py-3 border border-border rounded-lg text-primary placeholder:text-tertiary focus:outline-none focus:border-secondary transition-colors disabled:opacity-50"
        />
      </div>

      <div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="密码"
          disabled={isLoading}
          className="w-full px-4 py-3 border border-border rounded-lg text-primary placeholder:text-tertiary focus:outline-none focus:border-secondary transition-colors disabled:opacity-50"
        />
      </div>

      {displayError && (
        <p className="text-red-500 text-sm text-center">{displayError}</p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? '登录中...' : '登录 →'}
      </button>
    </form>
  );
}
