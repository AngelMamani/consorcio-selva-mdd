# Consorcio Selva MDD

Panel web (Vite + React + TypeScript) + app móvil de técnicos (Flutter) con **Clean Architecture** y Firebase (Auth, Firestore, Storage, Cloud Functions).

Repositorio: [AngelMamani/consorcio-selva-mdd](https://github.com/AngelMamani/consorcio-selva-mdd)

## Qué incluye

- **Web admin:** usuarios, carpetas, mapa GPS, PDF, modo claro/oscuro
- **App Flutter (`consorcio/`):** técnicos de campo, GPS obligatorio, fotos, tema por usuario
- Roles: `ADMINISTRADOR` | `TECNICO`

## Arranque local (web)

```bash
npm install
cp .env.example .env   # completar con tu config Firebase
npm run dev
```

Variables requeridas (también en Vercel → Settings → Environment Variables):

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

## Despliegue en Vercel (panel web)

1. Entra a [vercel.com](https://vercel.com) e importa el repo de GitHub.
2. Framework: **Vite** (detectado automático).
3. Build: `npm run build` · Output: `dist`.
4. Carga las 6 variables `VITE_FIREBASE_*` (Production + Preview).
5. Deploy.

Después del primer deploy:

1. Firebase Console → Authentication → **Authorized domains** → agrega tu dominio de Vercel (ej. `tu-app.vercel.app`).
2. CORS de Storage (PDF / imágenes en prod):

```bash
gsutil cors set storage.cors.json gs://consorcio-selva-mdd.firebasestorage.app
```

El archivo `vercel.json` ya reescribe rutas SPA (`/mapa`, `/usuarios`, etc.) a `index.html`.

## Firebase (rules + functions)

```bash
firebase deploy --only firestore:rules,storage,functions
```

Functions relevantes:

- `createManagedUser`
- `resetUserTemporaryPassword`
- `updateManagedUserDisplayName` (sincroniza nombre en Auth, perfil, carpetas e imágenes)

Clave temporal al crear/restablecer: **87654321** (obligatorio cambiarla al ingresar).

## App Flutter (técnicos)

```bash
cd consorcio
flutter pub get
flutter run
```

## Arquitectura (web)

```
src/domain          → entidades, repositorios, casos de uso
src/application     → composition root (DI)
src/infrastructure  → Firebase
src/presentation    → React (UI, rutas, providers)
consorcio/          → app Flutter técnicos
functions/          → Cloud Functions
```

## Calidad (ISO/IEC 25010)

→ [`REQUISITOS_NO_FUNCIONALES_ISO25010.md`](./REQUISITOS_NO_FUNCIONALES_ISO25010.md)
