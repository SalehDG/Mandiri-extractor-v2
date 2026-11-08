
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { extractPdfsFromZip } from './zip-extractor'

const OPTIONS = {
  maxArchiveSizeBytes: 10 * 1024 * 1024,
  maxEntries: 100,
}

async function createZip(files: Record<string, string>) {
  const zip = new JSZip()

  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content)
  }

  const content = await zip.generateAsync({
    type: 'arraybuffer',
  })

  return new File([content], 'test.zip', {
    type: 'application/zip',
  })
}

describe('extractPdfsFromZip', () => {
  it('should extract multiple valid PDFs', async () => {
    const zipFile = await createZip({
      'januari.pdf': '%PDF-1.7\nJanuary',
      'februari.pdf': '%PDF-1.7\nFebruary',
    })

    const result = await extractPdfsFromZip(zipFile, OPTIONS)

    expect(result.accepted).toHaveLength(2)
    expect(result.rejected).toHaveLength(0)
  })

  it('should reject non-PDF files', async () => {
    const zipFile = await createZip({
      'rekening.pdf': '%PDF-1.7\nSample',
      'foto.jpg': 'Image content',
      'video.mp4': 'Video content',
    })

    const result = await extractPdfsFromZip(zipFile, OPTIONS)

    expect(result.accepted).toHaveLength(1)
    expect(result.rejected).toHaveLength(2)
  })

  it('should find PDFs inside nested folders', async () => {
    const zipFile = await createZip({
      'januari.pdf': '%PDF-1.7\nJanuary',
      'arsip/februari.pdf': '%PDF-1.7\nFebruary',
      'arsip/2025/maret.pdf': '%PDF-1.7\nMarch',
    })

    const result = await extractPdfsFromZip(zipFile, OPTIONS)

    expect(result.accepted).toHaveLength(3)
  })

  it('should reject fake PDF files', async () => {
    const zipFile = await createZip({
      'fake.pdf': 'This is not a PDF',
    })

    const result = await extractPdfsFromZip(zipFile, OPTIONS)

    expect(result.accepted).toHaveLength(0)
    expect(result.rejected).toHaveLength(1)
  })

  it('should reject ZIP files exceeding size limit', async () => {
    const zipFile = await createZip({
      'rekening.pdf': '%PDF-1.7\nSample',
    })

    const result = extractPdfsFromZip(zipFile, {
      ...OPTIONS,
      maxArchiveSizeBytes: 1,
    })

    await expect(result).rejects.toThrow(
      'Ukuran ZIP melebihi batas yang diizinkan.',
    )
  })

  it('should reject ZIP files exceeding entry limit', async () => {
    const zipFile = await createZip({
      'januari.pdf': '%PDF-1.7\nJanuary',
      'februari.pdf': '%PDF-1.7\nFebruary',
    })

    const result = extractPdfsFromZip(zipFile, {
      ...OPTIONS,
      maxEntries: 1,
    })

    await expect(result).rejects.toThrow(
      'Jumlah file dalam ZIP melebihi batas.',
    )
  })

  it('should reject corrupted ZIP files', async () => {
    const corruptedZip = new File(
      ['This is not a ZIP archive'],
      'corrupted.zip',
    )

    await expect(
      extractPdfsFromZip(corruptedZip, OPTIONS),
    ).rejects.toThrow()
  })
})
