// src/utils/ffmpeg.ts

import { invoke } from '@tauri-apps/api/core';
import { MediaItem } from '../types';
import { CaptionSettings } from '../components/Captionsettingsmodal';

interface CombineVideoOptions {
  mediaItems: MediaItem[];
  outputPath: string;
  aspectRatio: string;
  defaultPhotoDuration: number;
  captionSettings: CaptionSettings;
  onProgress?: (percent: number) => void;
}

async function preprocessSingleItem(
  item: MediaItem,
  index: number,
  tempDir: string,
  aspectRatio: string,
  defaultPhotoDuration: number
): Promise<string> {
  const [width, height] = aspectRatio.split(':').map(Number);
  const targetWidth = 1920;
  const targetHeight = Math.round((targetWidth * height) / width);
  
  const outputPath = `${tempDir}\\temp_${index}.mp4`;

  if (item.type === 'video') {
    if (item.clips && item.clips.length > 0) {
      const clipPaths: string[] = [];
      
      for (let clipIdx = 0; clipIdx < item.clips.length; clipIdx++) {
        const clip = item.clips[clipIdx];
        const clipPath = `${tempDir}\\temp_${index}_clip_${clipIdx}.mp4`;
        
        const args = [
          '-ss', String(clip.start),  // MOVED BEFORE -i for faster seeking
          '-i', item.filepath,
          '-t', String(clip.end - clip.start),  // Duration instead of absolute time
          '-vf', `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`,
          '-af', 'aformat=sample_rates=48000:channel_layouts=stereo',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-avoid_negative_ts', 'make_zero',  // Fix timing issues
          '-y',
          clipPath
        ];
        
        await invoke<string>('run_ffmpeg', { args });
        clipPaths.push(clipPath);
      }
      
      if (clipPaths.length > 1) {
        const concatInputs = clipPaths.flatMap(p => ['-i', p]);
        const concatFilter = clipPaths.map((_, i) => `[${i}:v][${i}:a]`).join('') + 
          `concat=n=${clipPaths.length}:v=1:a=1[outv][outa]`;
        
        const concatArgs = [
          ...concatInputs,
          '-filter_complex', concatFilter,
          '-map', '[outv]',
          '-map', '[outa]',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-y',
          outputPath
        ];
        
        await invoke<string>('run_ffmpeg', { args: concatArgs });
      } else {
        const args = [
          '-i', clipPaths[0],
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-y',
          outputPath
        ];
        await invoke<string>('run_ffmpeg', { args });
      }
      
      return outputPath;
    } else {
      const args = [
        '-i', item.filepath,
        '-vf', `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`,
        '-af', 'aformat=sample_rates=48000:channel_layouts=stereo',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-y',
        outputPath
      ];
      
      await invoke<string>('run_ffmpeg', { args });
      return outputPath;
    }
  } else {
    const duration = item.photoDuration ?? defaultPhotoDuration;
    const args = [
      '-loop', '1',
      '-i', item.filepath,
      '-f', 'lavfi',
      '-i', `anullsrc=channel_layout=stereo:sample_rate=48000`,
      '-t', String(duration),
      '-vf', `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      '-y',
      outputPath
    ];
    
    await invoke<string>('run_ffmpeg', { args });
    return outputPath;
  }
}

export async function combineVideo(options: CombineVideoOptions): Promise<void> {
  const {
    mediaItems,
    outputPath,
    aspectRatio,
    defaultPhotoDuration,
    onProgress
  } = options;

  console.log(`Pre-processing ${mediaItems.length} items individually...`);

  try {
    const tempDir = outputPath.substring(0, outputPath.lastIndexOf('\\'));
    const processedPaths: string[] = [];

    for (let i = 0; i < mediaItems.length; i++) {
      if (onProgress) onProgress(10 + (i / mediaItems.length) * 80);
      console.log(`Processing item ${i + 1}/${mediaItems.length}`);
      
      const processedPath = await preprocessSingleItem(
        mediaItems[i],
        i,
        tempDir,
        aspectRatio,
        defaultPhotoDuration
      );
      processedPaths.push(processedPath);
    }

    console.log('Concatenating all processed files...');
    if (onProgress) onProgress(90);

    const concatInputs = processedPaths.flatMap(p => ['-i', p]);
    const concatFilter = processedPaths.map((_, i) => `[${i}:v][${i}:a]`).join('') +
      `concat=n=${processedPaths.length}:v=1:a=1[outv][outa]`;

const concatArgs = [
  ...concatInputs,
  '-filter_complex', concatFilter,
  '-map', '[outv]',
  '-map', '[outa]',
  '-c:v', 'libx264',  // ✅ RE-ENCODE
  '-preset', 'ultrafast',
  '-crf', '23',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-y',
  outputPath
];

    await invoke<string>('run_ffmpeg', { args: concatArgs });
    
    if (onProgress) onProgress(100);
    console.log('Video combination complete!');
  } catch (error) {
    console.error('FFmpeg processing failed:', error);
    throw new Error(`FFmpeg failed: ${error}`);
  }
}