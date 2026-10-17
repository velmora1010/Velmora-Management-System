import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  RefreshCw, 
  Trash2, 
  Loader2, 
  X, 
  Download, 
  ExternalLink,
  FileText,
  Video,
  Image as ImageIcon
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

export const formatFileSize = (bytes?: number): string => {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const getFileNameFromUrl = (url?: string | null, fallback = 'Uploaded File'): string => {
  if (!url) return fallback;
  try {
    const cleanUrl = url.split('?')[0];
    const rawName = cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1);
    const decoded = decodeURIComponent(rawName);
    // Strip common prefixes (e.g. timestamp_hash_name.jpg, product_photo_timestamp_name.jpg)
    const stripped = decoded
      .replace(/^[0-9]+_[a-z0-9]+_/, '')
      .replace(/^product_photo_[0-9]+_/, '')
      .replace(/^dispatch_photo_[0-9]+_/, '')
      .replace(/^profile_[0-9]+_/, '');
    return stripped || decoded || fallback;
  } catch {
    return fallback;
  }
};

export interface MarketingUploadFieldProps {
  label: string;
  icon?: React.ReactNode;
  value?: string | null;
  initialFileName?: string | null;
  initialFileSize?: number | null;
  fileType?: 'image' | 'video' | 'document' | 'all';
  accept?: string;
  maxSizeBytes?: number;
  storageFolder: string;
  bucket?: string;
  filePrefix?: string;
  isRequired?: boolean;
  hint?: string;
  disabled?: boolean;
  onChange: (url: string | null, meta?: { fileName?: string; fileSize?: number; storagePath?: string }) => void;
  onUploadStart?: () => void;
  onUploadEnd?: (success: boolean) => void;
}

export const MarketingUploadField: React.FC<MarketingUploadFieldProps> = ({
  label,
  icon,
  value,
  initialFileName,
  initialFileSize,
  fileType = 'image',
  accept = 'image/*',
  maxSizeBytes = 15 * 1024 * 1024, // 15MB default
  storageFolder,
  bucket = 'influencer-profiles',
  filePrefix = 'file',
  isRequired = false,
  hint,
  disabled = false,
  onChange,
  onUploadStart,
  onUploadEnd
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [fileName, setFileName] = useState<string>(() => {
    if (initialFileName) return initialFileName;
    if (value) return getFileNameFromUrl(value);
    return '';
  });

  const [fileSize, setFileSize] = useState<number | undefined>(initialFileSize || undefined);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync filename when external value changes
  useEffect(() => {
    if (value) {
      if (!fileName || fileName === 'Uploaded File') {
        setFileName(getFileNameFromUrl(value));
      }
    } else {
      setFileName('');
      setFileSize(undefined);
      setUploadError(null);
    }
  }, [value]);

  const defaultHint = (() => {
    if (hint) return hint;
    if (fileType === 'image') return `JPG, PNG, WEBP (Max ${Math.round(maxSizeBytes / (1024 * 1024))}MB)`;
    if (fileType === 'video') return `MP4, MOV, WEBM (Max ${Math.round(maxSizeBytes / (1024 * 1024))}MB)`;
    if (fileType === 'document') return `PDF, DOC, XLSX (Max ${Math.round(maxSizeBytes / (1024 * 1024))}MB)`;
    return `Max ${Math.round(maxSizeBytes / (1024 * 1024))}MB`;
  })();

  const performUpload = async (fileToUpload: File) => {
    if (disabled || isUploading) return;

    if (fileToUpload.size > maxSizeBytes) {
      const limitMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
      const actualMb = (fileToUpload.size / (1024 * 1024)).toFixed(1);
      const err = `File is too large (${actualMb}MB). Maximum allowed size is ${limitMb}MB.`;
      setUploadError(err);
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setCurrentFile(fileToUpload);
    setFileName(fileToUpload.name);
    setFileSize(fileToUpload.size);
    onUploadStart?.();

    try {
      const fileExt = (fileToUpload.name.split('.').pop() || 'dat').toLowerCase();
      const sanitizedName = fileToUpload.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const cleanFolder = storageFolder.replace(/^\/+|\/+$/g, '');
      const storagePath = `${cleanFolder}/${filePrefix}_${uniqueSuffix}_${sanitizedName}`;

      // Upload using supabaseAdmin (bypasses RLS) with fallback to regular supabase client
      let uploadSuccess = false;
      let lastError: any = null;

      try {
        const { error: adminErr } = await supabaseAdmin.storage
          .from(bucket)
          .upload(storagePath, fileToUpload, {
            contentType: fileToUpload.type || undefined,
            cacheControl: '3600',
            upsert: true
          });
        if (!adminErr) {
          uploadSuccess = true;
        } else {
          lastError = adminErr;
        }
      } catch (adminException) {
        lastError = adminException;
      }

      if (!uploadSuccess) {
        const { error: fallbackErr } = await supabase.storage
          .from(bucket)
          .upload(storagePath, fileToUpload, {
            contentType: fileToUpload.type || undefined,
            cacheControl: '3600',
            upsert: true
          });
        if (fallbackErr) {
          throw lastError || fallbackErr;
        }
      }

      // Retrieve public URL
      const { data: publicData } = supabaseAdmin.storage
        .from(bucket)
        .getPublicUrl(storagePath);

      if (!publicData?.publicUrl) {
        throw new Error('Failed to retrieve public URL from storage.');
      }

      const finalPublicUrl = publicData.publicUrl;
      onChange(finalPublicUrl, {
        fileName: fileToUpload.name,
        fileSize: fileToUpload.size,
        storagePath
      });

      onUploadEnd?.(true);
    } catch (err: any) {
      console.error('Upload failed:', err);
      const msg = err?.message || 'Storage upload failed. Please try again.';
      setUploadError(msg);
      onUploadEnd?.(false);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      performUpload(selected);
    }
    // Reset file input so user can re-select same file if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!disabled && !isUploading && e.dataTransfer.files && e.dataTransfer.files[0]) {
      performUpload(e.dataTransfer.files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || isUploading) return;
    onChange(null);
    setCurrentFile(null);
    setFileName('');
    setFileSize(undefined);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentFile) {
      performUpload(currentFile);
    } else {
      fileInputRef.current?.click();
    }
  };

  const isVideo = fileType === 'video' || (value && (value.includes('.mp4') || value.includes('.mov') || value.includes('.webm')));
  const isPdf = value && value.toLowerCase().includes('.pdf');

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {/* Label Row */}
      <div className="flex items-center justify-between text-xs font-medium text-slate-400">
        <label className="flex items-center gap-1.5 text-slate-300">
          {icon ? icon : (fileType === 'video' ? <Video size={13} className="text-purple-400 shrink-0" /> : <ImageIcon size={13} className="text-purple-400 shrink-0" />)}
          <span>{label}</span>
          {isRequired && (
            <span className="text-purple-400 font-bold ml-0.5" title="Required">*</span>
          )}
        </label>
        {value && !isUploading && !uploadError && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 size={11} className="text-emerald-400" />
            Upload complete
          </span>
        )}
      </div>

      {/* Main Upload Box */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-xl transition-all duration-200 overflow-hidden ${
          disabled ? 'opacity-60 cursor-not-allowed' : ''
        } ${
          isUploading
            ? 'bg-[#0b101b] border-2 border-purple-500/50 p-4 min-h-[140px] flex flex-col items-center justify-center text-center'
            : uploadError
            ? 'bg-rose-950/20 border-2 border-rose-500/50 p-3 min-h-[140px] flex flex-col items-center justify-center text-center'
            : value
            ? 'bg-[#0b101b]/80 border border-slate-700/80 hover:border-slate-600 p-2.5 min-h-[140px] flex flex-col justify-between'
            : isDragging
            ? 'bg-purple-950/40 border-2 border-dashed border-purple-400 p-4 min-h-[140px] flex flex-col items-center justify-center text-center cursor-pointer shadow-lg shadow-purple-900/20'
            : 'bg-[#0b101b]/60 border border-dashed border-slate-700/80 hover:border-purple-500/70 p-4 min-h-[140px] flex flex-col items-center justify-center text-center cursor-pointer group'
        }`}
        onClick={() => {
          if (!value && !isUploading && !disabled) {
            fileInputRef.current?.click();
          }
        }}
      >
        <input 
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          disabled={disabled || isUploading}
          className="hidden"
        />

        {/* 1. UPLOADING STATE */}
        {isUploading && (
          <div className="flex flex-col items-center justify-center gap-2.5 w-full py-2">
            <div className="relative">
              <Loader2 size={28} className="text-purple-400 animate-spin" />
              <div className="absolute inset-0 rounded-full border border-purple-400/30 animate-ping" />
            </div>
            <div>
              <p className="text-xs font-semibold text-purple-200">
                Uploading to cloud storage...
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[240px]">
                {fileName || 'Processing file...'}
              </p>
            </div>
            <div className="w-36 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full animate-pulse w-3/4" />
            </div>
          </div>
        )}

        {/* 2. ERROR STATE */}
        {!isUploading && uploadError && (
          <div className="flex flex-col items-center justify-center gap-2 w-full py-2">
            <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
              <AlertCircle size={18} />
            </div>
            <p className="text-xs font-semibold text-rose-300 max-w-xs text-center">
              {uploadError}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={handleRetry}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw size={12} /> Retry
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadError(null);
                  fileInputRef.current?.click();
                }}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Choose Another
              </button>
            </div>
          </div>
        )}

        {/* 3. UPLOADED STATE (PREVIEW + ACTIONS) */}
        {!isUploading && !uploadError && value && (
          <div className="w-full flex flex-col justify-between h-full gap-2">
            {/* Top Preview Area */}
            <div className="relative w-full h-24 bg-black/70 rounded-lg overflow-hidden border border-slate-800/80 flex items-center justify-center group/preview">
              {isVideo ? (
                <>
                  <video 
                    src={value} 
                    className="w-full h-full object-contain" 
                    preload="metadata"
                  />
                  <div 
                    onClick={() => setIsPreviewOpen(true)}
                    className="absolute inset-0 bg-black/40 group-hover/preview:bg-black/20 flex items-center justify-center cursor-pointer transition-colors"
                    title="Click to play video"
                  >
                    <div className="w-9 h-9 rounded-full bg-purple-600/90 text-white flex items-center justify-center shadow-lg group-hover/preview:scale-110 transition-transform">
                      <Eye size={18} />
                    </div>
                  </div>
                </>
              ) : isPdf ? (
                <div 
                  onClick={() => setIsPreviewOpen(true)}
                  className="flex flex-col items-center justify-center gap-1 cursor-pointer w-full h-full p-2"
                >
                  <FileText size={32} className="text-red-400" />
                  <span className="text-[10px] text-slate-400 font-mono">PDF Document</span>
                </div>
              ) : (
                <>
                  <img 
                    src={value} 
                    alt={fileName || 'Uploaded'} 
                    className="w-full h-full object-contain cursor-pointer"
                    onClick={() => setIsPreviewOpen(true)}
                  />
                  <div 
                    onClick={() => setIsPreviewOpen(true)}
                    className="absolute inset-0 bg-black/30 opacity-0 group-hover/preview:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
                    title="Click to view full image"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-900/80 text-white flex items-center justify-center shadow-md">
                      <Eye size={16} />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Bottom Meta & Actions Bar */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-200 truncate" title={fileName}>
                  {fileName || getFileNameFromUrl(value)}
                </p>
                {fileSize ? (
                  <p className="text-[10px] text-slate-500 font-mono">
                    {formatFileSize(fileSize)}
                  </p>
                ) : null}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="p-1.5 bg-[#151c2c] hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer border border-slate-700/60"
                  title="View full preview"
                >
                  <Eye size={13} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  disabled={disabled}
                  className="p-1.5 bg-[#151c2c] hover:bg-slate-700 text-purple-300 hover:text-purple-200 rounded-lg transition-colors cursor-pointer border border-slate-700/60"
                  title="Replace file"
                >
                  <RefreshCw size={13} />
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={disabled}
                  className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-200 rounded-lg transition-colors cursor-pointer border border-rose-800/40"
                  title="Remove file"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. EMPTY / DROPZONE STATE */}
        {!isUploading && !uploadError && !value && (
          <div className="py-2 flex flex-col items-center justify-center text-center">
            <UploadCloud className="text-purple-400/80 mb-2 group-hover:text-purple-300 transition-colors" size={26} />
            <span className="text-xs font-semibold text-slate-300">Click to upload</span>
            <span className="text-[10px] text-slate-500 mt-0.5">{defaultHint}</span>
          </div>
        )}
      </div>

      {/* Lightbox Preview Modal */}
      {isPreviewOpen && value && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#0b101b] border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-5 py-3 border-b border-slate-800 bg-[#0c121e] flex items-center justify-between">
              <div className="min-w-0 pr-4">
                <h4 className="text-sm font-bold text-white truncate">
                  {fileName || label}
                </h4>
                {fileSize && (
                  <span className="text-[11px] text-slate-400 font-mono">
                    {formatFileSize(fileSize)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 bg-[#151c2c] hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                  title="Open in new window"
                >
                  <ExternalLink size={16} />
                </a>
                <a
                  href={value}
                  download={fileName || 'download'}
                  className="p-1.5 bg-[#151c2c] hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                  title="Download file"
                >
                  <Download size={16} />
                </a>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="p-1.5 bg-[#151c2c] hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                  title="Close preview"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 flex-1 flex items-center justify-center bg-black/50 overflow-auto min-h-[300px]">
              {isVideo ? (
                <video 
                  src={value} 
                  controls 
                  autoPlay 
                  className="max-h-[70vh] max-w-full rounded-lg shadow-lg" 
                />
              ) : isPdf ? (
                <iframe 
                  src={value} 
                  title={fileName || 'PDF Preview'} 
                  className="w-full h-[65vh] rounded-lg border border-slate-800"
                />
              ) : (
                <img 
                  src={value} 
                  alt={fileName || 'Preview'} 
                  className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
