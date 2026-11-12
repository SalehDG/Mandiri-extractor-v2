import type {
  ParsedTransaction,
  TransactionValidationResult,
} from '../../transaction-parser/types/transaction'

const AMOUNT_TOLERANCE = 0.01

export function validateParsedTransactions(
  transactions: ParsedTransaction[],
): TransactionValidationResult {
  const issues: TransactionValidationResult['issues'] = []
  let balanceChecks = 0

  transactions.forEach((transaction, index) => {
    const issue = (field: string, message: string) => {
      issues.push({
        transactionIndex: index,
        pageNumber: transaction.pageNumber,
        field,
        message,
      })
    }

    if (!/^\d{2}\s+[A-Za-z]{3}\s+\d{4}$/.test(transaction.date)) {
      issue('date', `Format tanggal tidak valid: ${transaction.date}`)
    }

    if (transaction.sourceDebit === null) {
      issue('sourceDebit', 'Nominal pada kolom PDF Debit tidak ditemukan.')
    } else if (transaction.sourceDebit < 0) {
      issue('sourceDebit', 'Nominal PDF Debit tidak boleh negatif.')
    }

    if (transaction.sourceCredit === null) {
      issue('sourceCredit', 'Nominal pada kolom PDF Credit tidak ditemukan.')
    } else if (transaction.sourceCredit < 0) {
      issue('sourceCredit', 'Nominal PDF Credit tidak boleh negatif.')
    }

    if (transaction.balance === null) {
      issue('balance', 'Saldo transaksi tidak ditemukan.')
    }
  })

  // Reconcile only consecutive transactions from the same statement file.
  for (let index = 1; index < transactions.length; index++) {
    const previous = transactions[index - 1]
    const current = transactions[index]

    if (previous.sourceFile !== current.sourceFile) {
      continue
    }

    if (
      previous.balance === null ||
      current.balance === null ||
      current.sourceCredit === null ||
      current.sourceDebit === null
    ) {
      continue
    }

    balanceChecks++

    const expectedBalance =
      previous.balance + current.sourceCredit - current.sourceDebit

    if (Math.abs(expectedBalance - current.balance) > AMOUNT_TOLERANCE) {
      issues.push({
        transactionIndex: index,
        pageNumber: current.pageNumber,
        field: 'balance',
        message: `Saldo tidak cocok. Perkiraan ${expectedBalance.toFixed(2)}, PDF ${current.balance.toFixed(2)}.`,
      })
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    balanceChecks,
  }
}
