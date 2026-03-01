// src/components/PreviewPanel.tsx

import { useRef, useEffect, useState } from 'react';
import { MediaItem } from '../types';
import { convertFileSrc } from '@tauri-apps/api/core';

interface PreviewPanelProps {
  selectedItem: MediaItem | null;
  mediaItems: MediaItem[];
  defaultPhotoDuration: number;
  onCurrentItemChange: (itemId: string) => void;
}

export default function PreviewPanel({ 
  selectedItem, 
  mediaItems,
  defaultPhotoDuration,
  onCurrentItemChange 
}: PreviewPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const photoTimerRef = useRef<number | null>(null);
  const isAdvancingRef = useRef<boolean>(false);
  const isPreviewModeRef = useRef<boolean>(false);
  const playlistRef = useRef<MediaItem[]>([]);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [playlist, setPlaylist] = useState<MediaItem[]>([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [accumulatedTime, setAccumulatedTime] = useState(0);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [imageSrc, setImageSrc] = useState<string>('');

  // Build playlist when preview mode starts
  const buildPlaylist = (fromStart: boolean) => {
    const startIndex = fromStart ? 0 : mediaItems.findIndex(item => item.id === selectedItem?.id);
    if (startIndex === -1) return [];
    
    return mediaItems.slice(startIndex);
  };

  // Calculate total duration of playlist
  const calculateTotalDuration = (items: MediaItem[]) => {
    return items.reduce((total, item) => {
      if (item.type === 'video') {
        if (item.clips && item.clips.length > 0) {
          return total + item.clips.reduce((sum, clip) => sum + (clip.end - clip.start), 0);
        }
        return total + (item.duration || 0);
      } else {
        return total + (item.photoDuration ?? defaultPhotoDuration);
      }
    }, 0);
  };

  // Get duration for current media item
  const getCurrentItemDuration = (item: MediaItem) => {
    if (item.type === 'video') {
      if (item.clips && item.clips.length > 0) {
        return item.clips.reduce((sum, clip) => sum + (clip.end - clip.start), 0);
      }
      return item.duration || 0;
    } else {
      return item.photoDuration ?? defaultPhotoDuration;
    }
  };

  // Start preview from selected or from start
  const handleStartPreview = (fromStart: boolean) => {
    const newPlaylist = buildPlaylist(fromStart);
    if (newPlaylist.length === 0) return;

    console.log(`Starting preview with ${newPlaylist.length} items`);
    
    setPlaylist(newPlaylist);
    playlistRef.current = newPlaylist; // Sync ref
    setCurrentMediaIndex(0);
    setCurrentClipIndex(0);
    setAccumulatedTime(0);
    setIsPreviewMode(true);
    isPreviewModeRef.current = true; // Sync ref
    setTotalDuration(calculateTotalDuration(newPlaylist));
    loadMediaAtIndex(newPlaylist, 0);
  };

  // Load media at specific index
  const loadMediaAtIndex = async (playlistItems: MediaItem[], index: number) => {
    if (index >= playlistItems.length) {
      handleStopPreview();
      return;
    }

    const item = playlistItems[index];
    
    // CRITICAL: Clear any existing photo timer first
    if (photoTimerRef.current !== null) {
      clearTimeout(photoTimerRef.current);
      photoTimerRef.current = null;
    }

    onCurrentItemChange(item.id);

    if (item.type === 'video') {
      setImageSrc('');
      const convertedSrc = convertFileSrc(item.filepath);
      setVideoSrc(convertedSrc);
      setCurrentClipIndex(0);
      
      // Wait for video to load before playing
      setTimeout(() => {
        if (videoRef.current) {
          if (item.clips && item.clips.length > 0) {
            videoRef.current.currentTime = item.clips[0].start;
          } else {
            videoRef.current.currentTime = 0;
          }
          videoRef.current.play().catch(err => console.error('Play error:', err));
          setIsPlaying(true);
        }
      }, 100);
    } else {
      // Photo handling
      setVideoSrc('');
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
      
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        const fullImageSrc = await invoke<string>('read_image_as_base64', { 
          imagePath: item.filepath 
        });
        setImageSrc(fullImageSrc);
        setIsPlaying(true);

        // Calculate photo duration
        const duration = (item.photoDuration ?? defaultPhotoDuration) * 1000;
        console.log(`Photo loaded: ${item.filename}, duration: ${duration}ms (${duration/1000}s)`);
        
        // Set timer to advance to next item
        photoTimerRef.current = window.setTimeout(() => {
          console.log(`Photo timer fired for ${item.filename}, preview mode: ${isPreviewModeRef.current}`);
          
          // CRITICAL: Check ref not state (to avoid stale closure)
          if (!isPreviewModeRef.current) {
            console.log('Preview stopped, ignoring timer');
            photoTimerRef.current = null;
            return;
          }
          
          photoTimerRef.current = null;
          advanceToNextItem();
        }, duration);
      } catch (error) {
        console.error('Error loading image:', error);
        advanceToNextItem();
      }
    }
  };

  // Separate function to advance without state conflicts
  const advanceToNextItem = () => {
    // Check ref instead of state
    if (!isPreviewModeRef.current) {
      console.log('Preview mode ref is false, stopping advance');
      return;
    }
    
    // Prevent multiple simultaneous advances
    if (isAdvancingRef.current) {
      console.log('Already advancing, skipping duplicate call');
      return;
    }

    isAdvancingRef.current = true;
    console.log('Advancing to next item...');

    setCurrentMediaIndex(prev => {
      const nextIndex = prev + 1;
      const currentPlaylist = playlistRef.current; // Use ref
      console.log(`Current: ${prev}, Next: ${nextIndex}, Playlist length: ${currentPlaylist.length}`);
      
      if (nextIndex >= currentPlaylist.length) {
        // End of playlist
        console.log('End of playlist reached');
        isAdvancingRef.current = false;
        setTimeout(() => handleStopPreview(), 0);
        return prev;
      }
      
      // Update accumulated time
      const currentItem = currentPlaylist[prev];
      if (currentItem) {
        const itemDuration = getCurrentItemDuration(currentItem);
        setAccumulatedTime(accTime => accTime + itemDuration);
      }
      
      // Load next media after a short delay
      setTimeout(() => {
        // Double check ref before loading
        if (!isPreviewModeRef.current) {
          console.log('Preview stopped during advance, aborting load');
          isAdvancingRef.current = false;
          return;
        }
        
        console.log(`Loading media at index ${nextIndex}`);
        loadMediaAtIndex(playlistRef.current, nextIndex); // Use ref
        isAdvancingRef.current = false;
      }, 100);
      
      return nextIndex;
    });
  };

  // Move to next media item (for videos only)
  const moveToNextMedia = () => {
    if (!isPreviewMode) return;

    // Clear any photo timer
    if (photoTimerRef.current !== null) {
      clearTimeout(photoTimerRef.current);
      photoTimerRef.current = null;
    }

    advanceToNextItem();
  };

  // Handle video time updates
  const handleVideoTimeUpdate = () => {
    if (!videoRef.current || !isPreviewMode) return;

    const currentItem = playlist[currentMediaIndex];
    if (currentItem?.type !== 'video') return;

    // Update accumulated time
    const previousDuration = playlist.slice(0, currentMediaIndex).reduce((sum, item) => {
      return sum + getCurrentItemDuration(item);
    }, 0);

    if (currentItem.clips && currentItem.clips.length > 0) {
      const clip = currentItem.clips[currentClipIndex];
      if (clip) {
        const clipElapsed = videoRef.current.currentTime - clip.start;
        const clipsBeforeCurrent = currentItem.clips.slice(0, currentClipIndex).reduce((sum, c) => {
          return sum + (c.end - c.start);
        }, 0);
        setCurrentTime(previousDuration + clipsBeforeCurrent + clipElapsed);

        // Check if clip ended
        if (videoRef.current.currentTime >= clip.end) {
          if (currentClipIndex < currentItem.clips.length - 1) {
            setCurrentClipIndex(currentClipIndex + 1);
            videoRef.current.currentTime = currentItem.clips[currentClipIndex + 1].start;
          } else {
            // Last clip ended, move to next media
            moveToNextMedia();
          }
        }
      }
    } else {
      setCurrentTime(previousDuration + videoRef.current.currentTime);
      
      // Check if video ended
      if (videoRef.current.currentTime >= (videoRef.current.duration - 0.1)) {
        moveToNextMedia();
      }
    }
  };

  // Stop preview
  const handleStopPreview = () => {
    console.log('=== STOPPING PREVIEW ===');
    
    // FIRST: Set ref to false to kill all pending callbacks
    isPreviewModeRef.current = false;
    isAdvancingRef.current = false;
    playlistRef.current = [];
    
    // SECOND: Clear timer
    if (photoTimerRef.current !== null) {
      console.log('Clearing photo timer');
      clearTimeout(photoTimerRef.current);
      photoTimerRef.current = null;
    }
    
    // THIRD: Stop video
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
    }

    // FOURTH: Clear all state
    setIsPreviewMode(false);
    setIsPlaying(false);
    setPlaylist([]);
    setCurrentMediaIndex(0);
    setCurrentClipIndex(0);
    setAccumulatedTime(0);
    setCurrentTime(0);
    setVideoSrc('');
    setImageSrc('');

    console.log('Preview stopped, all flags cleared');

    // Reload selected item if available
    if (selectedItem) {
      setTimeout(() => {
        onCurrentItemChange(selectedItem.id);
      }, 100);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (photoTimerRef.current) {
        clearTimeout(photoTimerRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!selectedItem && mediaItems.length === 0) {
    return (
      <div className="h-full bg-gray-850 flex flex-col">
        <div className="p-3 border-b border-gray-700 font-semibold text-sm">
          Preview Panel
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          Add media items to preview
        </div>
      </div>
    );
  }

  const currentItem = isPreviewMode ? playlist[currentMediaIndex] : selectedItem;

  return (
    <div className="h-full bg-gray-850 flex flex-col min-h-0">
      <div className="p-3 border-b border-gray-700 font-semibold text-sm flex-shrink-0 flex items-center justify-between">
        <span>
          Preview Panel
          {isPreviewMode && ` - Playing ${currentMediaIndex + 1} of ${playlist.length}`}
        </span>
        <div className="flex gap-2">
          {isPreviewMode ? (
            <button
              onClick={handleStopPreview}
              className="px-3 py-1 rounded text-xs bg-orange-600 hover:bg-orange-700"
            >
              ⏹ Stop Preview
            </button>
          ) : (
            <>
              <button
                onClick={() => handleStartPreview(false)}
                disabled={!selectedItem}
                className="px-3 py-1 rounded text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ▶ Play from Selected
              </button>
              <button
                onClick={() => handleStartPreview(true)}
                disabled={mediaItems.length === 0}
                className="px-3 py-1 rounded text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ▶ Play from Start
              </button>
            </>
          )}
        </div>
      </div>
      
      <div className="flex-1 flex min-h-0">
        {/* Video Player */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex items-center justify-center bg-black min-h-0 relative">
            {videoSrc ? (
              <video
                ref={videoRef}
                className="max-w-full max-h-full object-contain"
                src={videoSrc}
                onTimeUpdate={isPreviewMode ? handleVideoTimeUpdate : undefined}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            ) : imageSrc ? (
              <img 
                ref={imageRef}
                src={imageSrc} 
                alt={currentItem?.filename}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="text-gray-500">
                {selectedItem ? 'Loading...' : 'Select a media item'}
              </div>
            )}
            
            {/* Caption Overlay */}
            {currentItem && currentItem.showCaption && currentItem.caption && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 px-4 py-2 rounded">
                <span className="text-white text-lg">{currentItem.caption}</span>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="px-3 py-2 bg-gray-900 flex-shrink-0 border-t border-gray-700">
            <div className="text-xs text-gray-400 mb-1 flex justify-between">
              <span>{formatTime(currentTime)}</span>
              <span className="text-[10px]">
                {isPreviewMode ? 'Full Preview Mode' : 'Single Item View'}
              </span>
              <span>{formatTime(isPreviewMode ? totalDuration : (selectedItem?.duration || 0))}</span>
            </div>
            <input
              type="range"
              min="0"
              max={isPreviewMode ? totalDuration : (selectedItem?.duration || 0)}
              step="0.01"
              value={currentTime}
              disabled={isPreviewMode}
              className="w-full cursor-pointer disabled:opacity-50"
            />
          </div>

          {/* Controls */}
          <div className="p-2 flex items-center justify-center gap-2 bg-gray-900 flex-shrink-0 border-t border-gray-700">
            {!isPreviewMode && (
              <span className="text-xs text-gray-400">
                Use "Play from Selected" or "Play from Start" to preview full sequence
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}