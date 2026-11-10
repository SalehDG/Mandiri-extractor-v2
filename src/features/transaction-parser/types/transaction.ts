import type { ExtractedTextItem } from '../../pdf-extraction/types/extracted-text'

/** Data extracted from the bank statement before output-column mapping. */
export interface ParsedTransaction {
  sourceFile: string
  pageNumber: number
  date: string
  dateY: number
  rawRemark: string
  remarkItems: ExtractedTextItem[]
  name: string
  description: string
  /** Amount in the PDF's Debit column. */
  sourceDebit: number | null
  /** Amount in the PDF's Credit column. */
  sourceCredit: number | null
  /** Running balance printed in the PDF. */
  balance: number | null
}

export interface TransactionValidationIssue {
  transactionIndex: number
  pageNumber: number
  field: string
  message: string
}

export interface TransactionValidationResult {
  isValid: boolean
  issues: TransactionValidationIssue[]
  balanceChecks: number
}

/** Exact five-column output required by the approved SRS. */
export interface TransactionOutput {
  'TGL/BLN/THN': string
  URAIAN: string
  NAMA: string
  DEBET: number
  KREDIT: number
}
