import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { extractPdfText } from '../../src/features/pdf-extraction/services/pdf-extractor'
import { groupPdfRemarks } from '../../src/features/pdf-extraction/services/remark-grouper'

async function loadGoldenPdf(fileName: string) {
  const filePath = resolve(
    process.cwd(),
    'tests/fixtures/golden',
    fileName,
  )

  const buffer = await readFile(filePath)

  const file = new File(
    [new Uint8Array(buffer)],
    fileName,
    { type: 'application/pdf' },
  )

  return extractPdfText(file)
}

const goldenFiles = [
  { name: 'rekening-1.pdf', expectedTransactions: 116 },
  { name: 'rekening-2.pdf', expectedTransactions: 306 },
  { name: 'rekening-3.pdf', expectedTransactions: 159 },
]

describe('Remark Grouper - Golden Dataset', () => {
  it.each(goldenFiles)(
    'should group remarks from $name without losing items',
    async ({ name, expectedTransactions }) => {
      const pdf = await loadGoldenPdf(name)
      const groups = groupPdfRemarks(pdf)

const firstPage = pdf.pages.find(
  (page) => page.pageNumber === 1,
)

const remarkHeader = firstPage?.items.find(
  (item) =>
    item.x >= 100 &&
    item.x < 235 &&
    item.text.trim() === 'Remark',
)

const sourceItems = pdf.pages.flatMap((page) =>
  page.items.filter((item) => {
    const text = item.text.trim()

    if (
      item.x < 100 ||
      item.x >= 235 ||
      item.y < 50 ||
      text === '' ||
      text === 'Remark'
    ) {
      return false
    }

    // Metadata sebelum judul kolom Remark bukan bagian transaksi.
    if (
      page.pageNumber === 1 &&
      remarkHeader &&
      item.y >= remarkHeader.y
    ) {
      return false
    }

    return true
  }),
)

      const groupedItems = groups.flatMap(
        (group) => group.items,
      )

      expect(groups).toHaveLength(expectedTransactions)
      expect(groupedItems).toHaveLength(sourceItems.length)

      const groupedSet = new Set(groupedItems)

      expect(groupedSet.size).toBe(sourceItems.length)

      for (const item of sourceItems) {
        expect(groupedSet.has(item)).toBe(true)
      }

      for (const group of groups) {
        expect(group.date).toMatch(
          /^\d{2}\s+[A-Za-z]{3}\s+\d{4}$/,
        )
      }
    },
  )

  it('should group rekening-2 page 25-26 continuation correctly', async () => {
    const pdf = await loadGoldenPdf('rekening-2.pdf')
    const groups = groupPdfRemarks(pdf)

    const transaction = groups.find(
      (group) =>
        group.pageNumber === 25 &&
        group.items.some(
          (item) => item.text.trim() === 'DUTA NUSA - 451',
        ),
    )

    expect(transaction).toBeDefined()

    const texts = transaction!.items.map(
      (item) => item.text.trim(),
    )

    expect(texts).toContain('001760 FPZEZ6VD AMAL')
    expect(texts).toContain('DUTA NUSA - 451')
    expect(texts).toContain('INDONESIA TBK')
    expect(texts).toContain('PURWAKARTA Pembelian')
  })

  it('should group rekening-3 koperasi transaction across page 10-11', async () => {
    const pdf = await loadGoldenPdf('rekening-3.pdf')
    const groups = groupPdfRemarks(pdf)

    const transaction = groups.find(
      (group) =>
        group.pageNumber === 10 &&
        group.items.some(
          (item) => item.text.toLowerCase().includes('koperasi'),
        ),
    )

    expect(transaction).toBeDefined()

    const texts = transaction!.items.map(
      (item) => item.text.trim(),
    )

    expect(texts).toContain('koperasi')
    expect(texts).toContain('MCM InhouseTrf KE')
    expect(texts).toContain('SHOLAHUDIN Transfer Fee')
    expect(texts).toContain('202610160954898419991')
    expect(texts).toContain('02')
  })

  it('should group rekening-2 page 2-3 continuation correctly', async () => {
    const pdf = await loadGoldenPdf('rekening-2.pdf')
    const groups = groupPdfRemarks(pdf)

    const transaction = groups.find(
      (group) =>
        group.pageNumber === 2 &&
        group.items.some(
          (item) =>
            item.text.trim() === 'Bahan Baku 24/09/26 09-',
        ),
    )

    expect(transaction).toBeDefined()

    const texts = transaction!.items.map(
      (item) => item.text.trim(),
    )

    expect(texts).toContain('MCM')
    expect(texts).toContain('InhouseTrf')
    expect(texts).toContain('8102500305876 Transfer')
    expect(texts).toContain('Fee')
  })

    it('should group rekening-1 page 3-4 continuation correctly', async () => {
    const pdf = await loadGoldenPdf('rekening-1.pdf')
    const groups = groupPdfRemarks(pdf)

    const transaction = groups.find(
      (group) =>
        group.pageNumber === 3 &&
        group.items.some(
          (item) => item.text.trim() === 'Invoice Air Galon',
        ),
    )

    expect(transaction).toBeDefined()

    const texts = transaction!.items.map(
      (item) => item.text.trim(),
    )

    expect(texts).toContain('Invoice Air Galon')
    expect(texts).toContain('InhouseTrf')
    expect(texts).toContain('8102500304860 Transfer')
    expect(texts).toContain('Fee99102')
  })
  
  it('should group rekening-1 page 10-11 continuation correctly', async () => {
    const pdf = await loadGoldenPdf('rekening-1.pdf')
    const groups = groupPdfRemarks(pdf)

    const transaction = groups.find(
      (group) =>
        group.pageNumber === 10 &&
        group.items.some(
          (item) => item.text.trim() === '001760 FPZEZ6VD AMAL',
        ),
    )

    expect(transaction).toBeDefined()

    const texts = transaction!.items.map(
      (item) => item.text.trim(),
    )

    expect(texts).toContain('001760 FPZEZ6VD AMAL')
    expect(texts).toContain('DUTA NUSA - 451')
    expect(texts).toContain('INDONESIA TBK')
    expect(texts).toContain('PURWAKARTA Pembelian')
    expect(
      texts.join(' ').replace(/\s+/g, ' '),
    ).toContain('StikEsCream PlastikRoll')

    expect(
      texts.join(' ').replace(/\s+/g, ' '),
    ).toContain('T15786')
  })

  
  it('should group rekening-2 page 8-9 continuation correctly', async () => {
    const pdf = await loadGoldenPdf('rekening-2.pdf')
    const groups = groupPdfRemarks(pdf)

    const transaction = groups.find(
      (group) =>
        group.pageNumber === 8 &&
        group.items.some(
          (item) => item.text.trim() === 'Wortel KentangDieng',
        ),
    )

    expect(transaction).toBeDefined()

    const texts = transaction!.items.map(
      (item) => item.text.trim(),
    )

    expect(texts).toContain('Wortel KentangDieng')
    expect(texts).toContain('Anggu15786')
  })

  
  it('should group rekening-1 page 1-2 continuation correctly', async () => {
    const pdf = await loadGoldenPdf('rekening-1.pdf')
    const groups = groupPdfRemarks(pdf)

    const transaction = groups.find(
      (group) =>
        group.pageNumber === 1 &&
        group.items.some(
          (item) =>
            item.text.trim() === '8102500306072 Transfer',
        ),
    )

    expect(transaction).toBeDefined()

    const texts = transaction!.items.map(
      (item) => item.text.trim(),
    )

    expect(texts).toContain('MCM InhouseTrf')
    expect(texts).toContain('8102500306072 Transfer')
    expect(texts).toContain('Fee99102')
  })

  
  it('should group rekening-1 page 5-6 continuation correctly', async () => {
    const pdf = await loadGoldenPdf('rekening-1.pdf')
    const groups = groupPdfRemarks(pdf)

    const transaction = groups.find(
      (group) =>
        group.pageNumber === 5 &&
        group.date === '13 Oct 2026' &&
        group.items.some(
          (item) =>
            item.text.trim() === '1304/J/DNS/X/26 10-',
        ),
    )

    expect(transaction).toBeDefined()

    const texts = transaction!.items.map(
      (item) => item.text.trim(),
    )

    expect(texts).toContain('KR06 AIR GALON')
    expect(texts).toContain('1304/J/DNS/X/26 MCM')
    expect(texts).toContain('InhouseTrf')
    expect(texts).toContain('8102500305272 Transfer')
    expect(texts).toContain('Fee99102')
  })

  it('should group rekening-1 page 6-7 continuation correctly', async () => {
  const pdf = await loadGoldenPdf('rekening-1.pdf')
  const groups = groupPdfRemarks(pdf)

  const transaction = groups.find(
    (group) =>
      group.pageNumber === 6 &&
      group.date === '15 Oct 2026' &&
      group.items.some(
        (item) =>
          item.text.trim() === '0402/J/DNS/26',
      ) &&
      group.items.some(
        (item) =>
          item.text.trim() === '8102500305272 Transfer',
      ),
  )

  expect(transaction).toBeDefined()

  const texts = transaction!.items.map(
    (item) => item.text.trim(),
  )

  expect(texts).toContain('KR06 AIR GALON')
  expect(texts).toContain('MCM')
  expect(texts).toContain('InhouseTrf')
  expect(texts).toContain('8102500305272 Transfer')
  expect(texts).toContain('Fee99102')
  })

  it('should group rekening-1 koperasi transaction across page 10-11', async () => {
  const pdf = await loadGoldenPdf('rekening-1.pdf')
  const groups = groupPdfRemarks(pdf)

  const transaction = groups.find(
    (group) =>
      group.pageNumber === 10 &&
      group.items.some(
        (item) => item.text.trim().toLowerCase() === 'koperasi',
      ) &&
      group.items.some(
        (item) => item.text.trim() === 'MCM InhouseTrf KE HAFID',
      ),
  )

  expect(transaction).toBeDefined()

  const texts = transaction!.items.map(
    (item) => item.text.trim(),
  )

  expect(texts).toContain('GHASANI Transfer Fee')
  expect(texts).toContain('202610261429751079991')
  expect(texts).toContain('02')
  })

  it('should group rekening-2 PRMA CR Transf across page 6-7', async () => {
  const pdf = await loadGoldenPdf('rekening-2.pdf')
  const groups = groupPdfRemarks(pdf)

  const transaction = groups.find(
    (group) =>
      group.pageNumber === 6 &&
      group.items.some(
        (item) => item.text.trim() === '6010047890208873',
      ),
  )

  expect(transaction).toBeDefined()

  const texts = transaction!.items.map(
    (item) => item.text.trim(),
  )

  expect(texts).toContain('PRMA CR Transf')
  expect(texts).toContain('1570014355565')
  expect(texts).toContain('6010047890208873')
  expect(texts).toContain('S1CBDR01TE/254331')
  expect(texts).toContain('/PRM-99105')
  })

  it('should group rekening-2 purchase remark across page 8-9', async () => {
  const pdf = await loadGoldenPdf('rekening-2.pdf')
  const groups = groupPdfRemarks(pdf)

  const transaction = groups.find(
    (group) =>
      group.pageNumber === 8 &&
      group.items.some(
        (item) => item.text.trim() === 'Wortel KentangDieng',
      ),
  )

  expect(transaction).toBeDefined()

  const texts = transaction!.items.map(
    (item) => item.text.trim(),
  )

  expect(texts).toContain('001760 FPZEZ6VD AMAL')
  expect(texts).toContain('DUTA NUSA - 451')
  expect(texts).toContain('INDONESIA TBK')
  expect(texts).toContain('PURWAKARTA Pembelian')
  expect(texts).toContain('Wortel KentangDieng')
  expect(texts).toContain('Anggu15786')
  })

it('should group rekening-2 bahan baku across page 14-15', async () => {
  const pdf = await loadGoldenPdf('rekening-2.pdf')
  const groups = groupPdfRemarks(pdf)

  const bahanBakuTransaction = groups.find(
    (group) =>
      group.pageNumber === 14 &&
      group.items.some(
        (item) => item.text.trim() === 'DP13 BAHAN BAKU',
      ),
  )

  expect(bahanBakuTransaction).toBeDefined()

  const bahanBakuTexts = bahanBakuTransaction!.items.map(
    (item) => item.text.trim(),
  )

  expect(bahanBakuTexts).toContain('0510/J/MJA/X')
  expect(bahanBakuTexts).toContain('MCM')
  expect(bahanBakuTexts).toContain('InhouseTrf')
  expect(bahanBakuTexts).toContain('8102500305275 Transfer')
  expect(bahanBakuTexts).toContain('Fee99102')

  expect(bahanBakuTexts).not.toContain('/PRM-99105')

  const prmaTransaction = groups.find(
    (group) =>
      group.pageNumber === 14 &&
      group.items.some(
        (item) => item.text.trim() === '6010047890007216',
      ),
  )

  expect(prmaTransaction).toBeDefined()

  const prmaTexts = prmaTransaction!.items.map(
    (item) => item.text.trim(),
  )

  expect(prmaTexts).toContain('/PRM-99105')
})
})
