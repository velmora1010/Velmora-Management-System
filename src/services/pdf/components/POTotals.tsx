import { Text, View } from '@react-pdf/renderer';
import { styles } from '../pdfStyles';
import { formatCurrencyPDF } from '../pdfHelpers';

interface POTotalsProps {
  subtotal: number;
  gstTotal: number;
  grandTotal: number;
}

export const POTotals = ({ subtotal, gstTotal, grandTotal }: POTotalsProps) => (
  <View style={styles.totalsContainer} wrap={false}>
    <View style={styles.totalsBox}>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Subtotal</Text>
        <Text style={styles.totalValue}>{formatCurrencyPDF(subtotal)}</Text>
      </View>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>GST</Text>
        <Text style={styles.totalValue}>{formatCurrencyPDF(gstTotal)}</Text>
      </View>
      <View style={styles.totalRowGrand}>
        <Text style={styles.grandTotalLabel}>Grand Total</Text>
        <Text style={styles.grandTotalValue}>Rs. {formatCurrencyPDF(grandTotal)}</Text>
      </View>
    </View>
  </View>
);
