// src/components/PreviewPanel.tsx

import { useRef, useState } from 'react';
import { MediaItem } from '../types';
import { CaptionSettings } from './Captionsettingsmodal';
import { usePreviewPlayback } from '../hooks/usePreviewPlayback';

interface PreviewPanelProps {
  selectedItem: MediaItem | null;
  mediaItems: MediaItem[];
  defaultPhotoDuration: number;
  captionSettings: CaptionSettings;
  aspectRatio: string;
  onCurrentItemChange: (itemId: string) => void;
  onPreviewModeChange: (isPreview: boolean) => void;
}

export default function PreviewPanel({ 
  selectedItem, 
  mediaItems,
  defaultPhotoDuration,
  captionSettings,
  aspectRatio,
  onCurrentItemChange,
  onPreviewModeChange
}: PreviewPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [imageSrc, setImageSrc] = useState<string>('');

  const {
    setIsPlaying,
    currentTime,
    totalDuration,
    isPreviewMode,
    playlist,
    currentMediaIndex,
    handleStartPreview,
    handleStopPreview,
    handleVideoTimeUpdate
  } = usePreviewPlayback({
    mediaItems,
    selectedItem,
    defaultPhotoDuration,
    onCurrentItemChange,
    onPreviewModeChange,
    videoRef,
    imageRef,
    setVideoSrc,
    setImageSrc
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCaptionPositionClass = () => {
    const base = 'absolute px-4 py-2 rounded';
    switch (captionSettings.position) {
      case 'bottom-left': return `${base} bottom-4 left-4`;
      case 'bottom-center': return `${base} bottom-4 left-1/2 transform -translate-x-1/2`;
      case 'bottom-right': return `${base} bottom-4 right-4`;
      case 'top-left': return `${base} top-4 left-4`;
      case 'top-center': return `${base} top-4 left-1/2 transform -translate-x-1/2`;
      case 'top-right': return `${base} top-4 right-4`;
      case 'center': return `${base} top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2`;
      default: return `${base} bottom-4 left-1/2 transform -translate-x-1/2`;
    }
  };

  const getCaptionStyle = () => {
    const hexToRgba = (hex: string, opacity: number) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };

    return {
      fontFamily: captionSettings.fontFamily,
      fontSize: `${captionSettings.fontSize}px`,
      color: captionSettings.textColor,
      backgroundColor: hexToRgba(captionSettings.backgroundColor, captionSettings.backgroundOpacity),
      fontWeight: captionSettings.bold ? 'bold' : 'normal',
      fontStyle: captionSettings.italic ? 'italic' : 'normal'
    };
  };

  if (!selectedItem && mediaItems.length === 0) {
    return (
      <div className="h-full bg-gray-850 flex flex-col">
        <div className="p-3 border-b border-gray-700 font-semibold text-sm">Preview Panel</div>
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
            <button onClick={handleStopPreview} className="px-3 py-1 rounded text-xs bg-orange-600 hover:bg-orange-700">
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
      
      <div className="flex-1 flex items-center justify-center bg-black min-h-0">
        <div className="relative bg-black" style={{ aspectRatio: aspectRatio.replace(':', '/'), maxWidth: '100%', maxHeight: '100%' }}>
          {videoSrc ? (
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              src={videoSrc}
              onTimeUpdate={isPreviewMode ? handleVideoTimeUpdate : undefined}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          ) : imageSrc ? (
            <img ref={imageRef} src={imageSrc} alt={currentItem?.filename} className="w-full h-full object-contain" />
          ) : (
            <div className="text-gray-500 text-center absolute inset-0 flex items-center justify-center">
              {isPreviewMode ? 'Loading...' : selectedItem ? (
                <div>
                  <div className="text-lg mb-2">Ready to preview</div>
                  <div className="text-sm">Press "Play from Selected" or "Play from Start" to begin</div>
                </div>
              ) : 'Select a media item'}
            </div>
          )}
          
          {currentItem && currentItem.showCaption && currentItem.caption && (
            <div className={getCaptionPositionClass()} style={getCaptionStyle()}>
              {currentItem.caption}
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="px-3 py-2 bg-gray-900 flex-shrink-0 border-t border-gray-700">
        <div className="text-xs text-gray-400 mb-1 flex justify-between">
          <span>{formatTime(currentTime)}</span>
          <span className="text-[10px]">{isPreviewMode ? 'Full Timeline' : 'Single Item View'}</span>
          <span>{formatTime(totalDuration || (selectedItem?.duration || 0))}</span>
        </div>
        <input
          type="range"
          min="0"
          max={totalDuration || (selectedItem?.duration || 0)}
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
  );
}