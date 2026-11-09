
import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { extractPdfText } from '../../src/features/pdf-extraction/services/pdf-extractor'
import { groupPdfRemarks } from '../../src/features/pdf-extraction/services/remark-grouper'

const goldenFiles = [
  { name: 'rekening-1.pdf', expectedTransactions: 116 },
  { name: 'rekening-2.pdf', expectedTransactions: 306 },
  { name: 'rekening-3.pdf', expectedTransactions: 159 },
]

describe('Remark Grouper - Golden Dataset', () => {
  it.each(goldenFiles)(
    'groups remarks from $name without losing items',
    async ({ name, expectedTransactions }) => {
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

      const pdf = await extractPdfText(file)
      const groups = groupPdfRemarks(pdf)

      const sourceItems = pdf.pages.flatMap((page) =>
        page.items.filter(
          (item) =>
            item.x >= 100 &&
            item.x < 235 &&
            item.y >= 50 &&
            item.text.trim() !== '' &&
            item.text.trim() !== 'Remark',
        ),
      )

      const groupedItems = groups.flatMap((group) => group.items)

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
})
