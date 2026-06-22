import { Text, View } from '@react-pdf/renderer';
import { styles } from '../pdfStyles';
import { formatDatePDF } from '../pdfHelpers';

interface POHeaderProps {
  poNumber: string;
  date: string;
  vendorName: string;
}

export const POHeader = ({ poNumber, date, vendorName }: POHeaderProps) => (
  <View>
    {/* Top Header */}
    <View style={styles.headerContainer}>
      <View style={styles.companyBranding}>
        <Text style={styles.companyName}>VELMORA</Text>
        <Text style={styles.companyDetails}>123 Business Avenue</Text>
        <Text style={styles.companyDetails}>Industrial Estate, Phase 1</Text>
        <Text style={styles.companyDetails}>GSTIN: 27AABCU9603R1ZX</Text>
      </View>
      <View style={styles.poMetaContainer}>
        <Text style={styles.documentTitle}>PURCHASE ORDER</Text>
        <View style={styles.metaGrid}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>PO Number:</Text>
            <Text style={styles.metaValue}>{poNumber}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date:</Text>
            <Text style={styles.metaValue}>{formatDatePDF(date)}</Text>
          </View>
        </View>
      </View>
    </View>

    {/* Entities */}
    <View style={styles.entitiesContainer}>
      <View style={styles.entityBlock}>
        <Text style={styles.entityTitle}>Vendor Details</Text>
        <Text style={styles.entityText}>{vendorName}</Text>
        <Text style={styles.entityText}>As per registered profile</Text>
      </View>
      <View style={styles.entityBlock}>
        <Text style={styles.entityTitle}>Shipping Address</Text>
        <Text style={styles.entityText}>Velmora Warehouse</Text>
        <Text style={styles.entityText}>123 Business Avenue</Text>
        <Text style={styles.entityText}>Industrial Estate, Phase 1</Text>
      </View>
    </View>
  </View>
);
