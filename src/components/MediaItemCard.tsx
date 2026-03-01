// src/components/MediaItemCard.tsx

import { MediaItem } from '../types';

interface MediaItemCardProps {
  item: MediaItem;
  isSelected: boolean;
  isDragging: boolean;
  defaultPhotoDuration: number;
  onSelect: (id: string) => void;
  onCaptionChange: (id: string, caption: string) => void;
  onShowCaptionToggle: (id: string) => void;
  onPhotoDurationChange: (id: string, duration: number | undefined) => void;
  onDelete: (id: string) => void;
  onExclude: (id: string) => void;
  onDragHandleMouseDown: (e: React.MouseEvent, id: string) => void;
}

export default function MediaItemCard({
  item,
  isSelected,
  isDragging,
  defaultPhotoDuration,
  onSelect,
  onCaptionChange,
  onShowCaptionToggle,
  onPhotoDurationChange,
  onDelete,
  onExclude,
  onDragHandleMouseDown
}: MediaItemCardProps) {
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getEditedDuration = () => {
    if (item.type === 'image') {
      // For photos, use individual duration or global default
      return item.photoDuration ?? defaultPhotoDuration;
    }
    
    if (item.type !== 'video' || !item.duration) return null;
    
    // If no clips, entire video is included
    if (!item.clips || item.clips.length === 0) {
      return item.duration;
    }
    
    // Sum up clip durations
    return item.clips.reduce((sum, clip) => sum + (clip.end - clip.start), 0);
  };

  const editedDuration = getEditedDuration();

  return (
    <div
      onClick={() => onSelect(item.id)}
      className={`
        bg-gray-700 rounded-lg p-2 mb-2 transition-all relative
        ${isSelected ? 'ring-2 ring-blue-500' : 'hover:bg-gray-600'}
        ${isDragging ? 'opacity-30' : ''}
      `}
    >
      {/* Drag Handle */}
      <div
        onMouseDown={(e) => onDragHandleMouseDown(e, item.id)}
        className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-10 bg-gray-600 hover:bg-blue-600 rounded cursor-grab active:cursor-grabbing flex items-center justify-center transition-colors z-20"
        title="Drag to reorder"
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-gray-300 pointer-events-none">
          <circle cx="6" cy="4" r="1.5" fill="currentColor"/>
          <circle cx="10" cy="4" r="1.5" fill="currentColor"/>
          <circle cx="6" cy="8" r="1.5" fill="currentColor"/>
          <circle cx="10" cy="8" r="1.5" fill="currentColor"/>
          <circle cx="6" cy="12" r="1.5" fill="currentColor"/>
          <circle cx="10" cy="12" r="1.5" fill="currentColor"/>
        </svg>
      </div>

      {/* 3 Column Layout */}
      <div className="grid grid-cols-3 gap-2 pl-8 pr-1">
        {/* Column 1: Thumbnail, Filename, Duration */}
        <div className="flex gap-2 items-center">
          <div className="w-16 h-9 bg-gray-800 rounded flex-shrink-0 overflow-hidden flex items-center justify-center">
            {item.thumbnail ? (
              <img src={item.thumbnail} alt={item.filename} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {/* Loading spinner */}
                <div className="relative w-6 h-6">
                  <div className="absolute inset-0 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate" title={item.filename}>
              {item.filename}
            </div>
            {item.type === 'video' && (
              <div className="flex items-center gap-1.5 text-[10px]">
                {item.duration && (
                  <span className="text-blue-400 font-semibold">
                    {formatDuration(item.duration)}
                  </span>
                )}
                {editedDuration !== null && editedDuration !== item.duration && (
                  <>
                    <span className="text-gray-600">→</span>
                    <span className="text-green-400 font-semibold">
                      {formatDuration(editedDuration)}
                    </span>
                  </>
                )}
                {!item.duration && (
                  <span className="text-gray-500">Loading...</span>
                )}
              </div>
            )}
            {item.type === 'image' && editedDuration !== null && (
              <div className="text-[10px] text-green-400 font-semibold">
                {formatDuration(editedDuration)}
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Checkbox and Caption */}
        <div className="flex flex-col justify-center gap-1">
          <div className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={item.showCaption}
              onChange={(e) => {
                e.stopPropagation();
                onShowCaptionToggle(item.id);
              }}
              className="w-3 h-3"
            />
            <label className="text-[10px] text-gray-400">Show</label>
          </div>
          <input
            type="text"
            value={item.caption}
            onChange={(e) => {
              e.stopPropagation();
              onCaptionChange(item.id, e.target.value);
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              // Prevent spacebar and other keys from triggering video controls
              e.stopPropagation();
            }}
            placeholder="Caption..."
            className="w-full px-1.5 py-0.5 text-[10px] bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
          />
          {item.type === 'image' && (
            <input
              type="number"
              value={item.photoDuration ?? ''}
              onChange={(e) => {
                e.stopPropagation();
                const value = e.target.value;
                onPhotoDurationChange(item.id, value === '' ? undefined : Math.max(0.1, Number(value)));
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={`${defaultPhotoDuration}s (default)`}
              min="0.1"
              step="0.5"
              className="w-full px-1.5 py-0.5 text-[10px] bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
            />
          )}
        </div>

        {/* Column 3: Type Indicator, Exclude, and Delete */}
        <div className="flex items-center justify-end gap-1">
          {/* Clips indicator for videos */}
          {item.type === 'video' && item.clips && item.clips.length > 0 && (
            <span className="text-[10px] px-2 py-1 rounded bg-green-600 text-white font-semibold" title={`${item.clips.length} clip${item.clips.length !== 1 ? 's' : ''} selected`}>
              ✓ {item.clips.length}
            </span>
          )}
          <span className={`text-[10px] px-2 py-1 rounded ${
            item.type === 'video' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
          }`}>
            {item.type === 'video' ? 'VID' : 'IMG'}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExclude(item.id);
            }}
            className="w-5 h-5 bg-orange-600 hover:bg-orange-700 rounded flex items-center justify-center text-white text-xs font-bold transition-colors cursor-pointer"
            title="Exclude (move to Excluded folder)"
          >
            ⊗
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            className="w-5 h-5 bg-red-600 hover:bg-red-700 rounded flex items-center justify-center text-white text-sm font-bold transition-colors cursor-pointer"
            title="Delete from list"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}