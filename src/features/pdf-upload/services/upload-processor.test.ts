import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { processUploadedFiles } from './upload-processor'

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

  return new File([content], 'arsip.zip', {
    type: 'application/zip',
  })
}

describe('processUploadedFiles', () => {
  it('should process directly uploaded PDFs', async () => {
    const files = [
      new File(['%PDF-1.7\nJanuary'], 'januari.pdf'),
      new File(['%PDF-1.7\nFebruary'], 'februari.pdf'),
    ]

    const result = await processUploadedFiles(files, OPTIONS)

    expect(result.uniquePdfs).toHaveLength(2)
    expect(result.duplicates).toHaveLength(0)
    expect(result.rejectedFiles).toHaveLength(0)
  })

  it('should extract PDFs from ZIP files', async () => {
    const zipFile = await createZip({
      'maret.pdf': '%PDF-1.7\nMarch',
      'april.pdf': '%PDF-1.7\nApril',
    })

    const result = await processUploadedFiles(
      [zipFile],
      OPTIONS,
    )

    expect(result.uniquePdfs).toHaveLength(2)
    expect(
      result.uniquePdfs.every((item) => item.sourceType === 'zip'),
    ).toBe(true)
  })

  it('should detect duplicates across direct PDFs and ZIP files', async () => {
    const directPdf = new File(
      ['%PDF-1.7\nSame content'],
      'januari.pdf',
    )

    const zipFile = await createZip({
      'salinan.pdf': '%PDF-1.7\nSame content',
    })

    const result = await processUploadedFiles(
      [directPdf, zipFile],
      OPTIONS,
    )

    expect(result.uniquePdfs).toHaveLength(1)
    expect(result.duplicates).toHaveLength(1)
    expect(result.duplicates[0].duplicateOf.file).toBe(directPdf)
    expect(result.duplicates[0].file.sourceType).toBe('zip')
  })

  it('should reject unsupported files', async () => {
    const files = [
      new File(['image content'], 'foto.jpg'),
      new File(['document content'], 'dokumen.docx'),
    ]

    const result = await processUploadedFiles(files, OPTIONS)

    expect(result.uniquePdfs).toHaveLength(0)
    expect(result.rejectedFiles).toHaveLength(2)
  })

  it('should continue processing when one ZIP is corrupted', async () => {
    const validPdf = new File(
      ['%PDF-1.7\nValid PDF'],
      'valid.pdf',
    )

    const corruptedZip = new File(
      ['Not a ZIP archive'],
      'corrupted.zip',
    )

    const result = await processUploadedFiles(
      [validPdf, corruptedZip],
      OPTIONS,
    )

    expect(result.uniquePdfs).toHaveLength(1)
    expect(result.rejectedFiles).toHaveLength(1)
  })

  it('should handle an empty upload', async () => {
    const result = await processUploadedFiles([], OPTIONS)

    expect(result.uniquePdfs).toHaveLength(0)
    expect(result.duplicates).toHaveLength(0)
    expect(result.rejectedFiles).toHaveLength(0)
  })
})