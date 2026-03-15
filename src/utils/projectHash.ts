// src/utils/projectHash.ts

import { MediaItem } from '../types';
import { CaptionSettings } from '../components/Captionsettingsmodal';

interface HashableProject {
  mediaItems: MediaItem[];
  captionSettings: CaptionSettings;
  aspectRatio: string;
  defaultPhotoDuration: number;
}

export function generateProjectHash(project: HashableProject): string {
  const hashData = {
    mediaItems: project.mediaItems.map(item => ({
      id: item.id,
      filepath: item.filepath,
      type: item.type,
      clips: item.clips || [],
      caption: item.caption || '',
      showCaption: item.showCaption || false,
      photoDuration: item.photoDuration,
      duration: item.duration
    })),
    captionSettings: project.captionSettings,
    aspectRatio: project.aspectRatio,
    defaultPhotoDuration: project.defaultPhotoDuration
  };
  
  return simpleHash(JSON.stringify(hashData));
}

// Simple hash function (good enough for change detection)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

export interface ProjectSnapshot {
  version: string;
  projectHash: string;
  timestamp: number;
  combinedVideoPath: string;
  mediaItemCount: number;
  totalDuration: number;
}

export function createSnapshot(
  projectHash: string,
  combinedVideoPath: string,
  mediaItemCount: number,
  totalDuration: number
): ProjectSnapshot {
  return {
    version: '1.0',
    projectHash,
    timestamp: Date.now(),
    combinedVideoPath,
    mediaItemCount,
    totalDuration
  };
}