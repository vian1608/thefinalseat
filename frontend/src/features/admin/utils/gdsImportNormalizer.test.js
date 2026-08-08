import {
  ensureGdsYear,
  normalizeGdsBlockForParser
} from './gdsImportNormalizer';

describe('gdsImportNormalizer', () => {
  test('adds the selected year to a DDMMM date', () => {
    expect(ensureGdsYear('12AUG', 2026)).toBe('12AUG2026');
    expect(ensureGdsYear('12AUG2027', 2026)).toBe('12AUG2027');
  });

  test('normalizes the exact numbered GDS format used by the admin dashboard', () => {
    const input = [
      '01 UA 2204 Y 12AUG EWRIAH 1200 1451 NN1',
      '02 UA 1675 Y 12AUG IAHMDE 1625 2110 NN1'
    ].join('\n');

    expect(normalizeGdsBlockForParser(input, 2026)).toBe([
      'SS UA 2204 Y 12AUG2026 EWR IAH 1200 1451',
      'SS UA 1675 Y 12AUG2026 IAH MDE 1625 2110'
    ].join('\n'));
  });

  test('supports numbered lines where origin and destination are separate tokens', () => {
    expect(
      normalizeGdsBlockForParser('01 DL 106 Y 15SEP JFK LHR 1930 0745 NN1', 2026)
    ).toBe('SS DL 106 Y 15SEP2026 JFK LHR 1930 0745');
  });

  test('keeps canonical SS input while filling a missing year', () => {
    expect(
      normalizeGdsBlockForParser('SS UA 700 Y 21OCT IAH EWR 1645 2128', 2026)
    ).toBe('SS UA 700 Y 21OCT2026 IAH EWR 1645 2128');
  });
});
