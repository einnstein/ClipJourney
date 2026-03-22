// src/components/ResolutionModal.tsx
import { useState } from 'react';

interface ResolutionModalProps {
  suggestedResolution: string;
  onConfirm: (resolution: string) => void;
  onCancel: () => void;
}

export default function ResolutionModal({
  suggestedResolution,
  onConfirm,
  onCancel
}: ResolutionModalProps) {
  const [selectedResolution, setSelectedResolution] = useState(suggestedResolution);
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');

  const commonResolutions = [
    { label: '1080p (1920x1080)', value: '1920x1080' },
    { label: '1440p (2560x1440)', value: '2560x1440' },
    { label: '4K (3840x2160)', value: '3840x2160' },
    { label: 'GoPro Hero (2704x1520)', value: '2704x1520' },
    { label: 'iPhone Portrait (1080x1920)', value: '1080x1920' }
  ];

  const handleConfirm = () => {
    if (selectedResolution === 'custom') {
      if (customWidth && customHeight) {
        onConfirm(`${customWidth}x${customHeight}`);
      } else {
        alert('Please enter custom width and height');
      }
    } else {
      onConfirm(selectedResolution);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-[500px] flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">Select Output Resolution</h2>
          <p className="text-sm text-gray-400 mt-1">
            Based on your first video, we suggest: <span className="text-blue-400">{suggestedResolution}</span>
          </p>
        </div>

        <div className="p-4 space-y-3">
          {commonResolutions.map(res => (
            <label key={res.value} className="flex items-center gap-3 p-3 bg-gray-700 hover:bg-gray-600 rounded cursor-pointer">
              <input
                type="radio"
                name="resolution"
                value={res.value}
                checked={selectedResolution === res.value}
                onChange={(e) => setSelectedResolution(e.target.value)}
                className="w-4 h-4"
              />
              <span className="text-sm">{res.label}</span>
            </label>
          ))}

          <label className="flex items-center gap-3 p-3 bg-gray-700 hover:bg-gray-600 rounded cursor-pointer">
            <input
              type="radio"
              name="resolution"
              value="custom"
              checked={selectedResolution === 'custom'}
              onChange={(e) => setSelectedResolution(e.target.value)}
              className="w-4 h-4"
            />
            <span className="text-sm">Custom Resolution</span>
          </label>

          {selectedResolution === 'custom' && (
            <div className="flex items-center gap-2 ml-7">
              <input
                type="number"
                placeholder="Width"
                value={customWidth}
                onChange={(e) => setCustomWidth(e.target.value)}
                className="w-24 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-sm"
              />
              <span className="text-gray-400">×</span>
              <input
                type="number"
                placeholder="Height"
                value={customHeight}
                onChange={(e) => setCustomHeight(e.target.value)}
                className="w-24 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-sm"
              />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-700 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold"
          >
            Use This Resolution
          </button>
        </div>
      </div>
    </div>
  );
}