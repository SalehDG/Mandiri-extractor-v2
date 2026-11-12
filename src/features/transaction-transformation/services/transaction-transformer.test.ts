import { describe, it, expect } from 'vitest'
import { formatStatementDate, transformTransactions } from './transaction-transformer'
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
    sourceDebit: 125_000,
    sourceCredit: 0,
    balance: 875_000,
    ...overrides,
  }
}

describe('Transaction Transformer', () => {
  it('formats English statement dates as DD/MM/YYYY', () => {
    expect(formatStatementDate('01 Oct 2026')).toBe('01/10/2026')
  })

  it('maps PDF Credit to output DEBET and PDF Debit to output KREDIT', () => {
    const [result] = transformTransactions([
      createTransaction({ sourceDebit: 25_000, sourceCredit: 75_000 }),
    ])

    expect(result.DEBET).toBe(75_000)
    expect(result.KREDIT).toBe(25_000)
  })

  it('does not silently replace missing amounts with zero', () => {
    expect(() =>
      transformTransactions([createTransaction({ sourceDebit: null })]),
    ).toThrow(/Nominal debit\/kredit tidak lengkap/)
  })
})
