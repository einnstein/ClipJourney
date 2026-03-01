// src/components/MediaListPanel.tsx

import { useState, useRef, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { MediaItem } from '../types';
import MediaItemCard from './MediaItemCard';

interface MediaListPanelProps {
  mediaItems: MediaItem[];
  selectedItemId: string | null;
  defaultPhotoDuration: number;
  isPreviewMode: boolean;
  onMediaItemsChange: (items: MediaItem[]) => void;
  onSelectItem: (id: string | null) => void;
}

export default function MediaListPanel({
  mediaItems,
  selectedItemId,
  defaultPhotoDuration,
  isPreviewMode,
  onMediaItemsChange,
  onSelectItem
}: MediaListPanelProps) {
  const [sortBy, setSortBy] = useState<'order' | 'date'>('order');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const sortedItems = [...mediaItems].sort((a, b) => {
    if (sortBy === 'date') {
      return b.dateCreated.getTime() - a.dateCreated.getTime();
    }
    return a.order - b.order;
  });

  const handleAddFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'Media',
          extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
        }]
      });

      if (!selected) return;

      const filePaths = Array.isArray(selected) ? selected : [selected];
      
      // First pass: Add files immediately without thumbnails/duration
      const quickItems: MediaItem[] = filePaths.map((path, index) => {
        const filename = path.split('\\').pop() || path.split('/').pop() || path;
        const extension = filename.split('.').pop()?.toLowerCase() || '';
        
        const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv'];
        const isVideo = videoExtensions.includes(extension);

        return {
          id: `${Date.now()}_${index}`,
          filename: filename,
          filepath: path,
          type: isVideo ? 'video' : 'image',
          duration: undefined,
          thumbnail: undefined,
          dateCreated: new Date(),
          caption: '',
          showCaption: true,
          order: mediaItems.length + index
        };
      });

      // Add items immediately so UI is responsive
      const allItems = [...mediaItems, ...quickItems];
      onMediaItemsChange(allItems);

      // Second pass: Generate thumbnails and duration in background
      for (let index = 0; index < quickItems.length; index++) {
        const item = quickItems[index];
        const path = filePaths[index];

        if (item.type === 'video') {
          try {
            const [duration, thumbnail] = await Promise.all([
              invoke<number>('get_video_duration', { path }),
              invoke<string>('generate_thumbnail', { videoPath: path })
            ]);
            
            item.duration = duration;
            item.thumbnail = thumbnail;
          } catch (error) {
            console.error('Error getting video info for', item.filename, error);
          }
        } else {
          try {
            item.thumbnail = await invoke<string>('read_image_as_base64', { imagePath: path });
          } catch (error) {
            console.error('Error reading image', item.filename, error);
          }
        }

        // Update the full list with the updated item
        const updatedItems = allItems.map(existingItem => 
          existingItem.id === item.id ? { ...item } : existingItem
        );
        onMediaItemsChange(updatedItems);
      }
    } catch (error) {
      console.error('Error selecting files:', error);
    }
  };

  const handleDeleteItem = (id: string) => {
    const items = mediaItems.filter(item => item.id !== id);
    items.forEach((item, index) => {
      item.order = index;
    });
    onMediaItemsChange(items);
    
    if (selectedItemId === id) {
      onSelectItem(null);
    }
  };

  const handleExcludeItem = async (id: string) => {
    const item = mediaItems.find(i => i.id === id);
    if (!item) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('exclude_file', { filePath: item.filepath });
      
      // Remove from list after successful move
      const items = mediaItems.filter(i => i.id !== id);
      items.forEach((item, index) => {
        item.order = index;
      });
      onMediaItemsChange(items);
      
      if (selectedItemId === id) {
        onSelectItem(null);
      }
    } catch (error) {
      console.error('Error excluding file:', error);
      alert(`Failed to exclude file: ${error}`);
    }
  };

  const handleDragHandleMouseDown = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingId(id);
  };

  const handleCaptionChange = (id: string, caption: string) => {
    const items = mediaItems.map(item =>
      item.id === id ? { ...item, caption } : item
    );
    onMediaItemsChange(items);
  };

  const handleShowCaptionToggle = (id: string) => {
    const items = mediaItems.map(item =>
      item.id === id ? { ...item, showCaption: !item.showCaption } : item
    );
    onMediaItemsChange(items);
  };

  const handlePhotoDurationChange = (id: string, duration: number | undefined) => {
    const items = mediaItems.map(item =>
      item.id === id ? { ...item, photoDuration: duration } : item
    );
    onMediaItemsChange(items);
  };

  useEffect(() => {
    if (!draggingId) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Find which item we're hovering over based on mouse position
      let targetIndex = -1;
      let minDistance = Infinity;

      sortedItems.forEach((item, index) => {
        const element = itemRefs.current.get(item.id);
        if (!element) return;

        const rect = element.getBoundingClientRect();
        const itemCenterY = rect.top + rect.height / 2;
        const distance = Math.abs(e.clientY - itemCenterY);

        if (distance < minDistance) {
          minDistance = distance;
          targetIndex = index;
        }
      });

      setHoverIndex(targetIndex);
    };

    const handleMouseUp = () => {
      if (hoverIndex !== null && hoverIndex !== -1) {
        const draggedIndex = sortedItems.findIndex(item => item.id === draggingId);
        
        if (draggedIndex !== -1 && draggedIndex !== hoverIndex) {
          const items = [...sortedItems];
          const [draggedItem] = items.splice(draggedIndex, 1);
          items.splice(hoverIndex, 0, draggedItem);

          items.forEach((item, idx) => {
            item.order = idx;
          });

          onMediaItemsChange(items);
        }
      }
      
      setDraggingId(null);
      setHoverIndex(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingId, hoverIndex, sortedItems, onMediaItemsChange]);

  // Auto-scroll to selected item (for preview mode)
  useEffect(() => {
    if (selectedItemId) {
      const element = itemRefs.current.get(selectedItemId);
      if (element && containerRef.current) {
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }
  }, [selectedItemId]);

  return (
    <div className="w-[30%] bg-gray-800 border-r border-gray-700 flex flex-col relative">
      {/* Preview Mode Overlay */}
      {isPreviewMode && (
        <div className="absolute inset-0 bg-black bg-opacity-60 z-50 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-white text-lg font-semibold mb-2">Preview in Progress</div>
          <div className="text-gray-300 text-sm">Stop preview to edit media</div>
        </div>
      )}
      
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <span className="font-semibold text-sm">Media List</span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'order' | 'date')}
          className="text-xs px-2 py-1 bg-gray-700 border border-gray-600 rounded"
        >
          <option value="order">Sort: Manual</option>
          <option value="date">Sort: Date</option>
        </select>
      </div>

      <div className="p-3 border-b border-gray-700">
        <button
          onClick={handleAddFiles}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors"
        >
          + Add Files
        </button>
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto p-3">
        {sortedItems.length === 0 ? (
          <div className="text-center text-gray-500 text-sm mt-8">
            No media added yet
            <div className="text-xs mt-2">Click "Add Files" to get started</div>
          </div>
        ) : (
          sortedItems.map((item, index) => (
            <div 
              key={item.id} 
              ref={(el) => {
                if (el) itemRefs.current.set(item.id, el);
              }}
              className="relative"
            >
              {/* Highlight the target position */}
              {hoverIndex === index && draggingId && draggingId !== item.id && (
                <div className="absolute inset-0 bg-blue-500 bg-opacity-20 rounded-lg border-2 border-blue-500 z-20 pointer-events-none" />
              )}
              <MediaItemCard
                item={item}
                isSelected={item.id === selectedItemId}
                isDragging={draggingId === item.id}
                defaultPhotoDuration={defaultPhotoDuration}
                onSelect={onSelectItem}
                onCaptionChange={handleCaptionChange}
                onShowCaptionToggle={handleShowCaptionToggle}
                onPhotoDurationChange={handlePhotoDurationChange}
                onDelete={handleDeleteItem}
                onExclude={handleExcludeItem}
                onDragHandleMouseDown={handleDragHandleMouseDown}
              />
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-gray-700 text-xs text-gray-400">
        {mediaItems.length} item{mediaItems.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}