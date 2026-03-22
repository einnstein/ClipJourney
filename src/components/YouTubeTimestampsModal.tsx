// src/components/YouTubeTimestampsModal.tsx

import { MediaItem } from '../types';
import { useState, useEffect } from 'react';

interface YouTubeTimestampsModalProps {
  mediaItems: MediaItem[];
  defaultPhotoDuration: number;
  onClose: () => void;
}

export default function YouTubeTimestampsModal({
  mediaItems,
  defaultPhotoDuration,
  onClose
}: YouTubeTimestampsModalProps) {
  const [timestamps, setTimestamps] = useState<string>('');

  useEffect(() => {
    generateTimestamps();
  }, []);

  const formatTimestamp = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateTimestamps = () => {
    let currentTime = 0;
    const timestampLines: string[] = [];

    mediaItems.forEach((item) => {
      if (item.type === 'video') {
        if (item.clips && item.clips.length > 0) {
          // Video has clips
          item.clips.forEach((clip) => {
            const clipDuration = clip.end - clip.start;
            
            if (item.showCaption && item.caption) {
              const timestamp = formatTimestamp(currentTime);
              timestampLines.push(`${timestamp} ${item.caption}`);
            }
            
            currentTime += clipDuration;
          });
        } else if (item.duration) {
          // Full video
          if (item.showCaption && item.caption) {
            const timestamp = formatTimestamp(currentTime);
            timestampLines.push(`${timestamp} ${item.caption}`);
          }
          
          currentTime += item.duration;
        }
      } else if (item.type === 'image') {
        // Photo
        const photoDuration = item.photoDuration ?? defaultPhotoDuration;
        
        if (item.showCaption && item.caption) {
          const timestamp = formatTimestamp(currentTime);
          timestampLines.push(`${timestamp} ${item.caption}`);
        }
        
        currentTime += photoDuration;
      }
    });

    // YouTube requires 0:00 as first timestamp
    if (timestampLines.length > 0 && !timestampLines[0].startsWith('0:00')) {
      timestampLines.unshift('0:00 Intro');
    }

    setTimestamps(timestampLines.join('\n'));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(timestamps);
    alert('Timestamps copied to clipboard!');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">YouTube Timestamps</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 text-sm text-gray-400">
            <p className="mb-2">
              Copy and paste these timestamps into your YouTube video description.
              Only items with captions are included.
            </p>
            <p className="text-xs">
              Note: YouTube requires at least 3 timestamps with the first one starting at 0:00
            </p>
          </div>

          <textarea
            value={timestamps}
            onChange={(e) => setTimestamps(e.target.value)}
            className="w-full h-64 bg-gray-900 border border-gray-700 rounded p-3 text-sm font-mono resize-none focus:outline-none focus:border-blue-500"
            placeholder="No captions found. Add captions to your media items first."
          />

          <div className="mt-2 text-xs text-gray-500">
            {timestamps.split('\n').filter(line => line.trim()).length} timestamp(s)
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Close
          </button>
          <button
            onClick={handleCopy}
            disabled={!timestamps}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📋 Copy to Clipboard
          </button>
        </div>
      </div>
    </div>
  );
}