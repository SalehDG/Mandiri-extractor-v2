
import { describe, it, expect } from 'vitest'
import { groupPdfRemarks } from './remark-grouper'
import type {
  ExtractedPdf,
  ExtractedPage,
} from '../types/extracted-text'

function createPage(
  pageNumber: number,
  items: ExtractedPage['items'],
): ExtractedPage {
  return {
    pageNumber,
    width: 595,
    height: 842,
    items,
  }
}

function createPdf(pages: ExtractedPage[]): ExtractedPdf {
  return {
    fileName: 'test.pdf',
    totalPages: pages.length,
    pages,
  }
}

function createItem(
  text: string,
  x: number,
  y: number,
) {
  return {
    text,
    x,
    y,
    width: 100,
    height: 9,
    fontName: 'test',
    hasEOL: false,
  }
}

describe('Remark Grouper', () => {
  it('groups remarks using date anchors', () => {
    const pdf = createPdf([
      createPage(1, [
        createItem('01 Oct 2026,', 35, 700),
        createItem('BAYAR AIR GALON', 120, 710),
        createItem('MCM InhouseTrf', 120, 690),

        createItem('02 Oct 2026,', 35, 600),
        createItem('Maintenance', 120, 610),
      ]),
    ])

    const result = groupPdfRemarks(pdf)

    expect(result).toHaveLength(2)
    expect(result[0].items.map((item) => item.text)).toEqual([
      'BAYAR AIR GALON',
      'MCM InhouseTrf',
    ])
    expect(result[1].items.map((item) => item.text)).toEqual([
      'Maintenance',
    ])
  })

  it('moves page continuation to previous transaction', () => {
    const pdf = createPdf([
      createPage(1, [
        createItem('01 Oct 2026,', 35, 100),
        createItem('MCM InhouseTrf', 120, 90),
      ]),
      createPage(2, [
        createItem('02 Oct 2026,', 35, 670),
        createItem('Fee99102', 120, 730),
        createItem('BAYAR AIR GALON', 120, 690),
      ]),
    ])

    const result = groupPdfRemarks(pdf)

    expect(result).toHaveLength(2)

    expect(result[0].items.map((item) => item.text)).toEqual([
      'MCM InhouseTrf',
      'Fee99102',
    ])

    expect(result[1].items.map((item) => item.text)).toEqual([
      'BAYAR AIR GALON',
    ])
  })

  it('does not move remarks within 40 points', () => {
    const pdf = createPdf([
      createPage(1, [
        createItem('01 Oct 2026,', 35, 100),
      ]),
      createPage(2, [
        createItem('02 Oct 2026,', 35, 670),
        createItem('BAYAR AIR GALON', 120, 690),
      ]),
    ])

    const result = groupPdfRemarks(pdf)

    expect(result[1].items.map((item) => item.text)).toEqual([
      'BAYAR AIR GALON',
    ])
  })

  it('ignores footer text', () => {
    const pdf = createPdf([
      createPage(1, [
        createItem('01 Oct 2026,', 35, 100),
        createItem('Footer', 120, 38),
      ]),
    ])

    const result = groupPdfRemarks(pdf)

    expect(result[0].items).toHaveLength(0)
  })
})
