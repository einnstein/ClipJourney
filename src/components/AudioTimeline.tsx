// src/components/AudioTimeline.tsx

import { useRef, useState } from 'react';

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

type DragMode = 'move' | 'trim-start' | 'trim-end' | null;

export default function AudioTimeline({
  totalDuration,
  currentTime,
  audioTracks,
  onAudioTracksChange
}: AudioTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateTimeMarkers = () => {
    const markers = [];
    const step = 30;
    for (let i = 0; i <= totalDuration; i += step) {
      markers.push(i);
    }
    if (markers[markers.length - 1] !== totalDuration && totalDuration > 0) {
      markers.push(totalDuration);
    }
    return markers;
  };

  const getTrackDuration = (track: AudioTrack) => {
    return track.fullDuration - track.clipStart - track.clipEnd;
  };

  const getTrackEnd = (track: AudioTrack) => {
    return track.timelineStart + getTrackDuration(track);
  };

  const checkCollision = (trackId: string, newStart: number, duration: number) => {
    const newEnd = newStart + duration;
    return audioTracks.filter(t => t.id !== trackId).some(track => {
      const trackStart = track.timelineStart;
      const trackEnd = getTrackEnd(track);
      return (newStart < trackEnd && newEnd > trackStart);
    });
  };

  const shiftOverlappingTracks = (movedTrackId: string, newStart: number, duration: number) => {
    const newEnd = newStart + duration;
    const overlapping = audioTracks
      .filter(t => t.id !== movedTrackId)
      .filter(track => {
        const trackStart = track.timelineStart;
        const trackEnd = getTrackEnd(track);
        return (newStart < trackEnd && newEnd > trackStart);
      })
      .sort((a, b) => a.timelineStart - b.timelineStart);

    if (overlapping.length === 0) return audioTracks;

    let updatedTracks = [...audioTracks];
    let currentEnd = newEnd;

    overlapping.forEach(track => {
      const trackDuration = getTrackDuration(track);
      updatedTracks = updatedTracks.map(t =>
        t.id === track.id ? { ...t, timelineStart: currentEnd } : t
      );
      currentEnd += trackDuration;
    });

    return updatedTracks;
  };

  const getEdgeZone = (e: React.MouseEvent, trackElement: HTMLElement): 'left' | 'right' | 'center' => {
    const rect = trackElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const edgeThreshold = 10; // pixels

    if (x < edgeThreshold) return 'left';
    if (x > rect.width - edgeThreshold) return 'right';
    return 'center';
  };

  const handleTrackMouseDown = (e: React.MouseEvent, trackId: string) => {
    e.preventDefault();
    const track = audioTracks.find(t => t.id === trackId);
    if (!track || !timelineRef.current) return;

    const trackElement = e.currentTarget as HTMLElement;
    const edge = getEdgeZone(e, trackElement);
    
    if (edge === 'left') {
      setDragMode('trim-start');
      handleTrimStart(e, trackId, track);
    } else if (edge === 'right') {
      setDragMode('trim-end');
      handleTrimEnd(e, trackId, track);
    } else {
      setDragMode('move');
      handleMove(e, trackId, track);
    }
  };

  const handleMove = (e: React.MouseEvent, trackId: string, track: AudioTrack) => {
    const startX = e.clientX;
    const rect = timelineRef.current!.getBoundingClientRect();
    const startTimelineStart = track.timelineStart;
    const trackDuration = getTrackDuration(track);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = (deltaX / rect.width) * totalDuration;
      const newStartTime = Math.max(0, Math.min(totalDuration - trackDuration, startTimelineStart + deltaTime));

      setHoverPosition(newStartTime);

      const hasCollision = checkCollision(trackId, newStartTime, trackDuration);
      
      if (hasCollision) {
        const shiftedTracks = shiftOverlappingTracks(trackId, newStartTime, trackDuration);
        const updatedTracks = shiftedTracks.map(t =>
          t.id === trackId ? { ...t, timelineStart: newStartTime } : t
        );
        onAudioTracksChange(updatedTracks);
      } else {
        const updatedTracks = audioTracks.map(t =>
          t.id === trackId ? { ...t, timelineStart: newStartTime } : t
        );
        onAudioTracksChange(updatedTracks);
      }
    };

    const handleMouseUp = () => {
      setHoverPosition(null);
      setDragMode(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTrimStart = (e: React.MouseEvent, trackId: string, track: AudioTrack) => {
    const startX = e.clientX;
    const rect = timelineRef.current!.getBoundingClientRect();
    const startClipStart = track.clipStart;
    const startTimelineStart = track.timelineStart;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = (deltaX / rect.width) * totalDuration;
      
      // Calculate new clip start (can't be negative or exceed full duration)
      const newClipStart = Math.max(0, Math.min(track.fullDuration - track.clipEnd - 0.1, startClipStart + deltaTime));
      const newTimelineStart = startTimelineStart + (newClipStart - startClipStart);

      const updatedTracks = audioTracks.map(t =>
        t.id === trackId ? { ...t, clipStart: newClipStart, timelineStart: newTimelineStart } : t
      );
      onAudioTracksChange(updatedTracks);
    };

    const handleMouseUp = () => {
      setDragMode(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTrimEnd = (e: React.MouseEvent, trackId: string, track: AudioTrack) => {
    const startX = e.clientX;
    const rect = timelineRef.current!.getBoundingClientRect();
    const startClipEnd = track.clipEnd;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = (deltaX / rect.width) * totalDuration;
      
      // Calculate new clip end (can't be negative or exceed full duration)
      const newClipEnd = Math.max(0, Math.min(track.fullDuration - track.clipStart - 0.1, startClipEnd - deltaTime));

      const updatedTracks = audioTracks.map(t =>
        t.id === trackId ? { ...t, clipEnd: newClipEnd } : t
      );
      onAudioTracksChange(updatedTracks);
    };

    const handleMouseUp = () => {
      setDragMode(null);
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

  const getCursor = (edge: 'left' | 'right' | 'center') => {
    if (edge === 'left' || edge === 'right') return 'ew-resize';
    return 'move';
  };

  const playheadPosition = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="bg-gray-900 border-t border-gray-700 flex flex-col" style={{ height: '120px' }}>
      <div className="px-3 py-1 bg-gray-800 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
        <span className="text-xs font-semibold text-gray-400">🎵 AUDIO TIMELINE</span>
        <span className="text-xs text-gray-500">
          {audioTracks.length} track{audioTracks.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex-1 relative px-3 py-2">
        <div className="absolute top-0 left-3 right-3 h-4 flex justify-between text-[10px] text-gray-500">
          {generateTimeMarkers().map(time => (
            <div key={time} className="relative">
              <span>{formatTime(time)}</span>
            </div>
          ))}
        </div>

        <div
          ref={timelineRef}
          className="absolute top-5 left-3 right-3 bottom-2 bg-gray-800 border border-gray-700 rounded overflow-hidden"
        >
          <div className="absolute inset-0 flex">
            {generateTimeMarkers().map(time => {
              const position = totalDuration > 0 ? (time / totalDuration) * 100 : 0;
              return (
                <div
                  key={time}
                  className="absolute top-0 bottom-0 w-px bg-gray-700"
                  style={{ left: `${position}%` }}
                />
              );
            })}
          </div>

          <div
            className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-20 pointer-events-none"
            style={{ left: `${playheadPosition}%` }}
          >
            <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 rounded-full" />
          </div>

          {audioTracks.map(track => {
            const hasCollision = hoverPosition !== null && 
              checkCollision(track.id, hoverPosition, getTrackDuration(audioTracks.find(t => t.id === track.id) || track));
            
            return (
              <div
                key={track.id}
                className={`absolute top-2 h-12 border rounded flex items-center px-2 group ${
                  hasCollision ? 'bg-red-600 border-red-500' : 'bg-green-600 border-green-500 hover:bg-green-500'
                }`}
                style={{
                  ...getTrackStyle(track),
                  cursor: dragMode === 'trim-start' || dragMode === 'trim-end' ? 'ew-resize' : 'move'
                }}
                onMouseDown={(e) => handleTrackMouseDown(e, track.id)}
                onMouseMove={(e) => {
                  const edge = getEdgeZone(e, e.currentTarget as HTMLElement);
                  (e.currentTarget as HTMLElement).style.cursor = getCursor(edge);
                }}
                title={`${track.filename}\nStart: ${formatTime(track.timelineStart)}\nDuration: ${formatTime(getTrackDuration(track))}\nClip: ${formatTime(track.clipStart)} - ${formatTime(track.fullDuration - track.clipEnd)}`}
              >
                <span className="text-xs text-white truncate flex-1 pointer-events-none">
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
            );
          })}

          {audioTracks.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs">
              Right-click audio files from the list to add them to the timeline
            </div>
          )}
        </div>
      </div>
    </div>
  );
}