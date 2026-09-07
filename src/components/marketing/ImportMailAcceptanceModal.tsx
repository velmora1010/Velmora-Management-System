import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Loader2,
  AlertCircle,
  Trash2,
  Check,
  Mail
} from 'lucide-react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { logActivity } from '../../services/activityService';
import toast from 'react-hot-toast';
import { isActiveStatus } from '../../utils/marketingUtils';
import { 
  StoredAgreement, 
  buildAgreementText, 
  getVideoPrice, 
  getInfluencerVideoDetails,
  persistSingleAgreement 
} from '../../modules/marketing/OfferAgreementSection';

interface ImportMailAcceptanceModalProps {
  campaign: Campaign;
  existingInfluencers: CampaignInfluencer[];
  onClose: () => void;
  onSuccess: () => void;
}

export interface ParsedMailAcceptanceRow {
  rowNum: number;
  code: string;
  username: string;
  email?: string;
  rawAcceptance: string;
  normalizedAcceptance: 'Accepted' | 'Not Accepted' | null;
  status: 'will_update' | 'not_found' | 'invalid_acceptance' | 'duplicate';
  reason?: string;
  matchedInfluencer?: CampaignInfluencer;
}

export const normalizeAcceptanceValue = (val: any): 'Accepted' | 'Not Accepted' | null => {
  if (val === undefined || val === null) return null;
  const str = String(val).trim().toLowerCase();
  if (!str) return null;

  if (['accepted', 'accept', 'yes', 'y', 'approved', 'confirm', 'confirmed', 'agree', 'agreed'].includes(str)) {
    return 'Accepted';
  }
  if (['not accepted', 'not accept', 'rejected', 'reject', 'declined', 'decline', 'no', 'n', 'disagree'].includes(str)) {
    return 'Not Accepted';
  }
  return null;
};

export const ImportMailAcceptanceModal: React.FC<ImportMailAcceptanceModalProps> = ({
  campaign,
  existingInfluencers,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedMailAcceptanceRow[]>([]);
  const [validationError, setValidationError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanStr = (val: any): string => {
    if (val === undefined || val === null) return '';
    return String(val).trim();
  };

  const normCode = (s: string) => s.toLowerCase().replace(/\s+/g, '');

  const findColumnIdx = (headers: any[], candidates: string[]): number => {
    for (let i = 0; i < headers.length; i++) {
      const headerStr = cleanStr(headers[i]).toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const candidate of candidates) {
        const normCandidate = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (headerStr === normCandidate) {
          return i;
        }
      }
    }
    return -1;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setValidationError(undefined);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!matrix || matrix.length < 2) {
          setValidationError('Spreadsheet is empty or missing data rows.');
          return;
        }

        // Find Header Row
        let headerRowIdx = -1;
        let codeColIdx = -1;
        let acceptanceColIdx = -1;
        let usernameColIdx = -1;
        let emailColIdx = -1;

        const codeCandidates = ['influencercode', 'code', 'infcode', 'influencerid', 'influencer_code'];
        const acceptanceCandidates = ['mailacceptance', 'acceptance', 'mailstatus', 'acceptancestatus', 'status', 'accepted'];
        const usernameCandidates = ['username', 'influencername', 'name', 'handle', 'user_name'];
        const emailCandidates = ['emailid', 'email', 'emailaddress', 'mail', 'email_id'];

        for (let r = 0; r < Math.min(10, matrix.length); r++) {
          const row = matrix[r];
          if (!Array.isArray(row) || row.length === 0) continue;

          const cIdx = findColumnIdx(row, codeCandidates);
          const aIdx = findColumnIdx(row, acceptanceCandidates);

          if (cIdx !== -1 && aIdx !== -1) {
            headerRowIdx = r;
            codeColIdx = cIdx;
            acceptanceColIdx = aIdx;
            usernameColIdx = findColumnIdx(row, usernameCandidates);
            emailColIdx = findColumnIdx(row, emailCandidates);
            break;
          }
        }

        if (headerRowIdx === -1) {
          // Fallback: check if row 0 has at least code or acceptance
          const row0 = matrix[0] || [];
          const cIdx = findColumnIdx(row0, codeCandidates);
          const aIdx = findColumnIdx(row0, acceptanceCandidates);
          if (cIdx === -1) {
            setValidationError("Missing required column: 'Influencer Code'. Please check your spreadsheet headers.");
            return;
          }
          if (aIdx === -1) {
            setValidationError("Missing required column: 'Acceptance' or 'Mail Acceptance'. Please check your spreadsheet headers.");
            return;
          }
        }

        // Active influencers map for fast lookup
        const activeInfluencers = existingInfluencers.filter(inf => isActiveStatus(inf.is_archived));
        const influencerCodeMap = new Map<string, CampaignInfluencer>();
        activeInfluencers.forEach(inf => {
          const code = inf.code || (inf as any).influencer_code || '';
          if (code) {
            influencerCodeMap.set(normCode(code), inf);
          }
        });

        // Parse Rows
        const rows: ParsedMailAcceptanceRow[] = [];
        const seenCodesInFile = new Set<string>();

        for (let r = headerRowIdx + 1; r < matrix.length; r++) {
          const rowData = matrix[r];
          if (!Array.isArray(rowData)) continue;

          const rawCode = cleanStr(rowData[codeColIdx]);
          const rawAcceptance = cleanStr(rowData[acceptanceColIdx]);
          const rawUsername = usernameColIdx !== -1 ? cleanStr(rowData[usernameColIdx]) : '';
          const rawEmail = emailColIdx !== -1 ? cleanStr(rowData[emailColIdx]) : '';

          // Skip empty rows
          if (!rawCode && !rawAcceptance && !rawUsername) continue;

          if (!rawCode) {
            rows.push({
              rowNum: r + 1,
              code: '—',
              username: rawUsername,
              email: rawEmail,
              rawAcceptance,
              normalizedAcceptance: null,
              status: 'not_found',
              reason: 'Empty Influencer Code'
            });
            continue;
          }

          const nCode = normCode(rawCode);
          const isDuplicate = seenCodesInFile.has(nCode);
          seenCodesInFile.add(nCode);

          const matchedInf = influencerCodeMap.get(nCode);
          const normAcc = normalizeAcceptanceValue(rawAcceptance);

          let status: ParsedMailAcceptanceRow['status'] = 'will_update';
          let reason: string | undefined;

          if (isDuplicate) {
            status = 'duplicate';
            reason = 'Duplicate Influencer Code in file';
          } else if (!normAcc) {
            status = 'invalid_acceptance';
            reason = `Invalid acceptance value: "${rawAcceptance}" (Expected "Accepted" or "Not Accepted")`;
          } else if (!matchedInf) {
            status = 'not_found';
            reason = 'Influencer Code not found in this campaign (will be skipped)';
          } else {
            status = 'will_update';
          }

          const displayUsername = rawUsername || (matchedInf?.influencer_name || (matchedInf as any)?.username || matchedInf?.name || '');

          rows.push({
            rowNum: r + 1,
            code: rawCode,
            username: displayUsername,
            email: rawEmail,
            rawAcceptance,
            normalizedAcceptance: normAcc,
            status,
            reason,
            matchedInfluencer: matchedInf
          });
        }

        if (rows.length === 0) {
          setValidationError('No valid data rows found in the uploaded file.');
          return;
        }

        setParsedRows(rows);
      } catch (err: any) {
        console.error('File parsing error:', err);
        setValidationError(`Error parsing file: ${err.message || String(err)}`);
      }
    };

    reader.readAsArrayBuffer(selectedFile);
    e.target.value = '';
  };

  const willUpdateRows = parsedRows.filter(r => r.status === 'will_update');
  const notFoundRows = parsedRows.filter(r => r.status === 'not_found');
  const invalidRows = parsedRows.filter(r => r.status === 'invalid_acceptance');
  const duplicateRows = parsedRows.filter(r => r.status === 'duplicate');

  const handleConfirmImport = async () => {
    if (willUpdateRows.length === 0) {
      toast.error('No matching records to import.');
      return;
    }

    setStep('importing');
    setIsSaving(true);

    try {
      const localKey = `velmora_offer_agreements_${campaign.id}`;
      let agreementsMap: Record<string, StoredAgreement> = {};
      try {
        const stored = localStorage.getItem(localKey);
        if (stored) agreementsMap = JSON.parse(stored);
      } catch (e) {}

      let updatedCount = 0;

      for (const row of willUpdateRows) {
        const inf = row.matchedInfluencer;
        if (!inf || !row.normalizedAcceptance) continue;

        const infId = String(inf.id);
        let agreement = agreementsMap[infId];

        if (agreement) {
          // Update existing agreement with acceptance status
          agreement = {
            ...agreement,
            mail_acceptance: row.normalizedAcceptance,
            updated_at: new Date().toISOString()
          };
        } else {
          // Construct fresh agreement
          const price = getVideoPrice(inf);
          const text = buildAgreementText(inf, campaign.campaign_name);
          const videoDetails = getInfluencerVideoDetails(inf);

          agreement = {
            campaign_id: campaign.id,
            influencer_id: inf.id,
            influencer_code: inf.code || (inf as any).influencer_code || row.code,
            username: inf.influencer_name || (inf as any).username || inf.name || row.username,
            price_per_video: price,
            publishing_dates: videoDetails.map(v => ({ video_number: v.videoNumber, post_date: v.pubDate })),
            draft_dates: videoDetails.map(v => ({ video_number: v.videoNumber, draft_date: v.draftDate })),
            agreement_text: text,
            mail_acceptance: row.normalizedAcceptance,
            generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        }

        // Persist to Supabase and localStorage
        await persistSingleAgreement(campaign.id, agreement);
        agreementsMap[infId] = agreement;
        updatedCount++;
      }

      // Log Activity
      try {
        logActivity(
          'Marketing',
          'Mail Acceptance Imported',
          `Imported Mail Acceptance for ${updatedCount} influencer(s) in ${campaign.campaign_name} from "${file?.name || 'spreadsheet'}"`
        );
      } catch (e) {}

      toast.success(`Successfully updated Mail Acceptance for ${updatedCount} influencer(s)!`);
      onSuccess();
    } catch (err: any) {
      console.error('Import error:', err);
      toast.error('Failed to import mail acceptance records.');
      setStep('preview');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400">
              <Mail size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Import Mail Acceptance
              </h3>
              <p className="text-xs text-slate-400">
                Update influencer offer agreement mail acceptance statuses via spreadsheet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Dropzone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-purple-500/60 bg-slate-800/30 hover:bg-slate-800/50 rounded-2xl p-8 text-center transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 bg-purple-500/10 text-purple-400 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <Upload size={24} />
                </div>
                <h4 className="text-sm font-semibold text-slate-200 mb-1">
                  Upload Mail Acceptance Spreadsheet
                </h4>
                <p className="text-xs text-slate-400 mb-4">
                  Supported formats: Excel (.xlsx, .xls) or CSV (.csv)
                </p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept=".xlsx,.xls,.csv" 
                  onChange={handleFileSelect} 
                  className="hidden" 
                />
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <Upload size={14} /> Choose File
                </button>

                {file && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="mt-4 p-3.5 bg-emerald-950/30 border border-emerald-800/50 rounded-xl max-w-md mx-auto text-xs text-left flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 bg-emerald-900/40 rounded-lg shrink-0">
                        <FileSpreadsheet className="text-emerald-400" size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-100 truncate" title={file.name}>
                          {file.name}
                        </div>
                        <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                          <CheckCircle2 size={10} /> {(file.size / 1024).toFixed(1)} KB • {parsedRows.length} rows detected
                        </div>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => { setFile(null); setParsedRows([]); }} 
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0 cursor-pointer"
                      title="Remove File"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}

                {validationError && (
                  <p className="mt-3 text-xs text-rose-400 font-medium flex items-center justify-center gap-1">
                    <AlertCircle size={14} /> {validationError}
                  </p>
                )}
              </div>

              {/* Instructions Box */}
              <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/60 text-xs text-slate-400 space-y-2">
                <p className="font-semibold text-slate-300">Spreadsheet Format & Matching Rules:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="text-purple-300 font-mono font-semibold">Influencer Code</span>
                    <p className="text-slate-400">Required. Matching is case-insensitive and ignores extra spaces.</p>
                  </div>
                  <div>
                    <span className="text-purple-300 font-mono font-semibold">Acceptance</span>
                    <p className="text-slate-400">Required. Accepts "Accepted" or "Not Accepted".</p>
                  </div>
                  <div>
                    <span className="text-slate-300 font-mono">User Name</span>
                    <p className="text-slate-400">Optional. Shown for reference.</p>
                  </div>
                  <div>
                    <span className="text-slate-300 font-mono">Email ID</span>
                    <p className="text-slate-400">Optional.</p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-700/40">
                  Note: Unknown influencer codes will be flagged and skipped. No new influencers will be created.
                </p>
              </div>

              {/* Upload Actions */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <button 
                  onClick={onClose} 
                  className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => setStep('preview')} 
                  disabled={!file || parsedRows.length === 0 || !!validationError}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-xs transition-colors shadow-sm cursor-pointer"
                >
                  Validate & Preview
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-5">
              {/* Summary Cards */}
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-white text-sm">
                    Mail Acceptance Import Summary
                  </h4>
                  <span className="text-xs bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 px-3 py-1 rounded-full font-semibold">
                    {willUpdateRows.length} Will Update
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-700/80">
                    <span className="text-slate-400 block text-[10px] uppercase">Total Rows</span>
                    <span className="text-sm font-bold text-slate-100">{parsedRows.length}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-700/80">
                    <span className="text-slate-400 block text-[10px] uppercase">Will Update</span>
                    <span className="text-sm font-bold text-emerald-400">{willUpdateRows.length}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-700/80">
                    <span className="text-slate-400 block text-[10px] uppercase">Not Found</span>
                    <span className={`text-sm font-bold ${notFoundRows.length > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                      {notFoundRows.length}
                    </span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-700/80">
                    <span className="text-slate-400 block text-[10px] uppercase">Invalid Value</span>
                    <span className={`text-sm font-bold ${invalidRows.length > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                      {invalidRows.length}
                    </span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-700/80">
                    <span className="text-slate-400 block text-[10px] uppercase">Duplicates</span>
                    <span className={`text-sm font-bold ${duplicateRows.length > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                      {duplicateRows.length}
                    </span>
                  </div>
                </div>

                {notFoundRows.length > 0 && (
                  <div className="mt-3 p-2.5 bg-amber-950/30 border border-amber-800/40 rounded-lg text-xs text-amber-300">
                    <p className="font-semibold flex items-center gap-1.5 text-amber-200">
                      <AlertTriangle size={13} /> {notFoundRows.length} code(s) not found in this campaign:
                    </p>
                    <p className="text-[11px] text-amber-300/80 font-mono mt-0.5">
                      {notFoundRows.slice(0, 8).map(r => r.code).join(', ')}
                      {notFoundRows.length > 8 ? ` ...and ${notFoundRows.length - 8} more` : ''}
                    </p>
                    <p className="text-[10px] text-amber-400/60 mt-1">
                      These will be skipped without creating new influencers.
                    </p>
                  </div>
                )}
              </div>

              {/* Preview Table */}
              <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-900/60">
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-800 text-slate-400 font-semibold sticky top-0 border-b border-slate-700">
                      <tr>
                        <th className="p-2.5 w-12 text-center">#</th>
                        <th className="p-2.5">Code</th>
                        <th className="p-2.5">User Name</th>
                        <th className="p-2.5 text-center">Acceptance</th>
                        <th className="p-2.5 text-center">Match Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {parsedRows.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-2.5 text-center text-slate-500 font-mono text-[11px]">{r.rowNum}</td>
                          <td className="p-2.5 font-mono font-bold text-purple-300">{r.code}</td>
                          <td className="p-2.5 text-slate-200">{r.username || '—'}</td>
                          <td className="p-2.5 text-center">
                            {r.normalizedAcceptance === 'Accepted' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Accepted
                              </span>
                            ) : r.normalizedAcceptance === 'Not Accepted' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Not Accepted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                                {r.rawAcceptance || 'Empty'}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            {r.status === 'will_update' ? (
                              <span className="text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 px-2 py-0.5 rounded font-bold">
                                Will Update
                              </span>
                            ) : r.status === 'not_found' ? (
                              <span className="text-[10px] bg-amber-950/60 text-amber-400 border border-amber-800/40 px-2 py-0.5 rounded font-bold" title={r.reason}>
                                Not Found
                              </span>
                            ) : r.status === 'duplicate' ? (
                              <span className="text-[10px] bg-amber-950/60 text-amber-400 border border-amber-800/40 px-2 py-0.5 rounded font-bold" title={r.reason}>
                                Duplicate
                              </span>
                            ) : (
                              <span className="text-[10px] bg-rose-950/60 text-rose-400 border border-rose-800/40 px-2 py-0.5 rounded font-bold" title={r.reason}>
                                Invalid
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Preview Actions */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <button 
                  onClick={() => setStep('upload')} 
                  className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  ← Back to Upload
                </button>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={onClose} 
                    className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleConfirmImport}
                    disabled={willUpdateRows.length === 0 || isSaving}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-xs transition-colors shadow-sm inline-flex items-center gap-2 cursor-pointer"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Check size={13} />
                        Import Mail Acceptance ({willUpdateRows.length})
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
              <Loader2 size={36} className="text-purple-400 animate-spin" />
              <h4 className="text-sm font-bold text-white">
                Importing Mail Acceptance Statuses...
              </h4>
              <p className="text-xs text-slate-400 max-w-sm">
                Updating offer agreements and persisting to database. Please wait a moment.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
