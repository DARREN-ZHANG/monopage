import { SourceType, SOURCE_LABELS } from '../../types';

interface SelectedTagsProps {
  sources: SourceType[];
  onRemove: (source: SourceType) => void;
}

export function SelectedTags({ sources, onRemove }: SelectedTagsProps) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {sources.map((source) => (
        <span
          key={source}
          className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-blue-100 text-blue-800 rounded-full"
        >
          {SOURCE_LABELS[source]}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(source);
            }}
            className="ml-1 text-blue-600 hover:text-blue-800"
            aria-label={`移除 ${SOURCE_LABELS[source]}`}
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </span>
      ))}
    </div>
  );
}
