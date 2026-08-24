const supplyCodeHead = '12';
const supplyCodeLength = 11;
const supplySearchMinDigits = 2;

class SupplySearchExpansion {
  const SupplySearchExpansion({
    required this.digits,
    required this.prefixes,
    required this.exactCodes,
  });

  final String digits;
  final List<String> prefixes;
  final List<String> exactCodes;
}

String formatRouteCode(String code) {
  final digits = code.replaceAll(RegExp(r'\D'), '');
  if (digits.isEmpty) return code;
  final buffer = StringBuffer();
  final start = digits.length % 3;
  if (start > 0) {
    buffer.write(digits.substring(0, start));
  }
  for (var index = start; index < digits.length; index += 3) {
    if (buffer.isNotEmpty) buffer.write(' ');
    buffer.write(digits.substring(index, index + 3));
  }
  return buffer.toString();
}

SupplySearchExpansion expandSupplySearch(String query) {
  final digits = query.replaceAll(RegExp(r'\D'), '');
  if (digits.length < supplySearchMinDigits || digits.length > 12) {
    return SupplySearchExpansion(
      digits: digits,
      prefixes: const [],
      exactCodes: const [],
    );
  }

  final prefixes = <String>{digits};
  final exactCodes = <String>{};
  final withHead = digits.startsWith(supplyCodeHead)
      ? digits
      : '$supplyCodeHead$digits';
  if (withHead.length >= supplySearchMinDigits && withHead.length <= 12) {
    prefixes.add(withHead);
  }
  if (digits.length >= 7 && digits.length <= 12) {
    exactCodes.add(digits);
  }
  if (withHead.length >= 7 && withHead.length <= 12) {
    exactCodes.add(withHead);
  }
  if (digits.length >= 4 && digits.length <= 9) {
    final rest = (digits.startsWith(supplyCodeHead)
            ? digits.substring(supplyCodeHead.length)
            : digits)
        .padLeft(supplyCodeLength - supplyCodeHead.length, '0');
    final padded = '$supplyCodeHead$rest';
    exactCodes.add(
      padded.length > supplyCodeLength
          ? padded.substring(0, supplyCodeLength)
          : padded,
    );
  }

  return SupplySearchExpansion(
    digits: digits,
    prefixes: prefixes.toList(),
    exactCodes: exactCodes.toList(),
  );
}

int scoreSupplyCode(String code, String digits) {
  if (digits.isEmpty) return 99;
  final value = code.replaceAll(RegExp(r'\D'), '');
  if (value.isEmpty) return 99;
  if (value == digits || value == '$supplyCodeHead$digits') return 0;
  if (value.startsWith(digits) || value.startsWith('$supplyCodeHead$digits')) {
    return 1;
  }
  if (value.endsWith(digits)) return 2;
  if (value.contains(digits)) return 3;
  return 10;
}

bool supplyCodeMatchesQuery(String code, String query) {
  final digits = query.replaceAll(RegExp(r'\D'), '');
  if (digits.isEmpty) return true;
  return scoreSupplyCode(code, digits) < 10;
}
