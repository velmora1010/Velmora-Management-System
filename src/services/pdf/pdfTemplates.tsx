import { Document, Page } from '@react-pdf/renderer';
import { styles } from './pdfStyles';
import { POHeader } from './components/POHeader';
import { POTable } from './components/POTable';
import { POTotals } from './components/POTotals';
import { POSignature } from './components/POSignature';
import { POFooter } from './components/POFooter';
import type { POProductPayload } from '../../types';

export interface PurchaseOrderDocumentProps {
  poNumber: string;
  createdAt: string; // The exact timestamp it was saved to the DB
  vendorName: string;
  products: POProductPayload[];
  subtotal: number;
  gstTotal: number;
  grandTotal: number;
  termsConditions: string;
}

export const PurchaseOrderDocument = ({
  poNumber,
  createdAt,
  vendorName,
  products,
  subtotal,
  gstTotal,
  grandTotal,
  termsConditions,
}: PurchaseOrderDocumentProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      
      <POHeader 
        poNumber={poNumber} 
        date={createdAt} 
        vendorName={vendorName} 
      />
      
      <POTable products={products} />
      
      <POTotals 
        subtotal={subtotal} 
        gstTotal={gstTotal} 
        grandTotal={grandTotal} 
      />
      
      <POSignature />
      
      <POFooter termsConditions={termsConditions} />
      
    </Page>
  </Document>
);
