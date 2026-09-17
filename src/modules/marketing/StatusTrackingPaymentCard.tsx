import React, { useState } from 'react';
import { Copy, Check, ShieldCheck, CreditCard, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

export interface PaymentDetailsInfo {
  payment_method?: string | null;
  upi_number?: string | null;
  account_holder_name?: string | null;
  account_number?: string | null;
  ifsc_code?: string | null;
  bank_name?: string | null;
}

export interface StatusTrackingPaymentCardProps {
  paymentInfo?: PaymentDetailsInfo | null;
  className?: string;
  isHistorical?: boolean;
  videoNumber?: number;
  perVideoAmount?: number | null;
  totalCampaignAmount?: number | null;
}

export const StatusTrackingPaymentCard: React.FC<StatusTrackingPaymentCardProps> = ({
  paymentInfo,
  className = '',
  isHistorical = false,
  videoNumber,
  perVideoAmount,
  totalCampaignAmount
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`Copied ${label}: ${text}`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const rawMethod = (paymentInfo?.payment_method || '').toUpperCase().trim();
  const isAccount = rawMethod === 'ACCOUNT_DETAILS' || rawMethod.includes('ACCOUNT');
  const isUPI = rawMethod === 'UPI' || (!rawMethod && Boolean(paymentInfo?.upi_number && paymentInfo.upi_number.trim()));
  const isConfigured = Boolean(paymentInfo?.payment_method || paymentInfo?.upi_number || paymentInfo?.account_number);

  return (
    <div className={`bg-[#0b1329] border border-slate-800 rounded-xl p-4 shadow-md ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          {isAccount ? (
            <CreditCard size={15} className="text-blue-400" />
          ) : (
            <Smartphone size={15} className="text-purple-400" />
          )}
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
            Payment Details
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
          <ShieldCheck size={11} className={isHistorical ? "text-emerald-400" : "text-blue-400"} />
          <span>{isHistorical ? 'Historical Record' : 'From Campaign Influencer'}</span>
        </div>
      </div>

      {/* Primary Focus: PER-VIDEO AGREED AMOUNT Banner */}
      <div className="bg-[#070c18] border border-slate-800/90 rounded-xl p-3 mb-3.5 flex items-center justify-between">
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
            {videoNumber ? `Video ${videoNumber} Agreed Amount` : 'Per Video Agreed Amount'}
          </span>
          <div className="flex items-baseline gap-2">
            {perVideoAmount !== null && perVideoAmount !== undefined ? (
              <span className="text-xl font-bold font-mono text-emerald-400">
                ₹{Number(perVideoAmount).toLocaleString('en-IN')}
              </span>
            ) : (
              <span className="text-sm font-semibold text-slate-400 italic">
                Not assigned
              </span>
            )}
          </div>
        </div>

        {totalCampaignAmount !== null && totalCampaignAmount !== undefined && (
          <div className="text-right">
            <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Total Campaign Amount
            </span>
            <span className="text-xs font-semibold font-mono text-slate-300">
              ₹{Number(totalCampaignAmount).toLocaleString('en-IN')}
            </span>
          </div>
        )}
      </div>

      {/* Conditional Content */}
      {!isConfigured ? (
        <div className="py-2 px-1">
          <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
            <span>Payment method not configured</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Configure payment method & credentials in Campaign Influencer &rarr; Edit &rarr; Basic Info.
          </p>
        </div>
      ) : isUPI ? (
        /* UPI Mode: Strictly UPI, NO Account fields */
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Payment Method</span>
            <span className="font-bold text-purple-300 bg-purple-950/60 border border-purple-800/60 px-2.5 py-0.5 rounded-full text-[11px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
              UPI
            </span>
          </div>

          <div className="bg-[#070c18] border border-slate-800/90 rounded-lg p-2.5 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">UPI / GPay Number</span>
              {paymentInfo?.upi_number && paymentInfo.upi_number.trim() ? (
                <span className="text-sm font-mono font-bold text-white tracking-wide break-all select-all">
                  {paymentInfo.upi_number.trim()}
                </span>
              ) : (
                <span className="text-xs italic text-amber-400/90 font-medium">UPI number not configured</span>
              )}
            </div>
            {paymentInfo?.upi_number && paymentInfo.upi_number.trim() && (
              <button
                type="button"
                onClick={() => copyToClipboard(paymentInfo.upi_number!.trim(), 'UPI Number')}
                className="shrink-0 p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Copy UPI Number"
              >
                {copiedField === 'UPI Number' ? (
                  <Check size={14} className="text-emerald-400" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Account Details Mode: Strictly Account, NO UPI fields */
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Payment Method</span>
            <span className="font-bold text-blue-300 bg-blue-950/60 border border-blue-800/60 px-2.5 py-0.5 rounded-full text-[11px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
              Account Details
            </span>
          </div>

          {!paymentInfo?.account_number && !paymentInfo?.account_holder_name && !paymentInfo?.ifsc_code ? (
            <div className="bg-[#070c18] border border-slate-800 rounded-lg p-2.5">
              <span className="text-xs italic text-amber-400/90 font-medium">Account details not configured</span>
            </div>
          ) : (
            <div className="bg-[#070c18] border border-slate-800/90 rounded-lg p-2.5 space-y-2 text-xs">
              {paymentInfo.account_holder_name && (
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400 text-[11px]">Account Holder</span>
                  <span className="font-semibold text-white truncate max-w-[180px] sm:max-w-[220px]">
                    {paymentInfo.account_holder_name}
                  </span>
                </div>
              )}

              {paymentInfo.account_number && (
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400 text-[11px]">Account Number</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-white tracking-wider">
                      {paymentInfo.account_number}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(paymentInfo.account_number!, 'Account Number')}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                      title="Copy Account Number"
                    >
                      {copiedField === 'Account Number' ? (
                        <Check size={13} className="text-emerald-400" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {paymentInfo.ifsc_code && (
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400 text-[11px]">IFSC Code</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-white uppercase tracking-wider">
                      {paymentInfo.ifsc_code}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(paymentInfo.ifsc_code!, 'IFSC Code')}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                      title="Copy IFSC Code"
                    >
                      {copiedField === 'IFSC Code' ? (
                        <Check size={13} className="text-emerald-400" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {paymentInfo.bank_name && (
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-slate-400 text-[11px]">Bank Name</span>
                  <span className="font-semibold text-slate-200">
                    {paymentInfo.bank_name}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
