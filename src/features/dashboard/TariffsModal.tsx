import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { DatePicker } from '@/components/primitives/DatePicker'
import { Input, Select } from '@/components/primitives/Input'
import { Icon } from '@/components/primitives/Icon'
import { Badge } from '@/components/primitives/Badge'
import { useToast } from '@/components/primitives/Toast'
import { useCurrency } from '@/currency/CurrencyProvider'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { partiesDeDateISO } from '@/lib/dates'
import { useSession } from '@/api/SessionProvider'
import { TARIFS_DEMO_DATES } from '@/data/portfolio'
import { ApiError, api } from '@/api/client'

/**
 * Le statut d'un prix : celui qui s'applique, celui qui attend, ceux qui ont
 * servi. Voir le commentaire de la liste pour le raisonnement.
 *
 * EXPORTÉE POUR ÊTRE ÉPROUVÉE, et c'est une mesure qui l'a décidé. La
 * démonstration ne porte que DEUX prix — un par fluide, à la même date — et deux
 * mutations franches passaient au vert contre l'écran : « tous en vigueur » y
 * est indistinguable du juste, et « le plus récent tous fluides confondus »
 * laisse simplement un fluide sans marque, ce qu'un compte par fluide ne voit
 * pas s'il ne compte que les fluides marqués.
 *
 * Un jeu de données ne se fabrique pas pour faire passer un test. On éprouve
 * donc la RÈGLE, sur des cas construits, et l'écran garde le sien : que la
 * marque paraisse.
 */
export function statutDuTarif(tarif: TarifApi, tous: TarifApi[]): 'vigueur' | 'aVenir' | 'passe' {
  const aujourdhui = new Date().toISOString().slice(0, 10)
  if (tarif.effectiveFrom > aujourdhui) return 'aVenir'
  const dernierPasse = tous
    .filter((t) => t.utility === tarif.utility && t.effectiveFrom <= aujourdhui)
    .reduce((a, b) => (a.effectiveFrom >= b.effectiveFrom ? a : b))
  return dernierPasse.id === tarif.id ? 'vigueur' : 'passe'
}

interface TarifApi {
  id: string
  utility: 'water' | 'power'
  unitPriceMinor: number
  effectiveFrom: string
}

/**
 * LES PRIX DE REFACTURATION, saisis par celui qui les décide.
 *
 * Deux constantes du client tenaient ce rôle — 520 le mètre cube, 99 le
 * kilowattheure — affichées à tous les parcs sans que personne ne les ait
 * saisies. Le serveur sait maintenant les stocker, datés et par parc ; il ne
 * manquait que l'endroit où les poser, et un propriétaire devait en passer par
 * `curl`.
 *
 * Un prix n'est jamais MODIFIÉ : on en pose un nouveau, avec sa date d'effet.
 * C'est ce que le schéma impose et c'est ce qui est juste — corriger le prix de
 * janvier en juin réécrirait des quittances déjà remises. L'historique reste
 * lisible en dessous, parce que c'est lui qui explique une facture ancienne.
 */
export function TariffsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const d = useDates()
  const { money, parseAmount } = useCurrency()
  const { notify } = useToast()
  /*
    LE REFUS LOCAL VIT SOUS SON CHAMP, et non dans un toast.

    Un toast s'efface au bout de quelques secondes pendant que le champ garde
    la valeur refusée : l'utilisateur relit un prix qui semble accepté, sans
    plus rien pour dire ce qu'on lui reproche. La modale d'ajout d'unité
    tient déjà le motif correct. Les échecs SERVEUR restent au toast — eux ne
    désignent aucun champ.
  */
  const [erreurPrix, setErreurPrix] = useState<string | undefined>(undefined)
  const { adhesionActive, estDemo } = useSession()
  const parkId = adhesionActive?.parkId ?? null

  const [tarifs, setTarifs] = useState<TarifApi[]>([])
  const [utility, setUtility] = useState<'water' | 'power'>('water')
  const [prix, setPrix] = useState('')
  /**
   * Le PREMIER du mois courant par défaut, et non aujourd'hui.
   *
   * La refacturation est mensuelle : un prix qui prend effet le 17 laisserait la
   * période en cours à cheval sur deux tarifs, sans que rien à l'écran ne dise
   * lequel s'applique. Le premier du mois est la date que le propriétaire aurait
   * saisie de toute façon, et il reste libre d'en mettre une autre.
   */
  const [effet, setEffet] = useState(() => new Date().toISOString().slice(0, 8) + '01')
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => {
    if (!open) return
    /*
      LA DÉMONSTRATION SERT SES PROPRES PRIX, et ce n'est pas un ornement.

      Sans parc, l'appel ne partait pas et la liste restait vide : la modale
      affichait « aucun prix posé ». Or l'écran des relevés, juste derrière
      elle, MONTRE ces deux prix en indicateurs — il les lit sur les relevés de
      la démonstration. L'éditeur des prix aurait donc démenti la page qui les
      affiche, à un clic d'écart.

      Les deux listes se dérivent de `TARIFS_DEMO` : elles ne peuvent pas
      diverger. Voir `portfolio.ts` pour la date d'effet, qui est dérivée du
      relevé le plus ancien plutôt qu'écrite.
    */
    if (!parkId) {
      setTarifs(estDemo ? TARIFS_DEMO_DATES() : [])
      return
    }
    void api
      .tariffs<{ tariffs: TarifApi[] }>(parkId)
      .then((r) => setTarifs(r.tariffs))
      .catch(() => notify(t('common.actionFailed'), { tone: 'danger' }))
  }, [open, parkId, estDemo, notify, t])

  const enregistrer = (event: FormEvent) => {
    event.preventDefault()
    /**
     * SANS PARC, ON LE DIT — on ne rendait rien.
     *
     * `if (!parkId) return` était muet : le bouton s'enfonçait, la modale
     * restait ouverte, et rien n'arrivait. C'est le contrôle mort que ce dépôt
     * retire partout, et il n'était visible de personne tant que la
     * démonstration ne pouvait pas ouvrir cette modale.
     *
     * Le message dit ce que la démonstration ne fait pas ET ce qu'elle montre
     * quand même : les deux prix de l'historique sont bien ceux que l'écran des
     * relevés applique.
     */
    if (!parkId) {
      notify(t(estDemo ? 'app.tariffs.demoNoSave' : 'common.actionFailed'), {
        tone: estDemo ? 'neutral' : 'danger',
      })
      return
    }
    // Un prix unitaire est un montant : il se lit comme les autres. `Number`
    // refusait « 1 250 » recopié depuis l'historique affiché juste en dessous —
    // le produit rejetait la forme qu'il venait lui-même d'imprimer.
    const valeur = parseAmount(prix)
    // `null` d'abord et à part : `Number.isInteger(null)` est faux, mais s'en
    // remettre à cette coïncidence confondrait l'illisible avec le prix
    // décimal, deux refus qui n'ont ni la même cause ni le même remède.
    if (valeur === null || !Number.isInteger(valeur) || valeur <= 0) {
      setErreurPrix(t('app.tariffs.priceInvalid'))
      return
    }
    setErreurPrix(undefined)

    setEnvoi(true)
    void api
      .setTariff<{ tariff: TarifApi }>(parkId, {
        utility,
        unitPriceMinor: valeur,
        effectiveFrom: effet,
      })
      .then((r) => {
        setTarifs((liste) => [r.tariff, ...liste])
        setPrix('')
        notify(t('app.tariffs.saved'), { tone: 'ok' })
      })
      .catch((err: unknown) => {
        // Le 409 a une cause précise et un remède précis — changer la date ou
        // corriger celle qui existe. Le confondre avec une panne obligerait à
        // deviner.
        if (err instanceof ApiError && err.status === 409) {
          notify(t('app.tariffs.duplicate'), { tone: 'danger' })
        } else {
          notify(t('common.actionFailed'), { tone: 'danger' })
        }
      })
      .finally(() => setEnvoi(false))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('app.tariffs.title')}
      description={t('app.tariffs.description')}
      /*
        UNE SEULE ACTION PRIMAIRE, et ce n'était pas la bonne.

        `Button` rend « primaire » par défaut : ce « Fermer » était donc en
        encre pleine, dans la barre épinglée qui ne défile jamais — le bouton le
        plus fort de l'écran était celui qui abandonne. Le vrai geste,
        « Enregistrer ce prix », vivait dans le corps défilant, et pouvait se
        trouver hors champ au moment où l'on cherche à valider.

        Le fichier du composant porte la règle en toutes lettres, juste
        au-dessus de la variante concernée : « Une seule action primaire par
        écran. »

        L'enregistrement remonte au pied par l'attribut `form`, le formulaire
        étant déjà écrit dans le corps — c'est ce que les deux modales voisines
        viennent d'adopter.
      */
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
          <Button type="submit" form="tarif" loading={envoi}>
            {t('app.tariffs.submit')}
          </Button>
        </>
      }
    >
      <form id="tarif" onSubmit={enregistrer} noValidate className="flex flex-col gap-5">
        <Field label={t('app.tariffs.utility')} required>
          {(props) => (
            <Select
              {...props}
              name="utility"
              value={utility}
              onChange={(e) => setUtility(e.target.value as 'water' | 'power')}
            >
              <option value="water">{t('app.meters.water')}</option>
              <option value="power">{t('app.meters.power')}</option>
            </Select>
          )}
        </Field>

        <Field
          label={t('app.tariffs.price')}
          hint={t('app.tariffs.priceHint')}
          required
          error={erreurPrix}
        >
          {(props) => (
            <Input
              {...props}
              name="unitPriceMinor"
              inputMode="numeric"
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
            />
          )}
        </Field>

        {/*
          LE DERNIER `type="date"` DU PRODUIT.

          Ce champ ouvrait le calendrier du SYSTÈME — ses polices, son bleu, ses
          flèches, sa géométrie — qu'aucune feuille de style n'atteint. C'est la
          raison d'être de `DatePicker`, dont l'en-tête le dit ; la migration qui
          l'a écrit a simplement manqué ce champ-ci.

          Le symptôme était déjà NOMMÉ dans le dépôt avant d'être vu : « il
          ouvrait donc le panneau du navigateur dans la modale même »
          (`gestures.test.tsx`). Ici, le panneau s'ouvrait VERS LE HAUT et
          recouvrait le titre, la description et le champ du dessus — on perdait
          de vue ce qu'on était en train de renseigner.

          `aucuneDateNative.test.ts` interdit désormais la reprise, sur toute la
          source : la migration précédente était racontée par trois commentaires
          et vérifiée par aucun.
        */}
        <Field label={t('app.tariffs.effectiveFrom')} hint={t('app.tariffs.effectiveFromHint')} required>
          {(props) => (
            <DatePicker {...props} name="effectiveFrom" value={effet} onChange={setEffet} />
          )}
        </Field>

      </form>

      <div className="mt-6 border-t border-divider pt-5">
        <p className="eyebrow text-muted">{t('app.tariffs.historyTitle')}</p>
        {tarifs.length === 0 ? (
          /* Un parc sans prix n'affiche aucun montant : on le dit ici plutôt que
             de laisser une liste vide sans explication. */
          <p className="mt-3 flex items-start gap-2 text-body text-muted">
            <Icon name="info" size={15} className="mt-0.5 shrink-0" />
            {t('app.tariffs.empty')}
          </p>
        ) : (
          /*
            ═══ LE PRIX EN VIGUEUR EST NOMMÉ, ET IL NE L'ÉTAIT PAS ═══

            La description de cette modale dit : « un prix ne vaut pas pour le
            passé : les relevés antérieurs gardent celui qui ÉTAIT EN VIGUEUR ».
            La notion est donc annoncée en toutes lettres — et l'historique la
            taisait. Une liste plate de « eau · date · montant » ne dit pas lequel
            de ces prix s'applique AUJOURD'HUI, alors que c'est la seule question
            qu'on se pose avant d'en poser un nouveau.

            Est en vigueur, par fluide, le prix dont la date d'effet est la plus
            RÉCENTE parmi celles déjà passées. Un prix daté du mois prochain est
            déjà posé mais ne s'applique pas encore : il est distingué lui aussi,
            faute de quoi on croirait avoir changé un tarif qui ne bougera que
            dans trois semaines.

            La comparaison porte sur des chaînes `AAAA-MM-JJ`, dont l'ordre
            lexicographique EST l'ordre chronologique — c'est la propriété de ce
            format, et elle évite de fabriquer des dates pour les comparer.
          */
          <ul className="mt-3 flex flex-col gap-2">
            {tarifs.map((tarif) => (
              <li key={tarif.id} className="flex items-baseline justify-between gap-3 text-body">
                <span>
                  {t(`app.meters.${tarif.utility}` as 'app.meters.water')}
                  {' · '}
                  {/* La date brute du serveur, « 2026-08-01 », ne se lit ni en
                      français ni en anglais : chaque autre écran de ce
                      périmètre passe par `useDates`, celui-ci l'affichait
                      encore tel quel. */}
                  <span className="text-muted">{d.fullDate(partiesDeDateISO(tarif.effectiveFrom))}</span>
                </span>
                <span className="flex items-baseline gap-2.5">
                  {statutDuTarif(tarif, tarifs) !== 'passe' && (
                    <Badge tone={statutDuTarif(tarif, tarifs) === 'vigueur' ? 'ok' : 'neutral'}>
                      {t(
                        statutDuTarif(tarif, tarifs) === 'vigueur'
                          ? 'app.tariffs.inForce'
                          : 'app.tariffs.scheduled',
                      )}
                    </Badge>
                  )}
                  <span className="numeric font-medium">
                    {money(tarif.unitPriceMinor, { compact: true })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
