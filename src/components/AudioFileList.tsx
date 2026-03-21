// src/components/AudioFileList.tsx

import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useState, useRef } from 'react';

export interface AudioItem {
  id: string;
  filename: string;
  filepath: string;
}

interface AudioFileListProps {
  audioItems: AudioItem[];
  onAudioItemsChange: (items: AudioItem[]) => void;
  onAddToTimeline: (item: AudioItem) => void;
}

export default function AudioFileList({
  audioItems,
  onAudioItemsChange,
  onAddToTimeline
}: AudioFileListProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const handleAddAudioFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'Audio',
          extensions: ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac']
        }]
      });

      if (!selected) return;

      const files = Array.isArray(selected) ? selected : [selected];
      const newItems: AudioItem[] = files.map(filepath => ({
        id: `audio_${Date.now()}_${Math.random()}`,
        filename: filepath.split('\\').pop()?.split('/').pop() || 'Unknown',
        filepath
      }));

      onAudioItemsChange([...audioItems, ...newItems]);
    } catch (error) {
      console.error('Error adding audio files:', error);
    }
  };

  const handleRemoveAudio = (id: string) => {
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
    }
    onAudioItemsChange(audioItems.filter(item => item.id !== id));
  };

  const handlePlayPause = (item: AudioItem) => {
    if (playingId === item.id) {
      // Pause current
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      // Play new
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const audio = new Audio();
      audio.src = convertFileSrc(item.filepath);
      audio.onended = () => setPlayingId(null);
      audio.play();
      audioRef.current = audio;
      setPlayingId(item.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, item: AudioItem) => {
    e.preventDefault();
    onAddToTimeline(item);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <span className="text-sm font-semibold">Audio Files</span>
        <button
          onClick={handleAddAudioFiles}
          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
        >
          + Add Audio
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {audioItems.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No audio files added yet
          </div>
        ) : (
          audioItems.map(item => (
            <div
              key={item.id}
              className="p-2 border-b border-gray-700 hover:bg-gray-800 group"
              onContextMenu={(e) => handleContextMenu(e, item)}
              title="Right-click to add to timeline"
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePlayPause(item)}
                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs flex-shrink-0"
                >
                  {playingId === item.id ? '⏸' : '▶'}
                </button>
                <div className="flex-1 truncate text-sm">
                  🎵 {item.filename}
                </div>
                <button
                  onClick={() => handleRemoveAudio(item.id)}
                  className="opacity-0 group-hover:opacity-100 px-1 text-red-500 hover:text-red-400"
                >
                  ×
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}