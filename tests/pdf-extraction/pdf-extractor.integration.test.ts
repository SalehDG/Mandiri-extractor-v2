import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { extractPdfText } from '../../src/features/pdf-extraction/services/pdf-extractor'

const goldenFiles = [
  {
    name: 'rekening-1.pdf',
    expectedPages: 13,
  },
  {
    name: 'rekening-2.pdf',
    expectedPages: 37,
  },
  {
    name: 'rekening-3.pdf',
    expectedPages: 19,
  },
]

describe('PDF Extraction - Golden Dataset', () => {
 it.each(goldenFiles)(
  'should extract meaningful text from $name',
  async ({ name }) => {
    const filePath = resolve(
      process.cwd(),
      'tests/fixtures/golden',
      name,
    )

    const buffer = await readFile(filePath)

    const file = new File(
      [new Uint8Array(buffer)],
      name,
      { type: 'application/pdf' },
    )

    const result = await extractPdfText(file)

    const allText = result.pages
      .flatMap((page) => page.items)
      .map((item) => item.text)
      .join(' ')

    // Pastikan hasil ekstraksi tidak kosong.
    expect(allText.trim().length).toBeGreaterThan(0)

    // Pastikan hasil ekstraksi memiliki teks yang cukup.
    expect(allText.trim().length).toBeGreaterThan(100)

    // Pastikan tidak seluruh teks berupa whitespace.
    expect(allText.replace(/\s/g, '').length).toBeGreaterThan(100)
  },
)
})  