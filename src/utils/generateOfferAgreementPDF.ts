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

  renderAgreementPage(doc, campaignName, item);

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${totalPages} — Offer Agreement (${item.influencerCode} - ${item.username})`,
      105,
      287,
      { align: 'center' }
    );
  }

  const safeCode = item.influencerCode.replace(/[^a-zA-Z0-9]/g, '_');
  const safeUser = item.username.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Offer_Agreement_${safeCode}_${safeUser}.pdf`);
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

  // Sort items strictly by numeric suffix of Influencer Code (HIS1... HIS38 -> TNS39... -> BHS214)
  const sortedItems = [...items].sort((a, b) => naturalSortCompare(a.influencerCode, b.influencerCode));

  sortedItems.forEach((item, idx) => {
    if (idx > 0) {
      doc.addPage('a4', 'portrait');
    }
    renderAgreementPage(doc, campaignName, item);
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${totalPages} — Combined Offer Agreements (${campaignName})`,
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
  campaignName: string,
  item: OfferAgreementPDFItem
) => {
  // Page printable width = 210 - 24 = 186mm (margins 12mm left/right)
  const leftMargin = 12;
  const rightMargin = 198;
  const contentWidth = 186;

  // Header Banner
  doc.setFillColor(109, 40, 217); // Purple theme
  doc.rect(0, 0, 210, 20, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('OFFER AGREEMENT', leftMargin, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Campaign: ${campaignName}`, rightMargin, 12, { align: 'right' });

  // Influencer Meta Badge
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(leftMargin, 24, contentWidth, 12, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`Influencer Code: ${item.influencerCode}`, leftMargin + 4, 31.5);
  doc.text(`Username: ${item.username}`, leftMargin + 65, 31.5);
  doc.text(`Price / Video: ${typeof item.pricePerVideo === 'number' ? `₹${item.pricePerVideo.toLocaleString('en-IN')}` : item.pricePerVideo}`, rightMargin - 4, 31.5, { align: 'right' });

  // Render Agreement Body Lines
  let yPos = 42;
  const textLines = item.agreementText.split('\n');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  textLines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      yPos += 2.5;
      return;
    }

    // Check headings
    const isHeading = [
      'PRODUCT PLAN',
      'YOUR ASSIGNED PUBLISHING DATES',
      'DRAFT & APPROVAL',
      'PAYMENT & COMMERCIAL TERMS',
      'Regards,',
      'Team Justmixx',
      'Velmora Consumer Products LLP'
    ].includes(trimmed);

    if (isHeading) {
      yPos += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(109, 40, 217);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
    }

    // Split text if it wraps wide
    const wrapped = doc.splitTextToSize(trimmed, contentWidth);
    wrapped.forEach((wLine: string) => {
      if (yPos > 275) {
        doc.addPage('a4', 'portrait');

        // Repeat Header Banner on subpage
        doc.setFillColor(109, 40, 217);
        doc.rect(0, 0, 210, 16, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text(`OFFER AGREEMENT — ${item.influencerCode} (${item.username})`, leftMargin, 10.5);

        yPos = 22;
      }

      doc.text(wLine, leftMargin, yPos);
      yPos += 4.2;
    });

    if (isHeading) {
      yPos += 1;
    }
  });
};
