import { Text, View } from '@react-pdf/renderer';
import { styles } from '../pdfStyles';
import { formatCurrencyPDF } from '../pdfHelpers';
import type { POProductPayload } from '../../../types';

interface POTableProps {
  products: POProductPayload[];
}

export const POTable = ({ products }: POTableProps) => (
  <View style={styles.table}>
    {/* Table Header */}
    <View style={styles.tableHeader}>
      <Text style={[styles.tableHeaderCell, styles.colNo]}>#</Text>
      <Text style={[styles.tableHeaderCell, styles.colItem]}>Item / Description</Text>
      <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
      <Text style={[styles.tableHeaderCell, styles.colPrice]}>Price</Text>
      <Text style={[styles.tableHeaderCell, styles.colGST]}>GST %</Text>
      <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total Amount</Text>
    </View>

    {/* Table Rows */}
    {products.map((row, index) => (
      <View key={index} style={styles.tableRow} wrap={false}>
        <Text style={[styles.tableCell, styles.colNo]}>{index + 1}</Text>
        <Text style={[styles.tableCell, styles.colItem]}>
          {row.product_name}
          {row.moq || row.batch_size ? `\n(MOQ: ${row.moq || '-'} | Batch: ${row.batch_size || '-'})` : ''}
        </Text>
        <Text style={[styles.tableCell, styles.colQty]}>{row.quantity}</Text>
        <Text style={[styles.tableCell, styles.colPrice]}>{formatCurrencyPDF(row.unit_price)}</Text>
        <Text style={[styles.tableCell, styles.colGST]}>{row.gst}%</Text>
        <Text style={[styles.tableCell, styles.colTotal]}>{formatCurrencyPDF(row.total_amount)}</Text>
      </View>
    ))}
  </View>
);
