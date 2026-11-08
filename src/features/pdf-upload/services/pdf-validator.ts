
export type PdfValidationResult =
  | {
      valid: true
    }
  | {
      valid: false
      reason: string
    }

const PDF_SIGNATURE = '%PDF-'

export async function validatePdfFile(
  file: File,
): Promise<PdfValidationResult> {
  // Pemeriksaan pertama: ekstensi file
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return {
      valid: false,
      reason: 'File harus memiliki ekstensi .pdf',
    }
  }

  // Pemeriksaan kedua: signature PDF
  const header = await file.slice(0, 1024).text()

  if (!header.startsWith(PDF_SIGNATURE)) {
    return {
      valid: false,
      reason: 'File bukan PDF yang valid',
    }
  }

  return {
    valid: true,
  }
}
