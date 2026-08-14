import { 
  MASTER_LOCATIONS, 
  STATE_ALIASES, 
  CITY_ALIASES,
  PINCODE_TO_LOCATION
} from '../src/data/indiaLocations.ts';
import { 
  normalizeLocationKey, 
  resolveCanonicalLocation, 
  orderMatchesLocationFilter 
} from '../src/modules/sales/website/websiteSalesUtils.ts';

console.log('=== CANONICAL MASTER LOCATION VERIFICATION ===\n');

// 1. Verify Dataset Structure
const states = Object.values(MASTER_LOCATIONS);
const stateCount = states.length;
let totalCities = 0;
let totalPincodes = 0;

for (const state of states) {
  const cities = Object.values(state.cities);
  totalCities += cities.length;
  for (const city of cities) {
    totalPincodes += city.pincodes.length;
  }
}

console.log(`Total Master States/UTs: ${stateCount}`);
console.log(`Total Master Cities: ${totalCities}`);
console.log(`Total Pincodes mapped: ${totalPincodes}`);
console.log(`Pincode lookup map entries: ${PINCODE_TO_LOCATION.size}\n`);

// 2. Test Key Requirements & Scenarios

const testCases = [
  // A. Gudiyatham mapping test
  { rawState: 'Tamil Nadu', rawCity: 'Gudiyattam', rawPin: '632602', expectedCity: 'Gudiyatham', desc: 'Gudiyattam -> Gudiyatham canonical spelling' },
  { rawState: 'TN', rawCity: 'gudiyatham', rawPin: '', expectedCity: 'Gudiyatham', desc: 'Alias TN -> Tamil Nadu & lowercase gudiyatham' },
  
  // B. Erode spellings & case variations
  { rawState: 'Tamil Nadu', rawCity: 'ERODE', rawPin: '638001', expectedCity: 'Erode', desc: 'ERODE uppercase' },
  { rawState: 'TamilNadu', rawCity: 'Erod', rawPin: '638002', expectedCity: 'Erode', desc: 'Erod typo alias -> Erode' },
  { rawState: 'tamil nadu', rawCity: 'erode', rawPin: '', expectedCity: 'Erode', desc: 'erode lowercase' },
  
  // C. Chennai variations
  { rawState: 'Tamil Nadu', rawCity: 'CHENNAI', rawPin: '600001', expectedCity: 'Chennai', desc: 'CHENNAI uppercase' },
  { rawState: 'Tamil Nadu', rawCity: 'Madras', rawPin: '600002', expectedCity: 'Chennai', desc: 'Madras alias -> Chennai' },

  // D. Bangalore / Bengaluru keeping distinct requirement (User Rule: Keep distinct)
  { rawState: 'Karnataka', rawCity: 'Bangalore', rawPin: '560001', expectedCity: 'Bangalore', desc: 'Bangalore -> Bangalore canonical resolution (distinct from Bengaluru)' },

  // E. Pincode priority over wrong city text
  { rawState: 'Tamil Nadu', rawCity: 'WrongCityName', rawPin: '638001', expectedCity: 'Erode', desc: 'Pincode 638001 overrides WrongCityName to Erode' },
  
  // F. Location never sold to (e.g. Leh, Ladakh)
  { rawState: 'Ladakh', rawCity: 'Leh', rawPin: '194101', expectedState: 'Ladakh', expectedCity: 'Leh', desc: 'Zero-sales location Leh in Ladakh exists in master' }
];

let passes = 0;
let fails = 0;

console.log('--- TEST CASES ---');
for (const tc of testCases) {
  const res = resolveCanonicalLocation(tc.rawState, tc.rawCity, tc.rawPin);
  let pass = true;
  if (tc.expectedCity && res.cityName !== tc.expectedCity) pass = false;
  if (tc.expectedState && res.stateName !== tc.expectedState) pass = false;

  if (pass) {
    passes++;
    console.log(`[PASS] ${tc.desc}`);
    console.log(`       Input: (${tc.rawState}, ${tc.rawCity}, ${tc.rawPin}) => (${res.stateName}, ${res.cityName})`);
  } else {
    fails++;
    console.log(`[FAIL] ${tc.desc}`);
    console.log(`       Expected: state=${tc.expectedState || 'ANY'}, city=${tc.expectedCity || 'ANY'}`);
    console.log(`       Got:      state=${res.stateName}, city=${res.cityName}`);
  }
}

console.log(`\nResults: ${passes} passed, ${fails} failed.\n`);

// 3. Test orderMatchesLocationFilter
console.log('--- FILTER MATCHING VERIFICATION ---');
const sampleOrder = {
  state: 'TN',
  city: 'ERODE',
  pincode: '638001'
};

const matchState = orderMatchesLocationFilter(sampleOrder, ['Tamil Nadu'], [], []);
const matchCity = orderMatchesLocationFilter(sampleOrder, [], ['Erode'], []);
const matchPin = orderMatchesLocationFilter(sampleOrder, [], [], ['638001']);
const matchMismatchState = orderMatchesLocationFilter(sampleOrder, ['Kerala'], [], []);

console.log(`Order (TN, ERODE, 638001) matches State filter ['Tamil Nadu']: ${matchState}`);
console.log(`Order (TN, ERODE, 638001) matches City filter ['Erode']: ${matchCity}`);
console.log(`Order (TN, ERODE, 638001) matches Pincode filter ['638001']: ${matchPin}`);
console.log(`Order (TN, ERODE, 638001) matches Mismatched State filter ['Kerala']: ${matchMismatchState}`);

if (matchState && matchCity && matchPin && !matchMismatchState) {
  console.log('\nALL FILTER MATCHING CHECKS PASSED!');
} else {
  console.log('\nFILTER MATCHING FAILED!');
}
