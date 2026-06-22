import { pdf } from '@react-pdf/renderer';
import { PurchaseOrderDocument, type PurchaseOrderDocumentProps } from './pdfTemplates';

/**
 * Triggers a client-side download of the Purchase Order PDF.
 * This is a pure read-only service that does not mutate application state.
 */
export const exportPurchaseOrderPDF = async (payload: PurchaseOrderDocumentProps) => {
  try {
    // Generate the PDF blob using the static payload
    const asPdf = pdf(<PurchaseOrderDocument {...payload} />);
    const blob = await asPdf.toBlob();

    // Create a temporary link to trigger the download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // Format: PO-YYYY-MM-XXX.pdf
    link.download = `${payload.poNumber || 'Draft-PO'}.pdf`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    return false;
  }
};
