export interface PdfImageSource {
  title: string
  storagePath: string
}

export interface PdfLocalImageSource {
  title: string
  data: Blob
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
  /** PDF desde imágenes locales (carpeta del PC). */
  createLocalImagesDocument(
    fileName: string,
    images: PdfLocalImageSource[],
  ): Promise<PdfExportResult>
  /** Une PDFs en el orden del arreglo (páginas concatenadas). */
  mergeDocuments(
    fileName: string,
    documents: ArrayBuffer[],
  ): Promise<PdfExportResult>
}
