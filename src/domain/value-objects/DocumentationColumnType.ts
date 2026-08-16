export const DocumentationColumnType = {
  Texto: 'TEXTO',
  Numero: 'NUMERO',
  Imagen: 'IMAGEN',
} as const

export type DocumentationColumnType =
  (typeof DocumentationColumnType)[keyof typeof DocumentationColumnType]

export function documentationColumnTypeLabel(
  type: DocumentationColumnType,
): string {
  switch (type) {
    case DocumentationColumnType.Texto:
      return 'Texto'
    case DocumentationColumnType.Numero:
      return 'Número'
    case DocumentationColumnType.Imagen:
      return 'Imagen'
    default:
      return type
  }
}

export function isDocumentationColumnType(
  value: string,
): value is DocumentationColumnType {
  return (
    value === DocumentationColumnType.Texto ||
    value === DocumentationColumnType.Numero ||
    value === DocumentationColumnType.Imagen
  )
}
