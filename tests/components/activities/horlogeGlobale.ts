// À importer EN PREMIER dans un test d’activité : les fausses horloges doivent exister avant que Motion ne capture `requestAnimationFrame`
// (il le lit à l’import) ; sans cela, ses rendus tournent sur la vraie horloge et les positions lues dans le DOM sont périmées.
import { vi } from 'vitest'

vi.useFakeTimers()
