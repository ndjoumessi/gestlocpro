import { useId, useState } from 'react'
import { DansUnCadre } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { Icon } from '@/components/primitives/Icon'
import { Logo } from '@/components/primitives/Logo'
import { cn } from '@/lib/cn'
import { useOngletsAuClavier } from '@/components/primitives/ongletsAuClavier'
import { useT } from '@/i18n/I18nProvider'
import { DEMO_TENANT_UNIT, UNITS } from '@/data/portfolio'
import { TenantDashboard } from './TenantDashboard'
import { TenantDocuments } from './TenantDocuments'
import { Signaler } from './Signaler'

/**
 * TROIS onglets, et non cinq.
 *
 * « Mes paiements » et « Travaux » étaient des destinations ; les maquettes en
 * font deux cartes de « Mon espace », et elles ont raison : le locataire ouvre
 * son portail pour savoir où il en est, pas pour choisir entre cinq rubriques.
 * Ce qu'il cherche — le loyer du mois, l'historique, les travaux en cours —
 * tient sur un écran, et le reste (ses pièces, un incident à déclarer) sont
 * les deux seules vraies bifurcations.
 */
const TABS = ['space', 'documents', 'report'] as const
type Tab = (typeof TABS)[number]

/**
 * Pastilles du chrome de navigateur — voir `--chrome-dot-*` dans `tokens.css`.
 * Elles ressemblent au trio de statut mais n'en sont pas : ce décor ne doit
 * suivre ni `--color-danger`, ni `--color-warn`, ni `--color-ok`.
 */
const CHROME_DOTS = ['var(--chrome-dot-1)', 'var(--chrome-dot-2)', 'var(--chrome-dot-3)'] as const

/**
 * L'adresse affichée dans le chrome suit l'onglet.
 *
 * Elle était figée sur « /mon-espace » : la fenêtre prétendait donc être sur
 * l'espace du locataire alors qu'on lisait ses documents. Un cadre de
 * navigateur dont l'URL ment sur son contenu vaut moins que pas de cadre.
 *
 * Les chemins restent traduits — c'est ce que corrigeait déjà l'ancienne clé
 * `demoUrl`, dont le garde-fou d'accents ne pouvait rien voir.
 */
const URL_PAR_ONGLET = {
  space: 'app.portal.urlSpace',
  documents: 'app.portal.urlDocuments',
  report: 'app.portal.urlReport',
} as const

/**
 * « Charles Ngassa » → initiales « CN », nom court « Charles N. ».
 *
 * Les deux étaient écrits en dur dans la barre — l'unité affichée pouvait
 * changer sans que le nom bouge, exactement le défaut déjà corrigé pour le nom
 * de l'immeuble. On les dérive donc du locataire de l'unité.
 */
function identite(nom: string | null) {
  const mots = (nom ?? '').trim().split(/\s+/).filter(Boolean)
  const premier = mots[0] ?? ''
  const dernier = mots.length > 1 ? mots[mots.length - 1] : ''
  return {
    initiales: `${premier[0] ?? ''}${dernier[0] ?? ''}`.toUpperCase(),
    court: dernier ? `${premier} ${dernier[0]}.` : premier,
  }
}

/**
 * Portail locataire, présenté dans un cadre de navigateur : c'est une
 * prévisualisation destinée au propriétaire, pas l'écran réel du locataire.
 * Le cadre évite l'ambiguïté — sans lui, on croirait avoir changé d'application.
 */
export function TenantPortal() {
  const t = useT()
  const [tab, setTab] = useState<Tab>('space')

  /** Préfixe des identifiants qui lient onglets et panneau. */
  const tabsId = useId()

  /* Le clavier de la rangée — flèches, Home, End, sélection suivant le focus,
     bornage aux extrémités — vit dans `useOngletsAuClavier`, qui porte aussi le
     raisonnement de chacun de ces choix. Il a été extrait d'ICI le jour où la
     grille de tarifs a eu besoin de la même rangée. */
  const { auClavier, referencer } = useOngletsAuClavier(TABS, setTab)

  // L'unité de démonstration ne sert plus qu'au DÉCOR d'identité de la barre :
  // les écrans montés vont chercher la leur par le fournisseur.
  const unit = UNITS.find((u) => u.id === DEMO_TENANT_UNIT)!
  const { initiales, court } = identite(unit.tenant)

  return (
    <>
      <PageHeader title={t('app.portal.title')} description={t('app.portal.subtitle')} />

      <div className="overflow-hidden rounded-lg border border-border-strong bg-surface-sunken shadow-e2">
        {/* Chrome de navigateur */}
        <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5">
          <span aria-hidden="true" className="flex gap-1.5">
            {CHROME_DOTS.map((dot) => (
              <span key={dot} className="size-2.5 rounded-full" style={{ background: dot }} />
            ))}
          </span>
          {/* `min-w-0` : sans lui, cet enfant de la rangée flexible ne
              descend jamais sous la largeur de son propre texte — le plancher
              par défaut d'un item flexible est son contenu, pas zéro — et
              `truncate` ne rognait donc rien. À 320-375px l'adresse la plus
              longue (`portail.gestlocpro.com/documents`) débordait de la
              barre sans le point de suspension qui dirait qu'elle est
              coupée ; seul le cadre arrondi l'empêchait de pousser la page. */}
          <span className="numeric min-w-0 truncate rounded-md bg-surface-sunken px-3 py-1 text-caps text-muted">
            {t(URL_PAR_ONGLET[tab])}
          </span>
        </div>

        <div className="bg-canvas">
          {/* Barre de navigation du portail — UN seul bandeau.
              Le logo vivait dans un bandeau clair, les onglets dans un second
              juste en dessous : deux règles horizontales pour une seule barre,
              là où les maquettes n'en montrent qu'une, sombre.

              Les libellés emploient `text-on-dark` / `text-on-dark-muted` EN
              TOUTES LETTRES, et non `text-ink` / `text-muted` en comptant sur
              le remappage de `.on-dark`. Ce remappage est écrit
              `:not([class*='bg-'])` : il se retire de lui-même dès que
              l'élément porte son propre fond — ce qui est exactement le cas de
              l'onglet actif et du survol. S'appuyer dessus rendait le libellé
              actif invisible, encre #131a22 sur barre #131a22.

              La pastille d'initiales, elle, ne demande plus rien à la cascade :
              elle NOMME son premier plan, `text-on-accent`, qui vaut blanc dans
              les deux thèmes. Une règle refixait autrefois `--color-ink` sur
              l'aplat d'accent — c'est ce que la clause `bg-` mettait à l'abri —
              parce que l'or de marque d'alors ne pouvait porter que de l'encre
              sombre ; le bleu qui lui a succédé porte du blanc, la règle a
              disparu avec sa cause, et la pastille n'a donc plus aucun
              remappage à protéger. */}
          <div className="on-dark flex flex-wrap items-center gap-x-2 gap-y-1 bg-ink px-4 pt-3">
            <Logo to="" size="sm" tone="dark" className="mr-4 mb-3" />

            {/* Onglets — motif ARIA COMPLET, et non ses seuls rôles.
                `role="tab"` annonce au lecteur d'écran une navigation aux
                flèches ; la déclarer sans la câbler promet une commande qui
                n'existe pas, ce qui est pire qu'une rangée de boutons ordinaires.
                Le motif est donc tenu en entier : flèches, Début/Fin, `tabindex`
                roulant, `aria-controls` et le panneau qui répond.

                Le contenu s'y prête — trois vues exclusives d'un même dossier,
                pas trois destinations —, donc on l'implémente plutôt que de
                retirer les rôles.

                BORNAGE et non bouclage, comme `Combobox` : c'est la convention
                du dépôt, et sur trois entrées visibles d'un coup, revenir au
                début en poussant à droite se lit comme un raté. */}
            <div
              role="tablist"
              aria-label={t('app.portal.title')}
              className="flex gap-2 overflow-x-auto"
            >
              {TABS.map((value, index) => {
                const active = tab === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    id={`${tabsId}-tab-${value}`}
                    aria-selected={active}
                    aria-controls={`${tabsId}-panel-${value}`}
                    // Un seul arrêt de tabulation pour tout le groupe : la
                    // tabulation atteint le contenu du panneau, elle ne traverse
                    // pas trois onglets pour y arriver.
                    tabIndex={active ? 0 : -1}
                    ref={(node) => referencer(index, node)}
                    onClick={() => setTab(value)}
                    onKeyDown={(e) => auClavier(e, index)}
                    className={cn(
                      'inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-t-lg border-b-2 px-4',
                      'text-label font-semibold transition-colors duration-150',
                      active
                        ? /* Cette barre est le SEUL repère de l'onglet courant :
                             c'est de la DONNÉE, elle doit tenir 3:1.

                             `accent-on-dark` et non `accent-ink`, et la garde
                             l'a exigé avant moi. `accent-ink` est le bleu des
                             LIENS SUR FOND CLAIR — il est sombre par
                             construction, et posé sur l'encre figée de
                             `.on-dark` il ne rendait que 2,61. Le jeton qui
                             convient est celui qui existe pour les panneaux
                             figés, clair dans les DEUX thèmes : 8,98. */
                          'border-accent-on-dark bg-on-dark-hover text-on-dark'
                        : 'border-transparent text-on-dark-muted hover:bg-on-dark-hover hover:text-on-dark',
                    )}
                  >
                    {t(`app.portal.${value}` as 'app.portal.space')}
                  </button>
                )
              })}
            </div>

            {/* Cloche et pastille : DÉCOR, au même titre que les trois points du
                chrome. Le portail de démonstration n'a pas de file de
                notifications à ouvrir — en faire un bouton promettrait un
                panneau qui n'existe pas, le défaut que les « Télécharger » de
                l'onglet Documents ont déjà coûté une fois. */}
            <div aria-hidden="true" className="ml-auto mb-3 flex items-center gap-3">
              <span className="relative flex size-9 items-center justify-center rounded-lg bg-on-dark-hover">
                <Icon name="bell" size={18} className="text-ink" />
                <span className="absolute top-2 right-2 size-1.5 rounded-full bg-danger" />
              </span>
              <span className="flex size-8 items-center justify-center rounded-full bg-accent text-label font-semibold text-on-accent">
                {initiales}
              </span>
              <span className="hidden text-label font-medium text-ink sm:inline">{court}</span>
            </div>
          </div>

          <div
            id={`${tabsId}-panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`${tabsId}-tab-${tab}`}
            // Le panneau n'est pas focalisable : ses trois vues contiennent
            // toutes au moins un élément atteignable au clavier, et la
            // tabulation depuis l'onglet actif y entre directement.
            //
            // Il DÉFILE en interne. L'espace du locataire fait plusieurs écrans
            // de haut : sans borne, le cadre perdait son bord inférieur bien
            // avant la fin, et une fenêtre sans bas n'est plus une fenêtre.
            // C'est d'ailleurs ce que fait un vrai navigateur.
            className="max-h-[70vh] overflow-y-auto p-5"
          >
            {/*
              LES VRAIS ÉCRANS, et non une copie.

              Les trois panneaux redéveloppaient ce que le produit rend déjà.
              Une copie ne se met pas à jour : la grille par période, le dossier
              du logement, le détail des états des lieux et la consommation sur
              douze mois l'ont tous contournée. Elle avait même DIVERGÉ — quatre
              corps de métier là où `TRADES_REPORTABLE` en compte cinq, et des
              urgences que le produit ne connaît nulle part. Le propriétaire
              montrait à son locataire un formulaire dont les valeurs n'existent
              pas.
            */}
            <DansUnCadre>
              {tab === 'space' && <TenantDashboard />}
              {tab === 'documents' && <TenantDocuments />}
              {tab === 'report' && <Signaler />}
            </DansUnCadre>
          </div>
        </div>
      </div>
    </>
  )
}
