// src/components/PreviewPanel.tsx

import { useRef, useEffect, useState } from 'react';
import { MediaItem } from '../types';
import { convertFileSrc } from '@tauri-apps/api/core';

interface PreviewPanelProps {
  selectedItem: MediaItem | null;
}

export default function PreviewPanel({ selectedItem }: PreviewPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [imageSrc, setImageSrc] = useState<string>('');
  const [playMode, setPlayMode] = useState<'selected' | 'full'>('selected');
  const [currentClipIndex, setCurrentClipIndex] = useState(0);

  useEffect(() => {
    const loadMedia = async () => {
      if (selectedItem?.type === 'video') {
        const convertedSrc = convertFileSrc(selectedItem.filepath);
        setVideoSrc(convertedSrc);
        setImageSrc('');
      } else if (selectedItem?.type === 'image') {
        const { invoke } = await import('@tauri-apps/api/core');
        try {
          const fullImageSrc = await invoke<string>('read_image_as_base64', { 
            imagePath: selectedItem.filepath 
          });
          setImageSrc(fullImageSrc);
          setVideoSrc('');
        } catch (error) {
          console.error('Error loading full image:', error);
          setImageSrc(selectedItem.thumbnail || '');
          setVideoSrc('');
        }
      } else {
        setVideoSrc('');
        setImageSrc('');
      }
    };
    
    loadMedia();
    setIsPlaying(false);
    setCurrentTime(0);
    setCurrentClipIndex(0);
  }, [selectedItem]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (!videoRef.current || !selectedItem || selectedItem.type !== 'video') return;

      // Prevent default for our hotkeys
      if (['ArrowLeft', 'ArrowRight', ' ', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
      }

      switch(e.key) {
        case 'ArrowLeft':
          // Frame backward (1/30th of a second)
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - (1/30));
          break;
        case 'ArrowRight':
          // Frame forward (1/30th of a second)
          videoRef.current.currentTime = Math.min(
            videoRef.current.duration, 
            videoRef.current.currentTime + (1/30)
          );
          break;
        case ' ':
          // Spacebar play/pause
          handlePlayPause();
          break;
        case 'Home':
          // Jump to start
          videoRef.current.currentTime = 0;
          break;
        case 'End':
          // Jump to end
          videoRef.current.currentTime = videoRef.current.duration;
          break;
        case 'j':
          // 1 second backward
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 1);
          break;
        case 'l':
          // 1 second forward
          videoRef.current.currentTime = Math.min(
            videoRef.current.duration, 
            videoRef.current.currentTime + 1
          );
          break;
        case 'k':
          // Play/pause (alternative)
          handlePlayPause();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem, isPlaying]);

  const handlePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (playMode === 'selected' && selectedItem?.clips && selectedItem.clips.length > 0) {
        // Start from first clip
        videoRef.current.currentTime = selectedItem.clips[0].start;
        setCurrentClipIndex(0);
      }
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    if (playMode === 'selected' && selectedItem?.clips && selectedItem.clips.length > 0) {
      videoRef.current.currentTime = selectedItem.clips[0].start;
    } else {
      videoRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current || !selectedItem) return;
    setCurrentTime(videoRef.current.currentTime);

    // Handle clip playback mode
    if (playMode === 'selected' && selectedItem.clips && selectedItem.clips.length > 0) {
      const currentClip = selectedItem.clips[currentClipIndex];
      
      if (currentClip && videoRef.current.currentTime >= currentClip.end) {
        // Move to next clip or stop
        if (currentClipIndex < selectedItem.clips.length - 1) {
          setCurrentClipIndex(currentClipIndex + 1);
          videoRef.current.currentTime = selectedItem.clips[currentClipIndex + 1].start;
        } else {
          // End of all clips
          videoRef.current.pause();
          setIsPlaying(false);
          videoRef.current.currentTime = selectedItem.clips[0].start;
          setCurrentClipIndex(0);
        }
      }
    }
  };

  const handleSeek = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + seconds));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!selectedItem) {
    return (
      <div className="h-full bg-gray-850 flex flex-col">
        <div className="p-3 border-b border-gray-700 font-semibold text-sm">
          Preview Panel
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          Select a media item to preview
        </div>
      </div>
    );
  }

  if (selectedItem.type === 'image') {
    return (
      <div className="h-full bg-gray-850 flex flex-col min-h-0">
        <div className="p-3 border-b border-gray-700 font-semibold text-sm">
          Preview Panel - {selectedItem.filename}
        </div>
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 flex items-center justify-center bg-black min-h-0">
              {imageSrc ? (
                <img 
                  src={imageSrc} 
                  alt={selectedItem.filename}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-gray-500">Loading image...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const duration = selectedItem.duration || 0;

  return (
    <div className="h-full bg-gray-850 flex flex-col min-h-0">
      <div className="p-3 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
        <span className="font-semibold text-sm">
          Preview Panel - {selectedItem.filename}
        </span>
        {selectedItem.clips && selectedItem.clips.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => setPlayMode('selected')}
              className={`px-3 py-1 rounded text-xs ${
                playMode === 'selected' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              Play Selected ({selectedItem.clips.length} clips)
            </button>
            <button
              onClick={() => setPlayMode('full')}
              className={`px-3 py-1 rounded text-xs ${
                playMode === 'full' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              Play Full Video
            </button>
          </div>
        )}
      </div>
      
      <div className="flex-1 flex min-h-0">
        {/* Video Player */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex items-center justify-center bg-black min-h-0">
            {videoSrc ? (
              <video
                ref={videoRef}
                className="max-w-full max-h-full object-contain"
                src={videoSrc}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            ) : (
              <div className="text-gray-500">Loading video...</div>
            )}
          </div>

          {/* Timeline */}
          <div className="px-3 py-2 bg-gray-900 flex-shrink-0 border-t border-gray-700">
            <div className="text-xs text-gray-400 mb-1 flex justify-between">
              <span>{formatTime(currentTime)}</span>
              <span className="text-[10px]">
                ← → Frame | J K L Shuttle | Space Play | Home/End
              </span>
              <span>{formatTime(duration)}</span>
            </div>
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

          {/* Controls */}
          <div className="p-2 flex items-center justify-center gap-2 bg-gray-900 flex-shrink-0 border-t border-gray-700">
            <button 
              onClick={() => handleSeek(-10)} 
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs"
            >
              ⏮ -10s
            </button>
            <button 
              onClick={() => handleSeek(-1)} 
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
            >
              -1s
            </button>
            <button 
              onClick={handlePlayPause} 
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm"
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button 
              onClick={handleStop}
              className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              ⏹ Stop
            </button>
            <button 
              onClick={() => handleSeek(1)} 
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
            >
              +1s
            </button>
            <button 
              onClick={() => handleSeek(10)} 
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs"
            >
              +10s ⏭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}