export const detectCourier = (awb: string): string => {
  if (!awb) return 'Unknown';
  const cleanAwb = awb.trim();
  if (cleanAwb.startsWith('5')) {
    return 'ST Courier';
  } else if (cleanAwb.startsWith('1')) {
    return 'Delhivery';
  } else if (cleanAwb.startsWith('3')) {
    return 'Amazon';
  } else if (cleanAwb.startsWith('IL') || cleanAwb.startsWith('il')) {
    return 'Ekart';
  }
  return 'Unknown';
};
