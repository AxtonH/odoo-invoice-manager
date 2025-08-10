import React from 'react';

const Progress = ({ value = 0, max = 100, className = '', showLabel = true }) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-1">
        {showLabel && (
          <span className="text-xs text-gray-600">
            {Math.round(percentage)}%
          </span>
        )}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div 
          className={`h-2 rounded-full transition-all duration-500 ease-out shadow-sm ${
            percentage === 100 
              ? 'bg-gradient-to-r from-green-500 to-green-600 animate-pulse' 
              : 'bg-gradient-to-r from-blue-500 to-blue-600'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default Progress; 