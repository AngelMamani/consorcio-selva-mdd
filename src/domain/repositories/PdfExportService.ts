export interface PdfImageSource {
  title: string
  storagePath: string
}

export interface PdfExportResult {
  blob: Blob
  fileName: string
}

export interface PdfExportService {
  createImagesDocument(
    fileName: string,
    images: PdfImageSource[],
  ): Promise<PdfExportResult>
}
