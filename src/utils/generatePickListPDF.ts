import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { naturalSortCompare, PickListInfluencerRecord } from '../config/skuMapping';

export const generatePickListPDF = (
  campaignName: string,
  records: PickListInfluencerRecord[]
) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const now = new Date();
  const formattedDate = `${String(now.getDate()).padStart(2, '0')} ${now.toLocaleString('default', { month: 'short' })} ${now.getFullYear()}`;

  // 1. Sort records strictly by numeric index of Influencer Code (1 to 214: HIS1... HIS38 -> TNS39... -> BHS214)
  const sortedRecords = [...records].sort((a, b) => 
    naturalSortCompare(a.influencerCode, b.influencerCode)
  );

  // Re-assign S.No sequentially from 1 to N after natural sorting
  sortedRecords.forEach((rec, idx) => {
    rec.sNo = idx + 1;
  });

  // 2. Build complete Influencer Groups
  interface InfluencerGroup {
    sNo: number;
    code: string;
    name: string;
    products: any[];
    rowCount: number;
  }

  const groups: InfluencerGroup[] = sortedRecords.map((rec) => {
    const prods = rec.products;
    const infName = rec.influencerName || rec.username || '—';
    return {
      sNo: rec.sNo,
      code: rec.influencerCode || '—',
      name: infName,
      products: prods,
      rowCount: prods.length > 0 ? prods.length : 1
    };
  });

  // 3. Paginate by Influencer GROUPS (Strict cap of 24 body rows per page for guaranteed zero autoTable page overflow)
  const MAX_ROWS_PER_PAGE = 24;

  interface PDFPage {
    groups: InfluencerGroup[];
  }

  const pages: PDFPage[] = [];
  let currentPageGroups: InfluencerGroup[] = [];
  let currentPageRowCount = 0;

  groups.forEach((group) => {
    const fitsInPage = currentPageRowCount + group.rowCount <= MAX_ROWS_PER_PAGE;

    if (fitsInPage || currentPageGroups.length === 0) {
      currentPageGroups.push(group);
      currentPageRowCount += group.rowCount;
    } else {
      pages.push({ groups: currentPageGroups });
      currentPageGroups = [group];
      currentPageRowCount = group.rowCount;
    }
  });

  if (currentPageGroups.length > 0) {
    pages.push({ groups: currentPageGroups });
  }

  // 4. Render Single-Table Full-Width PDF Pages
  const tableHead = [['S.No', 'Influencer Code', 'Influencer Name', 'Product Name', 'SKU', 'Qty', 'Verify']];

  // Printable width = 297mm (A4 Landscape) - 16mm (margins) = 281mm
  const columnStyles = {
    0: { cellWidth: 10, halign: 'center' as const },
    1: { cellWidth: 26, halign: 'center' as const, fontStyle: 'bold' as const },
    2: { cellWidth: 55 },
    3: { cellWidth: 132 },
    4: { cellWidth: 18, halign: 'center' as const, fontStyle: 'bold' as const },
    5: { cellWidth: 12, halign: 'center' as const },
    6: { cellWidth: 28, halign: 'center' as const }
  };

  const commonStyles = {
    fontSize: 8,
    cellPadding: { top: 1.1, bottom: 1.1, left: 1.5, right: 1.5 },
    textColor: [30, 41, 59] as [number, number, number],
    lineColor: [226, 232, 240] as [number, number, number],
    lineWidth: 0.12,
    valign: 'middle' as const
  };

  const headStyles = {
    fillColor: [109, 40, 217] as [number, number, number],
    textColor: [255, 255, 255] as [number, number, number],
    fontStyle: 'bold' as const,
    fontSize: 8.5,
    halign: 'center' as const,
    cellPadding: 1.6
  };

  pages.forEach((pageObj, pIdx) => {
    if (pIdx > 0) {
      doc.addPage('a4', 'landscape');
    }

    // Build table rows for all groups on this page
    const pageRows: any[][] = [];
    pageObj.groups.forEach((group) => {
      if (group.products.length === 0) {
        pageRows.push([
          group.sNo,
          group.code,
          group.name,
          'No products assigned',
          '—',
          '0',
          ''
        ]);
      } else {
        group.products.forEach((p: any, idx: number) => {
          if (idx === 0) {
            pageRows.push([
              group.sNo,
              group.code,
              group.name,
              p.product_name,
              p.sku,
              p.qty,
              ''
            ]);
          } else {
            pageRows.push([
              '',
              '',
              '',
              p.product_name,
              p.sku,
              p.qty,
              ''
            ]);
          }
        });
      }
    });

    // Top Header Block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text('PICK LIST', 8, 10);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(109, 40, 217);
    doc.text(`Campaign: ${campaignName}`, 8, 14.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Download Date: ${formattedDate}`, 289, 14.5, { align: 'right' });

    // Render Single Full-Width Table for this Page with pageBreak: 'avoid'
    autoTable(doc, {
      startY: 16,
      margin: { left: 8, top: 16, right: 8, bottom: 8 },
      tableWidth: 281,
      head: tableHead,
      body: pageRows,
      theme: 'grid',
      pageBreak: 'avoid',
      headStyles,
      columnStyles,
      styles: commonStyles
    });

    // Footer Page Number
    const totalPages = pages.length;
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${pIdx + 1} of ${totalPages} — Pick List (${campaignName})`,
      148.5,
      205,
      { align: 'center' }
    );
  });

  const safeFileName = `PickList_${campaignName.replace(/[^a-zA-Z0-9]/g, '_')}_${formattedDate.replace(/\s+/g, '_')}.pdf`;
  doc.save(safeFileName);
};
