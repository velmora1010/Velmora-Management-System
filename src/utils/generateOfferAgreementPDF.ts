import jsPDF from 'jspdf';
import { naturalSortCompare } from '../config/skuMapping';

export interface OfferAgreementPDFItem {
  influencerCode: string;
  username: string;
  pricePerVideo: string | number;
  agreementText: string;
}

export const generateSingleOfferAgreementPDF = (
  campaignName: string,
  item: OfferAgreementPDFItem
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  renderAgreementPage(doc, item);

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    const footerText = item.influencerCode
      ? `Page ${i} of ${totalPages} — Offer Agreement (${item.influencerCode})`
      : `Page ${i} of ${totalPages} — Offer Agreement`;
    doc.text(footerText, 105, 287, { align: 'center' });
  }

  const safeCode = (item.influencerCode || 'Agreement').replace(/[^a-zA-Z0-9]/g, '_');
  const safeUser = (item.username || '').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = safeUser ? `Offer_Agreement_${safeCode}_${safeUser}.pdf` : `Offer_Agreement_${safeCode}.pdf`;
  doc.save(filename);
};

export const generateCombinedOfferAgreementPDF = (
  campaignName: string,
  items: OfferAgreementPDFItem[]
) => {
  if (items.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Sort items strictly by numeric suffix of Influencer Code
  const sortedItems = [...items].sort((a, b) => naturalSortCompare(a.influencerCode, b.influencerCode));

  sortedItems.forEach((item, idx) => {
    if (idx > 0) {
      doc.addPage('a4', 'portrait');
    }
    renderAgreementPage(doc, item);
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${totalPages} — Combined Offer Agreements`,
      105,
      287,
      { align: 'center' }
    );
  }

  const safeCampaign = campaignName.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Combined_Offer_Agreements_${safeCampaign}.pdf`);
};

const renderAgreementPage = (
  doc: jsPDF,
  item: OfferAgreementPDFItem
) => {
  const leftMargin = 14;
  const contentWidth = 182; // 210 - 28 = 182mm

  // Purple Header Banner (Contains ONLY "OFFER AGREEMENT", NO campaign name)
  doc.setFillColor(109, 40, 217);
  doc.rect(0, 0, 210, 18, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('OFFER AGREEMENT', leftMargin, 12);

  // Body start Y position (Top info bar removed completely)
  let yPos = 28;

  // Clean agreement text:
  // 1. Strip asterisks
  // 2. Sanitize currency symbol to avoid character spacing corruption in jsPDF Helvetica
  // 3. Ensure any "Video X: D MMM" date without a 4-digit year has the year included
  const cleanText = item.agreementText
    .replace(/\*/g, '')
    .replace(/₹/g, 'Rs. ')
    .replace(/Video\s+(\d):\s*(\d{1,2}\s+[A-Za-z]{3,4})(?!\s+\d{4})/gi, (match, vNum, datePart) => {
      return `Video ${vNum}: ${datePart} 2026`;
    });

  const textLines = cleanText.split('\n');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);

  textLines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      yPos += 3;
      return;
    }

    // Check headings
    const isHeading = [
      'PRODUCT PLAN',
      'YOUR ASSIGNED PUBLISHING DATES',
      'DRAFT & APPROVAL',
      'PAYMENT & COMMERCIAL TERMS',
      'Looking forward to a smooth and successful collaboration!',
      'Regards,',
      'Team Justmixx',
      'Velmora Consumer Products LLP'
    ].includes(trimmed);

    if (isHeading) {
      yPos += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(109, 40, 217);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
    }

    // Split text naturally to wrap inside A4 printable width without text clipping or horizontal overflow
    const wrapped = doc.splitTextToSize(trimmed, contentWidth);
    wrapped.forEach((wLine: string) => {
      if (yPos > 272) {
        doc.addPage('a4', 'portrait');

        // Subpage Header
        doc.setFillColor(109, 40, 217);
        doc.rect(0, 0, 210, 14, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text('OFFER AGREEMENT', leftMargin, 9.5);

        yPos = 22;
      }

      doc.text(wLine, leftMargin, yPos);
      yPos += 4.5;
    });

    if (isHeading) {
      yPos += 1;
    }
  });
};
