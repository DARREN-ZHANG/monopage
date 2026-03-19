import { useState } from 'react';
import { SourceType, ALL_SOURCES, RefreshTaskProgress } from '../../types';
import { SourceDropdown } from './SourceDropdown';
import { SelectedTags } from './SelectedTags';

interface FilterBarProps {
  selectedSources: SourceType[];
  onSourcesChange: (sources: SourceType[]) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  progress?: RefreshTaskProgress | null;
}

export function FilterBar({
  selectedSources,
  onSourcesChange,
  onRefresh,
  isRefreshing,
  progress,
}: FilterBarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const toggleSource = (source: SourceType) => {
    if (selectedSources.includes(source)) {
      onSourcesChange(selectedSources.filter((s) => s !== source));
    } else {
      onSourcesChange([...selectedSources, source]);
    }
  };

  const selectAll = () => {
    onSourcesChange(ALL_SOURCES);
  };

  const clearSelection = () => {
    onSourcesChange([]);
  };

  const removeSource = (source: SourceType) => {
    onSourcesChange(selectedSources.filter((s) => s !== source));
  };

  return (
    <div className="flex items-center justify-between gap-4 mb-6">
      <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1">
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <span>选择源</span>
            <svg
              className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <SourceDropdown
            isOpen={isDropdownOpen}
            selectedSources={selectedSources}
            onToggle={toggleSource}
            onSelectAll={selectAll}
            onClear={clearSelection}
            onClose={() => setIsDropdownOpen(false)}
          />
        </div>

        <SelectedTags sources={selectedSources} onRemove={removeSource} />
      </div>

      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 whitespace-nowrap"
        title={isRefreshing && progress ? `正在处理 ${progress.currentSource}...` : undefined}
      >
        <svg
          className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span>
          {isRefreshing && progress
            ? `刷新中 (${progress.current}/${progress.total})`
            : '刷新'}
        </span>
      </button>
    </div>
  );
}
