import { 
  MASTER_LOCATIONS, 
  PINCODE_TO_LOCATION 
} from '../src/data/indiaLocations.ts';
import { 
  resolveCanonicalLocation,
  toCanonicalLocation 
} from '../src/modules/sales/website/websiteSalesUtils.ts';

console.log('--- AUDITING CANONICAL INDIA LOCATION RESOLVER ---');

// Test 1: City variations (Erode, ERODE, erode, Erod)
const erodeVariants = ['Erode', 'ERODE', 'erode', 'Erod'];
erodeVariants.forEach((variant) => {
  const res = resolveCanonicalLocation('Tamil Nadu', variant, '');
  console.log(`Variant "${variant}" => State: "${res.canonicalState}", City: "${res.canonicalCity}", Resolution: ${res.resolutionMethod}, Confidence: ${res.confidence}`);
  if (res.canonicalState !== 'Tamil Nadu' || res.canonicalCity !== 'Erode') {
    console.error(`FAILED test for ${variant}`);
    process.exit(1);
  }
});

// Test 2: Gudiyattam alias mapping
const gudiyattamVariants = ['Gudiyattam', 'Gudiyatham', 'gudiyattam', 'gudiyatham'];
gudiyattamVariants.forEach((variant) => {
  const res = resolveCanonicalLocation('TN', variant, '');
  console.log(`Gudiyattam Variant "${variant}" => State: "${res.canonicalState}", City: "${res.canonicalCity}", Resolution: ${res.resolutionMethod}`);
  if (res.canonicalState !== 'Tamil Nadu' || res.canonicalCity !== 'Gudiyatham') {
    console.error(`FAILED Gudiyattam test for ${variant}`);
    process.exit(1);
  }
});

// Test 3: Pincode Precedence
// Pincode 632602 -> Gudiyatham, Tamil Nadu
const pinRes = resolveCanonicalLocation('Wrong State', 'Wrong City', '632602');
console.log(`Pincode 632602 => State: "${pinRes.canonicalState}", City: "${pinRes.canonicalCity}", Resolution: ${pinRes.resolutionMethod}, Confidence: ${pinRes.confidence}`);
if (pinRes.canonicalState !== 'Tamil Nadu' || pinRes.canonicalCity !== 'Gudiyatham' || pinRes.resolutionMethod !== 'pincode') {
  console.error('FAILED Pincode precedence test');
  process.exit(1);
}

// Test 4: Master Locations Count
const stateCount = Object.keys(MASTER_LOCATIONS).length;
console.log(`Master Locations Total States/UTs: ${stateCount}`);
if (stateCount < 30) {
  console.error('FAILED Master locations state count test');
  process.exit(1);
}

// Test 5: Legacy toCanonicalLocation compatibility wrapper
const legacyRes = toCanonicalLocation('Tamil Nadu', 'ERODE', '638001');
console.log(`Legacy toCanonicalLocation => State: "${legacyRes.state}", City: "${legacyRes.city}"`);
if (legacyRes.state !== 'Tamil Nadu' || legacyRes.city !== 'Erode') {
  console.error('FAILED Legacy wrapper test');
  process.exit(1);
}

console.log('\n✅ ALL CANONICAL LOCATION TESTS PASSED SUCCESSFULLY!');
