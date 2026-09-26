import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { GOUTTIERE_LATERALE } from '@/components/layout/gouttiere'
import { SommaireDesRubriques } from '@/components/layout/SommaireDesRubriques'
import { Logo } from '@/components/primitives/Logo'
import { PanneauDeReglages } from '@/components/controls/PanneauDeReglages'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { EDITEUR } from '@/legal/editeur'
import { COOKIE_DE_SESSION, RELEVE_LE, SOUS_TRAITANTS } from '@/legal/confidentialite'

/**
 * LA POLITIQUE DE CONFIDENTIALITÉ — la deuxième page juridique, et la plus
 * attendue : la case de l'inscription faisait déjà accepter une « politique de
 * confidentialité » qui n'existait pas.
 *
 * Elle ne dit que ce que le produit fait, relevé dans son code et chez son
 * hébergeur le 2026-09-13 : voir `src/legal/confidentialite.ts`, qui porte les
 * faits et d'où ils viennent, et `confidentialite.test.tsx`, qui en garde ce qui
 * se garde — le cookie, chaque clé du navigateur, les prestataires absents.
 *
 * Même en-tête et même gabarit que les mentions légales : deux pages juridiques
 * qui ne se ressemblent pas laissent croire qu'elles ne viennent pas du même
 * éditeur.
 */
/**
 * LES NEUF RUBRIQUES, DANS L'ORDRE DU DOCUMENT — même rôle et même garde que
 * la table des conditions générales : elle sert au sommaire, et un cas la
 * compare aux rubriques réellement rendues pour qu'un ajout d'un seul côté
 * rougisse.
 */
const RUBRIQUES = [
  ['controleur', 'privacy.controller.title'],
  ['roles', 'privacy.roles.title'],
  ['donnees', 'privacy.data.title'],
  ['finalites', 'privacy.purposes.title'],
  ['destinataires', 'privacy.recipients.title'],
  ['transferts', 'privacy.transfers.title'],
  ['conservation', 'privacy.retention.title'],
  ['stockage', 'privacy.storage.title'],
  ['droits', 'privacy.rights.title'],
] as const

export function Confidentialite() {
  const t = useT()
  const d = useDates()
  useDocumentTitle(t('privacy.title'))
  /* La forme juridique est une valeur du registre français : dans la page
     anglaise, elle doit se déclarer `lang="fr"`, comme sur les mentions légales.
     `{form}` est laissé sans valeur — `interpolate` rend alors le jeton intact —
     et la phrase se coupe dessus : chaque langue garde UNE phrase, dans son
     ordre à elle, au lieu de trois fragments à recoller. */
  const [avantLaForme, apresLaForme] = t('privacy.controller.body', {
    name: EDITEUR.entrepreneur,
    siren: EDITEUR.siren,
  }).split('{form}')

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header
        className={cn(
          'flex flex-wrap items-center gap-4 border-b border-border',
          'pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3',
          'pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]',
          'sm:pl-[max(2rem,env(safe-area-inset-left))] sm:pr-[max(2rem,env(safe-area-inset-right))]',
        )}
      >
        <Logo />
        <PanneauDeReglages className="ml-auto" />
      </header>

      <main className={cn('flex-1 py-12', GOUTTIERE_LATERALE)}>
        <div className="mx-auto w-full max-w-2xl">
          <h1 className="display-m text-balance">{t('privacy.title')}</h1>
          <p className="mt-4 text-body-l text-pretty text-muted">{t('privacy.intro')}</p>
          <p className="mt-2 text-label text-muted">
            {t('privacy.updatedOn', { date: d.fullDate(RELEVE_LE) })}
          </p>

          <SommaireDesRubriques
            libelle={t('legal.contents')}
            prefixe="confidentialite"
            rubriques={RUBRIQUES.map(([ancre, cle]) => ({
              ancre,
              titre: t(cle as 'privacy.controller.title'),
            }))}
          />

          <Rubrique id="controleur" titre={t('privacy.controller.title')}>
            <p>
              {avantLaForme}
              <span lang="fr">{EDITEUR.forme}</span>
              {apresLaForme}
            </p>
            <address className="mt-2 not-italic" lang="fr">
              {EDITEUR.adresse.map((ligne) => (
                <span key={ligne} className="block">
                  {ligne}
                </span>
              ))}
            </address>
            <p className="mt-2">
              {t('privacy.controller.email')}{' '}
              <a
                href={`mailto:${EDITEUR.courriel}`}
                className="-my-2 inline-flex min-h-11 items-center text-accent-ink underline underline-offset-4"
              >
                {EDITEUR.courriel}
              </a>
            </p>
          </Rubrique>

          <Rubrique id="roles" titre={t('privacy.roles.title')}>
            <p>{t('privacy.roles.account')}</p>
            <p className="mt-3">{t('privacy.roles.rental')}</p>
          </Rubrique>

          <Rubrique id="donnees" titre={t('privacy.data.title')}>
            <Liste
              items={[
                t('privacy.data.account'),
                t('privacy.data.sessions'),
                t('privacy.data.rental'),
                t('privacy.data.audit'),
              ]}
            />
            <p className="mt-3">{t('privacy.data.none')}</p>
          </Rubrique>

          <Rubrique id="finalites" titre={t('privacy.purposes.title')}>
            <Liste
              items={[
                t('privacy.purposes.service'),
                t('privacy.purposes.security'),
                t('privacy.purposes.newsletter'),
              ]}
            />
            <p className="mt-3">{t('privacy.purposes.noTracking')}</p>
          </Rubrique>

          <Rubrique id="destinataires" titre={t('privacy.recipients.title')}>
            <p>{t('privacy.recipients.intro')}</p>
            <ul className="mt-3 divide-y divide-divider border-y border-divider">
              {SOUS_TRAITANTS.map((sousTraitant) => (
                <li key={sousTraitant.cle} className="py-3">
                  {/* Une raison sociale se cite : en anglais, et déclarée telle. */}
                  <span lang="en" className="block font-semibold">
                    {sousTraitant.nom}
                  </span>
                  <span className="block text-muted">
                    {t(`privacy.recipients.${sousTraitant.role}`)} · {t(`privacy.recipients.${sousTraitant.pays}`)}
                  </span>
                </li>
              ))}
            </ul>
          </Rubrique>

          <Rubrique id="transferts" titre={t('privacy.transfers.title')}>
            <p>{t('privacy.transfers.body')}</p>
          </Rubrique>

          <Rubrique id="conservation" titre={t('privacy.retention.title')}>
            <p>{t('privacy.retention.body')}</p>
            <p className="mt-3">{t('privacy.retention.onRequest')}</p>
          </Rubrique>

          <Rubrique id="stockage" titre={t('privacy.storage.title')}>
            {/* Le nom du cookie est une valeur technique : rendu tel quel, hors
                de la phrase traduite. PAS en chasse fixe — le produit l'a retirée,
                et `chasseFixe.test.ts` le tient. */}
            <p>
              {t('privacy.storage.cookieLead')} <span className="font-semibold">{COOKIE_DE_SESSION}</span>.{' '}
              {t('privacy.storage.cookieBody')}
            </p>
            <p className="mt-3">{t('privacy.storage.preferences')}</p>
            <p className="mt-3">{t('privacy.storage.login')}</p>
            <p className="mt-3">{t('privacy.storage.demo')}</p>
          </Rubrique>

          <Rubrique id="droits" titre={t('privacy.rights.title')}>
            <p>{t('privacy.rights.body')}</p>
            <p className="mt-3">
              {t('privacy.rights.complaint')}{' '}
              <a
                href="https://www.cnil.fr/fr/plaintes"
                className="-my-2 inline-flex min-h-11 items-center text-accent-ink underline underline-offset-4"
              >
                {t('privacy.rights.complaintLink')}
              </a>
            </p>
          </Rubrique>

          <div className="mt-10">
            <Link
              to="/"
              className="-ml-2 inline-flex min-h-11 items-center rounded-md px-2 text-body font-semibold text-accent-ink transition-colors duration-150 hover:bg-surface-sunken hover:text-accent-ink-hover"
            >
              {t('privacy.home')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

/** Une rubrique nommée par son titre : un lecteur d'écran la liste parmi les régions. */
function Rubrique({ id, titre, children }: { id: string; titre: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`confidentialite-${id}`} className="mt-10">
      {/* `scroll-mt-6` : voir la rubrique des conditions générales — une cible
          d'ancre collée au bord haut se lit comme une page coupée. */}
      <h2 id={`confidentialite-${id}`} className="title-m scroll-mt-6">
        {titre}
      </h2>
      <div className="mt-3 text-body text-pretty">{children}</div>
    </section>
  )
}

function Liste({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}
