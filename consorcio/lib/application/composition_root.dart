import '../domain/usecases/change_own_password_use_case.dart';
import '../domain/usecases/create_folder_use_case.dart';
import '../domain/usecases/get_folder_detail_use_case.dart';
import '../domain/usecases/list_my_folders_use_case.dart';
import '../domain/usecases/login_use_case.dart';
import '../domain/usecases/logout_use_case.dart';
import '../domain/usecases/observe_session_use_case.dart';
import '../domain/usecases/update_folder_use_case.dart';
import '../domain/usecases/update_own_theme_use_case.dart';
import '../domain/usecases/upload_folder_images_use_case.dart';
import '../infrastructure/auth/firebase_auth_repository.dart';
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
    required this.listMyFoldersUseCase,
    required this.createFolderUseCase,
    required this.updateFolderUseCase,
    required this.getFolderDetailUseCase,
    required this.uploadFolderImagesUseCase,
  });

  final LoginUseCase loginUseCase;
  final LogoutUseCase logoutUseCase;
  final ObserveSessionUseCase observeSessionUseCase;
  final ChangeOwnPasswordUseCase changeOwnPasswordUseCase;
  final UpdateOwnThemeUseCase updateOwnThemeUseCase;
  final ListMyFoldersUseCase listMyFoldersUseCase;
  final CreateFolderUseCase createFolderUseCase;
  final UpdateFolderUseCase updateFolderUseCase;
  final GetFolderDetailUseCase getFolderDetailUseCase;
  final UploadFolderImagesUseCase uploadFolderImagesUseCase;
}

AppDependencies createAppDependencies() {
  final authRepository = FirebaseAuthRepository();
  final userRepository = FirebaseUserRepository();
  final folderRepository = FirebaseImageFolderRepository();
  final imageRepository = FirebaseFolderImageRepository();

  return AppDependencies(
    loginUseCase: LoginUseCase(authRepository, userRepository),
    logoutUseCase: LogoutUseCase(authRepository),
    observeSessionUseCase:
        ObserveSessionUseCase(authRepository, userRepository),
    changeOwnPasswordUseCase:
        ChangeOwnPasswordUseCase(authRepository, userRepository),
    updateOwnThemeUseCase: UpdateOwnThemeUseCase(userRepository),
    listMyFoldersUseCase: ListMyFoldersUseCase(folderRepository),
    createFolderUseCase: CreateFolderUseCase(folderRepository),
    updateFolderUseCase: UpdateFolderUseCase(folderRepository),
    getFolderDetailUseCase:
        GetFolderDetailUseCase(folderRepository, imageRepository),
    uploadFolderImagesUseCase:
        UploadFolderImagesUseCase(folderRepository, imageRepository),
  );
}
