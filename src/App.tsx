import { useState, useMemo } from 'react';
import { MediaItem } from './types';
import MediaListPanel from './components/MediaListPanel';
import PreviewPanel from './components/PreviewPanel';
import EditingPanel from './components/EditingPanel';

function App() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState('MP4');
  const [splitPosition, setSplitPosition] = useState(50); // 50% split
  const [isDragging, setIsDragging] = useState(false);

  const selectedItem = mediaItems.find(item => item.id === selectedItemId) || null;

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
      }
    });

    return { totalLength: total, editedLength: edited };
  }, [mediaItems]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectItem = (id: string | null) => {
    setSelectedItemId(id);
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

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Menu Bar */}
      <div className="h-8 bg-gray-800 border-b border-gray-700 flex items-center px-4 text-sm">
        <button className="hover:bg-gray-700 px-3 py-1 rounded">File</button>
        <button className="hover:bg-gray-700 px-3 py-1 rounded">Edit</button>
        <button className="hover:bg-gray-700 px-3 py-1 rounded">View</button>
        <button className="hover:bg-gray-700 px-3 py-1 rounded">Help</button>
      </div>

      {/* Settings Panel */}
      <div className="h-[10%] bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center gap-6">
          {/* Video Length Stats */}
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

          {/* Divider */}
          <div className="w-px h-8 bg-gray-700"></div>
          
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

          <button className="ml-auto px-4 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm">
            Export Final Video
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* MediaList Panel */}
        <MediaListPanel
          mediaItems={mediaItems}
          selectedItemId={selectedItemId}
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
            <PreviewPanel selectedItem={selectedItem} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;