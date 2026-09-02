import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PickListInfluencerRecord } from '../config/skuMapping';

export const generatePickListPDF = (
  campaignName: string,
  records: PickListInfluencerRecord[]
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const now = new Date();
  const formattedDate = `${String(now.getDate()).padStart(2, '0')} ${now.toLocaleString('default', { month: 'short' })} ${now.getFullYear()}`;

  // Header Title Block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text('PICK LIST', 14, 18);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(109, 40, 217); // purple-700
  doc.text(`Campaign: ${campaignName}`, 14, 25);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Download Date: ${formattedDate}`, 196, 25, { align: 'right' });

  // Prepare table data with influencer row grouping
  const tableRows: any[] = [];

  records.forEach((rec) => {
    const prods = rec.products;
    if (prods.length === 0) {
      tableRows.push([
        rec.sNo,
        rec.influencerCode || '—',
        rec.influencerName || rec.username || '—',
        'No products assigned',
        '—',
        '0',
        ''
      ]);
    } else {
      prods.forEach((p, idx) => {
        if (idx === 0) {
          tableRows.push([
            rec.sNo,
            rec.influencerCode || '—',
            rec.influencerName || rec.username || '—',
            p.product_name,
            p.sku,
            p.qty,
            ''
          ]);
        } else {
          tableRows.push([
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

  autoTable(doc, {
    startY: 30,
    head: [['S.No', 'Influencer Code', 'Influencer Name', 'Product Name', 'SKU', 'Qty', 'Verify']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [109, 40, 217],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 40 },
      3: { cellWidth: 52 },
      4: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 12, halign: 'center' },
      6: { cellWidth: 18, halign: 'center' }
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount} — Pick List (${campaignName})`,
        105,
        287,
        { align: 'center' }
      );
    }
  });

  const safeFileName = `PickList_${campaignName.replace(/[^a-zA-Z0-9]/g, '_')}_${formattedDate.replace(/\s+/g, '_')}.pdf`;
  doc.save(safeFileName);
};
