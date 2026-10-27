import { createLocalePlugin } from '@vuetify/v0'

// Libellés internes de v0 en français (messages imbriqués : la clé `Dialog.close` = { Dialog: { close } }).
// Sans cela, DialogClose retombe sur « Close ». Seule la clé utilisée par l’app est déclarée.
export const createAppLocale = () => createLocalePlugin({ default: 'fr', messages: { fr: { Dialog: { close: 'Fermer' } } } })
