import { NamedCatalogPage } from '@/presentation/pages/NamedCatalogPage'
import { useDependencies } from '@/presentation/providers/DependenciesProvider'

export function LocalidadesPage() {
  const { catalogLocalidadesUseCase } = useDependencies()
  return (
    <NamedCatalogPage
      title="Localidades"
      eyebrow="Organización"
      description="Catálogo de localidades. Se usa en Recursos Humanos."
      createLabel="Nueva localidad"
      itemLabel="localidad"
      useCase={catalogLocalidadesUseCase}
    />
  )
}
