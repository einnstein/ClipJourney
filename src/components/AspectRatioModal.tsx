// src/components/AspectRatioModal.tsx

import { useState } from 'react';

interface AspectRatioModalProps {
  currentRatio: string;
  onSave: (ratio: string) => void;
  onClose: () => void;
}

const COMMON_RATIOS = [
  { value: '16:9', label: '16:9 (Widescreen)', width: 16, height: 9 },
  { value: '4:3', label: '4:3 (Standard)', width: 4, height: 3 },
  { value: '21:9', label: '21:9 (Ultrawide)', width: 21, height: 9 },
  { value: '1:1', label: '1:1 (Square)', width: 1, height: 1 },
  { value: '9:16', label: '9:16 (Vertical)', width: 9, height: 16 },
  { value: '2.39:1', label: '2.39:1 (Cinema)', width: 2.39, height: 1 },
];

export default function AspectRatioModal({ currentRatio, onSave, onClose }: AspectRatioModalProps) {
  const [selectedRatio, setSelectedRatio] = useState(currentRatio);

  const handleSave = () => {
    onSave(selectedRatio);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-[400px] border border-gray-700">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Project Aspect Ratio</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-400 mb-4">
            Select the aspect ratio for your output video. All content will be rendered to fit this ratio. Photos will be fitted with letterboxing.
          </p>

          <div className="space-y-2">
            {COMMON_RATIOS.map((ratio) => (
              <label
                key={ratio.value}
                className={`flex items-center gap-3 p-3 rounded border-2 cursor-pointer transition-colors ${
                  selectedRatio === ratio.value
                    ? 'border-blue-500 bg-blue-500 bg-opacity-10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <input
                  type="radio"
                  name="aspectRatio"
                  value={ratio.value}
                  checked={selectedRatio === ratio.value}
                  onChange={(e) => setSelectedRatio(e.target.value)}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <div className="font-medium">{ratio.label}</div>
                </div>
                <div 
                  className="bg-gray-700 border border-gray-600"
                  style={{
                    width: `${ratio.width * 8}px`,
                    height: `${ratio.height * 8}px`
                  }}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}