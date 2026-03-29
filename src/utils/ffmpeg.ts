// src/utils/ffmpeg.ts

import { invoke } from '@tauri-apps/api/core';
import { exists, mkdir, remove } from '@tauri-apps/plugin-fs';
import { MediaItem } from '../types';
import { CaptionSettings } from '../components/Captionsettingsmodal';

interface CombineVideoOptions {
  mediaItems: MediaItem[];
  outputPath: string;
  aspectRatio: string;
  defaultPhotoDuration: number;
  captionSettings: CaptionSettings;
  targetResolution?: string;  // ADD THIS LINE
  onProgress?: (percent: number) => void;
}

function buildCaptionFilter(item: MediaItem, captionSettings: CaptionSettings): string {
  if (!item.showCaption || !item.caption) {
    return '';
  }

  const escapedCaption = item.caption
    .replace(/\\/g, '\\\\\\\\')
    .replace(/'/g, "'\\\\\\''")
    .replace(/:/g, '\\:');

  const fontSize = captionSettings.fontSize;
  const fontColor = captionSettings.textColor.replace('#', '0x');
  const boxColor = captionSettings.backgroundColor.replace('#', '0x');
  const boxOpacity = Math.round(captionSettings.backgroundOpacity * 255).toString(16).padStart(2, '0');

  const positions: Record<string, string> = {
    'bottom-left': 'x=40:y=h-th-40',
    'bottom-center': 'x=(w-tw)/2:y=h-th-40',
    'bottom-right': 'x=w-tw-40:y=h-th-40',
    'top-left': 'x=40:y=40',
    'top-center': 'x=(w-tw)/2:y=40',
    'top-right': 'x=w-tw-40:y=40',
    'center': 'x=(w-tw)/2:y=(h-th)/2'
  };

  const position = positions[captionSettings.position] || positions['bottom-center'];
  const fontFile = 'C\\\\:/Windows/Fonts/arial.ttf';

  const drawtextFilter = 
    `drawtext=` +
    `fontfile=${fontFile}:` +
    `text='${escapedCaption}':` +
    `fontsize=${fontSize}:` +
    `fontcolor=${fontColor}:` +
    `box=1:` +
    `boxcolor=${boxColor}${boxOpacity}:` +
    `boxborderw=10:` +
    position;

  return `,${drawtextFilter}`;
}

async function preprocessSingleItem(
  item: MediaItem,
  index: number,
  tempDir: string,
  defaultPhotoDuration: number,
  captionSettings: CaptionSettings,
  targetWidth: number,
  targetHeight: number
): Promise<string> {
  const outputPath = `${tempDir}\\temp_${index}.mp4`;

  const captionFilter = buildCaptionFilter(item, captionSettings);
  const videoFilter = `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,` +
                      `pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black,` +
                      `setsar=1${captionFilter}`;

  if (item.type === 'video') {
    if (item.clips && item.clips.length > 0) {
      const clipPaths: string[] = [];
      
      for (let clipIdx = 0; clipIdx < item.clips.length; clipIdx++) {
        const clip = item.clips[clipIdx];
        const clipPath = `${tempDir}\\temp_${index}_clip_${clipIdx}.mp4`;
        
        const args = [
          '-ss', String(clip.start),
          '-i', item.filepath,
          '-t', String(clip.end - clip.start),
          '-vf', videoFilter,
          '-af', 'aformat=sample_rates=48000:channel_layouts=stereo',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-avoid_negative_ts', 'make_zero',
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
        '-vf', videoFilter,
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
      '-vf', videoFilter,
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
    defaultPhotoDuration,
    captionSettings,
    onProgress
  } = options;

  console.log(`Pre-processing ${mediaItems.length} items with captions...`);

  try {
    const projectDir = outputPath.substring(0, outputPath.lastIndexOf('\\'));
    const projectName = outputPath.substring(outputPath.lastIndexOf('\\') + 1, outputPath.lastIndexOf('_combined'));
    const tempDir = `${projectDir}\\${projectName}_temp`;

    try {
      const tempExists = await exists(tempDir);
      if (tempExists) {
        await remove(tempDir, { recursive: true });
      }
    } catch (error) {
      console.log('Temp dir does not exist, will create');
    }
    
    await mkdir(tempDir, { recursive: true });
    console.log(`Created temp directory: ${tempDir}`);

    // Detect highest resolution from all videos
   // Use target resolution if provided, otherwise detect from videos
let maxWidth = 1920;
let maxHeight = 1080;

if (options.targetResolution) {
  // User selected resolution
  [maxWidth, maxHeight] = options.targetResolution.split('x').map(Number);
  console.log(`Using user-selected resolution: ${maxWidth}x${maxHeight}`);
} else {
  // Auto-detect from videos (fallback)
  for (const item of mediaItems) {
    if (item.type === 'video') {
      if (item.resolution) {
        const [width, height] = item.resolution.split('x').map(Number);
        if (width > maxWidth) {
          maxWidth = width;
          maxHeight = height;
        }
      }
    }
  }
  console.log(`Auto-detected resolution: ${maxWidth}x${maxHeight}`);
}
    
    console.log(`Using maximum resolution: ${maxWidth}x${maxHeight}`);

    const processedPaths: string[] = [];

    for (let i = 0; i < mediaItems.length; i++) {
      if (onProgress) onProgress(10 + (i / mediaItems.length) * 80);
      console.log(`Processing item ${i + 1}/${mediaItems.length}`);
      
      const processedPath = await preprocessSingleItem(
        mediaItems[i],
        i,
        tempDir,
        defaultPhotoDuration,
        captionSettings,
        maxWidth,
        maxHeight
      );
      processedPaths.push(processedPath);
    }

 console.log('Concatenating all processed files...');
if (onProgress) onProgress(90);

// If too many files, process in batches
if (processedPaths.length > 50) {
  console.log(`Too many files (${processedPaths.length}), using batch concatenation...`);
  
  const BATCH_SIZE = 20;
  const batchPaths: string[] = [];
  
  for (let batchIdx = 0; batchIdx < Math.ceil(processedPaths.length / BATCH_SIZE); batchIdx++) {
    const batchStart = batchIdx * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, processedPaths.length);
    const batchFiles = processedPaths.slice(batchStart, batchEnd);
    
    console.log(`Concatenating batch ${batchIdx + 1}, files ${batchStart}-${batchEnd}`);
    
    const batchOutputPath = `${tempDir}\\batch_${batchIdx}.mp4`;
    
    const batchInputs = batchFiles.flatMap(p => ['-i', p]);
    const batchFilter = batchFiles.map((_, i) => `[${i}:v][${i}:a]`).join('') +
      `concat=n=${batchFiles.length}:v=1:a=1[outv][outa]`;

    const batchArgs = [
      ...batchInputs,
      '-filter_complex', batchFilter,
      '-map', '[outv]',
      '-map', '[outa]',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-y',
      batchOutputPath
    ];

    await invoke<string>('run_ffmpeg', { args: batchArgs });
    batchPaths.push(batchOutputPath);
  }
  
  // Now concat all batches
  console.log(`Merging ${batchPaths.length} batches...`);
  const finalInputs = batchPaths.flatMap(p => ['-i', p]);
  const finalFilter = batchPaths.map((_, i) => `[${i}:v][${i}:a]`).join('') +
    `concat=n=${batchPaths.length}:v=1:a=1[outv][outa]`;

  const finalArgs = [
    ...finalInputs,
    '-filter_complex', finalFilter,
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

  await invoke<string>('run_ffmpeg', { args: finalArgs });
  
} else {
  // Normal concat for smaller projects
  const concatInputs = processedPaths.flatMap(p => ['-i', p]);
  const concatFilter = processedPaths.map((_, i) => `[${i}:v][${i}:a]`).join('') +
    `concat=n=${processedPaths.length}:v=1:a=1[outv][outa]`;

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
}

if (onProgress) onProgress(100);
console.log(`Video combination complete at ${maxWidth}x${maxHeight} with captions!`);
    
  } catch (error) {
    console.error('FFmpeg processing failed:', error);
    throw new Error(`FFmpeg failed: ${error}`);
  }
}