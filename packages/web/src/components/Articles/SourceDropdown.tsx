import { useEffect, useRef } from 'react';
import { SourceType, SOURCE_LABELS, ALL_SOURCES } from '../../types';

interface SourceDropdownProps {
  isOpen: boolean;
  selectedSources: SourceType[];
  onToggle: (source: SourceType) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onClose: () => void;
}

export function SourceDropdown({
  isOpen,
  selectedSources,
  onToggle,
  onSelectAll,
  onClear,
  onClose,
}: SourceDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const isAllSelected = selectedSources.length === ALL_SOURCES.length;
  const isNoneSelected = selectedSources.length === 0;

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20"
    >
      <div className="p-2">
        {ALL_SOURCES.map((source) => {
          const isSelected = selectedSources.includes(source);
          return (
            <label
              key={source}
              className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(source)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{SOURCE_LABELS[source]}</span>
            </label>
          );
        })}
      </div>

      <div className="border-t border-gray-200 p-2 flex justify-between">
        <button
          onClick={onClear}
          disabled={isNoneSelected}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 disabled:text-gray-300 disabled:cursor-not-allowed"
        >
          清空选择
        </button>
        <button
          onClick={onSelectAll}
          disabled={isAllSelected}
          className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 disabled:text-blue-300 disabled:cursor-not-allowed"
        >
          全选
        </button>
      </div>
    </div>
  );
}
