
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { extractPdfText } from '../../src/features/pdf-extraction/services/pdf-extractor'

const files = [
  'rekening-1.pdf',
  'rekening-2.pdf',
  'rekening-3.pdf',
]

const DATE_PATTERN = /^\d{2}\s+[A-Za-z]{3}\s+\d{4},?$/

async function inspectFile(fileName: string) {
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

  const pdf = await extractPdfText(file)

  console.log(`\n========== ${fileName} ==========`)

  for (let i = 0; i < pdf.pages.length - 1; i++) {
    const currentPage = pdf.pages[i]
    const nextPage = pdf.pages[i + 1]

    const currentDates = currentPage.items
      .filter(
        (item) =>
          item.x >= 30 &&
          item.x < 80 &&
          DATE_PATTERN.test(item.text.trim()),
      )
      .sort((a, b) => b.y - a.y)

    const nextDates = nextPage.items
      .filter(
        (item) =>
          item.x >= 30 &&
          item.x < 80 &&
          DATE_PATTERN.test(item.text.trim()),
      )
      .sort((a, b) => b.y - a.y)

    if (!currentDates.length || !nextDates.length) {
      continue
    }

    const lastDate = currentDates[currentDates.length - 1]
    const firstDate = nextDates[0]

    const previousRemarks = currentPage.items
      .filter(
        (item) =>
          item.x >= 100 &&
          item.x < 235 &&
          item.y >= 50 &&
          item.text.trim() !== '' &&
          item.text.trim() !== 'Remark' &&
          item.y <= lastDate.y + 100,
      )
      .sort((a, b) => b.y - a.y)

    const nextRemarks = nextPage.items
      .filter(
        (item) =>
          item.x >= 100 &&
          item.x < 235 &&
          item.y >= 50 &&
          item.text.trim() !== '' &&
          item.text.trim() !== 'Remark' &&
          item.y > firstDate.y + 40,
      )
      .sort((a, b) => b.y - a.y)

    if (nextRemarks.length === 0) {
      continue
    }

    console.log(
      `\nHalaman ${currentPage.pageNumber} -> ${nextPage.pageNumber}`,
    )
    console.log(`Tanggal terakhir: ${lastDate.text.trim()}`)
    console.log(`Tanggal pertama berikutnya: ${firstDate.text.trim()}`)

    console.log('\nRemark akhir halaman sebelumnya:')
    for (const item of previousRemarks) {
      console.log(`  [Y=${item.y.toFixed(2)}] ${item.text}`)
    }

    console.log('\nRemark di atas transaksi pertama halaman berikutnya:')
    for (const item of nextRemarks) {
      console.log(`  [Y=${item.y.toFixed(2)}] ${item.text}`)
    }
  }
}

async function main() {
  for (const file of files) {
    await inspectFile(file)
  }
}

main().catch(console.error)
