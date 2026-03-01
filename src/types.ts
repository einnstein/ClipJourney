// src/types.ts

export interface ClipRange {
  id: string;
  start: number;
  end: number;
}

export interface MediaItem {
  id: string;
  filename: string;
  filepath: string;
  type: 'video' | 'image';
  duration?: number; // Video duration in seconds
  photoDuration?: number; // Photo display duration in seconds (undefined = use default)
  thumbnail?: string;
  dateCreated: Date;
  caption: string;
  showCaption: boolean;
  order: number;
  clips?: ClipRange[];
}