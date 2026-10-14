import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';

interface RnDUploadAreaProps {
  onFileSelect: (file: File) => void;
}

export const RnDUploadArea: React.FC<RnDUploadAreaProps> = ({ onFileSelect }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const validateAndProcessFile = (file: File) => {
    setError(null);
    const validExtensions = ['.xls', '.xlsx'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(fileExt)) {
      setError('Unsupported file format. Please upload a .XLS or .XLSX file.');
      return;
    }

    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndProcessFile(e.target.files[0]);
    }
    // Reset input so same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full">
      <div 
        className={`w-full border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-colors cursor-pointer
          ${isDragging 
            ? 'border-blue-500 bg-blue-500/10' 
            : 'border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 hover:border-slate-600'
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          className="hidden" 
          ref={fileInputRef}
          accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedumedocument.spreadsheetml.sheet"
          onChange={handleFileInput}
        />
        
        <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center mb-4">
          <UploadCloud size={32} />
        </div>
        
        <h3 className="text-xl font-bold text-slate-200 mb-2">Upload Excel File</h3>
        <p className="text-slate-400 text-center mb-6 max-w-md">
          Drag and drop your influencer list here, or click to browse.
        </p>

        <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-900/50 px-4 py-2 rounded-lg">
          <FileSpreadsheet size={16} />
          <span>Supported formats: .XLS / .XLSX</span>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
          {error}
        </div>
      )}
    </div>
  );
};
