import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore'
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage'
import type { DocumentationColumn } from '@/domain/entities/DocumentationColumn'
import type { DocumentationType } from '@/domain/entities/DocumentationType'
import type {
  DocumentationCellValue,
  DocumentationImageValue,
  DocumentationRow,
} from '@/domain/entities/DocumentationRow'
import type {
  DocumentationImageFilePayload,
  DocumentationRepository,
} from '@/domain/repositories/DocumentationRepository'
import { isDocumentationColumnType } from '@/domain/value-objects/DocumentationColumnType'
import { NotFoundError } from '@/domain/errors/DomainError'
import {
  firebaseStorage,
  firestoreDb,
} from '@/infrastructure/firebase/firebaseApp'

interface TypeDoc {
  name: string
  description: string
  columns: Array<{
    id: string
    name: string
    type: string
    order: number
  }>
  createdById: string
  createdByName: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

interface RowDoc {
  typeId: string
  values: Record<string, unknown>
  createdById: string
  createdByName: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

function mapColumns(
  columns: TypeDoc['columns'] | undefined,
): DocumentationColumn[] {
  if (!columns?.length) return []
  return columns
    .filter(
      (column) =>
        column.id && column.name && isDocumentationColumnType(column.type),
    )
    .map((column) => ({
      id: column.id,
      name: column.name,
      type: column.type as DocumentationColumn['type'],
      order: column.order,
    }))
    .sort((a, b) => a.order - b.order)
}

function mapType(id: string, data: TypeDoc): DocumentationType {
  return {
    id,
    name: data.name,
    description: data.description ?? '',
    columns: mapColumns(data.columns),
    createdById: data.createdById,
    createdByName: data.createdByName,
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
  }
}

function mapCellValue(raw: unknown): DocumentationCellValue {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string') return raw
  if (
    typeof raw === 'object' &&
    raw !== null &&
    'storagePath' in raw &&
    'downloadUrl' in raw &&
    'fileName' in raw
  ) {
    const image = raw as DocumentationImageValue
    return {
      storagePath: String(image.storagePath),
      downloadUrl: String(image.downloadUrl),
      fileName: String(image.fileName),
    }
  }
  return String(raw)
}

function mapRow(id: string, data: RowDoc): DocumentationRow {
  const values: Record<string, DocumentationCellValue> = {}
  for (const [key, value] of Object.entries(data.values ?? {})) {
    values[key] = mapCellValue(value)
  }
  return {
    id,
    typeId: data.typeId,
    values,
    createdById: data.createdById,
    createdByName: data.createdByName,
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
  }
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^\w.\-() ]+/g, '_').slice(0, 120)
}

function serializeValues(
  values: Record<string, DocumentationCellValue>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) {
    if (value === null) {
      payload[key] = null
    } else if (typeof value === 'object') {
      payload[key] = {
        storagePath: value.storagePath,
        downloadUrl: value.downloadUrl,
        fileName: value.fileName,
      }
    } else {
      payload[key] = value
    }
  }
  return payload
}

export class FirebaseDocumentationRepository
  implements DocumentationRepository
{
  private readonly typesRef = collection(firestoreDb, 'documentationTypes')
  private readonly rowsRef = collection(firestoreDb, 'documentationRows')

  async listTypes(): Promise<DocumentationType[]> {
    const snapshot = await getDocs(
      query(this.typesRef, orderBy('createdAt', 'desc')),
    )
    return snapshot.docs.map((item) =>
      mapType(item.id, item.data() as TypeDoc),
    )
  }

  async getTypeById(id: string): Promise<DocumentationType | null> {
    const snapshot = await getDoc(doc(this.typesRef, id))
    if (!snapshot.exists()) return null
    return mapType(snapshot.id, snapshot.data() as TypeDoc)
  }

  async createType(input: {
    name: string
    description: string
    createdById: string
    createdByName: string
  }): Promise<DocumentationType> {
    const now = Timestamp.now()
    const id = crypto.randomUUID()
    const payload: TypeDoc = {
      name: input.name,
      description: input.description,
      columns: [],
      createdById: input.createdById,
      createdByName: input.createdByName,
      createdAt: now,
      updatedAt: now,
    }
    await setDoc(doc(this.typesRef, id), payload)
    return mapType(id, payload)
  }

  async updateType(
    id: string,
    input: { name: string; description: string },
  ): Promise<DocumentationType> {
    const refDoc = doc(this.typesRef, id)
    const snapshot = await getDoc(refDoc)
    if (!snapshot.exists()) {
      throw new NotFoundError('Tipo de documentación no encontrado')
    }
    const current = snapshot.data() as TypeDoc
    const payload: TypeDoc = {
      ...current,
      name: input.name,
      description: input.description,
      updatedAt: Timestamp.now(),
    }
    await setDoc(refDoc, payload)
    return mapType(id, payload)
  }

  async deleteType(id: string): Promise<void> {
    await deleteDoc(doc(this.typesRef, id))
  }

  async saveColumns(
    typeId: string,
    columns: DocumentationColumn[],
  ): Promise<DocumentationType> {
    const refDoc = doc(this.typesRef, typeId)
    const snapshot = await getDoc(refDoc)
    if (!snapshot.exists()) {
      throw new NotFoundError('Tipo de documentación no encontrado')
    }
    await updateDoc(refDoc, {
      columns: columns.map((column, index) => ({
        id: column.id,
        name: column.name,
        type: column.type,
        order: index,
      })),
      updatedAt: Timestamp.now(),
    })
    const refreshed = await getDoc(refDoc)
    return mapType(typeId, refreshed.data() as TypeDoc)
  }

  async listRowsByType(typeId: string): Promise<DocumentationRow[]> {
    const snapshot = await getDocs(
      query(this.rowsRef, where('typeId', '==', typeId)),
    )
    return snapshot.docs
      .map((item) => mapRow(item.id, item.data() as RowDoc))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async createRow(input: {
    typeId: string
    values: Record<string, DocumentationCellValue>
    createdById: string
    createdByName: string
  }): Promise<DocumentationRow> {
    const now = Timestamp.now()
    const id = crypto.randomUUID()
    const payload: RowDoc = {
      typeId: input.typeId,
      values: serializeValues(input.values),
      createdById: input.createdById,
      createdByName: input.createdByName,
      createdAt: now,
      updatedAt: now,
    }
    await setDoc(doc(this.rowsRef, id), payload)
    return mapRow(id, payload)
  }

  async updateRow(
    id: string,
    values: Record<string, DocumentationCellValue>,
  ): Promise<DocumentationRow> {
    const refDoc = doc(this.rowsRef, id)
    const snapshot = await getDoc(refDoc)
    if (!snapshot.exists()) {
      throw new NotFoundError('Registro no encontrado')
    }
    const current = snapshot.data() as RowDoc
    const payload: RowDoc = {
      ...current,
      values: serializeValues(values),
      updatedAt: Timestamp.now(),
    }
    await setDoc(refDoc, payload)
    return mapRow(id, payload)
  }

  async deleteRow(id: string): Promise<void> {
    await deleteDoc(doc(this.rowsRef, id))
  }

  async uploadCellImage(
    typeId: string,
    rowId: string,
    columnId: string,
    file: DocumentationImageFilePayload,
  ): Promise<DocumentationImageValue> {
    const safeName = sanitizeFileName(file.fileName)
    const storagePath = `documentation/${typeId}/${rowId}/${columnId}_${crypto.randomUUID()}_${safeName}`
    const storageRef = ref(firebaseStorage, storagePath)
    await uploadBytes(storageRef, file.data, {
      contentType: file.contentType,
    })
    const downloadUrl = await getDownloadURL(storageRef)
    return {
      storagePath,
      downloadUrl,
      fileName: safeName,
    }
  }

  async deleteCellImage(storagePath: string): Promise<void> {
    if (!storagePath) return
    try {
      await deleteObject(ref(firebaseStorage, storagePath))
    } catch {
      // Ignora si el archivo ya no existe.
    }
  }
}
