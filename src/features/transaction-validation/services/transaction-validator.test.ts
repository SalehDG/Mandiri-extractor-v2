import { describe, it, expect } from 'vitest'
import { validateParsedTransactions } from './transaction-validator'
import type { ParsedTransaction } from '../../transaction-parser/types/transaction'

function createTransaction(
  overrides: Partial<ParsedTransaction> = {},
): ParsedTransaction {
  return {
    sourceFile: 'test.pdf',
    pageNumber: 1,
    date: '01 Oct 2026',
    dateY: 700,
    rawRemark: 'Maintenance',
    remarkItems: [],
    name: '',
    description: 'Maintenance',
    sourceDebit: 100,
    sourceCredit: 0,
    balance: 900,
    ...overrides,
  }
}

describe('Transaction Validator', () => {
  it('accepts a valid balance progression', () => {
    const result = validateParsedTransactions([
      createTransaction({ balance: 900 }),
      createTransaction({ sourceDebit: 50, balance: 850 }),
    ])

    expect(result.isValid).toBe(true)
    expect(result.balanceChecks).toBe(1)
    expect(result.issues).toEqual([])
  })

  it('reports a balance mismatch', () => {
    const result = validateParsedTransactions([
      createTransaction({ balance: 900 }),
      createTransaction({ sourceDebit: 50, balance: 860 }),
    ])

    expect(result.isValid).toBe(false)
    expect(result.issues.some((issue) => issue.field === 'balance')).toBe(true)
  })

  it('reports missing debit, credit, or balance values', () => {
    const result = validateParsedTransactions([
      createTransaction({
        sourceDebit: null,
        sourceCredit: null,
        balance: null,
      }),
    ])

    expect(result.isValid).toBe(false)
    expect(result.issues.map((issue) => issue.field)).toEqual([
      'sourceDebit',
      'sourceCredit',
      'balance',
    ])
  })
})
