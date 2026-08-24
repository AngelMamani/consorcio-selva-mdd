import { normalizeRouteCode } from '@/domain/value-objects/RouteCode'

export const SUPPLY_CODE_HEAD = '12'
export const SUPPLY_CODE_LENGTH = 11
export const SUPPLY_SEARCH_MIN_DIGITS = 2

export function formatRouteCode(code: string): string {
  const digits = normalizeRouteCode(code)
  if (!digits) return code
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export function expandSupplySearch(query: string): {
  digits: string
  prefixes: string[]
  exactCodes: string[]
} {
  const digits = normalizeRouteCode(query)
  const prefixes = new Set<string>()
  const exactCodes = new Set<string>()

  if (digits.length < SUPPLY_SEARCH_MIN_DIGITS || digits.length > 12) {
    return { digits, prefixes: [], exactCodes: [] }
  }

  prefixes.add(digits)

  const withHead = digits.startsWith(SUPPLY_CODE_HEAD)
    ? digits
    : `${SUPPLY_CODE_HEAD}${digits}`
  if (withHead.length >= SUPPLY_SEARCH_MIN_DIGITS && withHead.length <= 12) {
    prefixes.add(withHead)
  }

  if (digits.length >= 7 && digits.length <= 12) {
    exactCodes.add(digits)
  }
  if (withHead.length >= 7 && withHead.length <= 12) {
    exactCodes.add(withHead)
  }

  if (digits.length >= 4 && digits.length <= 9) {
    const rest = (digits.startsWith(SUPPLY_CODE_HEAD)
      ? digits.slice(SUPPLY_CODE_HEAD.length)
      : digits
    ).padStart(SUPPLY_CODE_LENGTH - SUPPLY_CODE_HEAD.length, '0')
    exactCodes.add(`${SUPPLY_CODE_HEAD}${rest}`.slice(0, SUPPLY_CODE_LENGTH))
  }

  return {
    digits,
    prefixes: [...prefixes],
    exactCodes: [...exactCodes],
  }
}

export function scoreSupplyCode(code: string, digits: string): number {
  if (!digits) return 99
  const value = normalizeRouteCode(code)
  if (!value) return 99
  if (value === digits || value === `${SUPPLY_CODE_HEAD}${digits}`) return 0
  if (value.startsWith(digits) || value.startsWith(`${SUPPLY_CODE_HEAD}${digits}`)) {
    return 1
  }
  if (value.endsWith(digits)) return 2
  if (value.includes(digits)) return 3
  return 10
}

export function supplyCodeMatchesQuery(code: string, query: string): boolean {
  const digits = normalizeRouteCode(query)
  if (!digits) return true
  return scoreSupplyCode(code, digits) < 10
}

export function rankSupplyCodes<T>(
  items: T[],
  digits: string,
  getCode: (item: T) => string,
): T[] {
  return [...items].sort((left, right) => {
    const leftScore = scoreSupplyCode(getCode(left), digits)
    const rightScore = scoreSupplyCode(getCode(right), digits)
    if (leftScore !== rightScore) return leftScore - rightScore
    return getCode(left).localeCompare(getCode(right))
  })
}

export function findCodeHighlight(
  code: string,
  query: string,
): { start: number; end: number } | null {
  const digits = normalizeRouteCode(query)
  if (!digits) return null
  const value = normalizeRouteCode(code)
  const candidates = [digits, `${SUPPLY_CODE_HEAD}${digits}`]
  for (const token of candidates) {
    const index = value.indexOf(token)
    if (index >= 0) return { start: index, end: index + token.length }
  }
  return null
}
