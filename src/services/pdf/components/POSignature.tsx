import { Text, View } from '@react-pdf/renderer';
import { styles } from '../pdfStyles';

export const POSignature = () => (
  <View style={styles.signatureContainer} wrap={false}>
    <View style={styles.signatureBlock}>
      <View style={styles.signatureLine} />
      <Text style={styles.signatureText}>Prepared By</Text>
    </View>
    <View style={styles.signatureBlock}>
      <View style={styles.signatureLine} />
      <Text style={styles.signatureText}>Authorized Signatory</Text>
    </View>
  </View>
);
