import React from 'react';
import { Card } from '../ui/Card';

interface ProcurementTotalsCardProps {
  subtotal: number;
  gstTotal: number;
  grandTotal: number;
}

export const ProcurementTotalsCard: React.FC<ProcurementTotalsCardProps> = ({ subtotal, gstTotal, grandTotal }) => {
  return (
    <Card className="w-full md:w-80 ml-auto border border-border shadow-velmora !p-5">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted font-medium">Subtotal</span>
          <span className="text-main font-semibold">₹{subtotal.toFixed(2)}</span>
        </div>
        
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted font-medium">GST Total</span>
          <span className="text-main font-semibold">₹{gstTotal.toFixed(2)}</span>
        </div>
        
        <div className="border-t border-border pt-4 mt-2 flex justify-between items-center">
          <span className="text-main font-bold">Grand Total</span>
          <span className="text-primary font-bold text-xl">₹{grandTotal.toFixed(2)}</span>
        </div>
      </div>
    </Card>
  );
};
