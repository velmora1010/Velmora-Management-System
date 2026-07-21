import { memo, useState, useEffect, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, FileText, Edit2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
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
    <Card className="flex flex-col h-full bg-slate-800 border-slate-700 text-slate-200">
      <div className="p-4 border-b border-slate-700 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <h3 className="text-lg font-bold text-white">Purchase Order History</h3>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          {/* Search PO */}
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block w-full pl-10 p-2.5"
              placeholder="Search PO Number or Vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Department Filter */}
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 p-2.5"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.department_name}</option>
            ))}
          </select>

          {/* Section Filter */}
          <select
            value={selectedSectionFilter}
            onChange={(e) => setSelectedSectionFilter(e.target.value)}
            disabled={selectedDeptFilter === 'all'}
            className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 p-2.5 disabled:opacity-50"
          >
            <option value="all">All Sections</option>
            {filteredSectionsForFilterDropdown.map((s) => (
              <option key={s.id} value={s.id}>{s.section_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm text-left text-slate-300">
          <thead className="text-xs uppercase bg-slate-900 border-b border-slate-700">
            <tr>
              <th scope="col" className="px-6 py-3 font-semibold text-white">Date</th>
              <th scope="col" className="px-6 py-3 font-semibold text-white">PO Number</th>
              <th scope="col" className="px-6 py-3 font-semibold text-white">Vendor</th>
              <th scope="col" className="px-6 py-3 font-semibold text-white">Department</th>
              <th scope="col" className="px-6 py-3 font-semibold text-white">Section</th>
              <th scope="col" className="px-6 py-3 font-semibold text-white text-right">Amount</th>
              <th scope="col" className="px-6 py-3 font-semibold text-white text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-750">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center">
                  <p className="text-slate-400 mb-1">No purchase orders found.</p>
                </td>
              </tr>
            ) : (
              data.map((po) => (
                <tr key={po.id} className="bg-slate-800 border-b border-slate-700 hover:bg-slate-750/30 transition-colors">
                  <td className="px-6 py-4">
                    {new Date(po.created_at || '').toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </td>
                  <td className="px-6 py-4 font-medium text-white">{po.po_number}</td>
                  <td className="px-6 py-4">{po.vendor_name}</td>
                  <td className="px-6 py-4">{getDeptName(po.category)}</td>
                  <td className="px-6 py-4">{getSectionName(po.sub_category_1)}</td>
                  <td className="px-6 py-4 text-right font-medium text-white">
                    {formatCurrency((po.subtotal || 0) + (po.gst_total || 0))}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => handleViewPDF(po)}
                        disabled={isGeneratingPDF === po.id}
                        className="text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                        title="View PDF"
                      >
                        {isGeneratingPDF === po.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                        ) : (
                          <FileText className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => navigate(`/finance/management/purchase-order?view=${po.id}`)}
                        className="text-slate-400 hover:text-slate-200 transition-colors"
                        title="View PO Form"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/finance/management/purchase-order?edit=${po.id}`)}
                        className="text-slate-400 hover:text-purple-400 transition-colors"
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

      <div className="p-4 border-t border-slate-700 flex items-center justify-between">
        <span className="text-sm text-slate-400">
          Showing <span className="font-semibold text-white">{(page * pageSize) + (data.length > 0 ? 1 : 0)}</span> to <span className="font-semibold text-white">{(page * pageSize) + data.length}</span> of <span className="font-semibold text-white">{totalCount}</span> Entries
        </span>
        <div className="inline-flex mt-2 xs:mt-0 gap-2">
          <button
            onClick={prevPage}
            disabled={page === 0 || isLoading}
            className="flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Prev
          </button>
          <button
            onClick={nextPage}
            disabled={(page + 1) * pageSize >= totalCount || isLoading}
            className="flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
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
