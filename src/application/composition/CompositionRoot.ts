import { FirebaseAuthRepository } from '@/infrastructure/auth/FirebaseAuthRepository'
import { FirebaseUserRepository } from '@/infrastructure/firestore/FirebaseUserRepository'
import { FirebaseImageFolderRepository } from '@/infrastructure/firestore/FirebaseImageFolderRepository'
import { FirebaseFolderImageRepository } from '@/infrastructure/firestore/FirebaseFolderImageRepository'
import { FirebaseFolderDateRepository } from '@/infrastructure/firestore/FirebaseFolderDateRepository'
import { LoginUseCase } from '@/domain/usecases/auth/LoginUseCase'
import { LogoutUseCase } from '@/domain/usecases/auth/LogoutUseCase'
import { ObserveSessionUseCase } from '@/domain/usecases/auth/ObserveSessionUseCase'
import { CreateUserUseCase } from '@/domain/usecases/users/CreateUserUseCase'
import { ListUsersUseCase } from '@/domain/usecases/users/ListUsersUseCase'
import { ListTechniciansUseCase } from '@/domain/usecases/users/ListTechniciansUseCase'
import { UpdateUserUseCase } from '@/domain/usecases/users/UpdateUserUseCase'
import { UpdateOwnThemeUseCase } from '@/domain/usecases/users/UpdateOwnThemeUseCase'
import { ChangeOwnPasswordUseCase } from '@/domain/usecases/users/ChangeOwnPasswordUseCase'
import { ResetUserPasswordUseCase } from '@/domain/usecases/users/ResetUserPasswordUseCase'
import { CreateFolderUseCase } from '@/domain/usecases/folders/CreateFolderUseCase'
import { UpdateFolderUseCase } from '@/domain/usecases/folders/UpdateFolderUseCase'
import { ListFoldersUseCase } from '@/domain/usecases/folders/ListFoldersUseCase'
import { GetFolderUseCase } from '@/domain/usecases/folders/GetFolderUseCase'
import { DeleteFolderUseCase } from '@/domain/usecases/folders/DeleteFolderUseCase'
import { UploadFolderImageUseCase } from '@/domain/usecases/folders/UploadFolderImageUseCase'
import { ListFolderImagesUseCase } from '@/domain/usecases/folders/ListFolderImagesUseCase'
import { DeleteFolderImageUseCase } from '@/domain/usecases/folders/DeleteFolderImageUseCase'
import { ExportFolderImagesToPdfUseCase } from '@/domain/usecases/folders/ExportFolderImagesToPdfUseCase'
import {
  ListFolderDatesUseCase,
  GetFolderDateUseCase,
  CreateFolderDateUseCase,
  DeleteFolderDateUseCase,
} from '@/domain/usecases/folders/FolderDateUseCases'
import {
  ListAreasUseCase,
  GetAreaUseCase,
  CreateAreaUseCase,
  UpdateAreaUseCase,
  DeleteAreaUseCase,
  EnsureDefaultNotificationsAreaUseCase,
} from '@/domain/usecases/areas/AreaUseCases'
import {
  ListDocumentationTypesUseCase,
  GetDocumentationTypeUseCase,
  CreateDocumentationTypeUseCase,
  UpdateDocumentationTypeUseCase,
  DeleteDocumentationTypeUseCase,
} from '@/domain/usecases/documentation/DocumentationTypeUseCases'
import { SaveDocumentationColumnsUseCase } from '@/domain/usecases/documentation/SaveDocumentationColumnsUseCase'
import {
  ListDocumentationRowsUseCase,
  CreateDocumentationRowUseCase,
  UpdateDocumentationRowUseCase,
  DeleteDocumentationRowUseCase,
} from '@/domain/usecases/documentation/DocumentationRowUseCases'
import {
  ImportDocumentationFromExcelUseCase,
  DownloadDocumentationExcelTemplateUseCase,
  ExportDocumentationToWordUseCase,
  UploadDocumentationCellImageUseCase,
} from '@/domain/usecases/documentation/DocumentationImportExportUseCases'
import { JsPdfExportService } from '@/infrastructure/pdf/JsPdfExportService'
import { FirebaseDocumentationRepository } from '@/infrastructure/firestore/FirebaseDocumentationRepository'
import { FirebaseAreaRepository } from '@/infrastructure/firestore/FirebaseAreaRepository'
import { XlsxDocumentationExcelService } from '@/infrastructure/excel/XlsxDocumentationExcelService'
import { DocxDocumentationWordExportService } from '@/infrastructure/word/DocxDocumentationWordExportService'

export interface AppDependencies {
  loginUseCase: LoginUseCase
  logoutUseCase: LogoutUseCase
  observeSessionUseCase: ObserveSessionUseCase
  createUserUseCase: CreateUserUseCase
  listUsersUseCase: ListUsersUseCase
  listTechniciansUseCase: ListTechniciansUseCase
  updateUserUseCase: UpdateUserUseCase
  updateOwnThemeUseCase: UpdateOwnThemeUseCase
  changeOwnPasswordUseCase: ChangeOwnPasswordUseCase
  resetUserPasswordUseCase: ResetUserPasswordUseCase
  createFolderUseCase: CreateFolderUseCase
  updateFolderUseCase: UpdateFolderUseCase
  listFoldersUseCase: ListFoldersUseCase
  getFolderUseCase: GetFolderUseCase
  deleteFolderUseCase: DeleteFolderUseCase
  uploadFolderImageUseCase: UploadFolderImageUseCase
  listFolderImagesUseCase: ListFolderImagesUseCase
  deleteFolderImageUseCase: DeleteFolderImageUseCase
  exportFolderImagesToPdfUseCase: ExportFolderImagesToPdfUseCase
  listFolderDatesUseCase: ListFolderDatesUseCase
  getFolderDateUseCase: GetFolderDateUseCase
  createFolderDateUseCase: CreateFolderDateUseCase
  deleteFolderDateUseCase: DeleteFolderDateUseCase
  listAreasUseCase: ListAreasUseCase
  getAreaUseCase: GetAreaUseCase
  createAreaUseCase: CreateAreaUseCase
  updateAreaUseCase: UpdateAreaUseCase
  deleteAreaUseCase: DeleteAreaUseCase
  ensureDefaultNotificationsAreaUseCase: EnsureDefaultNotificationsAreaUseCase
  listDocumentationTypesUseCase: ListDocumentationTypesUseCase
  getDocumentationTypeUseCase: GetDocumentationTypeUseCase
  createDocumentationTypeUseCase: CreateDocumentationTypeUseCase
  updateDocumentationTypeUseCase: UpdateDocumentationTypeUseCase
  deleteDocumentationTypeUseCase: DeleteDocumentationTypeUseCase
  saveDocumentationColumnsUseCase: SaveDocumentationColumnsUseCase
  listDocumentationRowsUseCase: ListDocumentationRowsUseCase
  createDocumentationRowUseCase: CreateDocumentationRowUseCase
  updateDocumentationRowUseCase: UpdateDocumentationRowUseCase
  deleteDocumentationRowUseCase: DeleteDocumentationRowUseCase
  importDocumentationFromExcelUseCase: ImportDocumentationFromExcelUseCase
  downloadDocumentationExcelTemplateUseCase: DownloadDocumentationExcelTemplateUseCase
  exportDocumentationToWordUseCase: ExportDocumentationToWordUseCase
  uploadDocumentationCellImageUseCase: UploadDocumentationCellImageUseCase
}

export function createAppDependencies(): AppDependencies {
  const authRepository = new FirebaseAuthRepository()
  const userRepository = new FirebaseUserRepository()
  const folderRepository = new FirebaseImageFolderRepository()
  const imageRepository = new FirebaseFolderImageRepository()
  const folderDateRepository = new FirebaseFolderDateRepository()
  const areaRepository = new FirebaseAreaRepository()
  const pdfExportService = new JsPdfExportService()
  const documentationRepository = new FirebaseDocumentationRepository()
  const documentationExcelService = new XlsxDocumentationExcelService()
  const documentationWordExportService =
    new DocxDocumentationWordExportService()

  return {
    loginUseCase: new LoginUseCase(authRepository, userRepository),
    logoutUseCase: new LogoutUseCase(authRepository),
    observeSessionUseCase: new ObserveSessionUseCase(
      authRepository,
      userRepository,
    ),
    createUserUseCase: new CreateUserUseCase(authRepository, userRepository),
    listUsersUseCase: new ListUsersUseCase(userRepository),
    listTechniciansUseCase: new ListTechniciansUseCase(userRepository),
    updateUserUseCase: new UpdateUserUseCase(authRepository, userRepository),
    updateOwnThemeUseCase: new UpdateOwnThemeUseCase(userRepository),
    changeOwnPasswordUseCase: new ChangeOwnPasswordUseCase(
      authRepository,
      userRepository,
    ),
    resetUserPasswordUseCase: new ResetUserPasswordUseCase(
      authRepository,
      userRepository,
    ),
    createFolderUseCase: new CreateFolderUseCase(
      folderRepository,
      areaRepository,
      userRepository,
    ),
    updateFolderUseCase: new UpdateFolderUseCase(
      folderRepository,
      userRepository,
    ),
    listFoldersUseCase: new ListFoldersUseCase(folderRepository),
    getFolderUseCase: new GetFolderUseCase(folderRepository),
    deleteFolderUseCase: new DeleteFolderUseCase(
      folderRepository,
      folderDateRepository,
      imageRepository,
    ),
    uploadFolderImageUseCase: new UploadFolderImageUseCase(
      folderRepository,
      folderDateRepository,
      imageRepository,
    ),
    listFolderImagesUseCase: new ListFolderImagesUseCase(
      folderRepository,
      imageRepository,
    ),
    deleteFolderImageUseCase: new DeleteFolderImageUseCase(
      folderRepository,
      folderDateRepository,
      imageRepository,
    ),
    listFolderDatesUseCase: new ListFolderDatesUseCase(
      folderRepository,
      folderDateRepository,
    ),
    getFolderDateUseCase: new GetFolderDateUseCase(
      folderRepository,
      folderDateRepository,
    ),
    createFolderDateUseCase: new CreateFolderDateUseCase(
      folderRepository,
      folderDateRepository,
    ),
    deleteFolderDateUseCase: new DeleteFolderDateUseCase(
      folderRepository,
      folderDateRepository,
      imageRepository,
    ),
    exportFolderImagesToPdfUseCase: new ExportFolderImagesToPdfUseCase(
      folderRepository,
      imageRepository,
      pdfExportService,
    ),
    listAreasUseCase: new ListAreasUseCase(areaRepository),
    getAreaUseCase: new GetAreaUseCase(areaRepository),
    createAreaUseCase: new CreateAreaUseCase(areaRepository),
    updateAreaUseCase: new UpdateAreaUseCase(areaRepository),
    deleteAreaUseCase: new DeleteAreaUseCase(
      areaRepository,
      folderRepository,
    ),
    ensureDefaultNotificationsAreaUseCase:
      new EnsureDefaultNotificationsAreaUseCase(
        areaRepository,
        folderRepository,
      ),
    listDocumentationTypesUseCase: new ListDocumentationTypesUseCase(
      documentationRepository,
    ),
    getDocumentationTypeUseCase: new GetDocumentationTypeUseCase(
      documentationRepository,
    ),
    createDocumentationTypeUseCase: new CreateDocumentationTypeUseCase(
      documentationRepository,
    ),
    updateDocumentationTypeUseCase: new UpdateDocumentationTypeUseCase(
      documentationRepository,
    ),
    deleteDocumentationTypeUseCase: new DeleteDocumentationTypeUseCase(
      documentationRepository,
    ),
    saveDocumentationColumnsUseCase: new SaveDocumentationColumnsUseCase(
      documentationRepository,
    ),
    listDocumentationRowsUseCase: new ListDocumentationRowsUseCase(
      documentationRepository,
    ),
    createDocumentationRowUseCase: new CreateDocumentationRowUseCase(
      documentationRepository,
    ),
    updateDocumentationRowUseCase: new UpdateDocumentationRowUseCase(
      documentationRepository,
    ),
    deleteDocumentationRowUseCase: new DeleteDocumentationRowUseCase(
      documentationRepository,
    ),
    importDocumentationFromExcelUseCase: new ImportDocumentationFromExcelUseCase(
      documentationRepository,
      documentationExcelService,
    ),
    downloadDocumentationExcelTemplateUseCase:
      new DownloadDocumentationExcelTemplateUseCase(
        documentationRepository,
        documentationExcelService,
      ),
    exportDocumentationToWordUseCase: new ExportDocumentationToWordUseCase(
      documentationRepository,
      documentationWordExportService,
    ),
    uploadDocumentationCellImageUseCase:
      new UploadDocumentationCellImageUseCase(documentationRepository),
  }
}
