import type { ImageFolderRepository } from '@/domain/repositories/ImageFolderRepository'
import type { FolderImageRepository } from '@/domain/repositories/FolderImageRepository'
import type {
  PdfExportResult,
  PdfExportService,
} from '@/domain/repositories/PdfExportService'
import type { User } from '@/domain/entities/User'
import { assertUserCanAccessFolder } from '@/domain/entities/User'
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'
import { sanitizePdfFileName } from '@/domain/services/PdfFileNameService'

export class ExportFolderImagesToPdfUseCase {
  private readonly folderRepository: ImageFolderRepository
  private readonly imageRepository: FolderImageRepository
  private readonly pdfExportService: PdfExportService

  constructor(
    folderRepository: ImageFolderRepository,
    imageRepository: FolderImageRepository,
    pdfExportService: PdfExportService,
  ) {
    this.folderRepository = folderRepository
    this.imageRepository = imageRepository
    this.pdfExportService = pdfExportService
  }

  async execute(
    actor: User,
    folderId: string,
    requestedFileName: string,
    dateId?: string,
    uploadedById?: string,
  ): Promise<PdfExportResult> {
    const folder = await this.folderRepository.getById(folderId)
    if (!folder) {
      throw new NotFoundError('Carpeta no encontrada')
    }

    if (!assertUserCanAccessFolder(actor, folder)) {
      throw new UnauthorizedError('No tienes permiso para exportar esta carpeta')
    }

    const fileName = sanitizePdfFileName(requestedFileName)
    if (!fileName) {
      throw new ValidationError('El nombre del PDF es obligatorio')
    }

    const allImages = dateId
      ? await this.imageRepository.listByDate(folderId, dateId)
      : await this.imageRepository.listByFolder(folderId)
    const technicianId = uploadedById?.trim()
    const images = technicianId
      ? allImages.filter((image) => image.uploadedById === technicianId)
      : allImages
    if (images.length === 0) {
      throw new ValidationError('No hay imágenes para exportar')
    }

    return this.pdfExportService.createImagesDocument(
      fileName,
      images.map((image) => ({
        title: image.fileName,
        storagePath: image.storagePath,
      })),
    )
  }
}
