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
    products: any[];
    rowCount: number;
  }

  const groups: InfluencerGroup[] = sortedRecords.map((rec) => {
    const prods = rec.products;
    return {
      sNo: rec.sNo,
      code: rec.influencerCode || '—',
      products: prods,
      rowCount: prods.length > 0 ? prods.length : 1
    };
  });

  // 3. Continuous Dynamic Pagination by Influencer GROUPS
  // Safe max printable capacity: 35 body rows per physical page.
  // 35 rows * 4.6mm = 161mm + 15mm startY + 5.2mm header = 181.2mm total table height.
  // This guarantees autoTable never exceeds the 202mm page boundary, preventing 1-row overflow and ghost header pages.
  const MAX_ROWS_PER_PAGE = 35;

  interface PDFPage {
    groups: InfluencerGroup[];
  }

  const pages: PDFPage[] = [];
  let currentPageGroups: InfluencerGroup[] = [];
  let currentPageRowCount = 0;

  groups.forEach((group) => {
    // If the whole group fits in remaining space of current page, add it
    if (currentPageRowCount + group.rowCount <= MAX_ROWS_PER_PAGE) {
      currentPageGroups.push(group);
      currentPageRowCount += group.rowCount;
    } 
    // If group exceeds page capacity but fits on a fresh page, start fresh page
    else if (group.rowCount <= MAX_ROWS_PER_PAGE) {
      if (currentPageGroups.length > 0) {
        pages.push({ groups: currentPageGroups });
      }
      currentPageGroups = [group];
      currentPageRowCount = group.rowCount;
    } 
    // Exceptional case: group itself is larger than 35 rows. Add what fits and spill cleanly.
    else {
      if (currentPageRowCount > 0) {
        pages.push({ groups: currentPageGroups });
        currentPageGroups = [];
        currentPageRowCount = 0;
      }
      pages.push({ groups: [group] });
    }
  });

  if (currentPageGroups.length > 0) {
    pages.push({ groups: currentPageGroups });
  }

  // Filter out any accidentally empty pages
  const validPages = pages.filter(p => p.groups.length > 0);

  // 4. Render Single-Table Full-Width PDF Pages (6 Columns: S.No | Influencer Code | Product Name | SKU | Qty | Verify)
  const tableHead = [['S.No', 'Influencer Code', 'Product Name', 'SKU', 'Qty', 'Verify']];

  // Printable width = 297mm (A4 Landscape) - 16mm (margins) = 281mm
  const columnStyles = {
    0: { cellWidth: 10, halign: 'center' as const },
    1: { cellWidth: 28, halign: 'center' as const, fontStyle: 'bold' as const },
    2: { cellWidth: 171 },
    3: { cellWidth: 20, halign: 'center' as const, fontStyle: 'bold' as const },
    4: { cellWidth: 14, halign: 'center' as const },
    5: { cellWidth: 38, halign: 'center' as const }
  };

  const commonStyles = {
    fontSize: 8,
    cellPadding: { top: 0.7, bottom: 0.7, left: 1.5, right: 1.5 },
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
    cellPadding: 1.5
  };

  validPages.forEach((pageObj, pIdx) => {
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
              p.product_name,
              p.sku,
              p.qty,
              ''
            ]);
          } else {
            pageRows.push([
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
    doc.text(`Campaign: ${campaignName}`, 8, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Download Date: ${formattedDate}`, 289, 14, { align: 'right' });

    // Render Single Full-Width Table for this Page with pageBreak: 'avoid'
    autoTable(doc, {
      startY: 15,
      margin: { left: 8, top: 15, right: 8, bottom: 8 },
      tableWidth: 281,
      head: tableHead,
      body: pageRows,
      theme: 'grid',
      pageBreak: 'avoid',
      headStyles,
      columnStyles,
      styles: commonStyles
    });
  });

  // Stamp Footer Page Numbers across all physical pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${totalPages} — Pick List (${campaignName})`,
      148.5,
      204,
      { align: 'center' }
    );
  }

  const safeFileName = `PickList_${campaignName.replace(/[^a-zA-Z0-9]/g, '_')}_${formattedDate.replace(/\s+/g, '_')}.pdf`;
  doc.save(safeFileName);
};
