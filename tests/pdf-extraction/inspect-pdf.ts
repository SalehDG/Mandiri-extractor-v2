import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { extractPdfText } from '../../src/features/pdf-extraction/services/pdf-extractor'

const fileNames = [
  'rekening-1.pdf',
  'rekening-2.pdf',
  'rekening-3.pdf',
]

const datePattern = /^\d{2}\s+[A-Za-z]{3}\s+\d{4},?$/
const continuationThreshold = 40

for (const fileName of fileNames) {
  const buffer = await readFile(
    resolve(process.cwd(), 'tests/fixtures/golden', fileName),
  )

  const file = new File(
    [new Uint8Array(buffer)],
    fileName,
    { type: 'application/pdf' },
  )

  const result = await extractPdfText(file)

  console.log(`\n========== ${fileName} ==========`)

  for (let i = 1; i < result.pages.length; i++) {
    const currentPage = result.pages[i]

    const dates = currentPage.items
      .filter(
        (item) =>
          item.x >= 30 &&
          item.x < 80 &&
          datePattern.test(item.text.trim()),
      )
      .sort((a, b) => b.y - a.y)

    const firstDate = dates[0]

    if (!firstDate) continue

    const candidates = currentPage.items
      .filter(
        (item) =>
          item.x >= 100 &&
          item.x < 235 &&
          item.text.trim() !== '' &&
          item.text.trim() !== 'Remark' &&
          item.y > firstDate.y + continuationThreshold,
      )
      .sort((a, b) => b.y - a.y)

    if (candidates.length === 0) continue

    console.log(
      `\nHalaman ${currentPage.pageNumber} | Tanggal pertama: ${firstDate.text.trim()}`,
    )

    for (const item of candidates) {
      const gap = item.y - firstDate.y

      console.log(
        `  Gap ${gap.toFixed(2)} | ${item.text.trim()}`,
      )
    }
  }
}