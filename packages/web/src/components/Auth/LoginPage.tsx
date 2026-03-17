import { LoginForm } from './LoginForm';

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  error: string | null;
}

export function LoginPage({ onLogin, isLoading, error }: LoginPageProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-primary px-4">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-primary mb-2">Monopage</h1>
        <p className="text-secondary text-sm">每日清晨，一览 AI 世界</p>
      </div>

      <LoginForm onSubmit={onLogin} isLoading={isLoading} error={error} />
    </div>
  );
}
