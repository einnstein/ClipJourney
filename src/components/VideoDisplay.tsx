// src/components/VideoDisplay.tsx

import { forwardRef } from 'react';
import { MediaItem } from '../types';
import { CaptionSettings } from './Captionsettingsmodal';

interface VideoDisplayProps {
  videoSrc: string;
  imageSrc: string;
  currentItem: MediaItem | null;
  aspectRatio: string;
  captionSettings: CaptionSettings;
  isPreviewMode: boolean;
  selectedItem: MediaItem | null;
  onVideoTimeUpdate?: () => void;
  onPlay: () => void;
  onPause: () => void;
}

const VideoDisplay = forwardRef<{ video: HTMLVideoElement | null; image: HTMLImageElement | null }, VideoDisplayProps>(
  ({ videoSrc, imageSrc, currentItem, aspectRatio, captionSettings, isPreviewMode, selectedItem, onVideoTimeUpdate, onPlay, onPause }, ref) => {
    
    const getCaptionPositionClass = () => {
      const base = 'absolute px-4 py-2 rounded';
      
      switch (captionSettings.position) {
        case 'bottom-left':
          return `${base} bottom-4 left-4`;
        case 'bottom-center':
          return `${base} bottom-4 left-1/2 transform -translate-x-1/2`;
        case 'bottom-right':
          return `${base} bottom-4 right-4`;
        case 'top-left':
          return `${base} top-4 left-4`;
        case 'top-center':
          return `${base} top-4 left-1/2 transform -translate-x-1/2`;
        case 'top-right':
          return `${base} top-4 right-4`;
        case 'center':
          return `${base} top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2`;
        default:
          return `${base} bottom-4 left-1/2 transform -translate-x-1/2`;
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

    return (
      <div className="flex-1 flex items-center justify-center bg-black min-h-0">
        <div 
          className="relative bg-black"
          style={{
            aspectRatio: aspectRatio.replace(':', '/'),
            maxWidth: '100%',
            maxHeight: '100%'
          }}
        >
          {videoSrc ? (
            <video
              ref={(el) => {
                if (ref && typeof ref === 'object' && 'current' in ref) {
                  (ref as any).current = { video: el, image: null };
                }
              }}
              className="w-full h-full object-contain"
              src={videoSrc}
              onTimeUpdate={isPreviewMode ? onVideoTimeUpdate : undefined}
              onPlay={onPlay}
              onPause={onPause}
            />
          ) : imageSrc ? (
            <img 
              ref={(el) => {
                if (ref && typeof ref === 'object' && 'current' in ref) {
                  (ref as any).current = { video: null, image: el };
                }
              }}
              src={imageSrc} 
              alt={currentItem?.filename}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-gray-500 text-center absolute inset-0 flex items-center justify-center">
              {isPreviewMode ? (
                'Loading...'
              ) : selectedItem ? (
                <div>
                  <div className="text-lg mb-2">Ready to preview</div>
                  <div className="text-sm">Press "Play from Selected" or "Play from Start" to begin</div>
                </div>
              ) : (
                'Select a media item'
              )}
            </div>
          )}
          
          {currentItem && currentItem.showCaption && currentItem.caption && (
            <div className={getCaptionPositionClass()} style={getCaptionStyle()}>
              {currentItem.caption}
            </div>
          )}
        </div>
      </div>
    );
  }
);

VideoDisplay.displayName = 'VideoDisplay';

export default VideoDisplay;