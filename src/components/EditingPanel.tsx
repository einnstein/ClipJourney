// src/components/EditingPanel.tsx

import { useState, useRef, useEffect } from 'react';
import { MediaItem, ClipRange } from '../types';
import { convertFileSrc } from '@tauri-apps/api/core';

interface EditingPanelProps {
  selectedItem: MediaItem | null;
  onClipsChange: (clips: ClipRange[]) => void;
}

export default function EditingPanel({ 
  selectedItem, 
  onClipsChange
}: EditingPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoSrc, setVideoSrc] = useState('');
  const [clips, setClips] = useState<ClipRange[]>([]);
  const [pendingStart, setPendingStart] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number} | null>(null);
  const [draggingClip, setDraggingClip] = useState<{id: string, type: 'move' | 'resize-left' | 'resize-right'} | null>(null);

  useEffect(() => {
    if (selectedItem?.type === 'video') {
      setVideoSrc(convertFileSrc(selectedItem.filepath));
      setClips(selectedItem.clips || []);
      setPendingStart(null);
      setIsPlaying(false);
      setCurrentTime(0);
    } else {
      setVideoSrc('');
      setClips([]);
      setPendingStart(null);
    }
  }, [selectedItem?.id]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (selectedItem?.type === 'video') {
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMarkStart = () => {
    if (!videoRef.current) return;
    setPendingStart(videoRef.current.currentTime);
    setContextMenu(null);
  };

  const handleMarkEnd = () => {
    if (!videoRef.current || pendingStart === null) return;
    
    const start = pendingStart;
    const end = videoRef.current.currentTime;
    
    if (end <= start) {
      alert('End must be after start');
      setContextMenu(null);
      return;
    }

    const newClip: ClipRange = {
      id: `clip_${Date.now()}`,
      start,
      end
    };

    // Remove any clips that overlap with this new clip
    const nonOverlappingClips = clips.filter(clip => {
      return clip.end <= start || clip.start >= end;
    });

    const updatedClips = [...nonOverlappingClips, newClip].sort((a, b) => a.start - b.start);
    setClips(updatedClips);
    onClipsChange(updatedClips);
    setPendingStart(null);
    setContextMenu(null);
  };

  const handleClearStart = () => {
    setPendingStart(null);
    setContextMenu(null);
  };

  const handleDeleteClip = (clipId: string) => {
    const updatedClips = clips.filter(c => c.id !== clipId);
    setClips(updatedClips);
    onClipsChange(updatedClips);
  };

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + seconds));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  // Handle clip dragging
  const handleClipMouseDown = (e: React.MouseEvent, clipId: string, type: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation();
    setDraggingClip({ id: clipId, type });
  };

  useEffect(() => {
    if (!draggingClip || !timelineRef.current) return;

    const duration = selectedItem?.duration || 0;
    if (duration === 0) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = timelineRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      const time = percent * duration;

      setClips(prevClips => {
        const clipIndex = prevClips.findIndex(c => c.id === draggingClip.id);
        if (clipIndex === -1) return prevClips;

        const clip = prevClips[clipIndex];
        const newClips = [...prevClips];

        if (draggingClip.type === 'resize-left') {
          // Resize from left (change start)
          const newStart = Math.max(0, Math.min(time, clip.end - 0.1));
          newClips[clipIndex] = { ...clip, start: newStart };
        } else if (draggingClip.type === 'resize-right') {
          // Resize from right (change end)
          const newEnd = Math.min(duration, Math.max(time, clip.start + 0.1));
          newClips[clipIndex] = { ...clip, end: newEnd };
        } else {
          // Move entire clip
          const clipDuration = clip.end - clip.start;
          const newStart = Math.max(0, Math.min(duration - clipDuration, time - clipDuration / 2));
          const newEnd = newStart + clipDuration;
          newClips[clipIndex] = { ...clip, start: newStart, end: newEnd };
        }

        return newClips;
      });
    };

    const handleMouseUp = () => {
      setDraggingClip(null);
      // Update parent with final clip positions
      onClipsChange(clips);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingClip, selectedItem?.duration, onClipsChange, clips]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (!videoRef.current || !selectedItem || selectedItem.type !== 'video') return;

      if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      switch(e.key) {
        case 'ArrowLeft':
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - (1/30));
          break;
        case 'ArrowRight':
          videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + (1/30));
          break;
        case ' ':
          handlePlayPause();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem, isPlaying]);

  if (!selectedItem) {
    return (
      <div className="h-full bg-gray-850 border-b border-gray-700 flex flex-col">
        <div className="p-3 border-b border-gray-700 font-semibold text-sm">
          Editing Panel
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          Select a media item to edit
        </div>
      </div>
    );
  }

  if (selectedItem.type === 'image') {
    return (
      <div className="h-full bg-gray-850 border-b border-gray-700 flex flex-col">
        <div className="p-3 border-b border-gray-700 font-semibold text-sm">
          Editing Panel
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          Images don't require clip selection
        </div>
      </div>
    );
  }

  const duration = selectedItem.duration || 0;
  const canMarkEnd = pendingStart !== null && currentTime > pendingStart;

  return (
    <div className="h-full bg-gray-850 border-b border-gray-700 flex flex-col min-h-0">
      <div className="p-3 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
        <span className="font-semibold text-sm">
          Editing Panel - {clips.length} clip{clips.length !== 1 ? 's' : ''} selected
        </span>
        {pendingStart !== null && (
          <span className="text-xs text-orange-400">
            Start marked at {formatTime(pendingStart)} - right-click to set End
          </span>
        )}
      </div>
      
      <div className="flex-1 flex min-h-0">
        {/* Video Player */}
        <div className="flex-1 flex flex-col min-h-0">
          <div 
            className="flex-1 flex items-center justify-center bg-black min-h-0"
            onContextMenu={handleContextMenu}
          >
            {videoSrc ? (
              <video
                ref={videoRef}
                className="max-w-full max-h-full object-contain"
                src={videoSrc}
                onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            ) : (
              <div className="text-gray-500">Loading video...</div>
            )}
          </div>

          {/* Timeline with markers */}
          <div 
            className="px-3 py-3 bg-gray-900 flex-shrink-0 border-t border-gray-700"
            onContextMenu={handleContextMenu}
          >
            <div className="text-xs text-gray-400 mb-2 flex justify-between">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            
            {/* Clip markers - ABOVE the seekbar */}
            <div className="relative mb-2" ref={timelineRef}>
              <div className="h-6 bg-gray-800 rounded relative">
                {clips.map(clip => {
                  const left = (clip.start / duration) * 100;
                  const width = ((clip.end - clip.start) / duration) * 100;
                  return (
                    <div
                      key={clip.id}
                      className="absolute h-full bg-blue-500 bg-opacity-60 rounded cursor-move border-2 border-blue-400 hover:bg-opacity-80 transition-opacity"
                      style={{ left: `${left}%`, width: `${width}%` }}
                      onMouseDown={(e) => handleClipMouseDown(e, clip.id, 'move')}
                      title={`Clip: ${formatTime(clip.start)} - ${formatTime(clip.end)}`}
                    >
                      {/* Left resize handle */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-2 bg-blue-600 cursor-ew-resize hover:bg-blue-400"
                        onMouseDown={(e) => handleClipMouseDown(e, clip.id, 'resize-left')}
                        title="Drag to adjust start"
                      />
                      {/* Right resize handle */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 bg-blue-600 cursor-ew-resize hover:bg-blue-400"
                        onMouseDown={(e) => handleClipMouseDown(e, clip.id, 'resize-right')}
                        title="Drag to adjust end"
                      />
                    </div>
                  );
                })}
                {/* Pending start marker */}
                {pendingStart !== null && (
                  <div
                    className="absolute h-full w-1 bg-orange-500"
                    style={{ left: `${(pendingStart / duration) * 100}%` }}
                  />
                )}
              </div>
            </div>

            {/* Seekbar - BELOW the clips */}
            <div className="relative">
              <input
                type="range"
                min="0"
                max={duration}
                step="0.01"
                value={currentTime}
                onInput={(e) => {
                  const newTime = Number((e.target as HTMLInputElement).value);
                  if (videoRef.current) {
                    videoRef.current.currentTime = newTime;
                  }
                }}
                className="w-full"
              />
            </div>
          </div>

          {/* Controls */}
          <div className="p-2 flex items-center justify-center gap-2 bg-gray-900 flex-shrink-0 border-t border-gray-700">
            <button onClick={() => handleSeek(-1)} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">-1s</button>
            <button onClick={handlePlayPause} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm">
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button onClick={() => handleSeek(1)} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">+1s</button>
          </div>
        </div>

        {/* Clips List */}
        <div className="w-64 bg-gray-800 border-l border-gray-700 flex flex-col flex-shrink-0">
          <div className="p-2 border-b border-gray-700 text-xs font-semibold">Selected Clips</div>
          <div className="flex-1 overflow-auto p-2">
            {clips.length === 0 ? (
              <div className="text-xs text-gray-500 text-center mt-4">
                Right-click video to mark clips
              </div>
            ) : (
              clips.map((clip, index) => (
                <div key={clip.id} className="bg-gray-700 p-2 rounded mb-2 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">Clip {index + 1}</span>
                    <button
                      onClick={() => handleDeleteClip(clip.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      ×
                    </button>
                  </div>
                  <div className="text-gray-400">
                    {formatTime(clip.start)} - {formatTime(clip.end)}
                  </div>
                  <div className="text-gray-500 text-[10px]">
                    Duration: {formatTime(clip.end - clip.start)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-gray-800 border border-gray-600 rounded shadow-lg py-1 z-50 min-w-40"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {pendingStart === null ? (
            <button
              onClick={handleMarkStart}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 text-sm"
            >
              Mark Clip Start
            </button>
          ) : (
            <>
              <button
                onClick={handleMarkEnd}
                disabled={!canMarkEnd}
                className={`w-full px-4 py-2 text-left text-sm ${
                  canMarkEnd ? 'hover:bg-gray-700' : 'text-gray-500 cursor-not-allowed'
                }`}
              >
                Mark Clip End
              </button>
              <button
                onClick={handleClearStart}
                className="w-full px-4 py-2 text-left hover:bg-gray-700 text-sm text-orange-400"
              >
                Clear Start Marker
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}