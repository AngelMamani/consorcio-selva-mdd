import '../domain/usecases/assign_folder_location_use_case.dart';
import '../domain/usecases/change_own_password_use_case.dart';
import '../domain/usecases/create_folder_date_use_case.dart';
import '../domain/usecases/create_folder_use_case.dart';
import '../domain/usecases/get_attendance_settings_use_case.dart';
import '../domain/usecases/get_folder_date_detail_use_case.dart';
import '../domain/usecases/get_folder_detail_use_case.dart';
import '../domain/usecases/get_my_today_attendance_use_case.dart';
import '../domain/usecases/list_areas_use_case.dart';
import '../domain/usecases/list_my_folders_use_case.dart';
import '../domain/usecases/login_use_case.dart';
import '../domain/usecases/logout_use_case.dart';
import '../domain/usecases/mark_attendance_use_case.dart';
import '../domain/usecases/observe_session_use_case.dart';
import '../domain/usecases/update_folder_use_case.dart';
import '../domain/usecases/update_own_theme_use_case.dart';
import '../domain/usecases/upload_folder_images_use_case.dart';
import '../infrastructure/auth/firebase_auth_repository.dart';
import '../infrastructure/firestore/firebase_area_repository.dart';
import '../infrastructure/firestore/firebase_attendance_repository.dart';
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
    required this.updateFolderUseCase,
    required this.assignFolderLocationUseCase,
    required this.getFolderDetailUseCase,
    required this.createFolderDateUseCase,
    required this.getFolderDateDetailUseCase,
    required this.uploadFolderImagesUseCase,
    required this.getMyTodayAttendanceUseCase,
    required this.getAttendanceSettingsUseCase,
    required this.markAttendanceUseCase,
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
  final UpdateFolderUseCase updateFolderUseCase;
  final AssignFolderLocationUseCase assignFolderLocationUseCase;
  final GetFolderDetailUseCase getFolderDetailUseCase;
  final CreateFolderDateUseCase createFolderDateUseCase;
  final GetFolderDateDetailUseCase getFolderDateDetailUseCase;
  final UploadFolderImagesUseCase uploadFolderImagesUseCase;
  final GetMyTodayAttendanceUseCase getMyTodayAttendanceUseCase;
  final GetAttendanceSettingsUseCase getAttendanceSettingsUseCase;
  final MarkAttendanceUseCase markAttendanceUseCase;
}

AppDependencies createAppDependencies() {
  final authRepository = FirebaseAuthRepository();
  final userRepository = FirebaseUserRepository();
  final folderRepository = FirebaseImageFolderRepository();
  final imageRepository = FirebaseFolderImageRepository();
  final folderDateRepository = FirebaseFolderDateRepository();
  final areaRepository = FirebaseAreaRepository();
  final attendanceRepository = FirebaseAttendanceRepository();

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
    updateFolderUseCase:
        UpdateFolderUseCase(folderRepository, userRepository),
    assignFolderLocationUseCase:
        AssignFolderLocationUseCase(folderRepository),
    getFolderDetailUseCase:
        GetFolderDetailUseCase(folderRepository, folderDateRepository),
    createFolderDateUseCase:
        CreateFolderDateUseCase(folderRepository, folderDateRepository),
    getFolderDateDetailUseCase: GetFolderDateDetailUseCase(
      folderRepository,
      folderDateRepository,
      imageRepository,
    ),
    uploadFolderImagesUseCase: UploadFolderImagesUseCase(
      folderRepository,
      folderDateRepository,
      imageRepository,
    ),
    getMyTodayAttendanceUseCase:
        GetMyTodayAttendanceUseCase(attendanceRepository),
    getAttendanceSettingsUseCase:
        GetAttendanceSettingsUseCase(attendanceRepository),
    markAttendanceUseCase:
        MarkAttendanceUseCase(attendanceRepository, areaRepository),
  );
}
