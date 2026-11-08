import { validatePdfFile } from './pdf-validator'
import { extractPdfsFromZip } from './zip-extractor'
import { detectDuplicates } from './duplicate-detector'

export interface UploadedPdf {
  file: File
  sourcePath: string
  sourceType: 'direct' | 'zip'
}

export interface UploadRejectedFile {
  fileName: string
  sourcePath: string
  reason: string
}

export interface UploadDuplicate {
  file: UploadedPdf
  duplicateOf: UploadedPdf
  hash: string
}

export interface UploadProcessingOptions {
  maxArchiveSizeBytes: number
  maxEntries: number
}

export interface UploadProcessingResult {
  uniquePdfs: UploadedPdf[]
  duplicates: UploadDuplicate[]
  rejectedFiles: UploadRejectedFile[]
}

export async function processUploadedFiles(
  files: File[],
  options: UploadProcessingOptions,
): Promise<UploadProcessingResult> {
  const validPdfs: UploadedPdf[] = []
  const rejectedFiles: UploadRejectedFile[] = []

  // Tahap 1: Pisahkan dan periksa setiap file.
  for (const file of files) {
    const fileName = file.name
    const lowerCaseName = fileName.toLowerCase()

    // PDF yang diunggah langsung.
    if (lowerCaseName.endsWith('.pdf')) {
      const validation = await validatePdfFile(file)

      if (!validation.valid) {
        rejectedFiles.push({
          fileName,
          sourcePath: fileName,
          reason: validation.reason,
        })

        continue
      }

      validPdfs.push({
        file,
        sourcePath: fileName,
        sourceType: 'direct',
      })

      continue
    }

    // ZIP yang berisi kumpulan file.
    if (lowerCaseName.endsWith('.zip')) {
      try {
        const result = await extractPdfsFromZip(file, options)

        for (const extracted of result.accepted) {
          validPdfs.push({
            file: extracted.file,
            sourcePath: extracted.sourcePath,
            sourceType: 'zip',
          })
        }

        rejectedFiles.push(...result.rejected)
      } catch (error) {
        rejectedFiles.push({
          fileName,
          sourcePath: fileName,
          reason:
            error instanceof Error
              ? error.message
              : 'ZIP gagal diproses.',
        })
      }

      continue
    }

    // Format selain PDF dan ZIP.
    rejectedFiles.push({
      fileName,
      sourcePath: fileName,
      reason: 'Format file tidak didukung.',
    })
  }

  // Tahap 2: Deteksi duplikat dari seluruh PDF valid.
  const detection = await detectDuplicates(
    validPdfs.map((item) => item.file),
  )

  // Hubungkan hasil deteksi dengan informasi sumber file.
  const pdfMap = new Map<File, UploadedPdf>(
    validPdfs.map((item) => [item.file, item]),
  )

  const duplicates: UploadDuplicate[] =
    detection.duplicates.map((duplicate) => ({
      file: pdfMap.get(duplicate.file)!,
      duplicateOf: pdfMap.get(duplicate.duplicateOf)!,
      hash: duplicate.hash,
    }))

  const uniquePdfs = detection.uniqueFiles.map(
    (file) => pdfMap.get(file)!,
  )

  return {
    uniquePdfs,
    duplicates,
    rejectedFiles,
  }
}