import { Command } from '@tauri-apps/plugin-shell';

export async function testFFmpeg(): Promise<string> {
  try {
    const command = Command.create('ffmpeg', ['-version']);
    
    let output = '';
    
    command.stdout.on('data', (line) => {
      output += line + '\n';
      console.log('FFmpeg version output:', line);
    });
    
    command.stderr.on('data', (line) => {
      output += line + '\n';
      console.error('FFmpeg version stderr:', line);
    });
    
    const result = await command.execute();
    console.log('FFmpeg test result:', result);
    
    return output || 'No output received';
  } catch (error) {
    console.error('FFmpeg test failed:', error);
    return `Error: ${error}`;
  }
}