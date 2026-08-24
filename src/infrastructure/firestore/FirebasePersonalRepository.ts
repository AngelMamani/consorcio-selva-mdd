import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { Personal } from '@/domain/entities/Personal'
import type {
  PersonalRepository,
  PersonalWriteInput,
} from '@/domain/repositories/PersonalRepository'
import type { PersonalCondition } from '@/domain/value-objects/PersonalCondition'
import { NotFoundError } from '@/domain/errors/DomainError'
import { firestoreDb } from '@/infrastructure/firebase/firebaseApp'

interface PersonalDoc {
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  dni: string
  cargoId: string
  cargoName: string
  localidadId: string
  localidadName: string
  condicion: string
  roleId: string
  roleName: string
  createdById: string
  createdByName: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

function mapPersonal(id: string, data: PersonalDoc): Personal {
  return {
    id,
    nombres: data.nombres,
    apellidoPaterno: data.apellidoPaterno,
    apellidoMaterno: data.apellidoMaterno,
    dni: data.dni,
    cargoId: data.cargoId,
    cargoName: data.cargoName,
    localidadId: data.localidadId,
    localidadName: data.localidadName,
    condicion: (data.condicion as PersonalCondition | '') ?? '',
    roleId: data.roleId ?? '',
    roleName: data.roleName ?? '',
    createdById: data.createdById,
    createdByName: data.createdByName,
    createdAt: data.createdAt?.toDate() ?? new Date(),
    updatedAt: data.updatedAt?.toDate() ?? new Date(),
  }
}

function toDoc(
  input: PersonalWriteInput,
  createdAt: Timestamp,
  updatedAt: Timestamp,
): PersonalDoc {
  return {
    nombres: input.nombres,
    apellidoPaterno: input.apellidoPaterno,
    apellidoMaterno: input.apellidoMaterno,
    dni: input.dni,
    cargoId: input.cargoId,
    cargoName: input.cargoName,
    localidadId: input.localidadId,
    localidadName: input.localidadName,
    condicion: input.condicion,
    roleId: input.roleId ?? '',
    roleName: input.roleName ?? '',
    createdById: input.createdById,
    createdByName: input.createdByName,
    createdAt,
    updatedAt,
  }
}

export class FirebasePersonalRepository implements PersonalRepository {
  private readonly collectionRef = collection(firestoreDb, 'personal')

  async listAll(): Promise<Personal[]> {
    const snapshot = await getDocs(
      query(this.collectionRef, orderBy('apellidoPaterno', 'asc')),
    )
    return snapshot.docs.map((item) =>
      mapPersonal(item.id, item.data() as PersonalDoc),
    )
  }

  async getById(id: string): Promise<Personal | null> {
    const snapshot = await getDoc(doc(this.collectionRef, id))
    if (!snapshot.exists()) return null
    return mapPersonal(snapshot.id, snapshot.data() as PersonalDoc)
  }

  async findByDni(dni: string): Promise<Personal | null> {
    const snapshot = await getDocs(
      query(this.collectionRef, where('dni', '==', dni), limit(1)),
    )
    const first = snapshot.docs[0]
    if (!first) return null
    return mapPersonal(first.id, first.data() as PersonalDoc)
  }

  async create(input: PersonalWriteInput): Promise<Personal> {
    const now = Timestamp.now()
    const id = crypto.randomUUID()
    const payload = toDoc(input, now, now)
    await setDoc(doc(this.collectionRef, id), payload)
    return mapPersonal(id, payload)
  }

  async update(id: string, input: PersonalWriteInput): Promise<Personal> {
    const refDoc = doc(this.collectionRef, id)
    const snapshot = await getDoc(refDoc)
    if (!snapshot.exists()) {
      throw new NotFoundError('Persona no encontrada')
    }
    const current = snapshot.data() as PersonalDoc
    const payload = toDoc(input, current.createdAt, Timestamp.now())
    await setDoc(refDoc, payload)
    return mapPersonal(id, payload)
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.collectionRef, id))
  }

  async countByCargoId(cargoId: string): Promise<number> {
    const snapshot = await getCountFromServer(
      query(this.collectionRef, where('cargoId', '==', cargoId)),
    )
    return snapshot.data().count
  }

  async countByLocalidadId(localidadId: string): Promise<number> {
    const snapshot = await getCountFromServer(
      query(this.collectionRef, where('localidadId', '==', localidadId)),
    )
    return snapshot.data().count
  }

  async renameCargo(cargoId: string, cargoName: string): Promise<void> {
    await this.renameField('cargoId', cargoId, { cargoName })
  }

  async renameLocalidad(
    localidadId: string,
    localidadName: string,
  ): Promise<void> {
    await this.renameField('localidadId', localidadId, { localidadName })
  }

  private async renameField(
    field: 'cargoId' | 'localidadId',
    id: string,
    patch: { cargoName: string } | { localidadName: string },
  ): Promise<void> {
    const snapshot = await getDocs(
      query(this.collectionRef, where(field, '==', id)),
    )
    if (snapshot.empty) return
    const now = Timestamp.now()
    let batch = writeBatch(firestoreDb)
    let count = 0
    for (const item of snapshot.docs) {
      batch.update(item.ref, { ...patch, updatedAt: now })
      count += 1
      if (count === 50) {
        await batch.commit()
        batch = writeBatch(firestoreDb)
        count = 0
      }
    }
    if (count > 0) {
      await batch.commit()
    }
  }
}
