export interface ExtractedTextItem {
  text: string
  x: number
  y: number
  width: number
  height: number
  fontName: string
  hasEOL: boolean
}

export interface ExtractedPage {
  pageNumber: number
  width: number
  height: number
  items: ExtractedTextItem[]
}

export interface ExtractedPdf {
  fileName: string
  totalPages: number
  pages: ExtractedPage[]
}