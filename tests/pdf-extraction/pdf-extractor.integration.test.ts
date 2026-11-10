import { pathToFileURL } from 'node:url'
import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
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

const standardFontDataUrl = pathToFileURL(
  resolve(process.cwd(), 'public/pdfjs/standard_fonts') + sep,
).href

describe('PDF Extraction - Golden Dataset', () => {
  it.each(goldenFiles)(
    'should extract meaningful text from $name',
    async ({ name, expectedPages }) => {
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

      const result = await extractPdfText(
        file,
        standardFontDataUrl,
      )

      expect(result.fileName).toBe(name)
      expect(result.totalPages).toBe(expectedPages)
      expect(result.pages).toHaveLength(expectedPages)

      const allText = result.pages
        .flatMap((page) => page.items)
        .map((item) => item.text)
        .join(' ')

      expect(allText.trim().length).toBeGreaterThan(100)
      expect(
        allText.replace(/\s/g, '').length,
      ).toBeGreaterThan(100)
    },
  )
})
