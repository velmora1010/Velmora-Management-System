import React from 'react';
import { X, Download, Package, Calendar, User, Hash } from 'lucide-react';
import type { CampaignInfluencer } from '../../types';
import { buildPickListRecords } from '../../config/skuMapping';
import { generatePickListPDF } from '../../utils/generatePickListPDF';
import toast from 'react-hot-toast';

interface SingleInfluencerPickListModalProps {
  campaignName: string;
  influencer: CampaignInfluencer;
  onClose: () => void;
}

export const SingleInfluencerPickListModal: React.FC<SingleInfluencerPickListModalProps> = ({
  campaignName,
  influencer,
  onClose
}) => {
  const records = buildPickListRecords([influencer]);
  const record = records[0];

  const handleDownload = () => {
    try {
      generatePickListPDF(campaignName, records);
      toast.success(`Pick List downloaded for ${record.influencerName || record.influencerCode}!`);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to generate Pick List PDF.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-950/80 border border-purple-700/50 rounded-xl text-purple-400">
              <Package size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Influencer Pick List</h3>
              <p className="text-xs text-slate-400 mt-0.5">Campaign: <span className="text-purple-300 font-semibold">{campaignName}</span></p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Influencer Details Summary Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs">
          <div className="space-y-1">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Hash size={13} className="text-purple-400" /> Influencer Code
            </span>
            <p className="font-mono font-bold text-purple-300 text-sm truncate">{record.influencerCode}</p>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <User size={13} className="text-purple-400" /> Influencer Name
            </span>
            <p className="font-semibold text-slate-100 truncate">{record.influencerName}</p>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Calendar size={13} className="text-purple-400" /> Download Date
            </span>
            <p className="font-mono text-slate-300">{record.downloadDate}</p>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3 text-center">SKU</th>
                <th className="px-4 py-3 text-center">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {record.products.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-6 text-slate-500 italic">
                    No products assigned to this influencer.
                  </td>
                </tr>
              ) : (
                record.products.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-medium text-slate-200">{p.product_name}</td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-purple-300">{p.sku}</td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-100">{p.qty}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md"
          >
            <Download size={14} /> Download Pick List
          </button>
        </div>
      </div>
    </div>
  );
};
