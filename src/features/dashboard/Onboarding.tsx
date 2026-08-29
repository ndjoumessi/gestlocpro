import { useState } from 'react'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader } from '@/components/primitives/Card'
import { RadioCards } from '@/components/primitives/Choice'
import { Icon } from '@/components/primitives/Icon'
import { useT } from '@/i18n/I18nProvider'
import { lien, useBase } from '@/lib/base'
import type { Role } from '@/features/auth/signupState'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input } from '@/components/primitives/Input'
import { useToast } from '@/components/primitives/Toast'
import { useSession } from '@/api/SessionProvider'
import { api } from '@/api/client'
import { formatInviteCode, validateInviteCode } from '@/features/auth/validation'

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

/**
 * Rejoindre un parc quand on a DÉJÀ un compte.
 *
 * Le code d'invitation ne se consommait qu'à l'inscription. Un compte existant —
 * celui d'un invité dont le code n'était jamais parti — n'avait aucune porte :
 * l'invitation restait valable et inutilisable, et son porteur se retrouvait
 * propriétaire d'un parc vide.
 *
 * Posé ici, sur « Prise en main et droits », parce que c'est l'écran qu'on
 * ouvre quand on ne comprend pas où l'on est.
 */
function RejoindreUnParc() {
  const t = useT()
  const { notify } = useToast()
  const { etat, rafraichir } = useSession()
  const [code, setCode] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  /**
   * Rien à rejoindre quand on appartient DÉJÀ à un parc.
   *
   * Posée sans condition, la carte s'affichait chez le propriétaire — qui a
   * fondé son parc et n'a aucun code à saisir. Elle lui proposait un geste sans
   * objet sur l'écran censé lui expliquer ses droits, ce qui est le contraire de
   * son propos.
   */
  if (etat.statut !== 'connecte' || etat.adhesions.length > 0) return null

  return (
    <Card className="mt-6 flex flex-col gap-4">
      {/*
        `CardHeader` PLUTÔT QU'UN EN-TÊTE ÉCRIT À LA MAIN.

        Il était recopié — un `<h2>` et un paragraphe gris — dans un fichier qui
        importe et appelle `CardHeader` quelques dizaines de lignes plus bas. La
        copie avait dérivé dans les deux sens : elle perdait `text-balance`, et
        elle ajoutait `font-semibold` alors que l'utilitaire `title-m` déclare
        déjà cette graisse. C'était le seul site du dépôt à poser une graisse en
        ligne à côté d'un rôle de titre — ce que `graisses.test.ts` interdit
        depuis toujours, et qu'il ne voyait pas parce qu'il ne connaissait que
        l'autre orthographe de l'utilitaire.
      */}
      <CardHeader
        title={t('app.onboarding.joinTitle')}
        description={t('app.onboarding.joinBody')}
        className="mb-0"
      />
      <Field
        label={t('auth.signup.inviteCode')}
        {...(erreur ? { error: erreur } : {})}
      >
        {(props) => (
          <Input
            {...props}
            name="joinCode"
            autoCapitalize="characters"
            /*
              LE PLACEHOLDER VIENT DU DICTIONNAIRE, comme partout ailleurs.

              Il était écrit en dur — le seul littéral non traduit de cet écran —
              et il divergeait de celui de l'inscription : « LOC-XXXX-XXXX »
              ici, la forme réelle là-bas. Deux gabarits pour un même code.
            */
            placeholder={t('auth.signup.inviteCodePlaceholder')}
            value={code}
            invalid={Boolean(erreur)}
            /*
              LA SAISIE EST REGROUPÉE AU FIL DE LA FRAPPE, comme à l'inscription.

              Elle partait telle quelle. Le serveur, lui, normalise par
              `trim().toUpperCase().replace(/\s+/g, '')` et NE RÉTABLIT PAS les
              tirets : « loc4a7b92cd » devient « LOC4A7B92CD », qui ne
              correspond à aucun code stocké. Le même code, tapé de la même
              façon, ouvrait donc un compte à l'inscription et se faisait
              refuser une adhésion ici — et l'utilisateur en concluait que son
              code était mauvais.

              `formatInviteCode` existait, exporté, employé par `SignUp`. Il n'y
              avait rien à écrire.
            */
            onChange={(e) => {
              setCode(formatInviteCode(e.target.value))
              setErreur(null)
            }}
          />
        )}
      </Field>
      <div>
        <Button
          /* LA MÊME BORNE QUE L'INSCRIPTION, et non un seuil local de quatre
             caractères : `validateInviteCode` connaît la forme exacte du code,
             préfixe compris. Un seuil inventé ici laisserait partir « LOC- »
             seul, pour un aller-retour dont la réponse est déjà connue. */
          disabled={envoi || validateInviteCode(code) !== null}
          onClick={async () => {
            setEnvoi(true)
            try {
              await api.joinPark(code.trim())
              // La session porte les adhésions : sans relecture, l'écran
              // resterait sur celles d'avant et le parc rejoint n'apparaîtrait
              // qu'au prochain rechargement.
              await rafraichir()
              notify(t('app.onboarding.joined'), { tone: 'ok' })
              setCode('')
            } catch {
              setErreur(t('app.onboarding.joinRefused'))
            } finally {
              setEnvoi(false)
            }
          }}
        >
          {t('app.onboarding.join')}
        </Button>
      </div>
    </Card>
  )
}

export function Onboarding() {
  const t = useT()
  const base = useBase()
  const { adhesionActive, estDemo } = useSession()

  /**
   * CET ÉCRAN EXPLIQUE, IL NE RÈGLE PLUS.
   *
   * Il écrivait `Park.delegation` alors que `ParkSettingsModal` corrigeait déjà
   * le nom, le pays et la devise : deux endroits réglaient le parc, avec deux
   * contrôles d'apparence identique dont un seul enregistrait. Le réglage a
   * rejoint les trois autres — ce sont les quatre choses qu'un parc EST — et
   * cette page redevient ce qu'elle a toujours été, la matrice des droits et ce
   * qu'elle enseigne.
   *
   * DÉRIVÉ et non figé : un `useState` initialisé depuis l'adhésion ne se
   * réexécute pas au montage suivant, et changer de parc dans le sélecteur
   * laisserait la politique du précédent à l'écran — le défaut qu'`Alerts` a
   * corrigé sur le rôle.
   *
   * `?? 'delegate'` couvre un serveur antérieur au champ : c'est le défaut du
   * schéma, et le supposer `solo` barrerait toute la colonne « Gestionnaire »
   * d'un parc qui délègue.
   */
  const [modeDemo, setModeDemo] = useState<'solo' | 'delegate'>('delegate')
  const surUnVraiParc = !estDemo && adhesionActive !== null
  const mode = surUnVraiParc ? (adhesionActive.delegation ?? 'delegate') : modeDemo

  return (
    <>
      <PageHeader title={t('app.onboarding.title')} description={t('app.onboarding.subtitle')} />

      {/* SANS ESPACEUR. `RejoindreUnParc` rend `null` dès qu'on appartient à
            un parc — la quasi-totalité des visiteurs de cet écran — et son
            enveloppe, elle, gardait ses 24 px de marge. Un blanc qui ne sépare
            rien de rien. La carte porte sa propre marge quand elle existe. */}
        <RejoindreUnParc />

      <Card className="mb-4">
        {/*
          SUR UN VRAI PARC : ce que la politique EST, et où elle se change.

          Pas de contrôle ici. Un second sélecteur, identique à celui des
          réglages mais sans effet — ou pire, avec le même effet depuis deux
          écrans — laisse deviner lequel fait foi. La phrase nomme le mode en
          cours et renvoie au seul endroit qui l'écrit.
        */}
        {surUnVraiParc ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-label font-semibold text-ink">
                {mode === 'delegate'
                  ? t('app.onboarding.delegateOn')
                  : t('app.onboarding.delegateOff')}
              </p>
              <p className="mt-1 text-body text-muted">
                {mode === 'delegate'
                  ? t('app.onboarding.delegateOnHint')
                  : t('app.onboarding.delegateOffHint')}
              </p>
            </div>
            {/* Un LIEN et non un bouton d'action : rien n'est décidé ici, on se
                déplace. Même partition que l'issue des notifications. */}
            <Button to={lien(base, 'parc')} variant="secondary" size="sm" iconAfter="arrowRight">
              {t('app.onboarding.changeInSettings')}
            </Button>
          </div>
        ) : (
          /*
            EN DÉMONSTRATION, la bascule reste — et elle n'écrit rien.

            Il n'y a pas de parc où enregistrer, et c'est justement le seul
            contexte où basculer le mode a une valeur pédagogique : on montre en
            deux clics ce que la délégation retire au gestionnaire. Le contrôle
            n'existe donc que là où il ne peut mentir sur ce qu'il fait.
          */
          <RadioCards
            legend={t('auth.signup.management')}
            name="delegation"
            columns={2}
            value={mode}
            onChange={setModeDemo}
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
        )}
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
          {/*
            LA LÉGENDE SORT DU `<caption>` ET SE LIT.

            « Actions autorisées pour chaque rôle, SELON LE MODE DE DÉLÉGATION
            choisi ci-dessus » vivait en `sr-only`, et le commentaire qui l'y
            avait mise disait pourquoi : le titre visible ne le dit pas. La
            conclusion s'arrêtait à mi-chemin — si le titre ne le dit pas, ce
            n'est pas au seul lecteur d'écran qu'il manque.

            C'est la phrase qui compte le plus sur cet écran : sans elle, rien
            ne relie ce tableau au choix de délégation posé juste au-dessus,
            dont il dépend pourtant colonne par colonne. Le lecteur voyant
            n'avait qu'un titre seul, surmontant trente-deux pixels de blanc,
            quand toutes les autres sections du produit portent un titre ET une
            ligne qui l'explique.
          */}
          <CardHeader
            title={t('app.onboarding.matrixTitle')}
            description={t('app.onboarding.matrixCaption')}
            level={2}
            className="mb-0"
          />
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
          {/*
            LE NOM DE LA TABLE PASSE EN `aria-label`, ET LA LÉGENDE REMONTE.

            Le `<caption>` a porté successivement les deux : d'abord le titre —
            qu'un lecteur d'écran entendait alors deux fois, puisque le `<h2>`
            le rend juste au-dessus —, puis l'explication, qui a suivi le même
            chemin en sens inverse et se lit maintenant sous le titre.

            Reste à nommer la table, et un `aria-label` le fait sans rien
            ajouter à la prose : il n'est pas rendu, il n'est pas lu à la file,
            il ne se prononce qu'en ENTRANT dans la table — le moment où l'on a
            justement besoin de savoir dans quoi l'on entre. Une table sans nom
            aurait été un défaut déplacé, pas un défaut fermé.

            La légende ne pouvait pas rester ici en devenant visible : ce bloc
            défile horizontalement, et une phrase de deux lignes s'en irait avec
            le tableau sur un écran étroit.
          */}
          <table
            className="w-full border-collapse text-body"
            aria-label={t('app.onboarding.matrixTitle')}
          >
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
          <p className="border-t border-divider px-4 py-3 text-body text-muted sm:px-5">
            {t('app.onboarding.managerOffNote')}
          </p>
        )}
      </Card>
    </>
  )
}
