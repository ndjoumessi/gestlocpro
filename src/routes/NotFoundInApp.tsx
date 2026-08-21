import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/primitives/Button'
import { useT } from '@/i18n/I18nProvider'
import { AttemptedPath } from './AttemptedPath'

/**
 * Adresse inconnue à l'intérieur de l'espace de gestion : la coque est gardée.
 *
 * SÉPARÉ de `NotFound.tsx` (l'écran public) depuis ce lot : ce fichier n'a
 * qu'un seul consommateur, `src/app/EspaceApplicatif.tsx`, et c'est
 * précisément ce qui permet à la règle de fuite de `mesure-ui.mjs` de le
 * vérifier sans exception — un module qui n'a qu'un public ne peut pas être
 * un faux positif.
 */
export function NotFoundInApp() {
  const t = useT()

  return (
    <>
      <PageHeader
        title={t('notFound.appTitle')}
        description={t('notFound.appBody')}
        actions={
          <Button to="/app" iconAfter="arrowRight">
            {t('notFound.appAction')}
          </Button>
        }
      />
      <div className="max-w-lg">
        <AttemptedPath />
      </div>
    </>
  )
}
