import type { ParsedSed } from '@/domain/entities/Sed'
import { isValidGeoLocation } from '@/domain/value-objects/GeoLocation'

const SED_CODE_RE = /\b(20\d{5})\b/

export interface ParseSedKmlResult {
  seds: ParsedSed[]
  skipped: number
  duplicates: number
}

export function parseSedKml(xml: string): ParseSedKmlResult {
  const byCode = new Map<string, ParsedSed>()
  let skipped = 0
  let duplicates = 0
  const pairRe =
    /<name>([^<]*\b20\d{5}\b[^<]*)<\/name>[\s\S]*?<coordinates>\s*([^,<\s]+)\s*,\s*([^,<\s]+)/g

  let match: RegExpExecArray | null
  while ((match = pairRe.exec(xml))) {
    const rawName = (match[1] ?? '').replace(/\s+/g, ' ').trim()
    const codeMatch = rawName.match(SED_CODE_RE)
    const longitude = Number(match[2])
    const latitude = Number(match[3])

    if (!codeMatch || !isValidGeoLocation(latitude, longitude)) {
      skipped += 1
      continue
    }

    const code = codeMatch[1]
    if (byCode.has(code)) {
      duplicates += 1
    }

    byCode.set(code, {
      code,
      name: rawName.slice(0, 180),
      latitude,
      longitude,
    })
  }

  return {
    seds: [...byCode.values()],
    skipped,
    duplicates,
  }
}
