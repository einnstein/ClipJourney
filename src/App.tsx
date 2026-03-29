import { useState, useMemo, useEffect } from 'react';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { load } from '@tauri-apps/plugin-store';
import { MediaItem } from './types';
import MediaListPanel from './components/MediaListPanel';
import PreviewPanel from './components/PreviewPanel';
import EditingPanel from './components/EditingPanel';
import CaptionSettingsModal, { CaptionSettings, DEFAULT_CAPTION_SETTINGS } from './components/Captionsettingsmodal';
import AspectRatioModal from './components/AspectRatioModal';
import { generateProjectHash, createSnapshot, ProjectSnapshot } from './utils/projectHash';
import ProgressModal from './components/ProgressModal';
import { exists } from '@tauri-apps/plugin-fs';
import FinalizationWindow from './components/FinalizationWindow';
import { AudioTrack } from './components/AudioTimeline';
import YouTubeTimestampsModal from './components/YouTubeTimestampsModal';
import ResolutionModal from './components/ResolutionModal';

function App() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState('MP4');
  const [defaultPhotoDuration, setDefaultPhotoDuration] = useState(3);
  const [splitPosition, setSplitPosition] = useState(50); // 50% split
  const [isDragging, setIsDragging] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [showCaptionSettings, setShowCaptionSettings] = useState(false);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const [captionSettings, setCaptionSettings] = useState<CaptionSettings>(DEFAULT_CAPTION_SETTINGS);
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [showAspectRatioModal, setShowAspectRatioModal] = useState(false);
const [showProgressModal, setShowProgressModal] = useState(false);
const [progressMessage, setProgressMessage] = useState('');
const [progressPercent, setProgressPercent] = useState<number | undefined>(undefined);
const [projectSnapshot, setProjectSnapshot] = useState<ProjectSnapshot | null>(null);
const [combinedVideoPath, setCombinedVideoPath] = useState<string | null>(null);
const [showFinalizationWindow, setShowFinalizationWindow] = useState(false);
const [showYouTubeTimestamps, setShowYouTubeTimestamps] = useState(false);
const [showResolutionModal, setShowResolutionModal] = useState(false);
const [forceRecombine, setForceRecombine] = useState(false);

  const selectedItem = mediaItems.find(item => item.id === selectedItemId) || null;

  // Load recent projects from Tauri store on mount
  useEffect(() => {
    const loadRecentProjects = async () => {
      try {
        const store = await load('settings.json', { autoSave: false, defaults: {} });
        const stored = await store.get<string[]>('recentProjects');
        console.log('Loaded recent projects:', stored);
        if (Array.isArray(stored)) {
          setRecentProjects(stored);
        }
      } catch (error) {
        console.error('Error loading recent projects:', error);
      }
    };
    loadRecentProjects();
  }, []);

  // Save recent projects to Tauri store when changed
  useEffect(() => {
    const saveRecentProjects = async () => {
      try {
        const store = await load('settings.json', { autoSave: false, defaults: {} });
        await store.set('recentProjects', recentProjects);
        await store.save();
        console.log('Saved recent projects:', recentProjects);
      } catch (error) {
        console.error('Error saving recent projects:', error);
      }
    };
    
    // Save whenever recentProjects changes (including first save)
    if (recentProjects.length > 0) {
      saveRecentProjects();
    }
  }, [recentProjects]);

  // Add project to recent list
  const addToRecentProjects = (path: string) => {
    console.log('Adding to recent projects:', path);
    setRecentProjects(prev => {
      // Remove if already exists
      const filtered = prev.filter(p => p !== path);
      // Add to front, keep max 5
      const newRecents = [path, ...filtered].slice(0, 5);
      console.log('New recent projects list:', newRecents);
      return newRecents;
    });
  };

  // Track changes to mark project as modified
  useEffect(() => {
    if (projectPath) {
      setHasUnsavedChanges(true);
    }
  }, [mediaItems, outputFormat, defaultPhotoDuration, splitPosition, selectedItemId]);

  // Calculate total and edited lengths
  const { totalLength, editedLength } = useMemo(() => {
    let total = 0;
    let edited = 0;

    mediaItems.forEach(item => {
      if (item.type === 'video' && item.duration) {
        total += item.duration;
        
        // If clips are defined and exist, use only the clips duration
        // Otherwise, use the full video duration
        if (item.clips && item.clips.length > 0) {
          const clipsTotal = item.clips.reduce((sum, clip) => {
            return sum + (clip.end - clip.start);
          }, 0);
          edited += clipsTotal;
        } else {
          // No clips defined = include full video
          edited += item.duration;
        }
      } else if (item.type === 'image') {
        // Use individual photo duration if set, otherwise use global default
        const photoDuration = item.photoDuration ?? defaultPhotoDuration;
        total += photoDuration;
        edited += photoDuration;
      }
    });

    return { totalLength: total, editedLength: edited };
  }, [mediaItems, defaultPhotoDuration]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectItem = (id: string | null) => {
    setSelectedItemId(id);
  };

  const handleSaveProject = async () => {
    try {
      let filePath = projectPath;

      // If no existing project, show save dialog
      if (!filePath) {
        filePath = await save({
          filters: [{
            name: 'ClipJourney Project',
            extensions: ['cjproj']
          }],
          defaultPath: 'Untitled.cjproj'
        });

        if (!filePath) return; // User cancelled
      }

      const projectData = {
        version: '1.0',
        mediaItems: mediaItems.map(item => ({
          ...item,
          dateCreated: item.dateCreated.toISOString()
        })),
        outputFormat,
        defaultPhotoDuration,
        captionSettings,
        aspectRatio,
        splitPosition,
        selectedItemId
      };

      await writeTextFile(filePath, JSON.stringify(projectData, null, 2));
      setProjectPath(filePath);
      setHasUnsavedChanges(false);
      addToRecentProjects(filePath);
      
    } catch (error) {
      console.error('Error saving project:', error);
      alert(`Failed to save project: ${error}`);
    }
  };

  const handleSaveAsProject = async () => {
    try {
      const filePath = await save({
        filters: [{
          name: 'ClipJourney Project',
          extensions: ['cjproj']
        }],
        defaultPath: projectPath || 'Untitled.cjproj'
      });

      if (!filePath) return; // User cancelled

    const projectData = {
      version: '1.0',
      mediaItems: mediaItems.map(item => ({
        ...item,
        dateCreated: item.dateCreated.toISOString()
      })),
      outputFormat,
      defaultPhotoDuration,
      captionSettings,
      aspectRatio,
      splitPosition,
      selectedItemId
    };

      await writeTextFile(filePath, JSON.stringify(projectData, null, 2));
      setProjectPath(filePath);
      setHasUnsavedChanges(false);
      addToRecentProjects(filePath);
      
    } catch (error) {
      console.error('Error saving project:', error);
      alert(`Failed to save project: ${error}`);
    }
  };

  const handleLoadRecentProject = async (filePath: string) => {
    try {
      // Check for unsaved changes
      if (hasUnsavedChanges && mediaItems.length > 0) {
        const confirmed = confirm('You have unsaved changes. Continue loading?');
        if (!confirmed) return;
      }

      const content = await readTextFile(filePath);
      const projectData = JSON.parse(content);

      // Restore media items with Date objects
      const restoredItems: MediaItem[] = projectData.mediaItems.map((item: any) => ({
        ...item,
        dateCreated: new Date(item.dateCreated)
      }));

      setMediaItems(restoredItems);
      setOutputFormat(projectData.outputFormat || 'MP4');
      setDefaultPhotoDuration(projectData.defaultPhotoDuration || 3);
      setCaptionSettings(projectData.captionSettings || DEFAULT_CAPTION_SETTINGS);
      setAspectRatio(projectData.aspectRatio || '16:9');
      setSplitPosition(projectData.splitPosition || 50);
      setSelectedItemId(projectData.selectedItemId || null);
      setProjectPath(filePath);
      setHasUnsavedChanges(false);
      addToRecentProjects(filePath);
      await loadProjectSnapshot(filePath);
    } catch (error) {
      console.error('Error loading recent project:', error);
      alert(`Failed to load project: ${error}`);
      // Remove from recent if file doesn't exist or can't be read
      setRecentProjects(prev => prev.filter(p => p !== filePath));
    }
  };

  const handleLoadProject = async () => {
    try {
      // Check for unsaved changes
      if (hasUnsavedChanges && mediaItems.length > 0) {
        const confirmed = confirm('You have unsaved changes. Continue loading?');
        if (!confirmed) return;
      }

      const filePath = await open({
        filters: [{
          name: 'ClipJourney Project',
          extensions: ['cjproj']
        }],
        multiple: false
      });

      if (!filePath) return;

      const filePathStr = Array.isArray(filePath) ? filePath[0] : filePath;
      const content = await readTextFile(filePathStr);
      const projectData = JSON.parse(content);

      // Restore media items with Date objects
      const restoredItems: MediaItem[] = projectData.mediaItems.map((item: any) => ({
        ...item,
        dateCreated: new Date(item.dateCreated)
      }));

      setMediaItems(restoredItems);
      setOutputFormat(projectData.outputFormat || 'MP4');
      setDefaultPhotoDuration(projectData.defaultPhotoDuration || 3);
      setCaptionSettings(projectData.captionSettings || DEFAULT_CAPTION_SETTINGS);
      setAspectRatio(projectData.aspectRatio || '16:9');
      setSplitPosition(projectData.splitPosition || 50);
      setSelectedItemId(projectData.selectedItemId || null);
      setProjectPath(filePathStr);
      setHasUnsavedChanges(false);
      addToRecentProjects(filePathStr);
      await loadProjectSnapshot(filePathStr);
    } catch (error) {
      console.error('Error loading project:', error);
      alert(`Failed to load project: ${error}`);
    }
  };

  const handleNewProject = () => {
    if (mediaItems.length > 0 || hasUnsavedChanges) {
      const confirmed = confirm('Are you sure? Any unsaved changes will be lost.');
      if (!confirmed) return;
    }
    
    setMediaItems([]);
    setSelectedItemId(null);
    setOutputFormat('MP4');
    setDefaultPhotoDuration(3);
    setSplitPosition(50);
    setProjectPath(null);
    setHasUnsavedChanges(false);
  };

  const handleClipsChange = (clips: any[]) => {
    if (!selectedItemId) return;
    
    const updatedItems = mediaItems.map(item => 
      item.id === selectedItemId ? { ...item, clips } : item
    );
    setMediaItems(updatedItems);
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const newPosition = (y / rect.height) * 100;
    
    // Limit between 20% and 80%
    setSplitPosition(Math.max(20, Math.min(80, newPosition)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

// Load snapshot from project file
const loadProjectSnapshot = async (projectFilePath: string) => {
  try {
    const snapshotPath = projectFilePath.replace('.cjproj', '_snapshot.json');
    const snapshotExists = await exists(snapshotPath);
    
    if (snapshotExists) {
      const content = await readTextFile(snapshotPath);
      const snapshot: ProjectSnapshot = JSON.parse(content);
      setProjectSnapshot(snapshot);
      
      // Check if combined video exists
// Check if combined video exists AND is not empty
const videoExists = await exists(snapshot.combinedVideoPath);
if (videoExists) {
  setCombinedVideoPath(snapshot.combinedVideoPath);
} else {
  // Video file doesn't exist anymore, clear the snapshot
  setCombinedVideoPath(null);
  setProjectSnapshot(null);
}
    }
  } catch (error) {
    console.error('Error loading snapshot:', error);
  }
};

// Save snapshot after combining video
const saveProjectSnapshot = async (snapshot: ProjectSnapshot) => {
  try {
    if (!projectPath) return;
    
    const snapshotPath = projectPath.replace('.cjproj', '_snapshot.json');
    await writeTextFile(snapshotPath, JSON.stringify(snapshot, null, 2));
    setProjectSnapshot(snapshot);
  } catch (error) {
    console.error('Error saving snapshot:', error);
  }
};

// Check if video needs re-combining
// Check if video needs re-combining
const needsRecombining = async (): Promise<boolean> => {
  // Force recombine if checkbox is checked
  if (forceRecombine) {
    console.log('Force re-combine enabled');
    return true;
  }

  const currentHash = generateProjectHash({
    mediaItems,
    captionSettings,
    aspectRatio,
    defaultPhotoDuration
  });
  
  if (!projectSnapshot) {
    console.log('No snapshot found - needs combining');
    return true;
  }
  
  if (projectSnapshot.projectHash !== currentHash) {
    console.log('Hash mismatch - needs combining');
    console.log('Current:', currentHash);
    console.log('Saved:', projectSnapshot.projectHash);
    return true;
  }
  
  if (!combinedVideoPath) {
    console.log('No combined video path - needs combining');
    return true;
  }
  
  // Actually check if the file exists on disk
  const fileExists = await exists(combinedVideoPath);
  if (!fileExists) {
    console.log('Combined video file deleted - needs combining');
    return true;
  }
  
  console.log('No changes detected - can reuse combined video');
  return false;
};

// Handle Finalize & Export button click
const handleFinalizeAndExport = async () => {
  if (!projectPath) {
    alert('Please save your project first');
    return;
  }
  
  if (mediaItems.length === 0) {
    alert('No media items to combine');
    return;
  }
  
  try {
    // Check if we need to recombine FIRST
    const needsUpdate = await needsRecombining();
    
    if (needsUpdate) {
      // Video needs combining - show resolution modal
      setShowResolutionModal(true);
    } else {
      // Reuse existing video - skip modal, go straight to finalization
      console.log('Using existing combined video');
      setShowFinalizationWindow(true);
    }
  } catch (error) {
    console.error('Error in finalization:', error);
    alert(`Error: ${error}`);
  }
};

const getSuggestedResolution = (): string => {
  const firstVideo = mediaItems.find(item => item.type === 'video');
  if (firstVideo?.resolution) {
    return firstVideo.resolution;
  }
  return '2704x1520'; // Default to common GoPro resolution
};

const handleResolutionConfirm = async (resolution: string) => {
  setShowResolutionModal(false);
    
  try {
    if (await needsRecombining()) {
      // Re-combine video with selected resolution
      setProgressMessage('Combining video clips...');
      await combineVideoWithResolution(resolution);
    }
    
    // Now open the finalization window
    setShowFinalizationWindow(true);
    
  } catch (error) {
    console.error('Error in finalization:', error);
    alert(`Error: ${error}`);
  }
};

const combineVideoWithResolution = async (resolution: string): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
      setShowProgressModal(true);
      setProgressMessage('Combining video clips...');
      setProgressPercent(0);
      
      const combinedPath = projectPath!.replace('.cjproj', '_combined.mp4');
      
      const { combineVideo: ffmpegCombine } = await import('./utils/ffmpeg');
      
      // Pass resolution to ffmpeg
      await ffmpegCombine({
        mediaItems,
        outputPath: combinedPath,
        aspectRatio,
        defaultPhotoDuration,
        captionSettings,
        targetResolution: resolution,
        onProgress: (percent) => {
          setProgressPercent(percent);
        }
      });
      
      const currentHash = generateProjectHash({
        mediaItems,
        captionSettings,
        aspectRatio,
        defaultPhotoDuration
      });
      
      const snapshot = createSnapshot(
        currentHash,
        combinedPath,
        mediaItems.length,
        editedLength
      );
      
      await saveProjectSnapshot(snapshot);
      setCombinedVideoPath(combinedPath);
      
      setShowProgressModal(false);
      resolve(combinedPath);
    } catch (error) {
      setShowProgressModal(false);
      reject(error);
    }
  });
};

const handleCloseFinalization = () => {
  setShowFinalizationWindow(false);
};

const handleFinalExport = async (audioTracks: AudioTrack[], videoDuckingPercent: number) => {
  if (!combinedVideoPath || !projectPath) {
    alert('No video to export');
    return;
  }

  try {
    setShowFinalizationWindow(false);
    setProgressMessage('Exporting final video with audio...');
    setProgressPercent(0);
    setShowProgressModal(true);

    const projectDir = projectPath.substring(0, projectPath.lastIndexOf('\\'));
    const projectName = projectPath.substring(
      projectPath.lastIndexOf('\\') + 1,
      projectPath.lastIndexOf('.cjproj')
    );
    const finalOutputPath = `${projectDir}\\${projectName}_final.mp4`;

    if (audioTracks.length === 0) {
      // No audio tracks, just copy combined video as final
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('run_ffmpeg', {
        args: ['-i', combinedVideoPath, '-c', 'copy', '-y', finalOutputPath]
      });
    } else {
      // Merge video with audio tracks
      await mergeVideoWithAudio(combinedVideoPath, audioTracks, finalOutputPath, videoDuckingPercent);
    }

    setShowProgressModal(false);
    alert(`Video exported successfully!\n${finalOutputPath}`);

  } catch (error) {
    console.error('Error exporting final video:', error);
    setShowProgressModal(false);
    alert(`Export failed: ${error}`);
  }
};

// Complete mergeVideoWithAudio function with video ducking
// Replace your existing mergeVideoWithAudio function in App.tsx with this:

const mergeVideoWithAudio = async (
  videoPath: string,
  audioTracks: AudioTrack[],
  outputPath: string,
  videoDuckingPercent: number
) => {
  const { invoke } = await import('@tauri-apps/api/core');
  
  if (audioTracks.length === 0) {
    await invoke('run_ffmpeg', {
      args: ['-i', videoPath, '-c', 'copy', '-y', outputPath]
    });
    return;
  }
  
  const inputs = ['-i', videoPath];
  audioTracks.forEach(track => inputs.push('-i', track.filepath));

  const audioFilters: string[] = [];
  
  // Process music tracks
  audioTracks.forEach((track, i) => {
    const inputIdx = i + 1;
    const trackDuration = track.fullDuration - track.clipStart - track.clipEnd;
    
    let filterChain = `[${inputIdx}:a]`;
    
    if (track.clipStart > 0 || track.clipEnd > 0) {
      const trimEnd = track.fullDuration - track.clipEnd;
      filterChain += `atrim=start=${track.clipStart}:end=${trimEnd},asetpts=PTS-STARTPTS,`;
    }
    
    if ((track.fadeInDuration || 0) > 0) {
      filterChain += `afade=t=in:st=0:d=${track.fadeInDuration},`;
    }
    
    if ((track.fadeOutDuration || 0) > 0) {
      const fadeOutStart = trackDuration - track.fadeOutDuration;
      filterChain += `afade=t=out:st=${fadeOutStart}:d=${track.fadeOutDuration},`;
    }
    
    filterChain += `volume=${track.volume},adelay=${Math.round(track.timelineStart * 1000)}|${Math.round(track.timelineStart * 1000)}[a${i}]`;
    audioFilters.push(filterChain);
  });

  // Simple video audio ducking - just set to constant ducking volume
  const duckingVolume = videoDuckingPercent / 100;
  audioFilters.push(`[0:a]volume=${duckingVolume},aformat=sample_rates=48000:channel_layouts=stereo[va]`);

  // Mix everything
  const mixInputs = ['[va]', ...audioTracks.map((_, i) => `[a${i}]`)].join('');
  const mixFilter = `${mixInputs}amix=inputs=${audioTracks.length + 1}:duration=first:normalize=0[aout]`;

  const filterComplex = audioFilters.join(';') + ';' + mixFilter;

  const args = [
    ...inputs,
    '-filter_complex', filterComplex,
    '-map', '0:v',
    '-map', '[aout]',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-y',
    outputPath
  ];

  console.log('FFmpeg export args:', args);
  await invoke('run_ffmpeg', { args });
};

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Menu Bar */}
      <div className="h-8 bg-gray-800 border-b border-gray-700 flex items-center px-4 text-sm">
        <div className="relative">
          <button 
            onClick={() => setShowFileMenu(!showFileMenu)}
            className="hover:bg-gray-700 px-3 py-1 rounded"
          >
            File
          </button>
          {showFileMenu && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowFileMenu(false)}
              />
              <div className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg py-1 z-20 min-w-40">
                <button
                  onClick={() => {
                    handleNewProject();
                    setShowFileMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-sm"
                >
                  New Project
                </button>
                <button
                  onClick={() => {
                    handleLoadProject();
                    setShowFileMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-sm"
                >
                  Open Project...
                </button>
                <div className="border-t border-gray-700 my-1" />
                <button
                  onClick={() => {
                    handleSaveProject();
                    setShowFileMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-sm"
                >
                  Save Project
                </button>
                <button
                  onClick={() => {
                    handleSaveAsProject();
                    setShowFileMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-sm"
                >
                  Save Project As...
                </button>
                
                {/* Recent Projects */}
                {recentProjects.length > 0 && (
                  <>
                    <div className="border-t border-gray-700 my-1" />
                    <div className="px-4 py-1 text-xs text-gray-500 uppercase">
                      Recent Projects
                    </div>
                    {recentProjects.map((path, index) => (
                      <button
                        key={path}
                        onClick={() => {
                          handleLoadRecentProject(path);
                          setShowFileMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-700 text-xs text-gray-300 truncate"
                        title={path}
                      >
                        {index + 1}. {path.split('\\').pop()?.split('/').pop() || path}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowEditMenu(!showEditMenu)}
            className="hover:bg-gray-700 px-3 py-1 rounded"
          >
            Edit
          </button>
          {showEditMenu && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowEditMenu(false)}
              />
              <div className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg py-1 z-20 min-w-40">
                <button
                  onClick={() => {
                    setShowAspectRatioModal(true);
                    setShowEditMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-sm"
                >
                  Aspect Ratio...
                </button>
                <button
                  onClick={() => {
                    setShowCaptionSettings(true);
                    setShowEditMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-sm"
                >
                  Caption Settings...
                </button>
                <button
                  onClick={() => {
                    setShowYouTubeTimestamps(true);
                    setShowEditMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-sm"
                >
                  Generate YouTube Timestamps...
                </button>
              </div>
            </>
          )}
        </div>
        <button className="hover:bg-gray-700 px-3 py-1 rounded">View</button>
        <button className="hover:bg-gray-700 px-3 py-1 rounded">Help</button>
      </div>

      {/* Settings Panel */}
      <div className="h-[10%] bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center gap-6">
          {/* Project Name and Video Length Stats */}
          <div className="flex flex-col gap-2">
            <div className="text-xs text-gray-400">
              <span className="font-semibold">ClipJourney</span>
              {projectPath && (
                <>
                  {' - '}
                  {projectPath.split('\\').pop()?.split('/').pop()}
                  {hasUnsavedChanges && <span className="text-orange-400"> *</span>}
                </>
              )}
              {!projectPath && hasUnsavedChanges && <span className="text-orange-400"> - Untitled *</span>}
            </div>
            <div className="flex items-center gap-6 px-4 py-1 bg-gray-900 rounded border border-gray-700">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 uppercase">Total Length</span>
                <span className="text-lg font-semibold text-blue-400">{formatDuration(totalLength)}</span>
              </div>
              <div className="w-px h-8 bg-gray-700"></div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 uppercase">Edited Length</span>
                <span className="text-lg font-semibold text-green-400">{formatDuration(editedLength)}</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-gray-700"></div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm">Default Photo Duration:</label>
            <input 
              type="number" 
              value={defaultPhotoDuration}
              onChange={(e) => setDefaultPhotoDuration(Math.max(0.1, Number(e.target.value)))}
              min="0.1"
              step="0.5"
              className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
            />
            <span className="text-sm text-gray-400">seconds</span>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm">Output Format:</label>
            <select 
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
            >
              <option>MP4</option>
              <option>MOV</option>
              <option>AVI</option>
            </select>
          </div>

<div className="ml-auto flex items-center gap-3">
  <label className="flex items-center gap-2 text-xs text-gray-400">
    <input
      type="checkbox"
      checked={forceRecombine}
      onChange={(e) => setForceRecombine(e.target.checked)}
      className="w-4 h-4"
    />
    Force Re-combine
  </label>
  
  <button 
    onClick={handleFinalizeAndExport}
    className="px-4 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
  >
    Finalize & Export
  </button>
</div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* MediaList Panel */}
        <MediaListPanel
          mediaItems={mediaItems}
          selectedItemId={selectedItemId}
          defaultPhotoDuration={defaultPhotoDuration}
          isPreviewMode={isPreviewMode}
          onMediaItemsChange={setMediaItems}
          onSelectItem={handleSelectItem}
        />
{/* Right Side - Resizable Split */}
        <div 
          className="flex-1 flex flex-col relative"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* EditingPanel */}
          <div style={{ height: `${splitPosition}%` }}>
            <EditingPanel
              selectedItem={selectedItem}
              aspectRatio={aspectRatio}
              onClipsChange={handleClipsChange}
            />
          </div>

          {/* Splitter */}
          <div
            onMouseDown={handleMouseDown}
            className={`h-1 bg-gray-700 hover:bg-blue-500 cursor-row-resize flex-shrink-0 ${
              isDragging ? 'bg-blue-500' : ''
            }`}
          />

          {/* PreviewPanel */}
          <div style={{ height: `${100 - splitPosition}%` }}>
            <PreviewPanel 
              selectedItem={selectedItem} 
              mediaItems={mediaItems}
              defaultPhotoDuration={defaultPhotoDuration}
              captionSettings={captionSettings}
            aspectRatio={aspectRatio}
            onCurrentItemChange={handleSelectItem}
            onPreviewModeChange={setIsPreviewMode}
            />
          </div>
        </div>
      </div>

      {/* Caption Settings Modal */}
      {showCaptionSettings && (
        <CaptionSettingsModal
          settings={captionSettings}
          onSave={(newSettings) => {
            setCaptionSettings(newSettings);
            setHasUnsavedChanges(true);
          }}
          onClose={() => setShowCaptionSettings(false)}
        />
      )}
      {/* Aspect Ratio Modal */}
      {showAspectRatioModal && (
        <AspectRatioModal
          currentRatio={aspectRatio}
          onSave={(newRatio) => {
            setAspectRatio(newRatio);
            setHasUnsavedChanges(true);
          }}
          onClose={() => setShowAspectRatioModal(false)}
        />
        
      )}
      {/* Progress Modal */}
      {showProgressModal && (
        <ProgressModal
          title="Processing Video"
          message={progressMessage}
          progress={progressPercent}
        />
      )}

      {/* YouTube Timestamps Modal */}
{showYouTubeTimestamps && (
  <YouTubeTimestampsModal
    mediaItems={mediaItems}
    defaultPhotoDuration={defaultPhotoDuration}
    onClose={() => setShowYouTubeTimestamps(false)}
  />
)}

{showResolutionModal && (
  <ResolutionModal
    suggestedResolution={getSuggestedResolution()}
    onConfirm={handleResolutionConfirm}
    onCancel={() => setShowResolutionModal(false)}
  />
)}
      {showFinalizationWindow && combinedVideoPath && projectPath && (
  <FinalizationWindow
    combinedVideoPath={combinedVideoPath}
    projectPath={projectPath}
    onClose={handleCloseFinalization}
    onExport={handleFinalExport}
  />
)}
    </div>
  );
}

export default App;