import { SourceType, SOURCE_LABELS, ALL_SOURCES } from '../../types';

interface FilterBarProps {
  selectedSources: SourceType[];
  onSourcesChange: (sources: SourceType[]) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function FilterBar({
  selectedSources,
  onSourcesChange,
  onRefresh,
  isRefreshing,
}: FilterBarProps) {
  const toggleSource = (source: SourceType) => {
    if (selectedSources.includes(source)) {
      // 至少保留一个选中
      if (selectedSources.length > 1) {
        onSourcesChange(selectedSources.filter(s => s !== source));
      }
    } else {
      onSourcesChange([...selectedSources, source]);
    }
  };

  const selectAll = () => {
    onSourcesChange(ALL_SOURCES);
  };

  const isAllSelected = selectedSources.length === ALL_SOURCES.length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div className="flex flex-wrap items-center gap-2">
        {ALL_SOURCES.map(source => {
          const isSelected = selectedSources.includes(source);
          return (
            <button
              key={source}
              onClick={() => toggleSource(source)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : 'bg-transparent border border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
            >
              {SOURCE_LABELS[source]}
            </button>
          );
        })}
        {!isAllSelected && (
          <button
            onClick={selectAll}
            className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700"
          >
            全选
          </button>
        )}
      </div>

      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        <span>刷新</span>
      </button>
    </div>
  );
}
