import { describe, expect, it } from 'vitest'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { extractPdfText } from '../../src/features/pdf-extraction/services/pdf-extractor'
import { parsePdfTransactions } from '../../src/features/transaction-parser/services/transaction-parser'
import { transformTransactions } from '../../src/features/transaction-transformation/services/transaction-transformer'

const standardFontDataUrl = pathToFileURL(
  resolve(process.cwd(), 'public/pdfjs/standard_fonts') + sep,
).href

const goldenFiles = [
  { name: 'rekening-1.pdf', expectedTransactions: 116 },
  { name: 'rekening-2.pdf', expectedTransactions: 306 },
  { name: 'rekening-3.pdf', expectedTransactions: 159 },
]

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

async function loadGoldenPdf(fileName: string) {
  const filePath = resolve(process.cwd(), 'tests/fixtures/golden', fileName)
  const buffer = await readFile(filePath)
  const file = new File([new Uint8Array(buffer)], fileName, {
    type: 'application/pdf',
  })

  return extractPdfText(file, standardFontDataUrl)
}

describe('Transaction Audit - Golden Dataset', () => {
  it('generates a local CSV audit report for all golden transactions', async () => {
    const rows: unknown[][] = []
    const summary: string[] = [
      'KOPRA EXTRACT - GOLDEN DATASET AUDIT',
      `Generated: ${new Date().toISOString()}`,
      '',
    ]
    let totalTransactions = 0
    let reviewCount = 0

    for (const golden of goldenFiles) {
      const pdf = await loadGoldenPdf(golden.name)
      const parsed = parsePdfTransactions(pdf)
      const output = transformTransactions(parsed)

      expect(parsed).toHaveLength(golden.expectedTransactions)
      expect(output).toHaveLength(golden.expectedTransactions)

      let fileReviewCount = 0
      for (let index = 0; index < parsed.length; index += 1) {
        const transaction = parsed[index]
        const transformed = output[index]
        const hasPartyMarker = /\b(?:KE|DARI)\b/i.test(transaction.rawRemark)
        const needsReview = hasPartyMarker && transaction.name.length === 0
        if (needsReview) {
          reviewCount += 1
          fileReviewCount += 1
        }

        rows.push([
          golden.name,
          index + 1,
          transaction.pageNumber,
          transaction.date,
          transformed['TGL/BLN/THN'],
          transaction.rawRemark,
          transformed.URAIAN,
          transformed.NAMA,
          transaction.sourceDebit,
          transaction.sourceCredit,
          transformed.DEBET,
          transformed.KREDIT,
          transaction.balance,
          needsReview ? 'PERIKSA: KE/DARI tanpa nama yang teridentifikasi' : '',
        ])
      }

      totalTransactions += parsed.length
      summary.push(
        `${golden.name}: ${parsed.length} transaksi; ${fileReviewCount} perlu pemeriksaan manual untuk pola KE/DARI tanpa nama teridentifikasi.`,
      )
    }

    expect(totalTransactions).toBe(581)

    const headers = [
      'FILE_SUMBER',
      'NO_TRANSAKSI',
      'HALAMAN',
      'TANGGAL_PDF',
      'TANGGAL_OUTPUT',
      'REMARK_ASLI',
      'URAIAN_OUTPUT',
      'NAMA_OUTPUT',
      'PDF_DEBIT',
      'PDF_CREDIT',
      'OUTPUT_DEBET',
      'OUTPUT_KREDIT',
      'SALDO_PDF',
      'STATUS_AUDIT',
    ]

    const csv = [headers, ...rows]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n')

    const reportDirectory = resolve(process.cwd(), 'reports/transaction-audit')
    await mkdir(reportDirectory, { recursive: true })
    await writeFile(
      resolve(reportDirectory, 'golden-transactions-audit.csv'),
      `\uFEFF${csv}\r\n`,
      'utf8',
    )
    await writeFile(
      resolve(reportDirectory, 'audit-summary.txt'),
      [...summary, '', `TOTAL: ${totalTransactions} transaksi`, `PERLU REVIEW: ${reviewCount} transaksi`].join('\n'),
      'utf8',
    )

    expect(rows).toHaveLength(581)
  }, 30_000)
})
