
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { extractPdfText } from '../../src/features/pdf-extraction/services/pdf-extractor'

const fileNames = [
  'rekening-1.pdf',
  'rekening-2.pdf',
  'rekening-3.pdf',
]

const datePattern = /^\d{2}\s+[A-Za-z]{3}\s+\d{4},?$/
const amountPattern = /^\d{1,3}(?:,\d{3})*\.\d{2}$/

const columns = {
  DEBIT: { min: 330, max: 410 },
  CREDIT: { min: 410, max: 490 },
  BALANCE: { min: 490, max: 580 },
}

for (const fileName of fileNames) {
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

  const result = await extractPdfText(file)

  let totalDates = 0
  let totalMatched = 0
  let totalFailed = 0

  console.log(`\n========== ${fileName} ==========`)

  for (const page of result.pages) {
    const dates = page.items
      .filter(
        (item) =>
          item.x >= 30 &&
          item.x <= 80 &&
          datePattern.test(item.text.trim()),
      )
      .sort((a, b) => b.y - a.y)

    for (const date of dates) {
      totalDates++

      const targetY = date.y - 4.66

      const values = Object.entries(columns).map(([column, range]) => {
        const candidates = page.items
          .filter(
            (item) =>
              item.x >= range.min &&
              item.x <= range.max &&
              amountPattern.test(item.text.trim()),
          )
          .map((item) => ({
            text: item.text.trim(),
            y: item.y,
            difference: Number((item.y - targetY).toFixed(2)),
          }))
          .filter((item) => Math.abs(item.difference) <= 12)
          .sort(
            (a, b) =>
              Math.abs(a.difference) - Math.abs(b.difference),
          )

        return candidates[0]
      })

      const matched = values.every(
        (value) => value !== undefined,
      )

      if (matched) {
        totalMatched++
      } else {
        totalFailed++
      }

      if (!matched) {
        console.log(
          `GAGAL | Halaman ${page.pageNumber} | ${date.text} | ` +
          values.map((value, index) =>
            `${Object.keys(columns)[index]}: ${value?.text ?? 'TIDAK DITEMUKAN'}`
          ).join(' | '),
        )
      }
    }
  }

  console.log(`Total halaman : ${result.totalPages}`)
  console.log(`Total tanggal : ${totalDates}`)
  console.log(`Berhasil      : ${totalMatched}`)
  console.log(`Gagal         : ${totalFailed}`)
}
