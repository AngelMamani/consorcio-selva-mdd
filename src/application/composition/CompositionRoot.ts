import { FirebaseAuthRepository } from '@/infrastructure/auth/FirebaseAuthRepository'
import { FirebaseUserRepository } from '@/infrastructure/firestore/FirebaseUserRepository'
import { FirebaseImageFolderRepository } from '@/infrastructure/firestore/FirebaseImageFolderRepository'
import { FirebaseFolderImageRepository } from '@/infrastructure/firestore/FirebaseFolderImageRepository'
import { LoginUseCase } from '@/domain/usecases/auth/LoginUseCase'
import { LogoutUseCase } from '@/domain/usecases/auth/LogoutUseCase'
import { ObserveSessionUseCase } from '@/domain/usecases/auth/ObserveSessionUseCase'
import { CreateUserUseCase } from '@/domain/usecases/users/CreateUserUseCase'
import { ListUsersUseCase } from '@/domain/usecases/users/ListUsersUseCase'
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
import { JsPdfExportService } from '@/infrastructure/pdf/JsPdfExportService'

export interface AppDependencies {
  loginUseCase: LoginUseCase
  logoutUseCase: LogoutUseCase
  observeSessionUseCase: ObserveSessionUseCase
  createUserUseCase: CreateUserUseCase
  listUsersUseCase: ListUsersUseCase
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
}

export function createAppDependencies(): AppDependencies {
  const authRepository = new FirebaseAuthRepository()
  const userRepository = new FirebaseUserRepository()
  const folderRepository = new FirebaseImageFolderRepository()
  const imageRepository = new FirebaseFolderImageRepository()
  const pdfExportService = new JsPdfExportService()

  return {
    loginUseCase: new LoginUseCase(authRepository, userRepository),
    logoutUseCase: new LogoutUseCase(authRepository),
    observeSessionUseCase: new ObserveSessionUseCase(
      authRepository,
      userRepository,
    ),
    createUserUseCase: new CreateUserUseCase(authRepository, userRepository),
    listUsersUseCase: new ListUsersUseCase(userRepository),
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
    createFolderUseCase: new CreateFolderUseCase(folderRepository),
    updateFolderUseCase: new UpdateFolderUseCase(folderRepository),
    listFoldersUseCase: new ListFoldersUseCase(folderRepository),
    getFolderUseCase: new GetFolderUseCase(folderRepository),
    deleteFolderUseCase: new DeleteFolderUseCase(
      folderRepository,
      imageRepository,
    ),
    uploadFolderImageUseCase: new UploadFolderImageUseCase(
      folderRepository,
      imageRepository,
    ),
    listFolderImagesUseCase: new ListFolderImagesUseCase(
      folderRepository,
      imageRepository,
    ),
    deleteFolderImageUseCase: new DeleteFolderImageUseCase(
      folderRepository,
      imageRepository,
    ),
    exportFolderImagesToPdfUseCase: new ExportFolderImagesToPdfUseCase(
      folderRepository,
      imageRepository,
      pdfExportService,
    ),
  }
}
