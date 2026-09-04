import jsPDF from 'jspdf';
import { naturalSortCompare } from '../config/skuMapping';
import { calculateDraftDate } from '../modules/marketing/OfferAgreementSection';

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
    doc.text(footerText, 105, 288, { align: 'center' });
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
      288,
      { align: 'center' }
    );
  }

  const safeCampaign = campaignName.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Combined_Offer_Agreements_${safeCampaign}.pdf`);
};

const drawHeaderBanner = (doc: jsPDF) => {
  // Light Blue Header Accent Background (#D9E8F7 ~ 40% lightness of logo blue)
  doc.setFillColor(217, 232, 247);
  doc.rect(0, 0, 210, 21, 'F');

  // Subtle Header Bottom Line (#B8D4F0)
  doc.setDrawColor(184, 212, 240);
  doc.setLineWidth(0.4);
  doc.line(0, 21, 210, 21);

  // Title "OFFER AGREEMENT" in Justmixx Logo Dark Blue (#0A4C95)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(10, 76, 149);
  doc.text('OFFER AGREEMENT', 15, 14);

  // Justmixx Rounded Logo Badge (Top Right Corner)
  doc.setFillColor(10, 76, 149);
  doc.roundedRect(158, 4, 37, 13, 3, 3, 'F');

  // "Justmixx" White Logo Text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('Justmixx', 176.5, 12.3, { align: 'center' });
};

const renderAgreementPage = (
  doc: jsPDF,
  item: OfferAgreementPDFItem
) => {
  const leftMargin = 15;
  const contentWidth = 180; // 210 - 30 = 180mm

  // Draw Top Blue Header Banner
  drawHeaderBanner(doc);

  // Body start Y position
  let yPos = 27;

  // Clean agreement text:
  // 1. Strip asterisks
  // 2. Sanitize currency symbol to avoid character spacing corruption in jsPDF Helvetica
  // 3. Ensure any "Video X: D MMM" date without a 4-digit year has the year included
  let cleanText = item.agreementText
    .replace(/\*/g, '')
    .replace(/₹/g, 'Rs. ')
    .replace(/Video\s+(\d):\s*(\d{1,2}\s+[A-Za-z]{3,4})(?!\s+\d{4})/gi, (match, vNum, datePart) => {
      return `Video ${vNum}: ${datePart} 2026`;
    });

  // Ensure YOUR ASSIGNED DRAFT DATES section is correctly calculated from YOUR ASSIGNED PUBLISHING DATES
  if (cleanText.includes('YOUR ASSIGNED PUBLISHING DATES')) {
    const parts = cleanText.split('YOUR ASSIGNED PUBLISHING DATES');
    const afterPub = parts[1] || '';

    // Extract publishing dates specifically from after YOUR ASSIGNED PUBLISHING DATES header
    const pubDates: Record<number, string> = {};
    for (let v = 1; v <= 6; v++) {
      const match = afterPub.match(new RegExp(`Video\\s+${v}:\\s*([^\\n]+)`));
      if (match && match[1] && match[1].trim()) {
        pubDates[v] = match[1].trim();
      }
    }

    // Build draft date lines (Pub Date - 3 days)
    const draftLines: string[] = [];
    for (let v = 1; v <= 6; v++) {
      const pubDate = pubDates[v];
      const draftDate = pubDate ? calculateDraftDate(pubDate) : '';
      draftLines.push(draftDate ? `Video ${v}: ${draftDate}` : `Video ${v}:`);
    }

    const draftBlockText = `YOUR ASSIGNED DRAFT DATES\n\n${draftLines.join('\n')}\n\n`;

    if (cleanText.includes('YOUR ASSIGNED DRAFT DATES')) {
      const topPart = cleanText.split('YOUR ASSIGNED DRAFT DATES')[0];
      cleanText = `${topPart}${draftBlockText}YOUR ASSIGNED PUBLISHING DATES${afterPub}`;
    } else {
      const beforePub = parts[0];
      cleanText = `${beforePub}${draftBlockText}YOUR ASSIGNED PUBLISHING DATES${afterPub}`;
    }
  }

  // Trim trailing empty lines so they don't trigger an unnecessary addPage()
  const rawLines = cleanText.split('\n');
  while (rawLines.length > 0 && !rawLines[rawLines.length - 1].trim()) {
    rawLines.pop();
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);

  rawLines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      yPos += 2.2;
      return;
    }

    // Check headings
    const isHeading = [
      'PRODUCT PLAN',
      'YOUR ASSIGNED DRAFT DATES',
      'YOUR ASSIGNED PUBLISHING DATES',
      'DRAFT & APPROVAL',
      'PAYMENT & COMMERCIAL TERMS',
      'Looking forward to a smooth and successful collaboration!',
      'Regards,',
      'Team Justmixx',
      'Velmora Consumer Products LLP'
    ].includes(trimmed);

    if (isHeading) {
      yPos += 1.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      // Dark Blue (#0A4C95) for Section Headings
      doc.setTextColor(10, 76, 149);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      // Dark slate (#1E293B) for Body Text
      doc.setTextColor(30, 41, 59);
    }

    // Split text naturally to wrap inside A4 printable width
    const wrapped = doc.splitTextToSize(trimmed, contentWidth);
    wrapped.forEach((wLine: string) => {
      if (yPos > 275) {
        doc.addPage('a4', 'portrait');
        drawHeaderBanner(doc);
        yPos = 27;
      }

      doc.text(wLine, leftMargin, yPos);
      yPos += 3.8;
    });

    if (isHeading) {
      yPos += 0.5;
    }
  });
};
