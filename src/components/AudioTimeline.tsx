// src/components/AudioTimeline.tsx

import { useRef } from 'react';

export interface AudioTrack {
  id: string;
  filename: string;
  filepath: string;
  fullDuration: number;
  timelineStart: number;
  clipStart: number;
  clipEnd: number;
  volume: number;
}

interface AudioTimelineProps {
  totalDuration: number;
  currentTime: number;
  audioTracks: AudioTrack[];
  onAudioTracksChange: (tracks: AudioTrack[]) => void;
}

export default function AudioTimeline({
  totalDuration,
  currentTime,
  audioTracks,
  onAudioTracksChange
}: AudioTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTrackDuration = (track: AudioTrack) => {
    return track.fullDuration - track.clipStart - track.clipEnd;
  };

  const handleTrackMouseDown = (e: React.MouseEvent, trackId: string) => {
    e.preventDefault();
    const startX = e.clientX;
    const track = audioTracks.find(t => t.id === trackId);
    if (!track || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const startTimelineStart = track.timelineStart;
    const trackDuration = getTrackDuration(track);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = (deltaX / rect.width) * totalDuration;
      const newStartTime = Math.max(0, Math.min(totalDuration - trackDuration, startTimelineStart + deltaTime));

      const updatedTracks = audioTracks.map(t =>
        t.id === trackId ? { ...t, timelineStart: newStartTime } : t
      );
      onAudioTracksChange(updatedTracks);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleRemoveTrack = (trackId: string) => {
    onAudioTracksChange(audioTracks.filter(t => t.id !== trackId));
  };

  const getTrackStyle = (track: AudioTrack) => {
    if (totalDuration === 0) return { left: '0%', width: '0%' };
    
    const startPercent = (track.timelineStart / totalDuration) * 100;
    const duration = getTrackDuration(track);
    const widthPercent = (duration / totalDuration) * 100;

    return {
      left: `${startPercent}%`,
      width: `${widthPercent}%`
    };
  };

  const playheadPosition = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  // Generate time markers every 10 seconds
  const generateTimeMarkers = () => {
    if (totalDuration === 0) return [];
    
    const markers = [];
    const interval = Math.max(10, Math.ceil(totalDuration / 10)); // At least 10 markers
    
    for (let time = 0; time <= totalDuration; time += interval) {
      markers.push(time);
    }
    
    if (markers[markers.length - 1] !== totalDuration) {
      markers.push(totalDuration);
    }
    
    return markers;
  };

  const timeMarkers = generateTimeMarkers();

  return (
    <div className="h-full bg-gray-900 flex flex-col p-4">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400">🎵 AUDIO TIMELINE</span>
        <span className="text-xs text-gray-500">
          {audioTracks.length} track{audioTracks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Timeline container with matching margins */}
      <div className="flex-1 flex items-center gap-3">
        {/* Current time label (matches video seekbar) */}
        <span className="text-xs text-gray-400 w-16 text-left">
          {formatTime(currentTime)}
        </span>

        {/* Timeline track area */}
        <div className="flex-1 relative h-full">
          <div
            ref={timelineRef}
            className="absolute inset-0 bg-gray-800 border border-gray-700 rounded overflow-visible"
          >
            {/* Time markers */}
            {timeMarkers.map((time) => {
              const position = totalDuration > 0 ? (time / totalDuration) * 100 : 0;
              return (
                <div
                  key={time}
                  className="absolute top-0 bottom-0 border-l border-gray-600"
                  style={{ left: `${position}%` }}
                />
              );
            })}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-20 pointer-events-none"
              style={{ left: `${playheadPosition}%` }}
            >
              <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 rounded-full" />
            </div>

            {/* Audio Tracks - all on same line, can overlap */}
            <div className="absolute inset-0">
            {audioTracks.map((track) => (
                <div
                key={track.id}
                className="absolute h-8 bg-green-600 border border-green-500 hover:bg-green-500 rounded cursor-move flex items-center px-2 group"
                style={{
                    ...getTrackStyle(track),
                    top: '50%',  // Center vertically
                    transform: 'translateY(-50%)'  // Perfect centering
                }}
                onMouseDown={(e) => handleTrackMouseDown(e, track.id)}
                title={`${track.filename}\nStart: ${formatTime(track.timelineStart)}\nDuration: ${formatTime(getTrackDuration(track))}`}
                >
                <span className="text-xs text-white truncate flex-1">
                    {track.filename}
                </span>
                <button
                    onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTrack(track.id);
                    }}
                    className="ml-1 px-1 bg-red-600 hover:bg-red-700 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    ×
                </button>
                </div>
            ))}

            {audioTracks.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs">
                Right-click audio files to add them to timeline
                </div>
            )}
            </div>
          </div>
        </div>

        {/* Total duration label (matches video seekbar) */}
        <span className="text-xs text-gray-400 w-16 text-right">
          {formatTime(totalDuration)}
        </span>
      </div>
    </div>
  );
}