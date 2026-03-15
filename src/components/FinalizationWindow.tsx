import { useState, useRef, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import AudioTimeline, { AudioTrack } from './AudioTimeline';
import AudioFileList, { AudioItem } from './AudioFileList';

interface FinalizationWindowProps {
  combinedVideoPath: string;
  projectPath: string;
  onClose: () => void;
  onExport: (audioTracks: AudioTrack[]) => void;
}

export default function FinalizationWindow({
  combinedVideoPath,
  projectPath,
  onClose,
  onExport
}: FinalizationWindowProps) {
  const [audioFiles, setAudioFiles] = useState<AudioItem[]>([]);
  const [timelineTracks, setTimelineTracks] = useState<AudioTrack[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const loadVideo = async () => {
      const converted = convertFileSrc(combinedVideoPath);
      console.log('Loading video:', combinedVideoPath);
      console.log('Converted src:', converted);
      setVideoSrc(converted);
    };
    loadVideo();
  }, [combinedVideoPath]);

  // Load existing audio tracks from project
  useEffect(() => {
    const loadAudioTracks = async () => {
      try {
        const { readTextFile } = await import('@tauri-apps/plugin-fs');
        const content = await readTextFile(projectPath);
        const projectData = JSON.parse(content);
        
        if (projectData.audioTracks) {
          setTimelineTracks(projectData.audioTracks);
        }
      } catch (error) {
        console.error('Error loading audio tracks:', error);
      }
    };
    loadAudioTracks();
  }, [projectPath]);

  // Mark as changed when audio tracks change
  useEffect(() => {
    if (timelineTracks.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [timelineTracks]);

  const handleSaveProject = async () => {
    try {
      // Read current project file
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const content = await readTextFile(projectPath);
      const projectData = JSON.parse(content);
      
      // Update audio tracks
      projectData.audioTracks = timelineTracks;
      
      // Save back to file
      await writeTextFile(projectPath, JSON.stringify(projectData, null, 2));
      setHasUnsavedChanges(false);
      alert('Project saved with audio tracks!');
    } catch (error) {
      console.error('Error saving project:', error);
      alert(`Failed to save: ${error}`);
    }
  };

  const handleVideoLoaded = () => {
    if (videoRef.current) {
      setTotalDuration(videoRef.current.duration);
      console.log('Video loaded, duration:', videoRef.current.duration);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Header */}
      <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-4 justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            ← Back to Editing
          </button>
          <span className="text-lg font-semibold">Finalization & Export</span>
          {hasUnsavedChanges && (
            <span className="text-orange-400 text-sm">● Unsaved changes</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveProject}
            className="px-4 py-1 bg-green-600 hover:bg-green-700 rounded text-sm font-semibold"
          >
            💾 Save Project
          </button>
          <button
            onClick={() => onExport(timelineTracks)}
            className="px-4 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold"
          >
            Export Final Video
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Preview (Left) */}
        <div className="flex-1 flex flex-col bg-black">
          <div className="flex-1 flex items-center justify-center">
            {videoSrc ? (
              <video
                ref={videoRef}
                src={videoSrc}
                className="max-w-full max-h-full"
                onLoadedMetadata={handleVideoLoaded}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            ) : (
              <div className="text-gray-500">Loading video...</div>
            )}
          </div>

 {/* Video Controls */}
<div className="bg-gray-800 p-4 border-t border-gray-700">
  <div className="flex flex-col gap-3">
    {/* Progress Bar */}
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-16">
        {formatTime(currentTime)}
      </span>
      <div 
        className="flex-1 h-2 bg-gray-700 rounded-full cursor-pointer relative group"
        onClick={(e) => {
          if (!videoRef.current) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const percent = (e.clientX - rect.left) / rect.width;
          const newTime = percent * totalDuration;
          videoRef.current.currentTime = newTime;
        }}
      >
        {/* Progress fill */}
        <div 
          className="absolute left-0 top-0 h-full bg-blue-500 rounded-full pointer-events-none"
          style={{ width: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%` }}
        />
        {/* Hover indicator */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute top-0 h-full w-1 bg-white rounded" 
               style={{ 
                 left: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%`,
                 transform: 'translateX(-50%)'
               }}
          />
        </div>
      </div>
      <span className="text-xs text-gray-400 w-16">
        {formatTime(totalDuration)}
      </span>
    </div>
    
    {/* Play/Pause Button */}
    <div className="flex items-center gap-4">
      <button
        onClick={handlePlayPause}
        disabled={!videoSrc}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPlaying ? '⏸ Pause' : '▶ Play'}
      </button>
    </div>
  </div>
</div>
        </div>

        {/* Audio Files Panel (Right) */}
        <div className="w-80 bg-gray-850 border-l border-gray-700 flex flex-col">
          <AudioFileList
            audioItems={audioFiles}
            onAudioItemsChange={setAudioFiles}
            onAddToTimeline={async (audioItem) => {
              const audio = new Audio();
              const converted = convertFileSrc(audioItem.filepath);
              audio.src = converted;
              
              audio.addEventListener('loadedmetadata', () => {
                const newTrack: AudioTrack = {
                  id: `track_${Date.now()}_${Math.random()}`,
                  filename: audioItem.filename,
                  filepath: audioItem.filepath,
                  fullDuration: audio.duration,
                  timelineStart: 0,
                  clipStart: 0,
                  clipEnd: 0,
                  volume: 1.0
                };
                setTimelineTracks([...timelineTracks, newTrack]);
              });
            }}
          />
        </div>
      </div>

    {/* Audio Timeline (Bottom) - Only spans video width */}
    <div className="flex">
    <div className="flex-1 h-32 bg-gray-900 border-t border-gray-700">
        <AudioTimeline
        totalDuration={totalDuration}
        currentTime={currentTime}
        audioTracks={timelineTracks}
        onAudioTracksChange={setTimelineTracks}
        />
    </div>
    <div className="w-80 bg-gray-850 border-t border-l border-gray-700">
        {/* Empty space to match audio panel width */}
    </div>
    </div>
    </div>
  );
}