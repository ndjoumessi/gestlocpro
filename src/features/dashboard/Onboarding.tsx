import { useState } from 'react'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardHeader } from '@/components/primitives/Card'
import { RadioCards } from '@/components/primitives/Choice'
import { Icon } from '@/components/primitives/Icon'
import { useT } from '@/i18n/I18nProvider'
import type { Role } from '@/features/auth/signupState'

/** Droits par rôle. `false` = action refusée. */
/**
 * Les droits, groupés par FAMILLE.
 *
 * À douze lignes, un tableau à plat cesse de se lire d'un coup : on cherche
 * une action au lieu de comprendre une règle. Le groupement rend la règle
 * visible avant les cases — constituer, exploiter, arbitrer, consulter — et
 * c'est cette progression qui explique la délégation.
 *
 * L'ordre n'est pas décoratif : il suit la vie d'un parc. On le constitue
 * d'abord, on l'exploite ensuite, on arbitre ce qui engage l'argent, et
 * chacun consulte ce qui le regarde.
 *
 * Les droits eux-mêmes RECOPIENT ce que le serveur impose. Une matrice qui
 * annoncerait autre chose que ce que l'API applique serait une brochure.
 */
const FAMILLES: {
  key: string
  rows: { key: string; owner: boolean; manager: boolean; tenant: boolean }[]
}[] = [
  {
    key: 'build',
    rows: [
      { key: 'addBuilding', owner: true, manager: true, tenant: false },
      { key: 'addUnit', owner: true, manager: true, tenant: false },
      { key: 'inviteTenant', owner: true, manager: true, tenant: false },
      { key: 'editPortfolio', owner: true, manager: false, tenant: false },
    ],
  },
  {
    key: 'operate',
    rows: [
      { key: 'recordPayment', owner: true, manager: true, tenant: false },
      { key: 'issueReceipt', owner: true, manager: true, tenant: false },
      { key: 'readMeters', owner: true, manager: true, tenant: false },
      { key: 'quoteWorks', owner: true, manager: true, tenant: false },
    ],
  },
  {
    /**
     * Les deux seuls gestes fermés au gestionnaire délégué.
     *
     * Leur famille porte leur raison d'être : ils engagent l'argent du
     * propriétaire. Les isoler vaut mieux que de laisser le lecteur repérer
     * deux croix perdues au milieu de douze lignes.
     */
    key: 'arbitrate',
    rows: [
      { key: 'approveWorks', owner: true, manager: false, tenant: false },
      { key: 'settleDeposit', owner: true, manager: false, tenant: false },
    ],
  },
  {
    key: 'consult',
    rows: [
      { key: 'viewAll', owner: true, manager: true, tenant: false },
      { key: 'ownData', owner: true, manager: true, tenant: true },
    ],
  },
]

const ROLES: Role[] = ['owner', 'manager', 'tenant']

export function Onboarding() {
  const t = useT()
  /**
   * Le défaut suit l'état du parc démontré, qui **est** délégué : le sélecteur
   * de profil porte « Gestionnaire délégué · Diane F. », et deux écrans lui
   * adressent une note expliquant ce qu'il ne peut pas décider.
   *
   * Il avait un temps été aligné sur le défaut du formulaire d'inscription
   * (`solo`), pour éviter qu'un propriétaire ayant répondu « je gère seul » ne
   * voie l'inverse de sa réponse. C'était se tromper de contradiction : cette
   * réponse n'est jamais transmise — `SignupState` vit dans le parcours
   * d'inscription, n'est ni partagé ni enregistré, et il n'y a pas encore
   * d'authentification pour le rattacher à un compte. Le désaccord corrigé
   * était donc hypothétique, tandis que le coût était réel : en mode `solo`,
   * la colonne « Gestionnaire » est entièrement barrée, et un écran intitulé
   * « délégation des droits » n'enseigne plus rien à qui l'ouvre.
   *
   * En mode délégué, les deux seules lignes refusées au gestionnaire sont
   * valider un devis et arbitrer une caution — précisément la règle appliquée
   * dans `Works` et `Deposits`. C'est ce que l'écran doit montrer d'emblée.
   *
   * Le jour où la réponse d'inscription sera réellement portée jusqu'ici,
   * c'est cette ligne qui la lira.
   */
  const [mode, setMode] = useState<'solo' | 'delegate'>('delegate')

  return (
    <>
      <PageHeader title={t('app.onboarding.title')} description={t('app.onboarding.subtitle')} />

      <Card className="mb-4">
        <RadioCards
          legend={t('auth.signup.management')}
          name="delegation"
          columns={2}
          value={mode}
          onChange={setMode}
          options={[
            {
              value: 'delegate',
              title: t('app.onboarding.delegateOn'),
              description: t('app.onboarding.delegateOnHint'),
              icon: 'users',
            },
            {
              value: 'solo',
              title: t('app.onboarding.delegateOff'),
              description: t('app.onboarding.delegateOffHint'),
              icon: 'shield',
            },
          ]}
        />
      </Card>

      {/* Basculer le mode réécrit neuf lignes de la colonne « Gestionnaire ».
          Un lecteur d'écran entendait la confirmation du bouton radio, puis
          plus rien : la seule conséquence du geste ne lui parvenait jamais. */}
      <p className="sr-only" aria-live="polite">
        {mode === 'delegate'
          ? t('app.onboarding.matrixDelegated')
          : t('app.onboarding.matrixSolo')}
      </p>

      <Card flush>
        <div className="p-4 sm:p-5">
          <CardHeader title={t('app.onboarding.matrixTitle')} level={2} className="mb-0" />
        </div>

        {/* `relative` n'est pas décoratif : sans lui, le tableau fait défiler
            la PAGE entière de 268px sur un écran de 375.
            Chaque case de la matrice porte un `sr-only`, donc un
            `position: absolute`. Une boîte de défilement ne rogne que les
            absolus dont elle est le bloc conteneur — statique, elle ne l'est
            pour aucun d'eux. Les trente-sept `sr-only` restaient donc posés à
            leur place d'origine, jusqu'à x=687, hors de portée du
            `overflow-x-auto` qui croyait les contenir. Invisibles, et
            pourtant seuls responsables du défilement horizontal.
            Même mécanisme que celui documenté dans `Charts.tsx` sur la table
            alternative du graphe — la leçon y avait été tirée, pas ici. */}
        <div className="relative overflow-x-auto">
          {/* Le `<caption>` répétait le titre rendu juste au-dessus : un
              lecteur d'écran entendait « Matrice des droits » deux fois. Il
              porte maintenant ce que le titre visible ne dit pas. */}
          <table className="w-full border-collapse text-body">
            <caption className="sr-only">{t('app.onboarding.matrixCaption')}</caption>
            <thead>
              <tr className="border-y border-divider bg-surface-sunken">
                <th scope="col" className="eyebrow px-4 py-3 text-left font-normal text-muted">
                  {t('app.onboarding.capability')}
                </th>
                {ROLES.map((role) => {
                  /**
                   * En gestion seule, la colonne du gestionnaire est neutralisée
                   * plutôt que remplie de refus.
                   *
                   * Douze croix identiques occupaient un tiers du tableau pour
                   * ne transmettre qu'une seule information — « ce rôle n'existe
                   * pas dans votre configuration » — et elles étaient ambiguës :
                   * on pouvait les lire « votre gestionnaire n'a pas ce droit »
                   * alors qu'elles disent « vous n'avez pas de gestionnaire ».
                   *
                   * La colonne reste affichée : elle montre ce que la
                   * délégation rendrait possible. C'est un argument, pas une
                   * liste de refus — et le retirer priverait de cette
                   * comparaison le propriétaire qui hésite encore.
                   */
                  const inactive = role === 'manager' && mode !== 'delegate'
                  return (
                    <th
                      key={role}
                      scope="col"
                      className={cn(
                        'eyebrow px-4 py-3 text-center font-normal whitespace-nowrap',
                        inactive ? 'text-muted/60' : 'text-muted',
                      )}
                    >
                      {t(`roles.${role}.name` as 'roles.owner.name')}
                      {inactive && (
                        <span className="mt-0.5 block text-caps normal-case">
                          {t('app.onboarding.managerOff')}
                        </span>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>

            {FAMILLES.map((famille) => (
            <tbody key={famille.key}>
              {/* Un `<tbody>` par famille, et son intitulé en ligne d'en-tête :
                  le groupement est ainsi porté par la STRUCTURE du tableau, et
                  non par un simple espacement qu'un lecteur d'écran ignorerait. */}
              <tr className="border-y border-divider bg-surface-sunken">
                <th
                  scope="colgroup"
                  colSpan={ROLES.length + 1}
                  className="eyebrow px-4 py-2 text-left font-normal text-muted"
                >
                  {t(`app.onboarding.families.${famille.key}` as 'app.onboarding.families.build')}
                </th>
              </tr>
              {famille.rows.map((row) => {
                // En gestion non déléguée, le propriétaire cumule les droits du
                // gestionnaire : la colonne « Gestionnaire » perd son sens.
                const managerAllowed = mode === 'delegate' ? row.manager : false

                return (
                  <tr key={row.key} className="border-b border-divider last:border-0">
                    <th
                      scope="row"
                      className="px-4 py-3 text-left font-normal whitespace-nowrap"
                    >
                      {t(`app.onboarding.caps.${row.key}` as 'app.onboarding.caps.viewAll')}
                    </th>
                    {[row.owner, managerAllowed, row.tenant].map((allowed, index) => {
                      /**
                       * La colonne du gestionnaire inactive porte un tiret, pas
                       * une croix.
                       *
                       * Une croix répond « non » à une question qui ne se pose
                       * pas : il n'y a pas de gestionnaire à qui refuser quoi
                       * que ce soit. Le tiret dit « sans objet », et le libellé
                       * caché le dit en toutes lettres à qui écoute la page.
                       */
                      const sansObjet = index === 1 && mode !== 'delegate'
                      return (
                        <td
                          key={index}
                          className={cn('px-4 py-3 text-center', sansObjet && 'opacity-45')}
                        >
                          {sansObjet ? (
                            <span aria-hidden="true" className="text-muted">
                              —
                            </span>
                          ) : (
                            /* Forme + libellé caché : la cellule reste lisible
                               sans distinguer les couleurs. */
                            <Icon
                              name={allowed ? 'checkCircle' : 'close'}
                              size={17}
                              className={allowed ? 'inline text-ok' : 'inline text-muted'}
                            />
                          )}
                          <span className="sr-only">
                            {sansObjet
                              ? t('app.onboarding.managerOff')
                              : allowed
                                ? t('app.onboarding.allowed')
                                : t('app.onboarding.denied')}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
            ))}
          </table>
        </div>

        {/* La note remplace douze refus par une phrase, et transforme la
            colonne en argument : voici ce que la délégation rendrait possible.
            Elle ne s'affiche qu'en gestion seule — la répéter en gestion
            déléguée serait du bruit. */}
        {mode !== 'delegate' && (
          <p className="border-t border-divider px-4 py-3 text-body-s text-muted sm:px-5">
            {t('app.onboarding.managerOffNote')}
          </p>
        )}
      </Card>
    </>
  )
}
