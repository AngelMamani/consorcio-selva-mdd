import '../entities/app_user.dart';

abstract class UserRepository {
  Future<AppUser?> getById(String id);
  Future<List<AppUser>> listTechnicians();
  Future<AppUser> updateMustChangePassword({
    required String userId,
    required bool mustChangePassword,
    String? loginSecret,
  });
  Future<AppUser> updateTheme({
    required String userId,
    required String theme,
  });
}
