const defaultTemporaryPassword = '87654321';
const legacyTemporaryPasswords = {'12345678', '87654321'};
const minPasswordLength = 10;

bool isSecurePassword(String password) {
  if (password.length < minPasswordLength) return false;
  if (legacyTemporaryPasswords.contains(password)) return false;

  final hasUpper = RegExp(r'[A-ZÁÉÍÓÚÑ]').hasMatch(password);
  final hasLower = RegExp(r'[a-záéíóúñ]').hasMatch(password);
  final hasNumber = RegExp(r'\d').hasMatch(password);
  return hasUpper && hasLower && hasNumber;
}

String securePasswordRequirementsMessage() {
  return 'Mínimo $minPasswordLength caracteres, con mayúscula, minúscula y número. No uses la temporal $defaultTemporaryPassword.';
}
