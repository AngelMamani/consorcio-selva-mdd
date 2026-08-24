abstract class AuthRepository {
  Future<String> login({required String email, required String password});
  Future<String> resolveEmailByDni(String dni);
  Future<void> logout();
  Stream<String?> observeAuthState();
  String? get currentUserId;
  Future<void> updatePassword(String newPassword);
}
