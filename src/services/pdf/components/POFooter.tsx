import { Text, View } from '@react-pdf/renderer';
import { styles } from '../pdfStyles';

interface POFooterProps {
  termsConditions: string;
}

export const POFooter = ({ termsConditions }: POFooterProps) => (
  <View style={styles.footerContainer} fixed>
    <Text style={styles.termsTitle}>Terms & Conditions</Text>
    <Text style={styles.termsText}>{termsConditions || 'Standard Velmora Business Terms Apply.'}</Text>
    
    <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
      `Page ${pageNumber} of ${totalPages}  |  Generated on ${new Date().toLocaleString()}`
    )} />
  </View>
);
