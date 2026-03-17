import { useState, useRef, useEffect } from 'react';
import { formatDate, formatDateISO, getLastNDays, isToday } from '../../utils/date';

interface DateSelectorProps {
  value: string;
  onChange: (date: string) => void;
  maxDays?: number;
}

export function DateSelector({ value, onChange, maxDays = 7 }: DateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const dates = getLastNDays(maxDays);
  const selectedDate = dates.find((d) => formatDateISO(d) === value) || dates[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (date: Date) => {
    onChange(formatDateISO(date));
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-3 py-1.5 text-sm text-secondary hover:text-primary transition-colors"
      >
        <span>{formatDate(selectedDate)}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 py-1 bg-white border border-border rounded-lg shadow-lg min-w-[140px] z-20">
          {dates.map((date) => {
            const isoDate = formatDateISO(date);
            const isSelected = isoDate === value;
            const today = isToday(date);

            return (
              <button
                key={isoDate}
                onClick={() => handleSelect(date)}
                className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                  isSelected
                    ? 'bg-bg-secondary text-primary font-medium'
                    : 'text-secondary hover:bg-bg-secondary hover:text-primary'
                }`}
              >
                {today ? '今天' : formatDate(date)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
