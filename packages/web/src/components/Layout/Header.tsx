import { DateSelector } from '../Articles/DateSelector';

interface HeaderProps {
  username: string;
  currentDate: string;
  onDateChange: (date: string) => void;
  onLogout: () => void;
}

export function Header({ username, currentDate, onDateChange, onLogout }: HeaderProps) {
  return (
    <header className="sticky top-0 bg-bg-primary border-b border-border z-10">
      <div className="max-w-content mx-auto px-4 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-primary">Monopage</h1>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-secondary">
            <span>{username}</span>
            <span className="text-tertiary">·</span>
            <button
              onClick={onLogout}
              className="text-secondary hover:text-primary transition-colors"
            >
              登出
            </button>
          </div>

          <DateSelector value={currentDate} onChange={onDateChange} />
        </div>
      </div>
    </header>
  );
}
