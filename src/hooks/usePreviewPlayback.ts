// src/hooks/usePreviewPlayback.ts

import { useRef, useState, useEffect } from 'react';
import { MediaItem } from '../types';
import { convertFileSrc } from '@tauri-apps/api/core';

interface UsePreviewPlaybackProps {
  mediaItems: MediaItem[];
  selectedItem: MediaItem | null;
  defaultPhotoDuration: number;
  onCurrentItemChange: (itemId: string) => void;
  onPreviewModeChange: (isPreview: boolean) => void;
videoRef: React.RefObject<HTMLVideoElement | null>;
imageRef: React.RefObject<HTMLImageElement | null>;
  setVideoSrc: (src: string) => void;
  setImageSrc: (src: string) => void;
}

export function usePreviewPlayback({
  mediaItems,
  selectedItem,
  defaultPhotoDuration,
  onCurrentItemChange,
  onPreviewModeChange,
  videoRef,
  imageRef,
  setVideoSrc,
  setImageSrc
}: UsePreviewPlaybackProps) {
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

  const buildPlaylist = (fromStart: boolean) => {
    const startIndex = fromStart ? 0 : mediaItems.findIndex(item => item.id === selectedItem?.id);
    if (startIndex === -1) return [];
    return mediaItems.slice(startIndex);
  };

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

  const handleStartPreview = (fromStart: boolean) => {
    const newPlaylist = buildPlaylist(fromStart);
    if (newPlaylist.length === 0) return;

    const startIndex = fromStart ? 0 : mediaItems.findIndex(item => item.id === selectedItem?.id);
    const timeBeforeStart = mediaItems.slice(0, Math.max(0, startIndex)).reduce((sum, item) => {
      return sum + getCurrentItemDuration(item);
    }, 0);
    
    console.log(`Starting from index ${startIndex}, time before start: ${timeBeforeStart}s`);
    
    setPlaylist(newPlaylist);
    playlistRef.current = newPlaylist;
    setCurrentMediaIndex(0);
    setCurrentClipIndex(0);
    setAccumulatedTime(timeBeforeStart);
    setIsPreviewMode(true);
    isPreviewModeRef.current = true;
    onPreviewModeChange(true);
    setTotalDuration(calculateTotalDuration(mediaItems));
    loadMediaAtIndex(newPlaylist, 0);
  };

  const loadMediaAtIndex = async (playlistItems: MediaItem[], index: number) => {
    if (index >= playlistItems.length) {
      handleStopPreview();
      return;
    }

    const item = playlistItems[index];
    
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

        const duration = (item.photoDuration ?? defaultPhotoDuration) * 1000;
        
        photoTimerRef.current = window.setTimeout(() => {
          if (!isPreviewModeRef.current) {
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

  const advanceToNextItem = () => {
    if (!isPreviewModeRef.current) return;
    if (isAdvancingRef.current) return;

    isAdvancingRef.current = true;

    setCurrentMediaIndex(prev => {
      const nextIndex = prev + 1;
      const currentPlaylist = playlistRef.current;
      
      if (nextIndex >= currentPlaylist.length) {
        isAdvancingRef.current = false;
        setTimeout(() => handleStopPreview(), 0);
        return prev;
      }
      
      const currentItem = currentPlaylist[prev];
      if (currentItem) {
        const itemDuration = getCurrentItemDuration(currentItem);
        setAccumulatedTime(accTime => accTime + itemDuration);
      }
      
      setTimeout(() => {
        if (!isPreviewModeRef.current) {
          isAdvancingRef.current = false;
          return;
        }
        loadMediaAtIndex(playlistRef.current, nextIndex);
        isAdvancingRef.current = false;
      }, 100);
      
      return nextIndex;
    });
  };

  const moveToNextMedia = () => {
    if (!isPreviewMode) return;

    if (photoTimerRef.current !== null) {
      clearTimeout(photoTimerRef.current);
      photoTimerRef.current = null;
    }

    advanceToNextItem();
  };

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current || !isPreviewMode) return;

    const currentItem = playlist[currentMediaIndex];
    if (currentItem?.type !== 'video') return;

    if (currentItem.clips && currentItem.clips.length > 0) {
      const clip = currentItem.clips[currentClipIndex];
      if (clip) {
        const clipElapsed = videoRef.current.currentTime - clip.start;
        const clipsBeforeCurrent = currentItem.clips.slice(0, currentClipIndex).reduce((sum, c) => {
          return sum + (c.end - c.start);
        }, 0);
        
        const playlistDuration = playlist.slice(0, currentMediaIndex).reduce((sum, item) => {
          return sum + getCurrentItemDuration(item);
        }, 0);
        
        setCurrentTime(accumulatedTime + playlistDuration + clipsBeforeCurrent + clipElapsed);

        if (videoRef.current.currentTime >= clip.end) {
          if (currentClipIndex < currentItem.clips.length - 1) {
            setCurrentClipIndex(currentClipIndex + 1);
            videoRef.current.currentTime = currentItem.clips[currentClipIndex + 1].start;
          } else {
            moveToNextMedia();
          }
        }
      }
    } else {
      const playlistDuration = playlist.slice(0, currentMediaIndex).reduce((sum, item) => {
        return sum + getCurrentItemDuration(item);
      }, 0);
      
      setCurrentTime(accumulatedTime + playlistDuration + videoRef.current.currentTime);
      
      if (videoRef.current.currentTime >= (videoRef.current.duration - 0.1)) {
        moveToNextMedia();
      }
    }
  };

  const handleStopPreview = () => {
    isPreviewModeRef.current = false;
    isAdvancingRef.current = false;
    playlistRef.current = [];
    
    if (photoTimerRef.current !== null) {
      clearTimeout(photoTimerRef.current);
      photoTimerRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
    }

    setIsPreviewMode(false);
    onPreviewModeChange(false);
    setIsPlaying(false);
    setPlaylist([]);
    setCurrentMediaIndex(0);
    setCurrentClipIndex(0);
    setAccumulatedTime(0);
    setCurrentTime(0);
    setVideoSrc('');
    setImageSrc('');

    if (selectedItem) {
      setTimeout(() => {
        onCurrentItemChange(selectedItem.id);
      }, 100);
    }
  };

  useEffect(() => {
    return () => {
      if (photoTimerRef.current) {
        clearTimeout(photoTimerRef.current);
      }
    };
  }, []);

  return {
    isPlaying,
    setIsPlaying,
    currentTime,
    totalDuration,
    isPreviewMode,
    playlist,
    currentMediaIndex,
    handleStartPreview,
    handleStopPreview,
    handleVideoTimeUpdate
  };
}