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
        className={`w-full border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer
          ${isDragging 
            ? 'border-[#3B82F6] bg-[#3B82F6]/10' 
            : 'border-[#293548] bg-[#111827]/60 hover:bg-[#1D2736]/40 hover:border-[#3B82F6]/50'
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
          accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={handleFileInput}
        />
        
        <div className="w-14 h-14 bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20 rounded-2xl flex items-center justify-center mb-3.5 shadow-sm">
          <UploadCloud size={28} />
        </div>
        
        <h3 className="text-lg font-bold text-[#F1F5F9] mb-1.5 tracking-tight">Upload Excel File</h3>
        <p className="text-[#94A3B8] text-center text-xs sm:text-sm mb-5 max-w-md">
          Drag and drop your influencer list here, or click to browse.
        </p>

        <div className="flex items-center gap-2 text-xs text-[#64748B] bg-[#111827] border border-[#293548] px-3.5 py-1.5 rounded-lg">
          <FileSpreadsheet size={14} className="text-[#3B82F6]" />
          <span>Supported formats: .XLS / .XLSX</span>
        </div>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg text-[#EF4444] text-xs text-center font-medium">
          {error}
        </div>
      )}
    </div>
  );
};
