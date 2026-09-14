import type {
  PdfExportResult,
  PdfExportService,
} from '@/domain/repositories/PdfExportService'
import { ValidationError } from '@/domain/errors/DomainError'
import { sanitizePdfFileName } from '@/domain/services/PdfFileNameService'

export const MAX_MERGE_PDF_BYTES = 25 * 1024 * 1024

export async function readPdfFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (!file || file.size <= 0) {
    throw new ValidationError('El archivo PDF está vacío')
  }
  if (file.size > MAX_MERGE_PDF_BYTES) {
    throw new ValidationError('Cada PDF debe pesar máximo 25 MB')
  }
  const type = (file.type || '').toLowerCase()
  const name = file.name.toLowerCase()
  if (type && type !== 'application/pdf' && !name.endsWith('.pdf')) {
    throw new ValidationError('Solo se admiten archivos PDF')
  }
  if (!type && !name.endsWith('.pdf')) {
    throw new ValidationError('Solo se admiten archivos PDF')
  }
  return file.arrayBuffer()
}

export class MergePdfsUseCase {
  private readonly pdfExportService: PdfExportService

  constructor(pdfExportService: PdfExportService) {
    this.pdfExportService = pdfExportService
  }

  async execute(
    requestedFileName: string,
    pdfFiles: File[],
  ): Promise<PdfExportResult> {
    if (pdfFiles.length !== 2) {
      throw new ValidationError('Debes seleccionar exactamente 2 PDFs')
    }

    const fileName = sanitizePdfFileName(requestedFileName)
    if (!fileName) {
      throw new ValidationError('El nombre del PDF es obligatorio')
    }

    const documents = await Promise.all(
      pdfFiles.map((file) => readPdfFileAsArrayBuffer(file)),
    )

    return this.pdfExportService.mergeDocuments(fileName, documents)
  }
}
