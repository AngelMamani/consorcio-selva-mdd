import { NamedCatalogPage } from '@/presentation/pages/NamedCatalogPage'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'

export function LocalidadesPage() {
  const { catalogLocalidadesUseCase } = useDependencies()
  return (
    <NamedCatalogPage
      title="Localidades"
      eyebrow="Personal"
      description="Catálogo de localidades. Se usa en la relación de personal."
      createLabel="Nueva localidad"
      itemLabel="localidad"
      useCase={catalogLocalidadesUseCase}
    />
  )
}
