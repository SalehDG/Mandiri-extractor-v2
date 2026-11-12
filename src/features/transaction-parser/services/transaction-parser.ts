import type {
  ExtractedPage,
  ExtractedPdf,
  ExtractedTextItem,
} from '../../pdf-extraction/types/extracted-text'
import { groupPdfRemarks } from '../../pdf-extraction/services/remark-grouper'
import type { ParsedTransaction } from '../types/transaction'

const AMOUNT_COLUMNS = {
  debit: { min: 330, max: 410 },
  credit: { min: 410, max: 490 },
  balance: { min: 490, max: 580 },
} as const

const AMOUNT_Y_OFFSET = 4.66
const AMOUNT_Y_TOLERANCE = 1.25
const AMOUNT_PATTERN = /^-?[\d,]+\.\d{2}$/

// These markers delimit a party name. They remain in the resulting URAIAN.
const PARTY_NAME_END_MARKERS = [
  /\bTransfer\s+Fee\b/i,
  /\bTransfer\b/i,
  /\bFee\d+\b/i,
  /\bInhouseTrf\b/i,
  /\bMCM\b/i,
  /\bbalikin\s+modal\b/i,
]

const SPECIAL_NURHAYATI_PATTERN = /\bNURHAYATI\s+ops\s+supir99102\b/i

interface PartyExtraction {
  name: string
  description: string
}

function parseAmount(text: string): number | null {
  const normalized = text.trim()
  if (!AMOUNT_PATTERN.test(normalized)) return null

  const value = Number(normalized.replace(/,/g, ''))
  return Number.isFinite(value) ? value : null
}

function findAmount(
  page: ExtractedPage,
  column: { min: number; max: number },
  targetY: number,
): number | null {
  const candidates = page.items
    .filter(
      (item) =>
        item.x >= column.min &&
        item.x < column.max &&
        Math.abs(item.y - targetY) <= AMOUNT_Y_TOLERANCE &&
        AMOUNT_PATTERN.test(item.text.trim()),
    )
    .sort(
      (a, b) => Math.abs(a.y - targetY) - Math.abs(b.y - targetY),
    )

  return candidates.length > 0 ? parseAmount(candidates[0].text) : null
}

function normalizeRemark(items: ExtractedTextItem[]): string {
  return [...items]
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function findPartyNameRange(rawRemark: string): { start: number; end: number } | null {
  const marker = /\b(?:KE|DARI)\b/i.exec(rawRemark)
  if (!marker || marker.index === undefined) return null

  // Start immediately after KE/DARI; retain the marker itself in URAIAN.
  let start = marker.index + marker[0].length
  while (start < rawRemark.length && /\s/.test(rawRemark[start])) start += 1

  let end = rawRemark.length
  const tail = rawRemark.slice(start)
  let foundEndMarker = false

  for (const endMarker of PARTY_NAME_END_MARKERS) {
    const match = endMarker.exec(tail)
    if (match?.index !== undefined && start + match.index < end) {
      end = start + match.index
      foundEndMarker = true
    }
  }

  // Conservative rule: without a recognized end marker, do not guess where
  // the party name ends. Keep the complete Remark as URAIAN and leave NAMA empty.
  // Exception: this exact party name was explicitly confirmed in the source data.
  if (!foundEndMarker) {
    const knownPartyMatch = /^\s*DARI\s+(MITRA\s+GIZI\s+TANGERANG)\s*$/i.exec(rawRemark)
    if (knownPartyMatch?.index !== undefined) {
      const nameStart = knownPartyMatch.index + knownPartyMatch[0].indexOf(knownPartyMatch[1])
      return { start: nameStart, end: nameStart + knownPartyMatch[1].length }
    }
    return null
  }

  // Exclude trailing separators from the name span, not from the source text.
  while (end > start && /[\s|,;]/.test(rawRemark[end - 1])) end -= 1

  const candidate = rawRemark.slice(start, end).trim()
  if (!candidate || !/[A-Za-zÀ-ÿ]/.test(candidate)) return null
  if (/^(?:MCM|InhouseTrf|Transfer|Transfer Fee|Fee\d*)$/i.test(candidate)) {
    return null
  }

  // Avoid treating a numeric/reference token as a party name.
  if (/^[\d\s.,/_-]+$/.test(candidate)) return null
  return { start, end }
}

function removeRange(rawRemark: string, start: number, end: number): string {
  return `${rawRemark.slice(0, start)}${rawRemark.slice(end)}`
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extracts a party only when a KE/DARI marker or the explicitly confirmed
 * NURHAYATI pattern identifies its position. Other Remark text is retained.
 */
export function extractPartyDetails(rawRemark: string): PartyExtraction {
  const specialMatch = SPECIAL_NURHAYATI_PATTERN.exec(rawRemark)
  if (specialMatch?.index !== undefined) {
    return {
      name: 'NURHAYATI',
      description: 'ops supir',
    }
  }

  const range = findPartyNameRange(rawRemark)
  if (!range) {
    return {
      name: '',
      description: /\bkoperasi\b/i.test(rawRemark) ? 'Ops Koperasi' : rawRemark,
    }
  }

  const name = rawRemark.slice(range.start, range.end).trim().toLocaleUpperCase('id-ID')
  return {
    name,
    description: /\bkoperasi\b/i.test(rawRemark)
      ? 'Ops Koperasi'
      : removeRange(rawRemark, range.start, range.end),
  }
}

function findPage(pdf: ExtractedPdf, pageNumber: number): ExtractedPage {
  const page = pdf.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) {
    throw new Error(`Halaman ${pageNumber} tidak ditemukan pada ${pdf.fileName}.`)
  }
  return page
}

export function parsePdfTransactions(pdf: ExtractedPdf): ParsedTransaction[] {
  const groups = groupPdfRemarks(pdf)

  return groups.map((group) => {
    const page = findPage(pdf, group.pageNumber)
    const targetAmountY = group.dateY - AMOUNT_Y_OFFSET
    const rawRemark = normalizeRemark(group.items)
    const party = extractPartyDetails(rawRemark)

    return {
      sourceFile: pdf.fileName,
      pageNumber: group.pageNumber,
      date: group.date,
      dateY: group.dateY,
      rawRemark,
      remarkItems: group.items,
      name: party.name,
      description: party.description,
      sourceDebit: findAmount(page, AMOUNT_COLUMNS.debit, targetAmountY),
      sourceCredit: findAmount(page, AMOUNT_COLUMNS.credit, targetAmountY),
      balance: findAmount(page, AMOUNT_COLUMNS.balance, targetAmountY),
    }
  })
}
