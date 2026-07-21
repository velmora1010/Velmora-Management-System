import { parseDate, formatDate, calculateDeliveryDays } from './deliveryRecommendationService';

function runTests() {
  console.log("=== RUNNING ACCURATE DATE PARSER TESTS ===");
  
  // Case 1: 02-06-2026 22:16:31
  const t1 = parseDate("02-06-2026 22:16:31");
  console.log("Test 1 (02-06-2026 22:16:31):", t1 ? formatDate(t1) : "FAILED");
  console.log("  Month should be June (5):", t1?.getMonth() === 5 ? "SUCCESS" : "FAILED");
  console.log("  Day should be 2:", t1?.getDate() === 2 ? "SUCCESS" : "FAILED");
  console.log("  Formatted output should display exactly DD-MM-YYYY (02-06-2026):", t1 && formatDate(t1) === "02-06-2026" ? "SUCCESS" : "FAILED");

  // Case 2: 29/05/2026 11:43:28
  const t2 = parseDate("29/05/2026 11:43:28");
  console.log("Test 2 (29/05/2026 11:43:28):", t2 ? formatDate(t2) : "FAILED");
  console.log("  Month should be May (4):", t2?.getMonth() === 4 ? "SUCCESS" : "FAILED");
  console.log("  Day should be 29:", t2?.getDate() === 29 ? "SUCCESS" : "FAILED");
  console.log("  Formatted output should display exactly DD-MM-YYYY (29-05-2026):", t2 && formatDate(t2) === "29-05-2026" ? "SUCCESS" : "FAILED");

  // Case 3: Excel serial date (real number type)
  const t3 = parseDate(46059.928252314814);
  console.log("Test 3 (Excel serial number type):", t3 ? formatDate(t3) : "FAILED");
  console.log("  Parsed date display exactly DD-MM-YYYY (07-02-2026):", t3 && formatDate(t3) === "07-02-2026" ? "SUCCESS" : "FAILED");

  // Case 4: Excel serial date (string type) -> should be NULL under strict cell-type rules
  const t4 = parseDate("46059.928252314814");
  console.log("Test 4 (Excel serial string type):", t4 === null ? "SUCCESS (ignored string serial)" : `FAILED (returned ${t4})`);

  // Case 5: blank date
  const t5 = parseDate("");
  console.log("Test 5 (blank string):", t5 === null ? "SUCCESS" : "FAILED");

  // Case 6: small Order ID
  const t6 = parseDate("2701");
  console.log("Test 6 (Order ID 2701):", t6 === null ? "SUCCESS" : "FAILED");

  // Case 7: AWB
  const t7 = parseDate("378502740422");
  console.log("Test 7 (AWB 378502740422):", t7 === null ? "SUCCESS" : "FAILED");

  // Case 8: Order 2701 Delivery Days calculation (29/05/2026 15:05:55 to 02-06-2026 22:16:31)
  const days1 = calculateDeliveryDays("29/05/2026 15:05:55", "02-06-2026 22:16:31");
  console.log("Test 8 (Order 2701 Delivery Days):", days1 === 4 ? "SUCCESS (4 days)" : `FAILED (${days1} days)`);

  // Case 9: Order 27-06-2026 to 30-06-2026 -> 3 days
  const days2 = calculateDeliveryDays("27-06-2026", "30-06-2026");
  console.log("Test 9 (27-06-2026 to 30-06-2026):", days2 === 3 ? "SUCCESS (3 days)" : `FAILED (${days2} days)`);

  // Case 10: Order 21-05-2026 to 24-05-2026 -> 3 days
  const days3 = calculateDeliveryDays("21-05-2026", "24-05-2026");
  console.log("Test 10 (21-05-2026 to 24-05-2026):", days3 === 3 ? "SUCCESS (3 days)" : `FAILED (${days3} days)`);

  // Case 11: Invalid Delivery Date < Order Date
  const daysInvalid = calculateDeliveryDays("30-06-2026", "27-06-2026");
  console.log("Test 11 (Invalid dates Delivery < Order):", daysInvalid === -1 ? "SUCCESS (-1 invalid)" : `FAILED (${daysInvalid} days)`);
}

runTests();
