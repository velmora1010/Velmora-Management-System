import jsPDF from 'jspdf';
import { naturalSortCompare } from '../config/skuMapping';

export interface AfterDispatchPDFItem {
  influencerCode: string;
  username: string;
  creatorName?: string;
  courier?: string;
  trackingId?: string;
  trackingUrl?: string;
  dispatchStatus?: string;
  messageText: string;
}

export const generateSingleAfterDispatchPDF = (
  campaignName: string,
  item: AfterDispatchPDFItem
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  renderAfterDispatchPage(doc, item);

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    const footerText = item.influencerCode
      ? `Page ${i} of ${totalPages} — After Dispatch (${item.influencerCode})`
      : `Page ${i} of ${totalPages} — After Dispatch`;
    doc.text(footerText, 105, 288, { align: 'center' });
  }

  const safeCode = (item.influencerCode || 'After_Dispatch').replace(/[^a-zA-Z0-9]/g, '_');
  const safeUser = (item.username || '').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = safeUser ? `After_Dispatch_${safeCode}_${safeUser}.pdf` : `After_Dispatch_${safeCode}.pdf`;
  doc.save(filename);
};

export const generateCombinedAfterDispatchPDF = (
  campaignName: string,
  items: AfterDispatchPDFItem[]
) => {
  if (!items || items.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const sortedItems = [...items].sort((a, b) => naturalSortCompare(a.influencerCode, b.influencerCode));

  sortedItems.forEach((item, idx) => {
    if (idx > 0) {
      doc.addPage('a4', 'portrait');
    }
    renderAfterDispatchPage(doc, item);
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${totalPages} — Combined After Dispatch Messages`,
      105,
      288,
      { align: 'center' }
    );
  }

  const safeCampaign = campaignName.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Combined_After_Dispatch_${safeCampaign}.pdf`);
};

const drawHeaderBanner = (doc: jsPDF) => {
  // Light Blue Header Accent Background (#D9E8F7 ~ 40% lightness of logo blue)
  doc.setFillColor(217, 232, 247);
  doc.rect(0, 0, 210, 21, 'F');

  // Header bottom border line (#B8D4F0)
  doc.setDrawColor(184, 212, 240);
  doc.setLineWidth(0.4);
  doc.line(0, 21, 210, 21);

  // Title in Justmixx Logo Dark Blue (#0A4C95)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(10, 76, 149);
  doc.text('AFTER DISPATCH CONFIRMATION', 15, 14);

  // Justmixx Rounded Logo Badge (Top Right Corner)
  doc.setFillColor(10, 76, 149);
  doc.roundedRect(158, 4, 37, 13, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('Justmixx', 176.5, 12.3, { align: 'center' });
};

const renderAfterDispatchPage = (
  doc: jsPDF,
  item: AfterDispatchPDFItem
) => {
  const leftMargin = 15;
  const contentWidth = 180;

  drawHeaderBanner(doc);

  let yPos = 28;

  // Metadata Card (Influencer Code, Username, Courier, Tracking ID)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(leftMargin, yPos, contentWidth, 18, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('INFLUENCER CODE', leftMargin + 4, yPos + 6);
  doc.text('RECIPIENT', leftMargin + 45, yPos + 6);
  doc.text('COURIER', leftMargin + 105, yPos + 6);
  doc.text('TRACKING ID', leftMargin + 140, yPos + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(item.influencerCode || '—', leftMargin + 4, yPos + 13);
  doc.text(item.creatorName || item.username || '—', leftMargin + 45, yPos + 13);
  doc.text(item.courier || 'Delhivery', leftMargin + 105, yPos + 13);
  doc.text(item.trackingId || 'Pending / Blank', leftMargin + 140, yPos + 13);

  yPos += 26;

  // Sanitize message text:
  // 1. Strip asterisks
  // 2. Convert ₹ to Rs. to prevent character distortion in standard Helvetica
  const cleanText = item.messageText
    .replace(/\*/g, '')
    .replace(/₹/g, 'Rs. ');

  const rawLines = cleanText.split('\n');
  while (rawLines.length > 0 && !rawLines[rawLines.length - 1].trim()) {
    rawLines.pop();
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);

  rawLines.forEach(line => {
    const trimmed = line.trim();

    if (!trimmed) {
      yPos += 3;
      return;
    }

    const isTrackingLine = trimmed.startsWith('Tracking ID:') || trimmed.startsWith('Tracking Link:');
    const isPaymentLine = trimmed.startsWith('Payment:');
    const isProductItem = /^\d+\.\s*\d+(st|nd|rd|th)\s+Video/i.test(trimmed);

    if (isTrackingLine || isPaymentLine) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
    } else if (isProductItem) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(10, 76, 149);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
    }

    const wrapped = doc.splitTextToSize(trimmed, contentWidth);

    if (yPos + wrapped.length * 4.5 > 280) {
      doc.addPage('a4', 'portrait');
      drawHeaderBanner(doc);
      yPos = 28;
    }

    doc.text(wrapped, leftMargin, yPos);
    yPos += wrapped.length * 4.5 + 1;
  });
};
