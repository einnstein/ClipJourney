// src/components/ProgressModal.tsx

interface ProgressModalProps {
  title: string;
  message: string;
  progress?: number; // 0-100, undefined for indeterminate
}

export default function ProgressModal({ title, message, progress }: ProgressModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <p className="text-gray-300 mb-4">{message}</p>
        
        {progress !== undefined ? (
          // Determinate progress bar
          <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
            <div 
              className="bg-blue-600 h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : (
          // Indeterminate progress bar
          <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
            <div className="bg-blue-600 h-full w-1/3 animate-pulse" />
          </div>
        )}
        
        {progress !== undefined && (
          <p className="text-center text-sm text-gray-400 mt-2">{Math.round(progress)}%</p>
        )}
      </div>
    </div>
  );
}