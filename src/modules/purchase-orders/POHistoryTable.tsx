import { memo, useState, useEffect, useMemo } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  Edit2,
  Eye,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { POHistoryRecord } from '../../hooks/analytics/usePOHistory';
import { supabase } from '../../lib/supabase';
import { exportPurchaseOrderPDF } from '../../services/pdf/generatePurchaseOrderPDF';
import type { PurchaseOrderDocumentProps } from '../../services/pdf/pdfTemplates';
import { useAuditLogger } from '../../hooks/useAuditLogger';
import { departmentService } from '../../services/departmentService';
import type { Department, DepartmentSection } from '../../types';
import toast from 'react-hot-toast';

interface POHistoryTableProps {
  data: POHistoryRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  selectedDeptFilter: string;
  setSelectedDeptFilter: (val: string) => void;
  selectedSectionFilter: string;
  setSelectedSectionFilter: (val: string) => void;
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
  selectedDeptFilter,
  setSelectedDeptFilter,
  selectedSectionFilter,
  setSelectedSectionFilter,
  isLoading,
  nextPage,
  prevPage
}: POHistoryTableProps) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<string | null>(null);
  const { logAction } = useAuditLogger();
  const navigate = useNavigate();

  // Mappings
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<DepartmentSection[]>([]);

  useEffect(() => {
    const loadMappings = async () => {
      try {
        const { data: depts } = await departmentService.getAllDepartments();
        if (depts) setDepartments(depts);

        const { data: secs } = await departmentService.getAllSections();
        if (secs) setSections(secs);
      } catch (err) {
        console.error('Failed to load mappings in POHistoryTable:', err);
      }
    };
    loadMappings();
  }, []);

  const getDeptName = (id: string | null) => {
    if (!id) return '-';
    const match = departments.find(d => String(d.id) === String(id));
    return match ? match.department_name : String(id);
  };

  const getSectionName = (id: string | null) => {
    if (!id) return '-';
    const match = sections.find(s => String(s.id) === String(id));
    return match ? match.section_name : String(id);
  };

  // Filtered sections for dropdown filter
  const filteredSectionsForFilterDropdown = useMemo(() => {
    if (selectedDeptFilter === 'all') return [];
    return sections.filter(s => String(s.department_id) === selectedDeptFilter);
  }, [sections, selectedDeptFilter]);

  // Reset section filter if department filter changes
  useEffect(() => {
    setSelectedSectionFilter('all');
  }, [selectedDeptFilter, setSelectedSectionFilter]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const handleViewPDF = async (po: POHistoryRecord) => {
    try {
      setIsGeneratingPDF(po.id);

      const { data: productsData, error: productsErr } = await supabase
        .from('purchase_order_products_rows')
        .select('*')
        .eq('purchase_order_id', po.id);

      if (productsErr) throw productsErr;

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
    <div className="rounded-2xl bg-slate-900/60 border border-slate-700/80 shadow-sm backdrop-blur-sm overflow-hidden flex flex-col">
      {/* Search and Filter Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-700/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/40">
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-semibold text-slate-200">Orders List</h3>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
            {totalCount} {totalCount === 1 ? 'order' : 'orders'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          {/* Search PO */}
          <div className="relative w-full sm:w-64 md:w-72">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              className="h-[42px] bg-slate-950/80 border border-slate-700/80 text-slate-100 text-sm rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/80 block w-full pl-10 pr-9 placeholder:text-slate-500 outline-none transition-all"
              placeholder="Search PO Number or Vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Department Filter */}
          <div className="relative w-full sm:w-52">
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="h-[42px] bg-slate-950/80 border border-slate-700/80 text-slate-100 text-sm rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/80 block w-full px-3.5 py-2 outline-none transition-all cursor-pointer appearance-none pr-8"
            >
              <option value="all" className="bg-slate-900 text-slate-200">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id} className="bg-slate-900 text-slate-200">{d.department_name}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>

          {/* Section Filter */}
          <div className="relative w-full sm:w-48">
            <select
              value={selectedSectionFilter}
              onChange={(e) => setSelectedSectionFilter(e.target.value)}
              disabled={selectedDeptFilter === 'all'}
              className="h-[42px] bg-slate-950/80 border border-slate-700/80 text-slate-100 text-sm rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/80 block w-full px-3.5 py-2 outline-none transition-all cursor-pointer appearance-none pr-8 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <option value="all" className="bg-slate-900 text-slate-200">All Sections</option>
              {filteredSectionsForFilterDropdown.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-slate-200">{s.section_name}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Purchase Order History Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="text-xs uppercase bg-slate-950/80 border-b border-slate-700/80">
            <tr>
              <th scope="col" className="px-5 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Date</th>
              <th scope="col" className="px-5 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">PO Number</th>
              <th scope="col" className="px-5 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Vendor</th>
              <th scope="col" className="px-5 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Department</th>
              <th scope="col" className="px-5 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Section</th>
              <th scope="col" className="px-5 py-3.5 font-semibold text-slate-400 uppercase tracking-wider text-right">Amount</th>
              <th scope="col" className="px-5 py-3.5 font-semibold text-slate-400 uppercase tracking-wider text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 text-slate-300">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500/20 border-t-purple-500" />
                    <p className="text-xs text-slate-400 font-medium">Loading purchase orders...</p>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-3">
                      <FileText size={24} />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-200 mb-1">No purchase orders found</h4>
                    <p className="text-xs text-slate-400">
                      {searchTerm || selectedDeptFilter !== 'all' || selectedSectionFilter !== 'all'
                        ? 'No purchase orders matched your search or filters. Try adjusting your query.'
                        : 'There are no purchase orders recorded in the system yet.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((po) => (
                <tr key={po.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-4 whitespace-nowrap text-xs font-medium text-slate-300">
                    {po.created_at ? (
                      new Date(po.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/25 text-purple-300">
                      {po.po_number || '-'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-slate-200 max-w-[200px] truncate" title={po.vendor_name || ''}>
                    {po.vendor_name || <span className="text-slate-500">-</span>}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-300">
                    {po.category ? (
                      <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300">
                        {getDeptName(po.category)}
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-400">
                    {getSectionName(po.sub_category_1)}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-right font-semibold text-slate-100 text-sm tracking-tight">
                    {formatCurrency((po.subtotal || 0) + (po.gst_total || 0))}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleViewPDF(po)}
                        disabled={isGeneratingPDF === po.id}
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-500/10 border border-purple-500/25 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 hover:border-purple-500/50 transition-all disabled:opacity-50 shadow-sm"
                        title="View PDF"
                      >
                        {isGeneratingPDF === po.id ? (
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-purple-400 border-t-transparent" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/finance/management/purchase-order?view=${po.id}`)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-800/80 border border-slate-700/80 text-slate-400 hover:text-slate-100 hover:bg-slate-700/80 hover:border-slate-600 transition-all shadow-sm"
                        title="View PO Form"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/finance/management/purchase-order?edit=${po.id}`)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-800/80 border border-slate-700/80 text-slate-400 hover:text-purple-300 hover:bg-purple-950/40 hover:border-purple-500/40 transition-all shadow-sm"
                        title="Edit PO"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Record Count Footer */}
      <div className="p-4 sm:px-6 border-t border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/40">
        <span className="text-xs sm:text-sm text-slate-400">
          Showing <span className="font-semibold text-slate-100">{(page * pageSize) + (data.length > 0 ? 1 : 0)}</span> to <span className="font-semibold text-slate-100">{(page * pageSize) + data.length}</span> of <span className="font-semibold text-slate-100">{totalCount}</span> Entries
        </span>
        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={prevPage}
            disabled={page === 0 || isLoading}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-200 bg-slate-800/80 border border-slate-700/80 rounded-xl hover:bg-slate-700/80 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Prev</span>
          </button>
          <button
            type="button"
            onClick={nextPage}
            disabled={(page + 1) * pageSize >= totalCount || isLoading}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-200 bg-slate-800/80 border border-slate-700/80 rounded-xl hover:bg-slate-700/80 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

POHistoryTable.displayName = 'POHistoryTable';
