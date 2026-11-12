import type {
  ExtractedPdf,
  ExtractedPage,
  ExtractedTextItem,
} from '../types/extracted-text'

export interface RemarkGroup {
  pageNumber: number
  date: string
  dateY: number
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
  const remarkHeader =
    page.pageNumber === 1
      ? page.items.find(
          (item) =>
            item.x >= REMARK_X_MIN &&
            item.x < REMARK_X_MAX &&
            item.text.trim() === 'Remark',
        )
      : undefined

  return page.items
    .filter((item) => {
      const text = item.text.trim()

      if (
        item.x < REMARK_X_MIN ||
        item.x >= REMARK_X_MAX ||
        item.y < FOOTER_Y_MIN ||
        text === '' ||
        text === 'Remark' ||
        (remarkHeader && item.y >= remarkHeader.y)
      ) {
        return false
      }

      return true
    })
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

export function groupPdfRemarks(pdf: ExtractedPdf): RemarkGroup[] {
  const groups: RemarkGroup[] = []

  for (const page of pdf.pages) {
    const dates = getTransactionDates(page)

    if (dates.length === 0) continue

    const firstDate = dates[0]
    const remarks = getRemarkItems(page)

    const pageGroups: RemarkGroup[] = dates.map((date) => ({
      pageNumber: page.pageNumber,
      date: date.text.trim().replace(/,$/, ''),
      dateY: date.y,
      items: [],
    }))

    for (const item of remarks) {
      // PRMA reference belongs to its corresponding PRMA transaction.
      if (/^\/PRM-/i.test(item.text.trim())) {
        const prmaStart = remarks
          .filter(
            (candidate) =>
              candidate.y > item.y &&
              candidate.text.trim() === 'PRMA CR Transf',
          )
          .sort((a, b) => a.y - b.y)[0]

        if (prmaStart) {
          const prmaIndex = getTransactionIndex(prmaStart, dates)
          pageGroups[prmaIndex].items.push(item)
          continue
        }
      }

      // On later pages, text above the first date may continue the
      // previous page's last transaction. Keep this behavior unchanged.
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
