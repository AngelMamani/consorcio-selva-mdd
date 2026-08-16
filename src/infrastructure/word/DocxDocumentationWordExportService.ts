import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import type { DocumentationColumn } from '@/domain/entities/DocumentationColumn'
import type { DocumentationRow } from '@/domain/entities/DocumentationRow'
import type { DocumentationWordExportService } from '@/domain/repositories/DocumentationWordExportService'
import { DocumentationColumnType } from '@/domain/value-objects/DocumentationColumnType'

function cellText(
  column: DocumentationColumn,
  row: DocumentationRow,
): string {
  const value = row.values[column.id]
  if (value === null || value === undefined || value === '') return '—'
  if (column.type === DocumentationColumnType.Imagen) {
    if (typeof value === 'object' && 'fileName' in value) {
      return value.fileName || 'Imagen'
    }
    return '—'
  }
  return String(value)
}

function headerCell(text: string): TableCell {
  return new TableCell({
    width: { size: 20, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: true,
          }),
        ],
      }),
    ],
  })
}

function bodyCell(text: string): TableCell {
  return new TableCell({
    width: { size: 20, type: WidthType.PERCENTAGE },
    children: [new Paragraph(text)],
  })
}

export class DocxDocumentationWordExportService
  implements DocumentationWordExportService
{
  async exportTable(
    typeName: string,
    columns: DocumentationColumn[],
    rows: DocumentationRow[],
  ): Promise<Blob> {
    const sorted = [...columns].sort((a, b) => a.order - b.order)
    const header = new TableRow({
      children: sorted.map((column) => headerCell(column.name)),
    })

    const body =
      rows.length === 0
        ? [
            new TableRow({
              children: sorted.map(() => bodyCell('Sin registros')),
            }),
          ]
        : rows.map(
            (row) =>
              new TableRow({
                children: sorted.map((column) =>
                  bodyCell(cellText(column, row)),
                ),
              }),
          )

    const document = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: typeName,
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
              text: `Documentación — Consorcio Selva MDD · ${new Date().toLocaleString('es-PE')}`,
              spacing: { after: 240 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [header, ...body],
            }),
          ],
        },
      ],
    })

    return Packer.toBlob(document)
  }
}
