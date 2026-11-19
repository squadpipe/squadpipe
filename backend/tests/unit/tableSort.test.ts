import assert from 'assert';
import {
  buildPrismaOrderBy,
  compareSortValues,
  normalizeSortDirection,
  parseSortParams,
  sortRecordsByColumn,
} from '../../src/utils/tableSort';

export const runTableSortTests = () => {
  console.log('--- Running Table Sort Utility & RBAC Tests ---');

  assert.strictEqual(normalizeSortDirection('ASC'), 'asc');
  assert.strictEqual(normalizeSortDirection('descending'), 'desc');
  assert.strictEqual(normalizeSortDirection('invalid', 'asc'), 'asc');

  // Whitelist & blocked rate fields enforcement
  const allowed = ['fullName', 'hourlyRate', 'stage'] as const;
  const blockedWhenMasked = parseSortParams(
    { sortBy: 'hourlyRate', sortDir: 'desc' },
    allowed,
    ['hourlyRate']
  );
  assert.strictEqual(blockedWhenMasked.sortBy, undefined);

  const rejectedUnknown = parseSortParams(
    { sortBy: 'passwordHash', sortDir: 'asc' },
    allowed
  );
  assert.strictEqual(rejectedUnknown.sortBy, undefined);

  const valid = parseSortParams({ sortBy: 'fullName', sortDir: 'desc' }, allowed);
  assert.deepStrictEqual(valid, { sortBy: 'fullName', sortDir: 'desc' });

  // buildPrismaOrderBy fallback & mapped column
  const defaultOrder = [{ createdAt: 'desc' }];
  assert.deepStrictEqual(
    buildPrismaOrderBy(undefined, 'asc', { fullName: (d) => [{ fullName: d }] }, defaultOrder),
    defaultOrder
  );
  assert.deepStrictEqual(
    buildPrismaOrderBy('fullName', 'asc', { fullName: (d) => [{ fullName: d }] }, defaultOrder),
    [{ fullName: 'asc' }]
  );

  // compareSortValues puts nulls last in both asc & desc
  assert.strictEqual(compareSortValues(null, 50, 'asc') > 0, true);
  assert.strictEqual(compareSortValues(null, 50, 'desc') > 0, true);
  assert.strictEqual(compareSortValues('REQ-1002', 'REQ-10', 'asc') > 0, true); // natural numeric compare

  // sortRecordsByColumn
  const rows = [
    { name: 'Zara', score: null as number | null },
    { name: 'alice', score: 85 },
    { name: 'Bob', score: 92 },
  ];
  const byScoreDesc = sortRecordsByColumn(rows, 'score', 'desc', { score: (r) => r.score });
  assert.deepStrictEqual(
    byScoreDesc.map((r) => r.name),
    ['Bob', 'alice', 'Zara']
  );

  const byScoreAsc = sortRecordsByColumn(rows, 'score', 'asc', { score: (r) => r.score });
  assert.deepStrictEqual(
    byScoreAsc.map((r) => r.name),
    ['alice', 'Bob', 'Zara']
  );

  const byNameAsc = sortRecordsByColumn(rows, 'name', 'asc', { name: (r) => r.name });
  assert.deepStrictEqual(
    byNameAsc.map((r) => r.name),
    ['alice', 'Bob', 'Zara']
  );

  console.log('✅ Table sort utility tests passed.');
};
