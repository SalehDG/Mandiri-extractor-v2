import { describe, it, expect } from 'vitest'
import { parsePdfTransactions } from './transaction-parser'
import type { ExtractedPdf, ExtractedPage, ExtractedTextItem } from '../../pdf-extraction/types/extracted-text'

function item(text: string, x: number, y: number): ExtractedTextItem {
  return {
    text,
    x,
    y,
    width: 80,
    height: 9,
    fontName: 'test-font',
    hasEOL: false,
  }
}

function createPdf(remarkItems: ExtractedTextItem[]): ExtractedPdf {
  const page: ExtractedPage = {
    pageNumber: 1,
    width: 595,
    height: 842,
    items: [
      item('01 Oct 2026,', 35, 700),
      ...remarkItems,
      item('100.00', 340, 695.34),
      item('0.00', 420, 695.34),
      item('900.00', 500, 695.34),
    ],
  }

  return {
    fileName: 'synthetic.pdf',
    totalPages: 1,
    pages: [page],
  }
}

describe('Transaction Parser', () => {
  it('moves only recipient name to NAMA and preserves all other Remark text', () => {
    const result = parsePdfTransactions(
      createPdf([
        item('MCM InhouseTrf KE', 120, 710),
        item('SHOLAHUDIN Transfer Fee', 120, 690),
      ]),
    )

    expect(result[0].name).toBe('SHOLAHUDIN')
    expect(result[0].rawRemark).toBe('MCM InhouseTrf KE SHOLAHUDIN Transfer Fee')
    expect(result[0].description).toBe('MCM InhouseTrf KE Transfer Fee')
  })

  it('moves sender name and preserves the remaining source description', () => {
    const result = parsePdfTransactions(
      createPdf([
        item('DARI BAGUS SANTOSO balikin modal', 120, 710),
      ]),
    )

    expect(result[0].name).toBe('BAGUS SANTOSO')
    expect(result[0].description).toBe('DARI balikin modal')
  })

  it('preserves system codes and transfer suffixes around a multi-word name', () => {
    const result = parsePdfTransactions(
      createPdf([
        item('MCM InhouseTrf KE YASMINA LUTHFI NUR FITRIANI Transfer Fee99102', 120, 710),
      ]),
    )

    expect(result[0].name).toBe('YASMINA LUTHFI NUR FITRIANI')
    expect(result[0].description).toBe('MCM InhouseTrf KE Transfer Fee99102')
  })

  it('uses the approved Ops Koperasi description and still extracts the name', () => {
    const result = parsePdfTransactions(
      createPdf([
        item('MCM InhouseTrf KE', 120, 710),
        item('SHOLAHUDIN Transfer Fee koperasi', 120, 690),
      ]),
    )

    expect(result[0].description).toBe('Ops Koperasi')
    expect(result[0].name).toBe('SHOLAHUDIN')
  })

  it('keeps the full Remark when no confirmed party name exists', () => {
    const result = parsePdfTransactions(
      createPdf([item('Maintenance okt E', 120, 710)]),
    )

    expect(result[0].name).toBe('')
    expect(result[0].description).toBe('Maintenance okt E')
  })

  it('keeps the approved special NURHAYATI output', () => {
    const result = parsePdfTransactions(
      createPdf([
        item('BSMDIDJA/YATI', 120, 710),
        item('NURHAYATI ops', 120, 700),
        item('supir99102', 120, 690),
      ]),
    )

    expect(result[0].name).toBe('NURHAYATI')
    expect(result[0].description).toBe('ops supir')
  })
})
