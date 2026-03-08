// src/components/AudioTrackList.tsx

export interface AudioItem {
  id: string;
  filename: string;
  filepath: string;
  duration: number;
}

interface AudioTrackListProps {
  audioItems: AudioItem[];
  onAudioItemsChange: (items: AudioItem[]) => void;
}

export default function AudioTrackList({ audioItems, onAudioItemsChange }: AudioTrackListProps) {
  const handleAddAudio = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'Audio',
          extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg']
        }]
      });

      if (!selected) return;

      const files = Array.isArray(selected) ? selected : [selected];
      
      const newAudioItems: AudioItem[] = files.map(filepath => ({
        id: `audio_${Date.now()}_${Math.random()}`,
        filename: filepath.split('\\').pop()?.split('/').pop() || 'Unknown',
        filepath: filepath,
        duration: 0
      }));

      onAudioItemsChange([...audioItems, ...newAudioItems]);
    } catch (error) {
      console.error('Error adding audio:', error);
    }
  };

  const handleRemoveAudio = (id: string) => {
    onAudioItemsChange(audioItems.filter(item => item.id !== id));
  };

  return (
    <div className="w-64 bg-gray-850 border-l border-gray-700 flex flex-col flex-shrink-0">
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <span className="font-semibold text-sm">Audio Tracks</span>
        <button
          onClick={handleAddAudio}
          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
        >
          + Add
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {audioItems.length === 0 ? (
          <div className="text-gray-500 text-xs text-center mt-4">
            No audio tracks
          </div>
        ) : (
          audioItems.map(audio => (
            <div
              key={audio.id}
              className="bg-gray-800 rounded p-2 mb-2 flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" title={audio.filename}>
                  {audio.filename}
                </div>
              </div>
              <button
                onClick={() => handleRemoveAudio(audio.id)}
                className="ml-2 px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}