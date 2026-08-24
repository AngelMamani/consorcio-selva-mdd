import { DependenciesProvider } from '@/presentation/providers/DependenciesProvider'
import { AuthProvider } from '@/presentation/providers/AuthProvider'
import { PermissionsProvider } from '@/presentation/providers/PermissionsProvider'
import { AppRouter } from '@/presentation/routes/AppRouter'
import '@/presentation/styles/global.css'
import '@/presentation/styles/boot.css'

export default function App() {
  return (
    <DependenciesProvider>
      <AuthProvider>
        <PermissionsProvider>
          <AppRouter />
        </PermissionsProvider>
      </AuthProvider>
    </DependenciesProvider>
  )
}
