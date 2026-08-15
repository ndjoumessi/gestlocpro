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

      <Card flush>
        <div className="p-4 sm:p-5">
          <CardHeader title={t('app.onboarding.matrixTitle')} level={2} className="mb-0" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-body">
            <caption className="sr-only">{t('app.onboarding.matrixTitle')}</caption>
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
