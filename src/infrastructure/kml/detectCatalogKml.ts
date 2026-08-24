export type CatalogKmlKind = 'supply' | 'sed'

export function detectCatalogKml(xml: string): CatalogKmlKind | null {
  const head = xml.slice(0, 4000)
  if (
    /Subestaci[oó]n de Distribuci[oó]n|Document id="Subestaci/i.test(head)
  ) {
    return 'sed'
  }
  if (/Document id="Suministro"|<name>Suministro<\/name>/i.test(head)) {
    return 'supply'
  }

  const supplyNames = xml.match(/<name>\d{10,12}<\/name>/g)?.length ?? 0
  const sedNames = xml.match(/<name>[^<]*\b20\d{5}\b[^<]*<\/name>/g)?.length ?? 0
  if (sedNames > 0 && sedNames >= supplyNames) return 'sed'
  if (supplyNames > 0) return 'supply'
  return null
}
