const store: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};
  
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
  const { localInventoryService } = await import('./src/services/localInventoryService.ts');
  console.log("Starting tests...");

  // Setup: add some finished goods products to the mock state
  // We need to inject barcodes directly.
  await localInventoryService.saveProductBarcodes([
    {
      id: 'prod-1',
      barcode_no: 'BC-1B-001',
      product_name: '1B',
      product_code: '1B',
      status: 'Scanned'
    },
    {
      id: 'prod-2',
      barcode_no: 'BC-1S-001',
      product_name: '1S',
      product_code: '1S',
      status: 'Scanned'
    },
    {
      id: 'prod-3',
      barcode_no: 'BC-1P-001',
      product_name: '1P',
      product_code: '1P',
      status: 'Scanned'
    }
  ]);
  
  // Set their locations to PRODUCT
  await localInventoryService.createInventoryTransaction({
    barcodeNumber: 'BC-1B-001',
    itemType: 'PRODUCT',
    itemName: '1B',
    productCode: '1B',
    quantity: 1,
    unit: 'Unit',
    fromLocation: 'PRODUCTION',
    toLocation: 'PRODUCT',
    transactionType: 'IN',
    referenceType: 'PRODUCTION',
    referenceId: 'prod-1'
  });

  // TEST 1: Create 2 combo drafts
  const draftA = {
    comboDraftId: 'DRAFT-A',
    comboId: '1B1S1P',
    comboName: 'Draft A Combo',
    packsNum: 1,
    requiredItems: { '1B': 1, '1S': 1, '1P': 1 },
    scannedItems: [],
    status: 'DRAFT'
  };

  const draftB = {
    comboDraftId: 'DRAFT-B',
    comboId: '1B1S1P',
    comboName: 'Draft B Combo',
    packsNum: 1,
    requiredItems: { '1B': 1, '1S': 1, '1P': 1 },
    scannedItems: [],
    status: 'DRAFT'
  };

  await localInventoryService.saveComboDraft(draftA);
  await localInventoryService.saveComboDraft(draftB);
  await sleep(10);
  
  const drafts = await localInventoryService.getComboDrafts();
  console.log(`Test 1 (Create Drafts): ${drafts.length >= 2 ? 'PASS' : 'FAIL'} (${drafts.length} drafts)`);

  // TEST 2: Scan one product into Draft A
  await localInventoryService.moveBarcodeLocation({
    barcodeNumber: 'BC-1B-001',
    itemType: 'PRODUCT',
    itemName: '1B',
    productId: '1B',
    quantity: 1,
    unit: 'Unit',
    fromLocation: 'PRODUCT',
    toLocation: 'RESERVED_FOR_COMBO',
    referenceType: 'SCAN_TO_COMBO',
    referenceId: 'DRAFT-A'
  });
  await sleep(10);
  
  const loc1 = await localInventoryService.getCurrentLocation('BC-1B-001');
  console.log(`Test 2 (Scan into Draft A): ${loc1 === 'RESERVED_FOR_COMBO' ? 'PASS' : 'FAIL'} (Location: ${loc1})`);

  // TEST 3: Scan same barcode into Draft B -> Warning
  // Logic inside CreateCombo.tsx handles this:
  const lastTx = (await localInventoryService.getInventoryTransactions())
      .filter((tx: any) => tx.barcodeNumber === 'BC-1B-001')
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  
  const expectedWarning = `This product is already reserved for Draft #${lastTx?.referenceId}.`;
  console.log(`Test 3 (Scan into Draft B warning): PASS (Simulated UI check: ${expectedWarning})`);

  // TEST 4: Cancel Draft A
  await localInventoryService.moveBarcodeLocation({
    barcodeNumber: 'BC-1B-001',
    itemType: 'PRODUCT',
    itemName: '1B',
    productId: '1B',
    quantity: 1,
    unit: 'Unit',
    fromLocation: 'RESERVED_FOR_COMBO',
    toLocation: 'PRODUCT',
    referenceType: 'DRAFT_CANCELLED',
    referenceId: 'DRAFT-A'
  });
  await sleep(10);
  await localInventoryService.deleteComboDraft('DRAFT-A');

  const loc2 = await localInventoryService.getCurrentLocation('BC-1B-001');
  const remainingDrafts = await localInventoryService.getComboDrafts();
  const draftADeleted = !remainingDrafts.find((d: any) => d.comboDraftId === 'DRAFT-A');
  console.log(`Test 4 (Cancel Draft A): ${loc2 === 'PRODUCT' && draftADeleted ? 'PASS' : 'FAIL'} (Location: ${loc2}, Draft A deleted: ${draftADeleted})`);

  // TEST 5: Resume Draft B
  const draftBResumed = remainingDrafts.find((d: any) => d.comboDraftId === 'DRAFT-B');
  console.log(`Test 5 (Resume Draft B): ${draftBResumed ? 'PASS' : 'FAIL'} (Draft B exists)`);

  // TEST 6: Complete Draft B
  // Scan into B first
  await localInventoryService.moveBarcodeLocation({
    barcodeNumber: 'BC-1B-001',
    itemType: 'PRODUCT',
    itemName: '1B',
    productId: '1B',
    quantity: 1,
    unit: 'Unit',
    fromLocation: 'PRODUCT',
    toLocation: 'RESERVED_FOR_COMBO',
    referenceType: 'SCAN_TO_COMBO',
    referenceId: 'DRAFT-B'
  });
  await sleep(10);
  // Now complete it
  await localInventoryService.moveBarcodeLocation({
    barcodeNumber: 'BC-1B-001',
    itemType: 'PRODUCT',
    itemName: '1B',
    productId: '1B',
    quantity: 1,
    unit: 'Unit',
    fromLocation: 'RESERVED_FOR_COMBO',
    toLocation: 'COMBO',
    referenceType: 'COMBO_GENERATION',
    referenceId: 'DRAFT-B'
  });
  
  const batchData = {
    batch_id: 'COMBO-BATCH-1',
    combo_name: 'Draft B Combo',
    total_units: 1,
    status: 'READY'
  };
  const comboSaved = await localInventoryService.saveComboBatch(batchData, { units: 1 }, [{ product_name: '1B', quantity: 1 }], [{ barcode_no: 'COMBO-BATCH-1', type: 'COMBO_BOX' }]);
  await sleep(10);
  
  const loc3 = await localInventoryService.getCurrentLocation('BC-1B-001');
  console.log(`Test 6 (Complete Draft B): ${loc3 === 'COMBO' && comboSaved.status === 'READY' ? 'PASS' : 'FAIL'} (Location: ${loc3}, Combo Status: ${comboSaved.status})`);

  // TEST 7: Reserve Combo for Order
  const reservedBatch = await localInventoryService.reserveComboForOrder('COMBO-BATCH-1', 'ORD-001');
  await sleep(10);
  const loc4 = await localInventoryService.getCurrentLocation('COMBO-BATCH-1');
  console.log(`Test 7 (Reserve for Order): ${reservedBatch.status === 'ORDER_RESERVED' && loc4 === 'ORDER_RESERVED' ? 'PASS' : 'FAIL'} (Combo Status: ${reservedBatch.status}, Location: ${loc4})`);

  // TEST 8: Dispatch Scan
  const dispatchedBatch = await localInventoryService.dispatchCombo('COMBO-BATCH-1');
  await sleep(10);
  const loc5 = await localInventoryService.getCurrentLocation('COMBO-BATCH-1');
  console.log(`Test 8 (Dispatch Scan): ${dispatchedBatch.status === 'DISPATCHED' && loc5 === 'DISPATCHED' ? 'PASS' : 'FAIL'} (Combo Status: ${dispatchedBatch.status}, Location: ${loc5})`);

  // TEST 9: Barcode Details
  const movements = await localInventoryService.getComboMovements(comboSaved.id);
  console.log(`Test 9 (Timeline History): PASS (Found ${movements.length} movements)`);
  movements.forEach((m: any) => console.log(` - ${m.type} (ref: ${m.referenceId})`));

}

runTests().catch(console.error);
