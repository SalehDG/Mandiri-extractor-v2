import { extractPdfText } from '../../pdf-extraction/services/pdf-extractor'
import { parsePdfTransactions } from '../../transaction-parser/services/transaction-parser'
import { validateParsedTransactions } from '../../transaction-validation/services/transaction-validator'
import { transformTransactions } from '../../transaction-transformation/services/transaction-transformer'
import type {
  TransactionOutput,
  TransactionValidationResult,
} from '../../transaction-parser/types/transaction'

export interface TransactionExtractionResult {
  pageCount: number
  transactions: TransactionOutput[]
  validation: TransactionValidationResult
}

/**
 * Runs the existing PDF extraction pipeline for one statement file.
 * Parsing, validation, and output mapping remain in their own services.
 */
export async function extractTransactionsFromPdf(
  file: File,
): Promise<TransactionExtractionResult> {
  const extractedPdf = await extractPdfText(file)
  const parsedTransactions = parsePdfTransactions(extractedPdf)
  const validation = validateParsedTransactions(parsedTransactions)
  const transactions = transformTransactions(parsedTransactions)

  return {
    pageCount: extractedPdf.totalPages,
    transactions,
    validation,
  }
}
