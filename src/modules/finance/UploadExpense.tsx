import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, X, Trash2, RefreshCw, AlertCircle, Eye } from 'lucide-react';
import * as xlsx from 'xlsx';

interface UploadExpenseProps {
  onClose: () => void;
}

interface ParsedData {
  headers: string[];
  rows: any[][];
}

interface UploadedFileState {
  id: string;
  file: File;
  fileName: string;
  size: number;
  uploadTime: Date;
  rows: number;
  columns: number;
  parsedData: ParsedData;
}

export const UploadExpense = ({ onClose }: UploadExpenseProps) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileState[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  
  const [fileToReplace, setFileToReplace] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File): Promise<UploadedFileState> => {
    const data = await file.arrayBuffer();
    const workbook = xlsx.read(data, { type: 'array' });
    
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error(`No worksheets found in ${file.name}`);
    
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
    
    if (!jsonData || jsonData.length === 0) {
      throw new Error(`The worksheet in ${file.name} is empty.`);
    }

    const rawHeaders = jsonData[0] as any[];
    const headers = rawHeaders.map(h => String(h ?? '').trim());
    const rows = jsonData.slice(1) as any[][];

    return {
      id: Math.random().toString(36).substr(2, 9),
      file,
      fileName: file.name,
      size: file.size,
      uploadTime: new Date(),
      rows: rows.length,
      columns: headers.length,
      parsedData: { headers, rows }
    };
  };

  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setIsParsing(true);
    setParseError(null);
    
    try {
      const filesArray = Array.from(e.target.files);
      const newUploads: UploadedFileState[] = [];
      
      for (const file of filesArray) {
        const fileState = await processFile(file);
        newUploads.push(fileState);
      }
      
      setUploadedFiles(prev => {
        const next = [...prev, ...newUploads];
        // Automatically select the first file if none is active
        if (!activeFileId && next.length > 0) {
          setActiveFileId(next[0].id);
        }
        return next;
      });
    } catch (err: any) {
      console.error("Excel parse error:", err);
      setParseError(err.message || "Failed to parse one or more files.");
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReplaceChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !fileToReplace) return;
    
    setIsParsing(true);
    setParseError(null);
    
    try {
      const file = e.target.files[0];
      const newFileState = await processFile(file);
      
      setUploadedFiles(prev => prev.map(f => f.id === fileToReplace ? { ...newFileState, id: f.id } : f));
    } catch (err: any) {
      console.error("Excel parse error:", err);
      setParseError(err.message || "Failed to replace file.");
    } finally {
      setIsParsing(false);
      setFileToReplace(null);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => {
      const next = prev.filter(f => f.id !== id);
      if (activeFileId === id) {
        setActiveFileId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  };

  const triggerReplace = (id: string) => {
    setFileToReplace(id);
    replaceInputRef.current?.click();
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const activeFile = uploadedFiles.find(f => f.id === activeFileId);

  return (
    <div className="bg-card w-full rounded-2xl shadow-sm border border-border flex flex-col fade-in text-slate-200 h-full">
      
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFilesChange}
        accept=".xlsx, .xls"
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={replaceInputRef}
        onChange={handleReplaceChange}
        accept=".xlsx, .xls"
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
        <div>
          <h2 className="text-xl font-bold text-main">Upload Expenses</h2>
          <p className="text-sm text-muted mt-1">Bulk import expense records using an Excel file.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-primary text-white shadow-md shadow-primary/20 hover:brightness-110 flex items-center gap-2"
          >
            <Upload size={16} />
            Upload Files
          </button>
          
          <button 
            onClick={onClose}
            className="p-2 text-muted hover:text-main bg-background rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-border"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        
        {/* Left Section: Files List */}
        <div className="w-full lg:w-96 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-border flex flex-col bg-background/30">
          <div className="p-4 border-b border-border bg-card">
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">
              Files
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
            {uploadedFiles.length === 0 ? (
              <div className="text-center p-8">
                <FileSpreadsheet size={40} className="mx-auto text-muted/50 mb-3" />
                <p className="text-sm font-medium text-main">No files uploaded</p>
                <p className="text-xs text-muted mt-1">Click Upload Files to begin.</p>
              </div>
            ) : (
              uploadedFiles.map(file => (
                <div 
                  key={file.id} 
                  onClick={() => setActiveFileId(file.id)}
                  className={`border rounded-xl p-2.5 transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                    activeFileId === file.id 
                      ? 'border-primary bg-primary/5 shadow-sm' 
                      : 'border-border/60 bg-card hover:border-border hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
                      <FileSpreadsheet size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-main truncate leading-tight" title={file.fileName}>
                        {file.fileName}
                      </h4>
                      <div className="text-[11px] text-muted mt-0.5">
                        {file.uploadTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} • {file.uploadTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); triggerReplace(file.id); }}
                      title="Replace File"
                      className="w-8 h-8 rounded-md bg-background border border-border text-main hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-colors"
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                      title="Delete File"
                      className="w-8 h-8 rounded-md text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors flex items-center justify-center"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}

            {/* Error State */}
            {parseError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 fade-in mt-4">
                <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
                <div>
                  <h4 className="text-xs font-semibold text-red-500">Error</h4>
                  <p className="text-xs text-red-400 mt-0.5">{parseError}</p>
                </div>
              </div>
            )}
            
            {/* Loading State */}
            {isParsing && (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2"></div>
                <p className="text-xs font-medium text-muted">Parsing files...</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: File Data Preview */}
        <div className="flex-1 flex flex-col bg-card min-w-0">
          <div className="p-4 border-b border-border flex items-center justify-between bg-card">
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">
              File Data
            </h3>
            {activeFile && (
              <div className="text-xs text-muted font-medium bg-background px-3 py-1.5 rounded-lg border border-border">
                Rows: {activeFile.rows} | Columns: {activeFile.columns}
              </div>
            )}
          </div>
          
          <div className="flex-1 p-4 overflow-hidden flex flex-col">
            {!activeFile ? (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border/60 rounded-2xl bg-background/30">
                <FileSpreadsheet size={48} className="text-muted/30 mb-4" />
                <p className="text-sm font-medium text-muted">No file selected for preview</p>
              </div>
            ) : (
              <div className="flex-1 bg-background rounded-2xl border border-border/50 shadow-sm overflow-hidden flex flex-col relative fade-in">
                <div className="flex-1 overflow-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-max">
                    <thead className="bg-background/95 backdrop-blur-sm sticky top-0 z-20 shadow-sm">
                      <tr>
                        <th className="p-3 text-xs font-semibold text-muted uppercase tracking-wider border-b border-border/50 sticky left-0 bg-background/95 backdrop-blur-sm z-30 shadow-[1px_0_0_0_rgba(255,255,255,0.05)] dark:shadow-[1px_0_0_0_rgba(0,0,0,0.1)] w-12 text-center">
                          #
                        </th>
                        {activeFile.parsedData.headers.map((header, idx) => (
                          <th key={idx} className="p-3 text-xs font-semibold text-muted uppercase tracking-wider border-b border-border/50 whitespace-nowrap">
                            {header || `Column ${idx + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {activeFile.parsedData.rows.map((row, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                          <td className="p-3 text-xs text-muted border-r border-border/50 sticky left-0 bg-background group-hover:bg-card transition-colors z-10 text-center font-medium shadow-[1px_0_0_0_rgba(255,255,255,0.05)] dark:shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">
                            {rowIdx + 1}
                          </td>
                          {activeFile.parsedData.headers.map((_, colIdx) => (
                            <td key={colIdx} className="p-3 text-sm text-main whitespace-nowrap">
                              {row[colIdx] !== undefined && row[colIdx] !== null ? String(row[colIdx]) : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {activeFile.parsedData.rows.length === 0 && (
                        <tr>
                          <td colSpan={activeFile.parsedData.headers.length + 1} className="p-8 text-center text-sm text-muted bg-card">
                            No data rows found in this sheet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
