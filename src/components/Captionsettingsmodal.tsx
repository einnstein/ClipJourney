// src/components/CaptionSettingsModal.tsx

import { useState } from 'react';

export interface CaptionSettings {
  position: 'bottom-left' | 'bottom-center' | 'bottom-right' | 'top-left' | 'top-center' | 'top-right' | 'center';
  fontFamily: string;
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  bold: boolean;
  italic: boolean;
}

export const DEFAULT_CAPTION_SETTINGS: CaptionSettings = {
  position: 'bottom-center',
  fontFamily: 'Arial',
  fontSize: 18,
  textColor: '#FFFFFF',
  backgroundColor: '#000000',
  backgroundOpacity: 0.75,
  bold: false,
  italic: false
};

interface CaptionSettingsModalProps {
  settings: CaptionSettings;
  onSave: (settings: CaptionSettings) => void;
  onClose: () => void;
}

export default function CaptionSettingsModal({ settings, onSave, onClose }: CaptionSettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<CaptionSettings>(settings);

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const getPositionStyle = () => {
    const base = 'absolute px-4 py-2 rounded';
    
    switch (localSettings.position) {
      case 'bottom-left':
        return `${base} bottom-4 left-4`;
      case 'bottom-center':
        return `${base} bottom-4 left-1/2 transform -translate-x-1/2`;
      case 'bottom-right':
        return `${base} bottom-4 right-4`;
      case 'top-left':
        return `${base} top-4 left-4`;
      case 'top-center':
        return `${base} top-4 left-1/2 transform -translate-x-1/2`;
      case 'top-right':
        return `${base} top-4 right-4`;
      case 'center':
        return `${base} top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2`;
      default:
        return `${base} bottom-4 left-1/2 transform -translate-x-1/2`;
    }
  };

  const getCaptionStyle = () => {
    const rgbaBackground = hexToRgba(localSettings.backgroundColor, localSettings.backgroundOpacity);
    
    return {
      fontFamily: localSettings.fontFamily,
      fontSize: `${localSettings.fontSize}px`,
      color: localSettings.textColor,
      backgroundColor: rgbaBackground,
      fontWeight: localSettings.bold ? 'bold' : 'normal',
      fontStyle: localSettings.italic ? 'italic' : 'normal'
    };
  };

  const hexToRgba = (hex: string, opacity: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-[500px] border border-gray-700">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Caption Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Position */}
          <div>
            <label className="block text-sm font-medium mb-2">Position</label>
            <select
              value={localSettings.position}
              onChange={(e) => setLocalSettings({ ...localSettings, position: e.target.value as CaptionSettings['position'] })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
            >
              <option value="bottom-left">Bottom Left</option>
              <option value="bottom-center">Bottom Center</option>
              <option value="bottom-right">Bottom Right</option>
              <option value="top-left">Top Left</option>
              <option value="top-center">Top Center</option>
              <option value="top-right">Top Right</option>
              <option value="center">Center</option>
            </select>
          </div>

          {/* Font Family */}
          <div>
            <label className="block text-sm font-medium mb-2">Font Family</label>
            <select
              value={localSettings.fontFamily}
              onChange={(e) => setLocalSettings({ ...localSettings, fontFamily: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
            >
              <option value="Arial">Arial</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
              <option value="Georgia">Georgia</option>
              <option value="Verdana">Verdana</option>
              <option value="Comic Sans MS">Comic Sans MS</option>
              <option value="Impact">Impact</option>
            </select>
          </div>

          {/* Font Size */}
          <div>
            <label className="block text-sm font-medium mb-2">Font Size</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={localSettings.fontSize}
                onChange={(e) => setLocalSettings({ ...localSettings, fontSize: Math.max(10, Number(e.target.value)) })}
                min="10"
                max="72"
                className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
              />
              <span className="text-sm text-gray-400">px</span>
            </div>
          </div>

          {/* Text Color */}
          <div>
            <label className="block text-sm font-medium mb-2">Text Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={localSettings.textColor}
                onChange={(e) => setLocalSettings({ ...localSettings, textColor: e.target.value })}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={localSettings.textColor}
                onChange={(e) => setLocalSettings({ ...localSettings, textColor: e.target.value })}
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm font-mono"
              />
            </div>
          </div>

          {/* Background Color */}
          <div>
            <label className="block text-sm font-medium mb-2">Background Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={localSettings.backgroundColor}
                onChange={(e) => setLocalSettings({ ...localSettings, backgroundColor: e.target.value })}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={localSettings.backgroundColor}
                onChange={(e) => setLocalSettings({ ...localSettings, backgroundColor: e.target.value })}
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm font-mono"
              />
            </div>
          </div>

          {/* Background Opacity */}
          <div>
            <label className="block text-sm font-medium mb-2">Background Opacity</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={localSettings.backgroundOpacity}
                onChange={(e) => setLocalSettings({ ...localSettings, backgroundOpacity: Number(e.target.value) })}
                className="flex-1"
              />
              <span className="text-sm text-gray-400 w-12">{Math.round(localSettings.backgroundOpacity * 100)}%</span>
            </div>
          </div>

          {/* Bold and Italic */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.bold}
                onChange={(e) => setLocalSettings({ ...localSettings, bold: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm">Bold</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.italic}
                onChange={(e) => setLocalSettings({ ...localSettings, italic: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm">Italic</span>
            </label>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium mb-2">Preview</label>
            <div className="relative bg-gray-900 rounded h-32 border border-gray-700">
              <div className={getPositionStyle()} style={getCaptionStyle()}>
                Sample Caption Text
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
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