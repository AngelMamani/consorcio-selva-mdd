import '../domain/usecases/assign_folder_location_use_case.dart';
import '../domain/usecases/change_own_password_use_case.dart';
import '../domain/usecases/create_folder_date_use_case.dart';
import '../domain/usecases/create_folder_use_case.dart';
import '../domain/usecases/ensure_folder_date_use_case.dart';
import '../domain/usecases/ensure_supply_folder_use_case.dart';
import '../domain/usecases/get_attendance_settings_use_case.dart';
import '../domain/usecases/get_folder_date_detail_use_case.dart';
import '../domain/usecases/get_folder_detail_use_case.dart';
import '../domain/usecases/get_my_today_attendance_use_case.dart';
import '../domain/usecases/list_areas_use_case.dart';
import '../domain/usecases/list_my_folders_use_case.dart';
import '../domain/usecases/login_use_case.dart';
import '../domain/usecases/logout_use_case.dart';
import '../domain/usecases/get_mobile_app_release_use_case.dart';
import '../domain/usecases/search_supplies_use_case.dart';
import '../domain/usecases/task_use_cases.dart';
import '../domain/usecases/rank_my_tasks_by_proximity_use_case.dart';
import '../infrastructure/firestore/firebase_supply_repository.dart';
import '../infrastructure/firestore/firebase_task_repository.dart';
import '../domain/usecases/mark_attendance_use_case.dart';
import '../domain/usecases/observe_session_use_case.dart';
import '../domain/usecases/update_folder_use_case.dart';
import '../domain/usecases/update_own_theme_use_case.dart';
import '../domain/usecases/upload_folder_images_use_case.dart';
import '../domain/usecases/upload_task_photos_use_case.dart';
import '../infrastructure/auth/firebase_auth_repository.dart';
import '../infrastructure/firestore/firebase_area_repository.dart';
import '../infrastructure/firestore/firebase_attendance_repository.dart';
import '../infrastructure/firestore/firebase_mobile_app_release_repository.dart';
import '../infrastructure/firestore/firebase_folder_date_repository.dart';
import '../infrastructure/firestore/firebase_folder_image_repository.dart';
import '../infrastructure/firestore/firebase_image_folder_repository.dart';
import '../infrastructure/firestore/firebase_user_repository.dart';

class AppDependencies {
  AppDependencies({
    required this.loginUseCase,
    required this.logoutUseCase,
    required this.observeSessionUseCase,
    required this.changeOwnPasswordUseCase,
    required this.updateOwnThemeUseCase,
    required this.listAreasUseCase,
    required this.getAreaUseCase,
    required this.listMyFoldersUseCase,
    required this.createFolderUseCase,
    required this.ensureSupplyFolderUseCase,
    required this.listSupplyCatalogUseCase,
    required this.updateFolderUseCase,
    required this.assignFolderLocationUseCase,
    required this.getFolderDetailUseCase,
    required this.createFolderDateUseCase,
    required this.ensureFolderDateUseCase,
    required this.getFolderDateDetailUseCase,
    required this.uploadFolderImagesUseCase,
    required this.uploadTaskPhotosUseCase,
    required this.getMyTodayAttendanceUseCase,
    required this.getAttendanceSettingsUseCase,
    required this.markAttendanceUseCase,
    required this.getMobileAppReleaseUseCase,
    required this.getSupplyByRouteCodeUseCase,
    required this.searchSuppliesUseCase,
    required this.getSupplyCatalogStatusUseCase,
    required this.getStationByCodeUseCase,
    required this.searchStationsUseCase,
    required this.listSuppliesNearUseCase,
    required this.listMyTasksUseCase,
    required this.startMyTaskUseCase,
    required this.completeMyTaskUseCase,
    required this.rankMyTasksByProximityUseCase,
  });

  final LoginUseCase loginUseCase;
  final LogoutUseCase logoutUseCase;
  final ObserveSessionUseCase observeSessionUseCase;
  final ChangeOwnPasswordUseCase changeOwnPasswordUseCase;
  final UpdateOwnThemeUseCase updateOwnThemeUseCase;
  final ListAreasUseCase listAreasUseCase;
  final GetAreaUseCase getAreaUseCase;
  final ListMyFoldersUseCase listMyFoldersUseCase;
  final CreateFolderUseCase createFolderUseCase;
  final EnsureSupplyFolderUseCase ensureSupplyFolderUseCase;
  final ListSupplyCatalogUseCase listSupplyCatalogUseCase;
  final UpdateFolderUseCase updateFolderUseCase;
  final AssignFolderLocationUseCase assignFolderLocationUseCase;
  final GetFolderDetailUseCase getFolderDetailUseCase;
  final CreateFolderDateUseCase createFolderDateUseCase;
  final EnsureFolderDateUseCase ensureFolderDateUseCase;
  final GetFolderDateDetailUseCase getFolderDateDetailUseCase;
  final UploadFolderImagesUseCase uploadFolderImagesUseCase;
  final UploadTaskPhotosUseCase uploadTaskPhotosUseCase;
  final GetMyTodayAttendanceUseCase getMyTodayAttendanceUseCase;
  final GetAttendanceSettingsUseCase getAttendanceSettingsUseCase;
  final MarkAttendanceUseCase markAttendanceUseCase;
  final GetMobileAppReleaseUseCase getMobileAppReleaseUseCase;
  final GetSupplyByRouteCodeUseCase getSupplyByRouteCodeUseCase;
  final SearchSuppliesUseCase searchSuppliesUseCase;
  final GetSupplyCatalogStatusUseCase getSupplyCatalogStatusUseCase;
  final GetStationByCodeUseCase getStationByCodeUseCase;
  final SearchStationsUseCase searchStationsUseCase;
  final ListSuppliesNearUseCase listSuppliesNearUseCase;
  final ListMyTasksUseCase listMyTasksUseCase;
  final StartMyTaskUseCase startMyTaskUseCase;
  final CompleteMyTaskUseCase completeMyTaskUseCase;
  final RankMyTasksByProximityUseCase rankMyTasksByProximityUseCase;
}

AppDependencies createAppDependencies() {
  final authRepository = FirebaseAuthRepository();
  final userRepository = FirebaseUserRepository();
  final folderRepository = FirebaseImageFolderRepository();
  final imageRepository = FirebaseFolderImageRepository();
  final folderDateRepository = FirebaseFolderDateRepository();
  final areaRepository = FirebaseAreaRepository();
  final attendanceRepository = FirebaseAttendanceRepository();
  final mobileAppReleaseRepository = FirebaseMobileAppReleaseRepository();
  final supplyRepository = FirebaseSupplyRepository();
  final taskRepository = FirebaseTaskRepository();

  final ensureSupplyFolderUseCase = EnsureSupplyFolderUseCase(
    folderRepository,
    areaRepository,
    supplyRepository,
  );
  final ensureFolderDateUseCase = EnsureFolderDateUseCase(
    folderRepository,
    folderDateRepository,
  );
  final uploadFolderImagesUseCase = UploadFolderImagesUseCase(
    folderRepository,
    folderDateRepository,
    imageRepository,
  );

  return AppDependencies(
    loginUseCase: LoginUseCase(authRepository, userRepository),
    logoutUseCase: LogoutUseCase(authRepository),
    observeSessionUseCase:
        ObserveSessionUseCase(authRepository, userRepository),
    changeOwnPasswordUseCase:
        ChangeOwnPasswordUseCase(authRepository, userRepository),
    updateOwnThemeUseCase: UpdateOwnThemeUseCase(userRepository),
    listAreasUseCase: ListAreasUseCase(areaRepository),
    getAreaUseCase: GetAreaUseCase(areaRepository),
    listMyFoldersUseCase: ListMyFoldersUseCase(folderRepository),
    createFolderUseCase:
        CreateFolderUseCase(folderRepository, areaRepository, userRepository),
    ensureSupplyFolderUseCase: ensureSupplyFolderUseCase,
    updateFolderUseCase:
        UpdateFolderUseCase(folderRepository, userRepository),
    assignFolderLocationUseCase:
        AssignFolderLocationUseCase(folderRepository),
    getFolderDetailUseCase:
        GetFolderDetailUseCase(folderRepository, folderDateRepository),
    createFolderDateUseCase:
        CreateFolderDateUseCase(folderRepository, folderDateRepository),
    ensureFolderDateUseCase: ensureFolderDateUseCase,
    getFolderDateDetailUseCase: GetFolderDateDetailUseCase(
      folderRepository,
      folderDateRepository,
      imageRepository,
    ),
    uploadFolderImagesUseCase: uploadFolderImagesUseCase,
    uploadTaskPhotosUseCase: UploadTaskPhotosUseCase(
      ensureSupplyFolderUseCase,
      ensureFolderDateUseCase,
      uploadFolderImagesUseCase,
    ),
    getMyTodayAttendanceUseCase:
        GetMyTodayAttendanceUseCase(attendanceRepository),
    getAttendanceSettingsUseCase:
        GetAttendanceSettingsUseCase(attendanceRepository),
    markAttendanceUseCase: MarkAttendanceUseCase(attendanceRepository),
    getMobileAppReleaseUseCase:
        GetMobileAppReleaseUseCase(mobileAppReleaseRepository),
    getSupplyByRouteCodeUseCase: GetSupplyByRouteCodeUseCase(supplyRepository),
    searchSuppliesUseCase: SearchSuppliesUseCase(supplyRepository),
    listSupplyCatalogUseCase: ListSupplyCatalogUseCase(supplyRepository),
    getSupplyCatalogStatusUseCase:
        GetSupplyCatalogStatusUseCase(supplyRepository),
    getStationByCodeUseCase: GetStationByCodeUseCase(supplyRepository),
    searchStationsUseCase: SearchStationsUseCase(supplyRepository),
    listSuppliesNearUseCase: ListSuppliesNearUseCase(supplyRepository),
    listMyTasksUseCase: ListMyTasksUseCase(taskRepository),
    startMyTaskUseCase: StartMyTaskUseCase(taskRepository),
    completeMyTaskUseCase: CompleteMyTaskUseCase(taskRepository),
    rankMyTasksByProximityUseCase:
        RankMyTasksByProximityUseCase(supplyRepository),
  );
}
