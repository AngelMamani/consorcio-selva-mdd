const defaultTemporaryPassword = '87654321';
const legacyTemporaryPasswords = {'12345678', '87654321'};
const minPasswordLength = 6;

bool isSecurePassword(String password) {
  if (password.length < minPasswordLength) return false;
  if (legacyTemporaryPasswords.contains(password)) return false;
  return true;
}

String securePasswordRequirementsMessage() {
  return 'Mínimo $minPasswordLength caracteres. Puede ser sencilla. No uses la temporal $defaultTemporaryPassword.';
}
