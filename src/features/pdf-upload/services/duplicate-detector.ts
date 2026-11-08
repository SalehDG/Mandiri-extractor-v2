import { calculateFileHash } from './file-hasher'

export interface DuplicateFile {
  file: File
  duplicateOf: File
  hash: string
}

export interface DuplicateDetectionResult {
  uniqueFiles: File[]
  duplicates: DuplicateFile[]
}

export async function detectDuplicates(
  files: File[],
): Promise<DuplicateDetectionResult> {
  const hashMap = new Map<string, File>()

  const result: DuplicateDetectionResult = {
    uniqueFiles: [],
    duplicates: [],
  }

  // Periksa file satu per satu.
  for (const file of files) {
    const hash = await calculateFileHash(file)

    const existingFile = hashMap.get(hash)

    if (existingFile) {
      result.duplicates.push({
        file,
        duplicateOf: existingFile,
        hash,
      })

      continue
    }

    // Simpan file pertama sebagai acuan.
    hashMap.set(hash, file)
    result.uniqueFiles.push(file)
  }

  return result
}