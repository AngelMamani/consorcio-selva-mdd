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
import { DeleteUserUseCase } from '@/domain/usecases/users/DeleteUserUseCase'
import { SyncHrAccountsUseCase } from '@/domain/usecases/users/SyncHrAccountsUseCase'
import { ProvisionElectricistaTechniciansUseCase } from '@/domain/usecases/users/ProvisionElectricistaTechniciansUseCase'
import { CreateFolderUseCase } from '@/domain/usecases/folders/CreateFolderUseCase'
import { UpdateFolderUseCase } from '@/domain/usecases/folders/UpdateFolderUseCase'
import { ListFoldersUseCase } from '@/domain/usecases/folders/ListFoldersUseCase'
import { GetFolderUseCase } from '@/domain/usecases/folders/GetFolderUseCase'
import { DeleteFolderUseCase } from '@/domain/usecases/folders/DeleteFolderUseCase'
import { EnsureSupplyFolderUseCase } from '@/domain/usecases/folders/EnsureSupplyFolderUseCase'
import { UploadFolderImageUseCase } from '@/domain/usecases/folders/UploadFolderImageUseCase'
import { ListFolderImagesUseCase } from '@/domain/usecases/folders/ListFolderImagesUseCase'
import { DeleteFolderImageUseCase } from '@/domain/usecases/folders/DeleteFolderImageUseCase'
import { ExportFolderImagesToPdfUseCase } from '@/domain/usecases/folders/ExportFolderImagesToPdfUseCase'
import { ListActivityPublishedWorkUseCase } from '@/domain/usecases/folders/ListActivityPublishedWorkUseCase'
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
  ListTasksUseCase,
  CreateTaskUseCase,
  UpdateTaskUseCase,
  CompleteTaskUseCase,
  CompleteTaskRouteUseCase,
  SaveTaskRouteLocationUseCase,
  StartTaskUseCase,
  DeleteTaskUseCase,
} from '@/domain/usecases/tasks/TaskUseCases'
import {
  ListAttendanceDayUseCase,
  GetAttendanceSettingsUseCase,
  SaveAttendanceSettingsUseCase,
  GetMyTodayAttendanceUseCase,
  MarkAttendanceUseCase,
  GrantAttendancePermissionUseCase,
} from '@/domain/usecases/attendance/AttendanceUseCases'
import { ExportAttendanceDayToExcelUseCase } from '@/domain/usecases/attendance/ExportAttendanceDayToExcelUseCase'
import { ExportAttendanceDayToPdfUseCase } from '@/domain/usecases/attendance/ExportAttendanceDayToPdfUseCase'
import {
  GetMobileAppReleaseUseCase,
  PublishMobileAppReleaseUseCase,
} from '@/domain/usecases/mobile-app/MobileAppReleaseUseCases'
import {
  GetStationByCodeUseCase,
  GetSupplyByRouteCodeUseCase,
  GetSupplyCatalogStatusUseCase,
  ImportSedsUseCase,
  ImportSuppliesUseCase,
  ListSupplyCatalogUseCase,
  ListSuppliesNearUseCase,
  SearchStationsUseCase,
  SearchSuppliesUseCase,
} from '@/domain/usecases/supplies/SupplyUseCases'
import { FirebaseAttendanceRepository } from '@/infrastructure/firestore/FirebaseAttendanceRepository'
import { FirebaseSupplyRepository } from '@/infrastructure/firestore/FirebaseSupplyRepository'
import { FirebaseMobileAppReleaseRepository } from '@/infrastructure/firestore/FirebaseMobileAppReleaseRepository'
import { JsPdfExportService } from '@/infrastructure/pdf/JsPdfExportService'
import { FirebaseAreaRepository } from '@/infrastructure/firestore/FirebaseAreaRepository'
import { FirebaseTaskRepository } from '@/infrastructure/firestore/FirebaseTaskRepository'
import { CatalogCrudUseCases } from '@/domain/usecases/personal/CatalogUseCases'
import {
  CreatePersonalUseCase,
  DeletePersonalUseCase,
  ImportPersonalUseCase,
  ListPersonalUseCase,
  UpdatePersonalUseCase,
  AssignPersonalRoleUseCase,
} from '@/domain/usecases/personal/PersonalUseCases'
import { ExportPersonalToExcelUseCase } from '@/domain/usecases/personal/ExportPersonalToExcelUseCase'
import { ExportPersonalToPdfUseCase } from '@/domain/usecases/personal/ExportPersonalToPdfUseCase'
import { FirebaseCatalogRepository } from '@/infrastructure/firestore/FirebaseCatalogRepository'
import { FirebasePersonalRepository } from '@/infrastructure/firestore/FirebasePersonalRepository'
import { FirebaseOperationalRoleRepository } from '@/infrastructure/firestore/FirebaseOperationalRoleRepository'
import {
  CreateOperationalRoleUseCase,
  DeleteOperationalRoleUseCase,
  EnsureDefaultOperationalRolesUseCase,
  GetOperationalRolePermissionsUseCase,
  ListOperationalRolesUseCase,
  UpdateOperationalRoleUseCase,
} from '@/domain/usecases/roles/OperationalRoleUseCases'
import {
  ListSupportTicketsUseCase,
  ResolveSupportTicketUseCase,
} from '@/domain/usecases/support/SupportTicketUseCases'
import { FirebaseSupportTicketRepository } from '@/infrastructure/firestore/FirebaseSupportTicketRepository'
import { XlsxAttendanceExcelService } from '@/infrastructure/excel/XlsxAttendanceExcelService'
import { XlsxPersonalExcelService } from '@/infrastructure/excel/XlsxPersonalExcelService'
import { JsPdfAttendanceExportService } from '@/infrastructure/pdf/JsPdfAttendanceExportService'
import { JsPdfPersonalExportService } from '@/infrastructure/pdf/JsPdfPersonalExportService'
import { FirebaseInstallationOrderRepository } from '@/infrastructure/firestore/FirebaseInstallationOrderRepository'
import { XlsxInstallationOrderExcelService } from '@/infrastructure/excel/XlsxInstallationOrderExcelService'
import { JsPdfInstallationOrderExportService } from '@/infrastructure/pdf/JsPdfInstallationOrderExportService'
import {
  AssignInstallationOrderUseCase,
  DeleteInstallationOrderUseCase,
  ExportInstallationOrdersToExcelUseCase,
  ExportInstallationOrdersToPdfUseCase,
  ImportInstallationOrdersUseCase,
  ListInstallationOrdersUseCase,
  ListMyInstallationOrdersUseCase,
  UpdateInstallationOrderUseCase,
  UpsertInstallationOrderUseCase,
} from '@/domain/usecases/installations/InstallationOrderUseCases'

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
  deleteUserUseCase: DeleteUserUseCase
  syncHrAccountsUseCase: SyncHrAccountsUseCase
  provisionElectricistaTechniciansUseCase: ProvisionElectricistaTechniciansUseCase
  createFolderUseCase: CreateFolderUseCase
  updateFolderUseCase: UpdateFolderUseCase
  listFoldersUseCase: ListFoldersUseCase
  getFolderUseCase: GetFolderUseCase
  deleteFolderUseCase: DeleteFolderUseCase
  ensureSupplyFolderUseCase: EnsureSupplyFolderUseCase
  uploadFolderImageUseCase: UploadFolderImageUseCase
  listFolderImagesUseCase: ListFolderImagesUseCase
  deleteFolderImageUseCase: DeleteFolderImageUseCase
  exportFolderImagesToPdfUseCase: ExportFolderImagesToPdfUseCase
  listActivityPublishedWorkUseCase: ListActivityPublishedWorkUseCase
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
  listTasksUseCase: ListTasksUseCase
  createTaskUseCase: CreateTaskUseCase
  updateTaskUseCase: UpdateTaskUseCase
  completeTaskUseCase: CompleteTaskUseCase
  completeTaskRouteUseCase: CompleteTaskRouteUseCase
  saveTaskRouteLocationUseCase: SaveTaskRouteLocationUseCase
  startTaskUseCase: StartTaskUseCase
  deleteTaskUseCase: DeleteTaskUseCase
  listInstallationOrdersUseCase: ListInstallationOrdersUseCase
  listMyInstallationOrdersUseCase: ListMyInstallationOrdersUseCase
  upsertInstallationOrderUseCase: UpsertInstallationOrderUseCase
  updateInstallationOrderUseCase: UpdateInstallationOrderUseCase
  assignInstallationOrderUseCase: AssignInstallationOrderUseCase
  deleteInstallationOrderUseCase: DeleteInstallationOrderUseCase
  importInstallationOrdersUseCase: ImportInstallationOrdersUseCase
  exportInstallationOrdersToPdfUseCase: ExportInstallationOrdersToPdfUseCase
  exportInstallationOrdersToExcelUseCase: ExportInstallationOrdersToExcelUseCase
  listAttendanceDayUseCase: ListAttendanceDayUseCase
  getAttendanceSettingsUseCase: GetAttendanceSettingsUseCase
  saveAttendanceSettingsUseCase: SaveAttendanceSettingsUseCase
  getMyTodayAttendanceUseCase: GetMyTodayAttendanceUseCase
  markAttendanceUseCase: MarkAttendanceUseCase
  grantAttendancePermissionUseCase: GrantAttendancePermissionUseCase
  exportAttendanceDayToExcelUseCase: ExportAttendanceDayToExcelUseCase
  exportAttendanceDayToPdfUseCase: ExportAttendanceDayToPdfUseCase
  getMobileAppReleaseUseCase: GetMobileAppReleaseUseCase
  publishMobileAppReleaseUseCase: PublishMobileAppReleaseUseCase
  listSupportTicketsUseCase: ListSupportTicketsUseCase
  resolveSupportTicketUseCase: ResolveSupportTicketUseCase
  getSupplyByRouteCodeUseCase: GetSupplyByRouteCodeUseCase
  searchSuppliesUseCase: SearchSuppliesUseCase
  listSupplyCatalogUseCase: ListSupplyCatalogUseCase
  getStationByCodeUseCase: GetStationByCodeUseCase
  searchStationsUseCase: SearchStationsUseCase
  listSuppliesNearUseCase: ListSuppliesNearUseCase
  getSupplyCatalogStatusUseCase: GetSupplyCatalogStatusUseCase
  importSuppliesUseCase: ImportSuppliesUseCase
  importSedsUseCase: ImportSedsUseCase
  catalogCargosUseCase: CatalogCrudUseCases
  catalogLocalidadesUseCase: CatalogCrudUseCases
  listPersonalUseCase: ListPersonalUseCase
  createPersonalUseCase: CreatePersonalUseCase
  updatePersonalUseCase: UpdatePersonalUseCase
  assignPersonalRoleUseCase: AssignPersonalRoleUseCase
  deletePersonalUseCase: DeletePersonalUseCase
  importPersonalUseCase: ImportPersonalUseCase
  exportPersonalToExcelUseCase: ExportPersonalToExcelUseCase
  exportPersonalToPdfUseCase: ExportPersonalToPdfUseCase
  listOperationalRolesUseCase: ListOperationalRolesUseCase
  getOperationalRolePermissionsUseCase: GetOperationalRolePermissionsUseCase
  ensureDefaultOperationalRolesUseCase: EnsureDefaultOperationalRolesUseCase
  createOperationalRoleUseCase: CreateOperationalRoleUseCase
  updateOperationalRoleUseCase: UpdateOperationalRoleUseCase
  deleteOperationalRoleUseCase: DeleteOperationalRoleUseCase
}

export function createAppDependencies(): AppDependencies {
  const authRepository = new FirebaseAuthRepository()
  const userRepository = new FirebaseUserRepository()
  const folderRepository = new FirebaseImageFolderRepository()
  const imageRepository = new FirebaseFolderImageRepository()
  const folderDateRepository = new FirebaseFolderDateRepository()
  const attendanceRepository = new FirebaseAttendanceRepository()
  const areaRepository = new FirebaseAreaRepository()
  const taskRepository = new FirebaseTaskRepository()
  const cargoRepository = new FirebaseCatalogRepository('cargos')
  const localidadRepository = new FirebaseCatalogRepository('localidades')
  const personalRepository = new FirebasePersonalRepository()
  const operationalRoleRepository = new FirebaseOperationalRoleRepository()
  const pdfExportService = new JsPdfExportService()
  const attendanceExcelService = new XlsxAttendanceExcelService()
  const attendancePdfService = new JsPdfAttendanceExportService()
  const personalExcelService = new XlsxPersonalExcelService()
  const personalPdfService = new JsPdfPersonalExportService()
  const installationOrderRepository = new FirebaseInstallationOrderRepository()
  const installationOrderExcelService = new XlsxInstallationOrderExcelService()
  const installationOrderPdfService = new JsPdfInstallationOrderExportService()
  const mobileAppReleaseRepository = new FirebaseMobileAppReleaseRepository()
  const supportTicketRepository = new FirebaseSupportTicketRepository()
  const supplyRepository = new FirebaseSupplyRepository()
  const listAttendanceDayUseCase = new ListAttendanceDayUseCase(
    attendanceRepository,
    userRepository,
  )
  const getAttendanceSettingsUseCase = new GetAttendanceSettingsUseCase(
    attendanceRepository,
  )
  const updateUserUseCase = new UpdateUserUseCase(
    authRepository,
    userRepository,
  )
  const provisionElectricistaTechniciansUseCase =
    new ProvisionElectricistaTechniciansUseCase(
      authRepository,
      userRepository,
      personalRepository,
      operationalRoleRepository,
      updateUserUseCase,
    )
  const deleteUserUseCase = new DeleteUserUseCase(
    authRepository,
    userRepository,
    personalRepository,
  )
  const syncHrAccountsUseCase = new SyncHrAccountsUseCase(
    personalRepository,
    userRepository,
    operationalRoleRepository,
    provisionElectricistaTechniciansUseCase,
    updateUserUseCase,
  )

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
    updateUserUseCase,
    updateOwnThemeUseCase: new UpdateOwnThemeUseCase(userRepository),
    changeOwnPasswordUseCase: new ChangeOwnPasswordUseCase(
      authRepository,
      userRepository,
    ),
    resetUserPasswordUseCase: new ResetUserPasswordUseCase(
      authRepository,
      userRepository,
    ),
    deleteUserUseCase,
    syncHrAccountsUseCase,
    provisionElectricistaTechniciansUseCase,
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
    ensureSupplyFolderUseCase: new EnsureSupplyFolderUseCase(
      folderRepository,
      areaRepository,
      supplyRepository,
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
    listActivityPublishedWorkUseCase: new ListActivityPublishedWorkUseCase(
      areaRepository,
      folderRepository,
      folderDateRepository,
      imageRepository,
      userRepository,
    ),
    listAreasUseCase: new ListAreasUseCase(areaRepository),
    getAreaUseCase: new GetAreaUseCase(areaRepository),
    createAreaUseCase: new CreateAreaUseCase(areaRepository),
    updateAreaUseCase: new UpdateAreaUseCase(
      areaRepository,
      taskRepository,
      installationOrderRepository,
    ),
    deleteAreaUseCase: new DeleteAreaUseCase(
      areaRepository,
      folderRepository,
      folderDateRepository,
      imageRepository,
    ),
    ensureDefaultNotificationsAreaUseCase:
      new EnsureDefaultNotificationsAreaUseCase(
        areaRepository,
        folderRepository,
      ),
    listTasksUseCase: new ListTasksUseCase(taskRepository),
    createTaskUseCase: new CreateTaskUseCase(
      taskRepository,
      areaRepository,
      userRepository,
      supplyRepository,
    ),
    updateTaskUseCase: new UpdateTaskUseCase(
      taskRepository,
      areaRepository,
      userRepository,
      supplyRepository,
    ),
    completeTaskUseCase: new CompleteTaskUseCase(taskRepository),
    completeTaskRouteUseCase: new CompleteTaskRouteUseCase(taskRepository),
    saveTaskRouteLocationUseCase: new SaveTaskRouteLocationUseCase(
      taskRepository,
      supplyRepository,
    ),
    startTaskUseCase: new StartTaskUseCase(taskRepository),
    deleteTaskUseCase: new DeleteTaskUseCase(taskRepository),
    listInstallationOrdersUseCase: new ListInstallationOrdersUseCase(
      installationOrderRepository,
    ),
    listMyInstallationOrdersUseCase: new ListMyInstallationOrdersUseCase(
      installationOrderRepository,
    ),
    upsertInstallationOrderUseCase: new UpsertInstallationOrderUseCase(
      installationOrderRepository,
      areaRepository,
    ),
    updateInstallationOrderUseCase: new UpdateInstallationOrderUseCase(
      installationOrderRepository,
      areaRepository,
    ),
    assignInstallationOrderUseCase: new AssignInstallationOrderUseCase(
      installationOrderRepository,
      areaRepository,
    ),
    deleteInstallationOrderUseCase: new DeleteInstallationOrderUseCase(
      installationOrderRepository,
    ),
    importInstallationOrdersUseCase: new ImportInstallationOrdersUseCase(
      installationOrderRepository,
      areaRepository,
      userRepository,
    ),
    exportInstallationOrdersToPdfUseCase:
      new ExportInstallationOrdersToPdfUseCase(installationOrderPdfService),
    exportInstallationOrdersToExcelUseCase:
      new ExportInstallationOrdersToExcelUseCase(installationOrderExcelService),
    listAttendanceDayUseCase,
    getAttendanceSettingsUseCase,
    saveAttendanceSettingsUseCase: new SaveAttendanceSettingsUseCase(
      attendanceRepository,
    ),
    getMyTodayAttendanceUseCase: new GetMyTodayAttendanceUseCase(
      attendanceRepository,
    ),
    markAttendanceUseCase: new MarkAttendanceUseCase(attendanceRepository),
    grantAttendancePermissionUseCase: new GrantAttendancePermissionUseCase(
      attendanceRepository,
      userRepository,
    ),
    exportAttendanceDayToExcelUseCase: new ExportAttendanceDayToExcelUseCase(
      listAttendanceDayUseCase,
      getAttendanceSettingsUseCase,
      attendanceExcelService,
    ),
    exportAttendanceDayToPdfUseCase: new ExportAttendanceDayToPdfUseCase(
      listAttendanceDayUseCase,
      getAttendanceSettingsUseCase,
      attendancePdfService,
    ),
    getMobileAppReleaseUseCase: new GetMobileAppReleaseUseCase(
      mobileAppReleaseRepository,
    ),
    publishMobileAppReleaseUseCase: new PublishMobileAppReleaseUseCase(
      mobileAppReleaseRepository,
    ),
    listSupportTicketsUseCase: new ListSupportTicketsUseCase(
      supportTicketRepository,
    ),
    resolveSupportTicketUseCase: new ResolveSupportTicketUseCase(
      supportTicketRepository,
    ),
    getSupplyByRouteCodeUseCase: new GetSupplyByRouteCodeUseCase(
      supplyRepository,
    ),
    searchSuppliesUseCase: new SearchSuppliesUseCase(supplyRepository),
    listSupplyCatalogUseCase: new ListSupplyCatalogUseCase(supplyRepository),
    getStationByCodeUseCase: new GetStationByCodeUseCase(supplyRepository),
    searchStationsUseCase: new SearchStationsUseCase(supplyRepository),
    listSuppliesNearUseCase: new ListSuppliesNearUseCase(supplyRepository),
    getSupplyCatalogStatusUseCase: new GetSupplyCatalogStatusUseCase(
      supplyRepository,
    ),
    importSuppliesUseCase: new ImportSuppliesUseCase(supplyRepository),
    importSedsUseCase: new ImportSedsUseCase(supplyRepository),
    catalogCargosUseCase: new CatalogCrudUseCases(
      cargoRepository,
      personalRepository,
      { singular: 'cargo', plural: 'cargos' },
      'cargo',
    ),
    catalogLocalidadesUseCase: new CatalogCrudUseCases(
      localidadRepository,
      personalRepository,
      { singular: 'localidad', plural: 'localidades' },
      'localidad',
    ),
    listPersonalUseCase: new ListPersonalUseCase(personalRepository),
    createPersonalUseCase: new CreatePersonalUseCase(
      personalRepository,
      cargoRepository,
      localidadRepository,
      operationalRoleRepository,
    ),
    updatePersonalUseCase: new UpdatePersonalUseCase(
      personalRepository,
      cargoRepository,
      localidadRepository,
      operationalRoleRepository,
    ),
    assignPersonalRoleUseCase: new AssignPersonalRoleUseCase(
      personalRepository,
      operationalRoleRepository,
      userRepository,
      deleteUserUseCase,
    ),
    deletePersonalUseCase: new DeletePersonalUseCase(
      personalRepository,
      userRepository,
      deleteUserUseCase,
    ),
    importPersonalUseCase: new ImportPersonalUseCase(
      personalRepository,
      cargoRepository,
      localidadRepository,
    ),
    exportPersonalToExcelUseCase: new ExportPersonalToExcelUseCase(
      personalExcelService,
    ),
    exportPersonalToPdfUseCase: new ExportPersonalToPdfUseCase(
      personalPdfService,
    ),
    listOperationalRolesUseCase: new ListOperationalRolesUseCase(
      operationalRoleRepository,
    ),
    getOperationalRolePermissionsUseCase:
      new GetOperationalRolePermissionsUseCase(operationalRoleRepository),
    ensureDefaultOperationalRolesUseCase:
      new EnsureDefaultOperationalRolesUseCase(operationalRoleRepository),
    createOperationalRoleUseCase: new CreateOperationalRoleUseCase(
      operationalRoleRepository,
    ),
    updateOperationalRoleUseCase: new UpdateOperationalRoleUseCase(
      operationalRoleRepository,
    ),
    deleteOperationalRoleUseCase: new DeleteOperationalRoleUseCase(
      operationalRoleRepository,
    ),
  }
}
