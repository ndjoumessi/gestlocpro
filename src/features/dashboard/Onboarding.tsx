import { useState } from 'react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardHeader } from '@/components/primitives/Card'
import { RadioCards } from '@/components/primitives/Choice'
import { Icon } from '@/components/primitives/Icon'
import { useT } from '@/i18n/I18nProvider'
import type { Role } from '@/features/auth/signupState'

/** Droits par rôle. `false` = action refusée. */
const MATRIX: { key: string; owner: boolean; manager: boolean; tenant: boolean }[] = [
  { key: 'viewAll', owner: true, manager: true, tenant: false },
  /**
   * Les trois gestes ajoutés en constituant le parc.
   *
   * Leurs droits ne sont pas décidés ici : ils RECOPIENT ce que le serveur
   * impose — `exigerRole('owner', 'manager')` sur les trois routes. Une matrice
   * qui annoncerait autre chose que ce que l'API applique serait une brochure,
   * et c'est l'écran qui aurait tort.
   *
   * Déclarer un immeuble ou un logement relève de l'exploitation quotidienne,
   * que le gestionnaire délégué assure. Ce qui lui reste fermé — valider un
   * devis, arbitrer une caution — sont les deux gestes qui engagent l'argent du
   * propriétaire.
   */
  { key: 'addBuilding', owner: true, manager: true, tenant: false },
  { key: 'addUnit', owner: true, manager: true, tenant: false },
  { key: 'issueReceipt', owner: true, manager: true, tenant: false },
  { key: 'ownData', owner: true, manager: true, tenant: true },
  { key: 'recordPayment', owner: true, manager: true, tenant: false },
  { key: 'readMeters', owner: true, manager: true, tenant: false },
  { key: 'quoteWorks', owner: true, manager: true, tenant: false },
  { key: 'approveWorks', owner: true, manager: false, tenant: false },
  { key: 'settleDeposit', owner: true, manager: false, tenant: false },
  { key: 'inviteTenant', owner: true, manager: true, tenant: false },
  { key: 'editPortfolio', owner: true, manager: false, tenant: false },
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

        <div className="overflow-x-auto">
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
                {ROLES.map((role) => (
                  <th
                    key={role}
                    scope="col"
                    className="eyebrow px-4 py-3 text-center font-normal whitespace-nowrap text-muted"
                  >
                    {t(`roles.${role}.name` as 'roles.owner.name')}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {MATRIX.map((row) => {
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
                    {[row.owner, managerAllowed, row.tenant].map((allowed, index) => (
                      <td key={index} className="px-4 py-3 text-center">
                        {/* Forme + libellé caché : la cellule reste lisible
                            sans distinguer les couleurs. */}
                        <Icon
                          name={allowed ? 'checkCircle' : 'close'}
                          size={17}
                          className={allowed ? 'inline text-ok' : 'inline text-muted'}
                        />
                        <span className="sr-only">
                          {allowed ? t('app.onboarding.allowed') : t('app.onboarding.denied')}
                        </span>
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
