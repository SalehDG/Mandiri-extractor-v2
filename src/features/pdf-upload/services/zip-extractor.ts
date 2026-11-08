
import JSZip from 'jszip'
import { validatePdfFile } from './pdf-validator'

export interface ZipExtractionOptions {
  maxArchiveSizeBytes: number
  maxEntries: number
}

export interface ExtractedPdf {
  file: File
  sourcePath: string
}

export interface RejectedZipFile {
  fileName: string
  sourcePath: string
  reason: string
}

export interface ZipExtractionResult {
  accepted: ExtractedPdf[]
  rejected: RejectedZipFile[]
}

export async function extractPdfsFromZip(
  zipFile: File,
  options: ZipExtractionOptions,
): Promise<ZipExtractionResult> {
  if (zipFile.size > options.maxArchiveSizeBytes) {
    throw new Error('Ukuran ZIP melebihi batas yang diizinkan.')
  }

  const zip = await JSZip.loadAsync(zipFile)

  const entries = Object.values(zip.files).filter(
    (entry) => !entry.dir,
  )

  if (entries.length > options.maxEntries) {
    throw new Error('Jumlah file dalam ZIP melebihi batas.')
  }

  const result: ZipExtractionResult = {
    accepted: [],
    rejected: [],
  }

  // Proses satu file pada satu waktu.
  for (const entry of entries) {
    const sourcePath = entry.unsafeOriginalName ?? entry.name
    const fileName = sourcePath.split('/').pop() ?? sourcePath

    // Abaikan file yang bukan PDF.
    if (!fileName.toLowerCase().endsWith('.pdf')) {
      result.rejected.push({
        fileName,
        sourcePath,
        reason: 'Format file tidak didukung.',
      })

      continue
    }

    try {
      const blob = await entry.async('blob')

      const file = new File(
        [blob],
        fileName,
        { type: 'application/pdf' },
      )

      const validation = await validatePdfFile(file)

      if (!validation.valid) {
        result.rejected.push({
          fileName,
          sourcePath,
          reason: validation.reason,
        })

        continue
      }

      result.accepted.push({
        file,
        sourcePath,
      })
    } catch {
      result.rejected.push({
        fileName,
        sourcePath,
        reason: 'File gagal diekstrak atau dibaca.',
      })
    }
  }

  return result
}
