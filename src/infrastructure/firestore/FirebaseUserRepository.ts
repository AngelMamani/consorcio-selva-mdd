import {
  collection,
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
import type { User } from '@/domain/entities/User'
import type {
  CreateUserInput,
  UpdateUserInput,
  UserRepository,
} from '@/domain/repositories/UserRepository'
import { isUserRole } from '@/domain/value-objects/UserRole'
import { ThemePreference, normalizeThemePreference } from '@/domain/value-objects/ThemePreference'
import { DomainError, NotFoundError } from '@/domain/errors/DomainError'
import { firestoreDb } from '@/infrastructure/firebase/firebaseApp'

interface UserDoc {
  email: string
  displayName: string
  role: string
  theme?: string
  mustChangePassword?: boolean
  active: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

function mapUser(id: string, data: UserDoc): User {
  if (!isUserRole(data.role)) {
    throw new DomainError(`Rol inválido en usuario ${id}`)
  }

  return {
    id,
    email: data.email,
    displayName: data.displayName,
    role: data.role,
    theme: normalizeThemePreference(data.theme),
    mustChangePassword: data.mustChangePassword === true,
    active: data.active,
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
  }
}

export class FirebaseUserRepository implements UserRepository {
  private readonly collectionRef = collection(firestoreDb, 'users')

  async getById(id: string): Promise<User | null> {
    const snapshot = await getDoc(doc(this.collectionRef, id))
    if (!snapshot.exists()) return null
    return mapUser(snapshot.id, snapshot.data() as UserDoc)
  }

  async listAll(): Promise<User[]> {
    const snapshot = await getDocs(
      query(this.collectionRef, orderBy('createdAt', 'desc')),
    )
    return snapshot.docs.map((item) => mapUser(item.id, item.data() as UserDoc))
  }

  async listTechnicians(): Promise<User[]> {
    const snapshot = await getDocs(
      query(this.collectionRef, where('role', '==', 'TECNICO')),
    )
    return snapshot.docs
      .map((item) => mapUser(item.id, item.data() as UserDoc))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'))
  }

  async create(input: CreateUserInput): Promise<User> {
    const now = Timestamp.now()
    const payload: UserDoc = {
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      theme: ThemePreference.Light,
      mustChangePassword: true,
      active: true,
      createdAt: now,
      updatedAt: now,
    }

    await setDoc(doc(this.collectionRef, input.id), payload)
    return mapUser(input.id, payload)
  }

  async update(id: string, input: UpdateUserInput): Promise<User> {
    const ref = doc(this.collectionRef, id)
    const existing = await getDoc(ref)
    if (!existing.exists()) {
      throw new NotFoundError('Usuario no encontrado')
    }

    const patch: Partial<UserDoc> = {
      updatedAt: Timestamp.now(),
    }

    if (input.displayName !== undefined) patch.displayName = input.displayName
    if (input.role !== undefined) patch.role = input.role
    if (input.active !== undefined) patch.active = input.active
    if (input.theme !== undefined) patch.theme = input.theme
    if (input.mustChangePassword !== undefined) {
      patch.mustChangePassword = input.mustChangePassword
    }

    await updateDoc(ref, patch)
    const updated = await getDoc(ref)
    return mapUser(id, updated.data() as UserDoc)
  }
}
