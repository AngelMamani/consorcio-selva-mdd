import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'
import { loadFirebaseConfig } from '@/infrastructure/firebase/firebaseConfig'

const config = loadFirebaseConfig()

const app = getApps().length === 0 ? initializeApp(config) : getApp()

export const firebaseApp = app
export const firebaseAuth = getAuth(app)
export const firestoreDb = getFirestore(app)
export const firebaseStorage = getStorage(app)
export const firebaseFunctions = getFunctions(app, 'us-central1')
