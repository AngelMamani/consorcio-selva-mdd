import '../entities/app_user.dart';

abstract class UserRepository {
  Future<AppUser?> getById(String id);
  Future<AppUser> updateMustChangePassword({
    required String userId,
    required bool mustChangePassword,
  });
  Future<AppUser> updateTheme({
    required String userId,
    required String theme,
  });
}
