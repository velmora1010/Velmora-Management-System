import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Loader2, 
  AlertCircle,
  Check,
  RefreshCw
} from 'lucide-react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import { logActivity } from '../../services/activityService';
import { notifyInfluencerChange } from '../../hooks/marketing/useCampaignInfluencers';
import toast from 'react-hot-toast';

export interface ImportAutoDmStats {
  total: number;
  matched: number;
  on: number;
  off: number;
  blank: number;
  unmatched: number;
  invalid: number;
}

export interface ParsedAutoDmRow {
  rowIndex: number;
  code: string;
  normalizedCode: string;
  rawValue: string;
  parsedAutoDm: boolean | null;
  isMatched: boolean;
  matchedInfluencer?: CampaignInfluencer;
  isDuplicate: boolean;
  isInvalid: boolean;
  reason?: string;
}

interface ImportAutoDmModalProps {
  campaign: Campaign;
  existingInfluencers: CampaignInfluencer[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedMap: Map<string, boolean | null>, stats: ImportAutoDmStats) => void;
  initialFile?: File | null;
}

const findColumnKey = (headers: string[], candidates: string[]): string | null => {
  for (const h of headers) {
    const cleanH = String(h).toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    for (const c of candidates) {
      const cleanC = c.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      if (cleanH === cleanC) return h;
    }
  }
  return null;
};

export const ImportAutoDmModal: React.FC<ImportAutoDmModalProps> = ({
  campaign,
  existingInfluencers,
  isOpen,
  onClose,
  onSuccess,
  initialFile
}) => {
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [duplicateCodes, setDuplicateCodes] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedAutoDmRow[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setIsProcessingFile(false);
    setValidationError(null);
    setDuplicateCodes([]);
    setParsedRows([]);
    setIsApplying(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialFile) {
        setFile(initialFile);
        processFile(initialFile);
      }
    } else {
      resetState();
    }
  }, [isOpen, initialFile]);

  const processFile = async (selectedFile: File) => {
    setIsProcessingFile(true);
    setValidationError(null);
    setDuplicateCodes([]);
    setParsedRows([]);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        setValidationError('The Excel file appears to be empty.');
        setIsProcessingFile(false);
        return;
      }

      const sheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

      if (rawRows.length === 0) {
        setValidationError('The uploaded sheet contains no data rows.');
        setIsProcessingFile(false);
        return;
      }

      // Check headers
      const sampleRow = rawRows[0];
      const headers = Object.keys(sampleRow);

      const codeColumnKey = findColumnKey(headers, ['influencer code', 'influencercode', 'influencer_code', 'code']);
      const autoDmColumnKey = findColumnKey(headers, ['auto dm tool', 'autodmtool', 'auto dm', 'autodm', 'auto_dm_tool', 'auto_dm']);

      if (!codeColumnKey || !autoDmColumnKey) {
        setValidationError('Invalid Auto DM file. Required columns: Influencer Code and Auto Dm Tool.');
        setIsProcessingFile(false);
        return;
      }

      // Build map of existing influencers in current campaign
      const existingMap = new Map<string, CampaignInfluencer>();
      (existingInfluencers || []).forEach(inf => {
        if (inf.code) {
          existingMap.set(String(inf.code).trim().toUpperCase(), inf);
        }
      });

      // Detect duplicates in Excel
      const codeFrequency = new Map<string, number>();
      rawRows.forEach(r => {
        const rawCode = String(r[codeColumnKey] ?? '').trim();
        if (rawCode) {
          const norm = rawCode.toUpperCase();
          codeFrequency.set(norm, (codeFrequency.get(norm) || 0) + 1);
        }
      });

      const detectedDuplicates: string[] = [];
      codeFrequency.forEach((count, code) => {
        if (count > 1) {
          detectedDuplicates.push(code);
        }
      });
      setDuplicateCodes(detectedDuplicates);

      // Parse each row
      const results: ParsedAutoDmRow[] = [];
      rawRows.forEach((r, idx) => {
        const rawCode = String(r[codeColumnKey] ?? '').trim();
        const rawVal = String(r[autoDmColumnKey] ?? '').trim();

        // Skip completely empty rows
        if (!rawCode && !rawVal) {
          return;
        }

        const normCode = rawCode.toUpperCase();
        const isDuplicate = Boolean(normCode && (codeFrequency.get(normCode) || 0) > 1);

        if (!rawCode) {
          results.push({
            rowIndex: idx + 1,
            code: '',
            normalizedCode: '',
            rawValue: rawVal,
            parsedAutoDm: null,
            isMatched: false,
            isDuplicate: false,
            isInvalid: true,
            reason: 'Missing Influencer Code'
          });
          return;
        }

        const matchedInf = existingMap.get(normCode);
        const lowerVal = rawVal.toLowerCase();

        let parsedAutoDm: boolean | null = null;
        let isInvalid = false;
        let reason: string | undefined;

        if (lowerVal === 'yes') {
          parsedAutoDm = true;
        } else if (lowerVal === 'no') {
          parsedAutoDm = false;
        } else if (rawVal === '' || rawVal === null || rawVal === undefined) {
          parsedAutoDm = null;
        } else {
          // Unexpected value
          isInvalid = true;
          reason = `Invalid value "${rawVal}" (expected "yes", "no", or blank)`;
        }

        results.push({
          rowIndex: idx + 1,
          code: rawCode,
          normalizedCode: normCode,
          rawValue: rawVal,
          parsedAutoDm,
          isMatched: Boolean(matchedInf),
          matchedInfluencer: matchedInf,
          isDuplicate,
          isInvalid,
          reason
        });
      });

      setParsedRows(results);
    } catch (err: any) {
      console.error('Error processing Auto DM Excel:', err);
      setValidationError(err?.message || 'Failed to read Excel file. Please ensure it is a valid .xlsx or .xls file.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      processFile(selected);
    }
  };

  // Compute stats
  const totalRows = parsedRows.length;
  const invalidCount = parsedRows.filter(r => r.isInvalid).length;
  const matchedRows = parsedRows.filter(r => r.isMatched && !r.isInvalid);
  const matchedCount = matchedRows.length;
  
  const onCount = matchedRows.filter(r => r.parsedAutoDm === true).length;
  const offCount = matchedRows.filter(r => r.parsedAutoDm === false).length;
  const blankCount = matchedRows.filter(r => r.parsedAutoDm === null).length;

  const unmatchedRows = parsedRows.filter(r => !r.isMatched && !r.isInvalid && r.code);
  const unmatchedCodes = Array.from(new Set(unmatchedRows.map(r => r.code)));

  const hasDuplicates = duplicateCodes.length > 0;
  const canApply = matchedCount > 0 && !hasDuplicates && !isApplying && !validationError;

  const handleApplyUpdate = async () => {
    if (!canApply) return;

    setIsApplying(true);
    try {
      // Group matched influencers by target auto_dm value
      const idsToTurnOn: number[] = [];
      const idsToTurnOff: number[] = [];
      const idsToSetNull: number[] = [];
      const updatedMap = new Map<string, boolean | null>();

      matchedRows.forEach(r => {
        if (!r.matchedInfluencer) return;
        const numericId = Number(r.matchedInfluencer.id);
        if (isNaN(numericId)) return;

        updatedMap.set(r.normalizedCode, r.parsedAutoDm);

        if (r.parsedAutoDm === true) {
          idsToTurnOn.push(numericId);
        } else if (r.parsedAutoDm === false) {
          idsToTurnOff.push(numericId);
        } else {
          idsToSetNull.push(numericId);
        }
      });

      const BATCH_SIZE = 100;

      // 1. Batch update ON (true)
      if (idsToTurnOn.length > 0) {
        for (let i = 0; i < idsToTurnOn.length; i += BATCH_SIZE) {
          const chunk = idsToTurnOn.slice(i, i + BATCH_SIZE);
          const { error } = await supabase
            .from(SUPABASE_TABLES.influencersInfo)
            .update({ auto_dm: true })
            .in('id', chunk);
          if (error) throw error;
        }
      }

      // 2. Batch update OFF (false)
      if (idsToTurnOff.length > 0) {
        for (let i = 0; i < idsToTurnOff.length; i += BATCH_SIZE) {
          const chunk = idsToTurnOff.slice(i, i + BATCH_SIZE);
          const { error } = await supabase
            .from(SUPABASE_TABLES.influencersInfo)
            .update({ auto_dm: false })
            .in('id', chunk);
          if (error) throw error;
        }
      }

      // 3. Batch update Blank / Unset (null)
      if (idsToSetNull.length > 0) {
        for (let i = 0; i < idsToSetNull.length; i += BATCH_SIZE) {
          const chunk = idsToSetNull.slice(i, i + BATCH_SIZE);
          const { error } = await supabase
            .from(SUPABASE_TABLES.influencersInfo)
            .update({ auto_dm: null })
            .in('id', chunk);
          if (error) throw error;
        }
      }

      // Activity logging
      logActivity(
        'Marketing',
        'Auto DM Bulk Update',
        `Auto DM updated for ${matchedCount} influencers in campaign "${campaign.campaign_name}" (${onCount} ON, ${offCount} OFF, ${blankCount} unchanged).`
      );

      notifyInfluencerChange(campaign.id);

      const stats: ImportAutoDmStats = {
        total: totalRows,
        matched: matchedCount,
        on: onCount,
        off: offCount,
        blank: blankCount,
        unmatched: unmatchedCodes.length,
        invalid: invalidCount
      };

      toast.success(
        `Auto DM updated successfully • ${matchedCount} influencers updated • ${onCount} ON • ${offCount} OFF • ${blankCount} unchanged`
      );

      onSuccess(updatedMap, stats);
      onClose();
    } catch (err: any) {
      console.error('Error applying Auto DM updates:', err);
      toast.error(err?.message || 'Failed to update Auto DM settings');
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-[#0b1220] border border-slate-800/90 rounded-2xl w-full max-w-3xl shadow-2xl shadow-purple-950/20 flex flex-col max-h-[92vh] my-auto animate-fade-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800/80 bg-[#0c1527] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-950/70 border border-purple-800/50 text-purple-300">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                Auto DM Excel Import
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Campaign: <span className="text-purple-300 font-semibold">{campaign.campaign_name}</span>
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            disabled={isApplying}
            aria-label="Close modal"
            className="text-slate-400 hover:text-white transition-colors p-2 bg-slate-900/80 hover:bg-slate-800 rounded-xl border border-slate-700/80 cursor-pointer shrink-0 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-5 flex-1 [scrollbar-width:thin] [scrollbar-color:#334155_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-700/60 [&::-webkit-scrollbar-thumb]:rounded-full">
          
          {/* File Picker / Dropzone if no file or replace */}
          <div className="flex items-center justify-between p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-xl gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileSpreadsheet size={16} className="text-purple-400 shrink-0" />
              <span className="text-xs sm:text-sm text-slate-300 font-medium truncate">
                {file ? file.name : 'No file selected'}
              </span>
            </div>
            <label className="cursor-pointer px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0">
              <Upload size={13} />
              <span>{file ? 'Change File' : 'Choose Excel File'}</span>
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".xlsx, .xls" 
                onChange={handleFileChange}
                className="hidden" 
                disabled={isProcessingFile || isApplying}
              />
            </label>
          </div>

          {/* Loading state */}
          {isProcessingFile && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 size={32} className="animate-spin text-purple-400" />
              <span className="text-sm font-medium">Parsing and validating Excel file...</span>
            </div>
          )}

          {/* Validation Error Banner */}
          {validationError && !isProcessingFile && (
            <div className="p-4 bg-red-950/50 border border-red-800/60 rounded-xl flex items-start gap-3 text-red-200">
              <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs sm:text-sm">
                <div className="font-bold text-red-300">File Validation Failed</div>
                <div className="text-red-200/90 leading-relaxed">{validationError}</div>
              </div>
            </div>
          )}

          {/* Duplicate Codes Alert */}
          {hasDuplicates && !isProcessingFile && (
            <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl space-y-2.5">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <AlertTriangle size={17} />
                <span>Duplicate Influencer Codes Detected</span>
              </div>
              <p className="text-xs text-red-300/90 leading-relaxed">
                The following Influencer Code(s) appear more than once in the Excel file. Please resolve duplicates before applying:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {duplicateCodes.map(code => (
                  <span key={code} className="px-2 py-0.5 bg-red-900/60 border border-red-700/60 text-red-200 text-xs font-mono font-bold rounded">
                    {code}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Preview Statistics Grid */}
          {!isProcessingFile && parsedRows.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                {/* Total Excel Rows */}
                <div className="bg-[#0e172a]/70 border border-slate-800/80 rounded-xl p-3">
                  <div className="text-[11px] font-medium text-slate-400 mb-1">Total Excel Rows</div>
                  <div className="text-lg font-bold text-slate-200 font-mono">{totalRows}</div>
                </div>

                {/* Matched Influencers */}
                <div className="bg-[#0e172a]/70 border border-slate-800/80 rounded-xl p-3">
                  <div className="text-[11px] font-medium text-slate-400 mb-1">Matched Influencers</div>
                  <div className="text-lg font-bold text-purple-400 font-mono">{matchedCount}</div>
                </div>

                {/* Auto DM ON */}
                <div className="bg-[#0e172a]/70 border border-emerald-900/40 rounded-xl p-3">
                  <div className="text-[11px] font-medium text-emerald-400 mb-1">Auto DM ON</div>
                  <div className="text-lg font-bold text-emerald-400 font-mono">{onCount}</div>
                </div>

                {/* Auto DM OFF */}
                <div className="bg-[#0e172a]/70 border border-slate-800/80 rounded-xl p-3">
                  <div className="text-[11px] font-medium text-slate-400 mb-1">Auto DM OFF</div>
                  <div className="text-lg font-bold text-slate-300 font-mono">{offCount}</div>
                </div>

                {/* Blank / Unchanged */}
                <div className="bg-[#0e172a]/70 border border-slate-800/80 rounded-xl p-3">
                  <div className="text-[11px] font-medium text-slate-400 mb-1">Blank / Unchanged</div>
                  <div className="text-lg font-bold text-amber-300 font-mono">{blankCount}</div>
                </div>

                {/* Unmatched Codes */}
                <div className="bg-[#0e172a]/70 border border-slate-800/80 rounded-xl p-3">
                  <div className="text-[11px] font-medium text-slate-400 mb-1">Unmatched Codes</div>
                  <div className={`text-lg font-bold font-mono ${unmatchedCodes.length > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {unmatchedCodes.length}
                  </div>
                </div>

                {/* Invalid Rows */}
                <div className="bg-[#0e172a]/70 border border-slate-800/80 rounded-xl p-3">
                  <div className="text-[11px] font-medium text-slate-400 mb-1">Invalid Rows</div>
                  <div className={`text-lg font-bold font-mono ${invalidCount > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                    {invalidCount}
                  </div>
                </div>
              </div>

              {/* Unmatched Codes Section */}
              {unmatchedCodes.length > 0 && (
                <div className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-xl space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      Unmatched Codes ({unmatchedCodes.length})
                    </span>
                    <span className="text-[11px] text-slate-400">
                      These codes do not exist in the current campaign and will be skipped (no influencers created).
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {unmatchedCodes.map(code => (
                      <span key={code} className="px-2 py-0.5 bg-amber-950/60 border border-amber-800/50 text-amber-300 text-xs font-mono font-semibold rounded">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Preview List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1">
                  <span>Excel Preview (showing up to 50 rows)</span>
                  <span>{parsedRows.length} total rows parsed</span>
                </div>

                <div className="border border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0c1527] text-slate-400 font-semibold border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Influencer Code</th>
                        <th className="py-2.5 px-3">Campaign Match</th>
                        <th className="py-2.5 px-3">Excel Value</th>
                        <th className="py-2.5 px-3 text-right">Resulting Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {parsedRows.slice(0, 50).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2 px-3 text-slate-500 font-mono">{r.rowIndex}</td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-200">
                            {r.code || '—'}
                            {r.isDuplicate && (
                              <span className="ml-2 text-[10px] text-red-400 bg-red-950/60 border border-red-800/50 px-1 py-0.5 rounded font-sans">
                                Duplicate
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {r.isMatched ? (
                              <span className="text-slate-200 font-medium">
                                {r.matchedInfluencer?.influencer_name || r.matchedInfluencer?.name || 'Matched'}
                              </span>
                            ) : (
                              <span className="text-amber-400 italic">Not found</span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-400">
                            {r.rawValue || '<blank>'}
                          </td>
                          <td className="py-2 px-3 text-right font-medium">
                            {r.isInvalid ? (
                              <span className="text-red-400">{r.reason || 'Invalid'}</span>
                            ) : !r.isMatched ? (
                              <span className="text-slate-500 italic">Skip (Unmatched)</span>
                            ) : r.parsedAutoDm === true ? (
                              <span className="text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded">
                                Turn ON
                              </span>
                            ) : r.parsedAutoDm === false ? (
                              <span className="text-slate-300 font-semibold bg-slate-800 border border-slate-700 px-2 py-0.5 rounded">
                                Turn OFF
                              </span>
                            ) : (
                              <span className="text-slate-400 italic bg-slate-800/40 border border-slate-700/40 px-2 py-0.5 rounded">
                                Blank / Unset
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!isProcessingFile && parsedRows.length === 0 && !validationError && (
            <div className="py-12 border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="p-3 bg-purple-950/50 rounded-2xl border border-purple-800/40 text-purple-400">
                <Upload size={24} />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-200">Upload Auto DM Excel File</div>
                <p className="text-xs text-slate-400 max-w-sm">
                  The Excel must contain columns <strong className="text-purple-300 font-mono">Influencer Code</strong> and <strong className="text-purple-300 font-mono">Auto Dm Tool</strong>.
                </p>
              </div>
              <label className="cursor-pointer px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-purple-900/30">
                Browse File (.xlsx / .xls)
                <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
              </label>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-t border-slate-800/80 bg-[#0c1527] shrink-0 gap-3">
          <button 
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>

          <button 
            type="button"
            onClick={handleApplyUpdate}
            disabled={!canApply}
            className={`px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md ${
              canApply 
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-900/30 cursor-pointer' 
                : 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isApplying ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Applying Updates...</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>Apply Auto DM Update</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
