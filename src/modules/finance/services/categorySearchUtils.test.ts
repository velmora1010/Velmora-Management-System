import assert from 'node:assert/strict';
import type { FinanceCategoryRow } from '../../../hooks/finance/useFinanceCategories';
import { searchCategoryPaths } from './categorySearchUtils';

const sampleCategories: FinanceCategoryRow[] = [
  {
    id: '1',
    main: 'Operations',
    sub1: 'Procurement',
    sub2: 'Raw Materials',
    sub3: 'Surfactants',
    sub4: 'SLES',
    status: 'active',
  },
  {
    id: '2',
    main: 'Operations',
    sub1: 'Procurement',
    sub2: 'Packaging',
    sub3: 'Bottles',
    sub4: 'HDPE 500ml',
    status: 'active',
  },
  {
    id: '3',
    main: 'Sales & Marketing',
    sub1: 'Digital Ads',
    sub2: 'Meta Ads',
    sub3: '-',
    sub4: '-',
    status: 'active',
  },
  {
    id: '4',
    main: 'Operations',
    sub1: 'Procurement',
    sub2: 'Raw Materials',
    sub3: 'Surfactants',
    sub4: 'SLES',
    status: 'active',
  },
  {
    id: '5',
    main: 'Finance',
    sub1: 'Banking',
    sub2: 'Bank Charges',
    sub3: 'Wire Transfer Fees',
    sub4: null,
    status: 'active',
  },
];

function runTests() {
  // 1. Level 1 (Department) match
  const deptResults = searchCategoryPaths(sampleCategories, 'Sales');
  assert.equal(deptResults.length, 1);
  assert.equal(deptResults[0].displayPath, 'Sales & Marketing → Digital Ads → Meta Ads');
  assert.deepEqual(deptResults[0].matchedLevels, ['Department']);
  assert.deepEqual(deptResults[0].selection, {
    dept: 'Sales & Marketing',
    cat: 'Digital Ads',
    sub1: 'Meta Ads',
    sub2: '',
    sub3: '',
  });

  // 2. Level 2 (Category) match + multiple matching paths
  const catResults = searchCategoryPaths(sampleCategories, 'procure');
  assert.equal(catResults.length, 2);
  assert.equal(
    catResults[0].displayPath,
    'Operations → Procurement → Packaging → Bottles → HDPE 500ml'
  );
  assert.equal(
    catResults[1].displayPath,
    'Operations → Procurement → Raw Materials → Surfactants → SLES'
  );
  assert.deepEqual(catResults[0].matchedLevels, ['Category']);

  // 3. Level 3 (Sub Category 1) match
  const sub1Results = searchCategoryPaths(sampleCategories, 'RAW MAT');
  assert.equal(sub1Results.length, 1);
  assert.deepEqual(sub1Results[0].matchedLevels, ['Sub Category 1']);

  // 4. Level 4 (Sub Category 2) match with null sub4
  const sub2Results = searchCategoryPaths(sampleCategories, 'wire transfer');
  assert.equal(sub2Results.length, 1);
  assert.equal(
    sub2Results[0].displayPath,
    'Finance → Banking → Bank Charges → Wire Transfer Fees'
  );
  assert.deepEqual(sub2Results[0].matchedLevels, ['Sub Category 2']);
  assert.deepEqual(sub2Results[0].selection, {
    dept: 'Finance',
    cat: 'Banking',
    sub1: 'Bank Charges',
    sub2: 'Wire Transfer Fees',
    sub3: '',
  });

  // 5. Level 5 (Sub Category 3) match + deduplication
  const sub3Results = searchCategoryPaths(sampleCategories, 'sles');
  assert.equal(sub3Results.length, 1);
  assert.equal(
    sub3Results[0].displayPath,
    'Operations → Procurement → Raw Materials → Surfactants → SLES'
  );
  assert.deepEqual(sub3Results[0].matchedLevels, ['Sub Category 3']);
  assert.deepEqual(sub3Results[0].selection, {
    dept: 'Operations',
    cat: 'Procurement',
    sub1: 'Raw Materials',
    sub2: 'Surfactants',
    sub3: 'SLES',
  });

  // 6. Multiple levels matching in one path
  const multiLevelResults = searchCategoryPaths(sampleCategories, 'bank');
  assert.equal(multiLevelResults.length, 1);
  assert.deepEqual(multiLevelResults[0].matchedLevels, ['Category', 'Sub Category 1']);

  // 7. Empty / whitespace / no match
  assert.deepEqual(searchCategoryPaths(sampleCategories, ''), []);
  assert.deepEqual(searchCategoryPaths(sampleCategories, '   '), []);
  assert.deepEqual(searchCategoryPaths(sampleCategories, 'nonexistent-xyz'), []);

  console.log('All categorySearchUtils tests passed (7/7 scenarios).');
}

runTests();
