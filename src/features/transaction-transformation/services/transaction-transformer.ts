import type {
  ParsedTransaction,
  TransactionOutput,
} from '../../transaction-parser/types/transaction'

const MONTHS: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
}

export function formatStatementDate(date: string): string {
  const match = /^(\d{2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(date.trim())

  if (!match) {
    throw new Error(`Format tanggal tidak dikenali: ${date}`)
  }

  const [, day, monthText, year] = match
  const month = MONTHS[monthText.toLowerCase()]

  if (!month) {
    throw new Error(`Bulan tidak dikenali: ${monthText}`)
  }

  return `${day}/${month}/${year}`
}

export function transformTransactions(
  transactions: ParsedTransaction[],
): TransactionOutput[] {
  return transactions.map((transaction) => {
    if (
      transaction.sourceDebit === null ||
      transaction.sourceCredit === null
    ) {
      throw new Error(
        `Nominal debit/kredit tidak lengkap pada ${transaction.sourceFile}, halaman ${transaction.pageNumber}, tanggal ${transaction.date}.`,
      )
    }

    return {
      'TGL/BLN/THN': formatStatementDate(transaction.date),
      URAIAN: transaction.description,
      NAMA: transaction.name,
      // Approved SRS mapping: PDF Credit becomes output DEBET.
      DEBET: transaction.sourceCredit,
      // Approved SRS mapping: PDF Debit becomes output KREDIT.
      KREDIT: transaction.sourceDebit,
    }
  })
}
