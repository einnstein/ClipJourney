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
  fadeInDuration: number;   // ADD THIS
  fadeOutDuration: number;  // ADD THIS
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
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTrackDuration = (track: AudioTrack) => {
    return track.fullDuration - track.clipStart - track.clipEnd;
  };

  
  const checkCollision = (trackId: string, newStart: number, newDuration: number): boolean => {
    const newEnd = newStart + newDuration;
    
    return audioTracks.some(track => {
      if (track.id === trackId) return false;
      
      const trackStart = track.timelineStart;
      const trackEnd = trackStart + getTrackDuration(track);
      
      return (newStart < trackEnd && newEnd > trackStart);
    });
  };

  const handleTrackMouseDown = (e: React.MouseEvent, trackId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
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

      if (!checkCollision(trackId, newStartTime, trackDuration)) {
        const updatedTracks = audioTracks.map(t =>
          t.id === trackId ? { ...t, timelineStart: newStartTime } : t
        );
        onAudioTracksChange(updatedTracks);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleLeftEdgeMouseDown = (e: React.MouseEvent, trackId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const track = audioTracks.find(t => t.id === trackId);
    if (!track || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const startClipStart = track.clipStart;
    const startTimelineStart = track.timelineStart;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = (deltaX / rect.width) * totalDuration;
      
      const newClipStart = Math.max(0, Math.min(track.fullDuration - track.clipEnd - 0.1, startClipStart + deltaTime));
      const newTimelineStart = startTimelineStart + deltaTime;
      const newDuration = track.fullDuration - newClipStart - track.clipEnd;

      if (newTimelineStart >= 0 && newDuration > 0.1 && !checkCollision(trackId, newTimelineStart, newDuration)) {
        const updatedTracks = audioTracks.map(t =>
          t.id === trackId ? { ...t, clipStart: newClipStart, timelineStart: newTimelineStart } : t
        );
        onAudioTracksChange(updatedTracks);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleRightEdgeMouseDown = (e: React.MouseEvent, trackId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const track = audioTracks.find(t => t.id === trackId);
    if (!track || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const startClipEnd = track.clipEnd;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = (deltaX / rect.width) * totalDuration;
      
      const newClipEnd = Math.max(0, Math.min(track.fullDuration - track.clipStart - 0.1, startClipEnd - deltaTime));
      const newDuration = track.fullDuration - track.clipStart - newClipEnd;

      if (newDuration > 0.1 && !checkCollision(trackId, track.timelineStart, newDuration)) {
        const updatedTracks = audioTracks.map(t =>
          t.id === trackId ? { ...t, clipEnd: newClipEnd } : t
        );
        onAudioTracksChange(updatedTracks);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle fade in handle drag
  const handleFadeInMouseDown = (e: React.MouseEvent, trackId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const track = audioTracks.find(t => t.id === trackId);
    if (!track || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const startFadeIn = track.fadeInDuration;
    const trackDuration = getTrackDuration(track);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = (deltaX / rect.width) * totalDuration;
      
      const newFadeIn = Math.max(0, Math.min(trackDuration / 2, startFadeIn + deltaTime));
      
      const updatedTracks = audioTracks.map(t =>
        t.id === trackId ? { ...t, fadeInDuration: newFadeIn } : t
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

  // Handle fade out handle drag
  const handleFadeOutMouseDown = (e: React.MouseEvent, trackId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const track = audioTracks.find(t => t.id === trackId);
    if (!track || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const startFadeOut = track.fadeOutDuration;
    const trackDuration = getTrackDuration(track);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = -(deltaX / rect.width) * totalDuration; // Negative because dragging left increases fade
      
      const newFadeOut = Math.max(0, Math.min(trackDuration / 2, startFadeOut + deltaTime));
      
      const updatedTracks = audioTracks.map(t =>
        t.id === trackId ? { ...t, fadeOutDuration: newFadeOut } : t
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

const getFadeInWidth = (track: AudioTrack) => {
  const trackDuration = getTrackDuration(track);
  if (trackDuration === 0) return 0;
  return ((track.fadeInDuration || 0) / trackDuration) * 100;  // ADD || 0
};

const getFadeOutWidth = (track: AudioTrack) => {
  const trackDuration = getTrackDuration(track);
  if (trackDuration === 0) return 0;
  return ((track.fadeOutDuration || 0) / trackDuration) * 100;  // ADD || 0
};

  const playheadPosition = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  const generateTimeMarkers = () => {
    if (totalDuration === 0) return [];
    
    const markers = [];
    const interval = Math.max(10, Math.ceil(totalDuration / 10));
    
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
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400">🎵 AUDIO TIMELINE</span>
        <span className="text-xs text-gray-500">
          {audioTracks.length} track{audioTracks.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex-1 flex items-center gap-3">
        <span className="text-xs text-gray-400 w-16 text-left">
          {formatTime(currentTime)}
        </span>

        <div className="flex-1 relative h-full">
<div
  ref={timelineRef}
  className="absolute inset-0 bg-gray-800 border border-gray-700 rounded overflow-hidden"
  onClick={() => setSelectedTrackId(null)}  // ADD THIS - click background to deselect
>
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

            <div
              className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-20 pointer-events-none"
              style={{ left: `${playheadPosition}%` }}
            >
              <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 rounded-full" />
            </div>

            <div className="absolute inset-0">
              {audioTracks.map((track) => {
                const fadeInWidth = getFadeInWidth(track);
                const fadeOutWidth = getFadeOutWidth(track);
                
                return (
                  <div
                    key={track.id}
                    className={`absolute h-8 bg-green-600 border-2 hover:bg-green-500 rounded cursor-move flex items-center group overflow-hidden ${
                      selectedTrackId === track.id ? 'border-blue-500' : 'border-green-500'
                    }`}
                    style={{
                      ...getTrackStyle(track),
                      top: '50%',
                      transform: 'translateY(-50%)'
                    }}
                    onMouseDown={(e) => {
                      setSelectedTrackId(track.id);
                      handleTrackMouseDown(e, track.id);
                    }}
                    title={`${track.filename}\nStart: ${formatTime(track.timelineStart)}\nDuration: ${formatTime(getTrackDuration(track))}\nVolume: ${Math.round(track.volume * 100)}%`}
                  >
                    {/* Fade In Triangle Overlay */}
                    {track.fadeInDuration > 0 && (
                      <div
                        className="absolute left-0 top-0 bottom-0 pointer-events-none"
                        style={{
                          width: `${fadeInWidth}%`,
                          background: 'linear-gradient(to right, rgba(0,0,0,0.5), transparent)'
                        }}
                      >
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <polygon points="0,100 100,0 100,100" fill="rgba(0,0,0,0.3)" />
                        </svg>
                      </div>
                    )}
                    
                    {/* Fade Out Triangle Overlay */}
                    {track.fadeOutDuration > 0 && (
                      <div
                        className="absolute right-0 top-0 bottom-0 pointer-events-none"
                        style={{
                          width: `${fadeOutWidth}%`,
                          background: 'linear-gradient(to left, rgba(0,0,0,0.5), transparent)'
                        }}
                      >
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <polygon points="0,0 0,100 100,100" fill="rgba(0,0,0,0.3)" />
                        </svg>
                      </div>
                    )}

                    {/* Fade In Handle */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-yellow-400 bg-yellow-500 z-10"
                      style={{ left: `${fadeInWidth}%` }}
                      onMouseDown={(e) => handleFadeInMouseDown(e, track.id)}
                      title="Drag to adjust fade in"
                    />

                    {/* Left edge trim handle */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-2 bg-blue-500 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-blue-400 z-10"
                      onMouseDown={(e) => handleLeftEdgeMouseDown(e, track.id)}
                      title="Drag to trim start"
                    />
                    
                    <span className="text-xs text-white truncate flex-1 px-2 relative z-0">
                      {track.filename}
                    </span>
                    
                    {/* Right edge trim handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 bg-blue-500 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-blue-400 z-10"
                      onMouseDown={(e) => handleRightEdgeMouseDown(e, track.id)}
                      title="Drag to trim end"
                    />

                    {/* Fade Out Handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-yellow-400 bg-yellow-500 z-10"
                      style={{ right: `${fadeOutWidth}%` }}
                      onMouseDown={(e) => handleFadeOutMouseDown(e, track.id)}
                      title="Drag to adjust fade out"
                    />
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveTrack(track.id);
                      }}
                      className="mr-1 px-1 bg-red-600 hover:bg-red-700 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity relative z-10"
                    >
                      ×
                    </button>
                  </div>
                );
              })}

              {audioTracks.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs">
                  Right-click audio files to add them to timeline
                </div>
              )}
            </div>
          </div>
        </div>

        <span className="text-xs text-gray-400 w-16 text-right">
          {formatTime(totalDuration)}
        </span>
      </div>

      {/* Volume control for selected track */}
      {selectedTrackId && (
        <div className="mt-2 p-2 bg-gray-800 rounded border border-gray-700">
          {(() => {
            const track = audioTracks.find(t => t.id === selectedTrackId);
            if (!track) return null;
            
            return (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-16">Volume:</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={track.volume * 100}
                    onChange={(e) => {
                      const newVolume = Number(e.target.value) / 100;
                      const updatedTracks = audioTracks.map(t =>
                        t.id === selectedTrackId ? { ...t, volume: newVolume } : t
                      );
                      onAudioTracksChange(updatedTracks);
                    }}
                    className="flex-1"
                  />
                  <span className="text-xs text-gray-400 w-12 text-right">
                    {Math.round(track.volume * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
<span className="w-16">Fade In: {(track.fadeInDuration || 0).toFixed(1)}s</span>
<span className="w-16">Fade Out: {(track.fadeOutDuration || 0).toFixed(1)}s</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}