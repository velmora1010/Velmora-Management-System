/**
 * Utility functions to map camelCase App objects to snake_case Supabase rows and vice versa.
 */

// Generic camel to snake
export function toSnakeCaseObj(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(toSnakeCaseObj);
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    result[snakeKey] = typeof value === 'object' && value !== null && !Array.isArray(value) 
                       ? toSnakeCaseObj(value) 
                       : value;
  }
  return result;
}

// Generic snake to camel
export function toCamelCaseObj(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCaseObj);
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = typeof value === 'object' && value !== null && !Array.isArray(value)
                       ? toCamelCaseObj(value)
                       : value;
  }
  return result;
}

// --- Specific Module Mappers ---

export const ProductMapper = {
  toSupabase: (appObj: any) => ({
    barcode: appObj.barcodeNumber || appObj.barcode,
    product_name: appObj.productName,
    product_code: appObj.productCode,
    batch_id: appObj.batchId,
    micro_batch_no: appObj.microBatchNo,
    current_stage: appObj.currentStage,
    produced_by: appObj.producedBy,
    labeled_by: appObj.labeledBy,
    ...toSnakeCaseObj(appObj) // Fallback for other fields
  }),
  toApp: (dbObj: any) => ({
    ...toCamelCaseObj(dbObj),
    barcodeNumber: dbObj.barcode,
    barcode: dbObj.barcode
  })
};

export const ComboMapper = {
  toSupabase: (appObj: any) => ({
    combo_box_barcode: appObj.comboBoxBarcode,
    combo_name: appObj.comboName,
    combo_type: appObj.comboType,
    packed_items: appObj.packedItems,
    current_stage: appObj.currentStage,
    ...toSnakeCaseObj(appObj)
  }),
  toApp: (dbObj: any) => ({
    ...toCamelCaseObj(dbObj),
    comboBoxBarcode: dbObj.combo_box_barcode
  })
};

export const QCMapper = {
  toSupabase: (appObj: any) => ({
    qc_barcode: appObj.qcBarcode,
    product_barcodes: appObj.productBarcodes,
    current_stage: appObj.currentStage,
    ...toSnakeCaseObj(appObj)
  }),
  toApp: (dbObj: any) => ({
    ...toCamelCaseObj(dbObj),
    qcBarcode: dbObj.qc_barcode
  })
};

export const RawMaterialMapper = {
  toSupabase: (appObj: any) => ({
    barcode: appObj.barcodeNumber || appObj.displayBarcode || appObj.barcode,
    material_name: appObj.materialName,
    batch_no: appObj.batchNo,
    current_stage: appObj.currentStage,
    ...toSnakeCaseObj(appObj)
  }),
  toApp: (dbObj: any) => ({
    ...toCamelCaseObj(dbObj),
    barcodeNumber: dbObj.barcode,
    displayBarcode: dbObj.barcode,
    barcode: dbObj.barcode
  })
};

export const TaskMapper = {
  toSupabase: (appObj: any) => ({
    task_id: appObj.taskId,
    sub_task: appObj.subTask,
    is_completed: appObj.isCompleted,
    created_at: appObj.createdAt,
    ...toSnakeCaseObj(appObj)
  }),
  toApp: (dbObj: any) => ({
    ...toCamelCaseObj(dbObj),
    taskId: dbObj.task_id
  })
};

export const FinanceMapper = {
  toSupabase: (appObj: any) => ({
    created_at: appObj.createdAt,
    sub_sub_sub_category: appObj.subSubSubCategory,
    ...toSnakeCaseObj(appObj)
  }),
  toApp: (dbObj: any) => ({
    ...toCamelCaseObj(dbObj)
  })
};
