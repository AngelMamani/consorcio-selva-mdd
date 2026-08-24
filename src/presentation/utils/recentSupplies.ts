const STORAGE_KEY = 'consorcio-recent-supplies'
const MAX_RECENT = 8

export function readRecentSupplies(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is string => typeof item === 'string' && /^\d{7,12}$/.test(item))
      .slice(0, MAX_RECENT)
  } catch {
    return []
  }
}

export function rememberRecentSupply(routeCode: string): string[] {
  const next = [
    routeCode,
    ...readRecentSupplies().filter((item) => item !== routeCode),
  ].slice(0, MAX_RECENT)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}
