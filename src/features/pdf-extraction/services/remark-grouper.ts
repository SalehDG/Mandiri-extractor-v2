
import type {
  ExtractedPdf,
  ExtractedPage,
  ExtractedTextItem,
} from '../types/extracted-text'

export interface RemarkGroup {
  pageNumber: number
  date: string
  items: ExtractedTextItem[]
}

const DATE_X_MIN = 30
const DATE_X_MAX = 80

const REMARK_X_MIN = 100
const REMARK_X_MAX = 235

const FOOTER_Y_MIN = 50
const PAGE_CONTINUATION_GAP = 40

const DATE_PATTERN = /^\d{2}\s+[A-Za-z]{3}\s+\d{4},?$/

function getTransactionDates(page: ExtractedPage) {
  return page.items
    .filter(
      (item) =>
        item.x >= DATE_X_MIN &&
        item.x < DATE_X_MAX &&
        DATE_PATTERN.test(item.text.trim()),
    )
    .sort((a, b) => b.y - a.y)
}

function getRemarkItems(page: ExtractedPage) {
  return page.items
    .filter(
      (item) =>
        item.x >= REMARK_X_MIN &&
        item.x < REMARK_X_MAX &&
        item.y >= FOOTER_Y_MIN &&
        item.text.trim() !== '' &&
        item.text.trim() !== 'Remark',
    )
    .sort((a, b) => b.y - a.y)
}

function getTransactionIndex(
  item: ExtractedTextItem,
  dates: ExtractedTextItem[],
): number {
  for (let i = 0; i < dates.length - 1; i++) {
    const upperBoundary = dates[i].y
    const lowerBoundary = dates[i + 1].y
    const midpoint = (upperBoundary + lowerBoundary) / 2

    if (item.y >= midpoint) {
      return i
    }
  }

  return dates.length - 1
}

export function groupPdfRemarks(
  pdf: ExtractedPdf,
): RemarkGroup[] {
  const groups: RemarkGroup[] = []

  for (const page of pdf.pages) {
    const dates = getTransactionDates(page)

    if (dates.length === 0) continue

    const remarks = getRemarkItems(page)

    const pageGroups: RemarkGroup[] = dates.map((date) => ({
      pageNumber: page.pageNumber,
      date: date.text.trim().replace(/,$/, ''),
      items: [],
    }))

    for (const item of remarks) {
      const firstDate = dates[0]

      const isContinuation =
        page.pageNumber > 1 &&
        item.y > firstDate.y + PAGE_CONTINUATION_GAP

      if (isContinuation) {
        const previousGroup = groups[groups.length - 1]

        if (previousGroup) {
          previousGroup.items.push(item)
          continue
        }
      }

      const transactionIndex = getTransactionIndex(item, dates)

      pageGroups[transactionIndex].items.push(item)
    }

    groups.push(...pageGroups)
  }

  return groups
}
