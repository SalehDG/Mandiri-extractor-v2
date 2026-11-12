
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type {
  ExtractedPdf,
  ExtractedPage,
  ExtractedTextItem,
} from '../types/extracted-text'

export async function extractPdfText(
  file: File,
  standardFontDataUrl = `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
): Promise<ExtractedPdf> {
  const fileData = new Uint8Array(await file.arrayBuffer())

  const loadingTask = getDocument({
    data: fileData,
    standardFontDataUrl,
  })

  const pdf = await loadingTask.promise

  try {
    const pages: ExtractedPage[] = []

    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber++
    ) {
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1 })
      const textContent = await page.getTextContent()

      const items: ExtractedTextItem[] = []

      for (const item of textContent.items) {
        if (!('str' in item)) {
          continue
        }

        items.push({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height,
          fontName: item.fontName,
          hasEOL: item.hasEOL,
        })
      }

      pages.push({
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        items,
      })

      page.cleanup()
    }

    return {
      fileName: file.name,
      totalPages: pdf.numPages,
      pages,
    }
  } finally {
    await loadingTask.destroy()
  }
}
