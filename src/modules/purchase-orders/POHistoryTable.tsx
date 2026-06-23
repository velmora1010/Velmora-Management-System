import { memo, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import type { POHistoryRecord } from '../../hooks/analytics/usePOHistory';
import { supabase } from '../../lib/supabase';
import { exportPurchaseOrderPDF } from '../../services/pdf/generatePurchaseOrderPDF';
import type { PurchaseOrderDocumentProps } from '../../services/pdf/pdfTemplates';
import { useAuditLogger } from '../../hooks/useAuditLogger';
import toast from 'react-hot-toast';

interface POHistoryTableProps {
  data: POHistoryRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  isLoading: boolean;
  nextPage: () => void;
  prevPage: () => void;
}

export const POHistoryTable = memo(({
  data,
  totalCount,
  page,
  pageSize,
  searchTerm,
  setSearchTerm,
  isLoading,
  nextPage,
  prevPage
}: POHistoryTableProps) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<string | null>(null);
  const { logAction } = useAuditLogger();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const handleViewPDF = async (po: POHistoryRecord) => {
    try {
      setIsGeneratingPDF(po.id);
      
      // 1. Fetch the exact finalized product snapshot from DB
      const { data: productsData, error: productsErr } = await supabase
        .from('purchase_order_products_rows')
        .select('*')
        .eq('purchase_order_id', po.id);
        
      if (productsErr) throw productsErr;

      // 2. Pass immutable DB data to PDF generator
      const pdfSnapshot: PurchaseOrderDocumentProps = {
        poNumber: po.po_number,
        createdAt: po.created_at || new Date().toISOString(),
        vendorName: po.vendor_name,
        products: productsData || [],
        subtotal: po.subtotal || 0,
        gstTotal: po.gst_total || 0,
        grandTotal: (po.subtotal || 0) + (po.gst_total || 0),
        termsConditions: po.terms_conditions || '',
      };

      await exportPurchaseOrderPDF(pdfSnapshot);

      logAction('EXPORT_PDF', 'purchase_orders_rows', po.id, {
        po_number: po.po_number,
      });

    } catch (err) {
      console.error('Failed to generate PDF:', err);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(null);
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-lg font-bold text-white">Purchase Order History</h3>
        
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-muted" />
          </div>
          <input
            type="text"
            className="bg-background border border-border text-white text-sm rounded-lg focus:ring-primary focus:border-primary block w-full pl-10 p-2.5"
            placeholder="Search PO Number or Vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm text-left text-muted">
          <thead className="text-xs uppercase bg-background border-b border-border">
            <tr>
              <th scope="col" className="px-6 py-3 font-semibold text-white">Date</th>
              <th scope="col" className="px-6 py-3 font-semibold text-white">PO Number</th>
              <th scope="col" className="px-6 py-3 font-semibold text-white">Vendor</th>
              <th scope="col" className="px-6 py-3 font-semibold text-white text-right">Amount</th>
              <th scope="col" className="px-6 py-3 font-semibold text-white text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center">
                  <p className="text-muted mb-1">No purchase orders found.</p>
                </td>
              </tr>
            ) : (
              data.map((po) => (
                <tr key={po.id} className="bg-card border-b border-border hover:bg-background/50 transition-colors">
                  <td className="px-6 py-4">
                    {new Date(po.created_at || '').toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </td>
                  <td className="px-6 py-4 font-medium text-white">{po.po_number}</td>
                  <td className="px-6 py-4">{po.vendor_name}</td>
                  <td className="px-6 py-4 text-right font-medium text-white">
                    {formatCurrency((po.subtotal || 0) + (po.gst_total || 0))}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleViewPDF(po)}
                      disabled={isGeneratingPDF === po.id}
                      className="inline-flex items-center justify-center text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                      title="View PDF"
                    >
                      {isGeneratingPDF === po.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      ) : (
                        <FileText className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-border flex items-center justify-between">
        <span className="text-sm text-muted">
          Showing <span className="font-semibold text-white">{(page * pageSize) + (data.length > 0 ? 1 : 0)}</span> to <span className="font-semibold text-white">{(page * pageSize) + data.length}</span> of <span className="font-semibold text-white">{totalCount}</span> Entries
        </span>
        <div className="inline-flex mt-2 xs:mt-0 gap-2">
          <button
            onClick={prevPage}
            disabled={page === 0 || isLoading}
            className="flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-background border border-border rounded-lg hover:bg-border disabled:opacity-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Prev
          </button>
          <button
            onClick={nextPage}
            disabled={(page + 1) * pageSize >= totalCount || isLoading}
            className="flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-background border border-border rounded-lg hover:bg-border disabled:opacity-50 transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>
    </Card>
  );
});

POHistoryTable.displayName = 'POHistoryTable';
