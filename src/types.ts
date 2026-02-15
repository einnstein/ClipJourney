// src/types.ts

export interface MediaItem {
  id: string;
  filename: string;
  filepath: string;
  type: 'video' | 'image';
  duration?: number; // in seconds, only for videos
  thumbnail?: string; // base64 or URL
  dateCreated: Date;
  caption: string;
  showCaption: boolean;
  order: number;
  clips?: ClipRange[]; // Multiple clip selections for videos
}

export interface ClipRange {
  id: string;
  start: number; // in seconds
  end: number; // in seconds
}

export interface AppState {
  mediaItems: MediaItem[];
  selectedItemId: string | null;
  clipDuration: number;
  outputFormat: string;
  useFixedDuration: boolean;
}