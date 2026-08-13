import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import {
  createAppDependencies,
  type AppDependencies,
} from '@/application/composition/CompositionRoot'

const DependenciesContext = createContext<AppDependencies | null>(null)

export function DependenciesProvider({ children }: { children: ReactNode }) {
  const dependencies = useMemo(() => createAppDependencies(), [])

  return (
    <DependenciesContext.Provider value={dependencies}>
      {children}
    </DependenciesContext.Provider>
  )
}

export function useDependencies(): AppDependencies {
  const value = useContext(DependenciesContext)
  if (!value) {
    throw new Error('useDependencies debe usarse dentro de DependenciesProvider')
  }
  return value
}
