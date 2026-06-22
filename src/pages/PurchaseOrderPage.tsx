import { PurchaseOrderForm } from '../modules/purchase-orders/PurchaseOrderForm';

export const PurchaseOrderPage = () => {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Create Purchase Order</h1>
        <p className="text-muted-foreground">
          Fill out the form below to generate a new purchase order. The system will automatically link it to the selected vendor.
        </p>
      </div>
      
      <PurchaseOrderForm />
    </div>
  );
};
