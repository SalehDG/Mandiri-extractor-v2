import type { TransactionOutput } from '../../transaction-parser/types/transaction'

const OUTPUT_COLUMNS: (keyof TransactionOutput)[] = [
  'TGL/BLN/THN',
  'URAIAN',
  'NAMA',
  'DEBET',
  'KREDIT',
]

function escapeCsv(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`
}

export function buildTransactionsCsv(
  transactions: TransactionOutput[],
): string {
  const header = OUTPUT_COLUMNS.map(escapeCsv).join(',')
  const rows = transactions.map((transaction) =>
    OUTPUT_COLUMNS.map((column) => escapeCsv(transaction[column])).join(','),
  )

  // UTF-8 BOM helps spreadsheet applications recognize Indonesian text.
  return `\uFEFF${[header, ...rows].join('\r\n')}`
}

export function downloadTransactionsCsv(
  fileName: string,
  transactions: TransactionOutput[],
): void {
  const blob = new Blob([buildTransactionsCsv(transactions)], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${fileName.replace(/\.pdf$/i, '')}-hasil-ekstraksi.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
