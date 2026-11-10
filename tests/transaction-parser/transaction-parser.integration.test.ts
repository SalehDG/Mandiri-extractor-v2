import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { extractPdfText } from '../../src/features/pdf-extraction/services/pdf-extractor'
import { parsePdfTransactions } from '../../src/features/transaction-parser/services/transaction-parser'
import { validateParsedTransactions } from '../../src/features/transaction-validation/services/transaction-validator'
import { transformTransactions } from '../../src/features/transaction-transformation/services/transaction-transformer'

const standardFontDataUrl = pathToFileURL(
  resolve(process.cwd(), 'public/pdfjs/standard_fonts') + sep,
).href

const goldenFiles = [
  { name: 'rekening-1.pdf', expectedTransactions: 116 },
  { name: 'rekening-2.pdf', expectedTransactions: 306 },
  { name: 'rekening-3.pdf', expectedTransactions: 159 },
]

async function loadGoldenPdf(fileName: string) {
  const filePath = resolve(process.cwd(), 'tests/fixtures/golden', fileName)
  const buffer = await readFile(filePath)
  const file = new File(
    [new Uint8Array(buffer)],
    fileName,
    { type: 'application/pdf' },
  )

  return extractPdfText(file, standardFontDataUrl)
}

describe('Transaction Parser - Golden Dataset', () => {
  it.each(goldenFiles)(
    'should parse all transactions from $name',
    async ({ name, expectedTransactions }) => {
      const pdf = await loadGoldenPdf(name)
      const transactions = parsePdfTransactions(pdf)

      expect(transactions).toHaveLength(expectedTransactions)

      for (const transaction of transactions) {
        expect(transaction.date).toMatch(/^\d{2}\s+[A-Za-z]{3}\s+\d{4}$/)
        expect(transaction.sourceDebit).not.toBeNull()
        expect(transaction.sourceCredit).not.toBeNull()
        expect(transaction.balance).not.toBeNull()
      }

      const validation = validateParsedTransactions(transactions)
      expect(validation.isValid).toBe(true)
      expect(validation.issues).toEqual([])
      expect(validation.balanceChecks).toBe(expectedTransactions - 1)

      const output = transformTransactions(transactions)
      expect(output).toHaveLength(expectedTransactions)
      expect(Object.keys(output[0])).toEqual([
        'TGL/BLN/THN',
        'URAIAN',
        'NAMA',
        'DEBET',
        'KREDIT',
      ])
    },
  )
})
