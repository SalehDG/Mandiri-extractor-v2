import { describe, it, expect } from 'vitest'
import { detectDuplicates } from './duplicate-detector'

describe('detectDuplicates', () => {
  it('should identify files without duplicates', async () => {
    const files = [
      new File(['content A'], 'file-a.pdf'),
      new File(['content B'], 'file-b.pdf'),
    ]

    const result = await detectDuplicates(files)

    expect(result.uniqueFiles).toHaveLength(2)
    expect(result.duplicates).toHaveLength(0)
  })

  it('should detect files with identical content', async () => {
    const fileA = new File(['same content'], 'file-a.pdf')
    const fileB = new File(['same content'], 'file-b.pdf')

    const result = await detectDuplicates([fileA, fileB])

    expect(result.uniqueFiles).toHaveLength(1)
    expect(result.duplicates).toHaveLength(1)

    expect(result.duplicates[0].file).toBe(fileB)
    expect(result.duplicates[0].duplicateOf).toBe(fileA)
  })

  it('should detect multiple duplicates against the first file', async () => {
    const fileA = new File(['same content'], 'file-a.pdf')
    const fileB = new File(['same content'], 'file-b.pdf')
    const fileC = new File(['same content'], 'file-c.pdf')

    const result = await detectDuplicates([
      fileA,
      fileB,
      fileC,
    ])

    expect(result.uniqueFiles).toHaveLength(1)
    expect(result.duplicates).toHaveLength(2)

    expect(result.duplicates[0].duplicateOf).toBe(fileA)
    expect(result.duplicates[1].duplicateOf).toBe(fileA)
  })

  it('should treat different filenames with different content as unique', async () => {
    const fileA = new File(['content A'], 'rekening.pdf')
    const fileB = new File(['content B'], 'rekening.pdf')

    const result = await detectDuplicates([fileA, fileB])

    expect(result.uniqueFiles).toHaveLength(2)
    expect(result.duplicates).toHaveLength(0)
  })

  it('should handle an empty file list', async () => {
    const result = await detectDuplicates([])

    expect(result.uniqueFiles).toHaveLength(0)
    expect(result.duplicates).toHaveLength(0)
  })
})