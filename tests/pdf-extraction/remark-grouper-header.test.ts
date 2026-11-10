import { describe, expect, it } from 'vitest'
import { groupPdfRemarks } from '../../src/features/pdf-extraction/services/remark-grouper'
import type {
  ExtractedPage,
  ExtractedPdf,
  ExtractedTextItem,
} from '../../src/features/pdf-extraction/types/extracted-text'

function item(
  text: string,
  x: number,
  y: number,
): ExtractedTextItem {
  return {
    text,
    x,
    y,
    width: text.length * 5,
    height: 10,
    fontName: 'TestFont',
    hasEOL: false,
  }
}

function page(
  pageNumber: number,
  items: ExtractedTextItem[],
): ExtractedPage {
  return {
    pageNumber,
    width: 600,
    height: 800,
    items,
  }
}

describe('Remark Grouper - first-page header isolation', () => {
it('does not attach account metadata above the Remark header to the first transaction', () => {
  const pdf: ExtractedPdf = {
    fileName: 'header-test.pdf',
    totalPages: 1,
    pages: [
      page(1, [
        item('Account Name', 110, 780),
        item('KONSUMEN DUTA NUSANT', 110, 760),
        item('Currency', 110, 740),
        item('IDR', 110, 724),
        item('No. of Debit', 110, 700),
        item('11', 110, 684),
        item('No. of Credit', 110, 660),
        item('105', 110, 644),

        item('Remark', 120, 620),

        item('01 Jan 2026', 40, 600),
        item('BAYAR AIR GALON', 110, 590),
      ]),
    ],
  }

  const groups = groupPdfRemarks(pdf)

  expect(groups).toHaveLength(1)
  expect(groups[0].items.map((entry) => entry.text)).toEqual([
    'BAYAR AIR GALON',
  ])
})

  it('preserves legitimate continuation text above the first date on later pages', () => {
    const pdf: ExtractedPdf = {
      fileName: 'continuation-test.pdf',
      totalPages: 2,
      pages: [
        page(1, [
          item('01 Jan 2026', 40, 700),
          item('Remark transaksi pertama', 110, 690),
        ]),
        page(2, [
          item('teks lanjutan transaksi pertama', 110, 760),
          item('02 Jan 2026', 40, 700),
          item('Remark transaksi kedua', 110, 690),
        ]),
      ],
    }

    const groups = groupPdfRemarks(pdf)

    expect(groups).toHaveLength(2)
    expect(groups[0].items.map((entry) => entry.text)).toEqual([
      'Remark transaksi pertama',
      'teks lanjutan transaksi pertama',
    ])
    expect(groups[1].items.map((entry) => entry.text)).toEqual([
      'Remark transaksi kedua',
    ])
  })
})
