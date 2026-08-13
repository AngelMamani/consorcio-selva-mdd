import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth'
import { httpsCallable, type FunctionsError } from 'firebase/functions'
import type {
  AuthCredentials,
  AuthRepository,
  CreateManagedUserInput,
  CreateManagedUserResult,
  UpdateManagedUserDisplayNameInput,
} from '@/domain/repositories/AuthRepository'
import {
  firebaseAuth,
  firebaseFunctions,
} from '@/infrastructure/firebase/firebaseApp'
import { DomainError } from '@/domain/errors/DomainError'

function readErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return ''
  if ('code' in error) return String((error as { code: unknown }).code ?? '')
  return ''
}

function readErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Error de autenticación'
  }

  const candidate = error as {
    message?: unknown
    details?: unknown
    customData?: { message?: unknown }
  }

  if (typeof candidate.details === 'string' && candidate.details.trim()) {
    return candidate.details.trim()
  }

  if (
    typeof candidate.customData?.message === 'string' &&
    candidate.customData.message.trim()
  ) {
    return candidate.customData.message.trim()
  }

  if (typeof candidate.message === 'string' && candidate.message.trim()) {
    return candidate.message
      .replace(/^Firebase:\s*/i, '')
      .replace(/\s*\(functions\/[^)]+\)\.?$/i, '')
      .trim()
  }

  return 'Error de autenticación'
}

function mapAuthError(error: unknown): Error {
  const code = readErrorCode(error)
  const message = readErrorMessage(error)

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return new DomainError('Correo o contraseña incorrectos')
    case 'auth/email-already-in-use':
    case 'functions/already-exists':
      return new DomainError('El correo ya está registrado')
    case 'auth/weak-password':
      return new DomainError('La contraseña es demasiado débil')
    case 'auth/requires-recent-login':
      return new DomainError(
        'Por seguridad, cierra sesión e inicia de nuevo para cambiar la contraseña',
      )
    case 'auth/too-many-requests':
      return new DomainError('Demasiados intentos. Intenta más tarde')
    case 'functions/not-found':
      return new DomainError(
        message.includes('Authentication') || message.includes('Firestore')
          ? message
          : 'La función de administración no está desplegada o el usuario no existe.',
      )
    case 'functions/permission-denied':
      return new DomainError('Solo el administrador puede realizar esta acción')
    case 'functions/failed-precondition':
      return new DomainError(
        message || 'No se pudo completar la operación de seguridad',
      )
    case 'functions/unauthenticated':
      return new DomainError('Debes iniciar sesión')
    case 'functions/invalid-argument':
      return new DomainError(message || 'Datos inválidos')
    case 'functions/unavailable':
    case 'functions/deadline-exceeded':
      return new DomainError(
        'El servicio de Functions no respondió. Reintenta en unos segundos.',
      )
    case 'functions/internal':
      return new DomainError(
        message && message.toUpperCase() !== 'INTERNAL'
          ? message
          : 'Error interno al restablecer/crear usuario. Revisa Functions en Firebase.',
      )
    default:
      return new DomainError(message || 'Error de autenticación')
  }
}

function assertCallablePayload<T extends Record<string, unknown>>(
  data: T | undefined,
  requiredKeys: Array<keyof T>,
): T {
  if (!data) {
    throw new DomainError('La función no devolvió datos')
  }
  for (const key of requiredKeys) {
    if (data[key] === undefined || data[key] === null || data[key] === '') {
      throw new DomainError(`Respuesta incompleta de la función (${String(key)})`)
    }
  }
  return data
}

export class FirebaseAuthRepository implements AuthRepository {
  async login(credentials: AuthCredentials): Promise<string> {
    try {
      const result = await signInWithEmailAndPassword(
        firebaseAuth,
        credentials.email,
        credentials.password,
      )
      return result.user.uid
    } catch (error) {
      throw mapAuthError(error)
    }
  }

  async logout(): Promise<void> {
    await signOut(firebaseAuth)
  }

  async getCurrentUserId(): Promise<string | null> {
    return firebaseAuth.currentUser?.uid ?? null
  }

  observeAuthState(onChange: (userId: string | null) => void): () => void {
    return onAuthStateChanged(firebaseAuth, (user) => {
      onChange(user?.uid ?? null)
    })
  }

  async createManagedUser(
    input: CreateManagedUserInput,
  ): Promise<CreateManagedUserResult> {
    try {
      const callable = httpsCallable<
        CreateManagedUserInput,
        { ok: boolean; userId: string; temporaryPassword: string }
      >(firebaseFunctions, 'createManagedUser')
      const result = await callable(input)
      const data = assertCallablePayload(result.data, [
        'userId',
        'temporaryPassword',
      ])
      return {
        userId: data.userId,
        temporaryPassword: data.temporaryPassword,
      }
    } catch (error) {
      throw mapAuthError(error as FunctionsError)
    }
  }

  async updateManagedUserDisplayName(
    input: UpdateManagedUserDisplayNameInput,
  ): Promise<void> {
    try {
      const callable = httpsCallable<
        UpdateManagedUserDisplayNameInput,
        { ok: boolean; userId: string; displayName: string }
      >(firebaseFunctions, 'updateManagedUserDisplayName')
      const result = await callable(input)
      assertCallablePayload(result.data, ['userId', 'displayName'])
    } catch (error) {
      throw mapAuthError(error as FunctionsError)
    }
  }

  async updatePassword(newPassword: string): Promise<void> {
    const currentUser = firebaseAuth.currentUser
    if (!currentUser) {
      throw new DomainError('No hay sesión activa para cambiar la contraseña')
    }

    try {
      await updatePassword(currentUser, newPassword)
    } catch (error) {
      throw mapAuthError(error)
    }
  }

  async resetTemporaryPassword(userId: string): Promise<string> {
    try {
      const callable = httpsCallable<
        { userId: string },
        { ok: boolean; temporaryPassword: string }
      >(firebaseFunctions, 'resetUserTemporaryPassword')
      const result = await callable({ userId })
      const data = assertCallablePayload(result.data, ['temporaryPassword'])
      return data.temporaryPassword
    } catch (error) {
      throw mapAuthError(error as FunctionsError)
    }
  }
}
