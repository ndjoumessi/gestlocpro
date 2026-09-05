import { useRef, useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input, Select } from '@/components/primitives/Input'
import { Notice } from '@/components/primitives/Notice'
import { DatePicker } from '@/components/primitives/DatePicker'
import { useToast } from '@/components/primitives/Toast'
import { useT } from '@/i18n/I18nProvider'
import { usePortfolio } from '@/data/PortfolioProvider'
import type { MeterReading } from '@/data/portfolio'

/**
 * SAISIR UN RELEVÉ DE COMPTEUR — LE GESTE QUI N'EXISTAIT NULLE PART.
 *
 * ═══ UN ÉCRAN ENTIER SANS PORTE D'ENTRÉE ═══
 *
 * L'écran des relevés affichait des index, des consommations, un « Total
 * refacturé » et un export CSV. Aucune route n'écrivait de relevé, aucun bouton
 * n'en proposait un : seul le semis de démonstration en posait. Sur un parc
 * réel, cet écran était vide et le serait resté.
 *
 * ═══ LA PÉRIODE SE DÉDUIT DE LA DATE DE RELEVÉ ═══
 *
 * Un champ « période » de plus aurait demandé au releveur de dire deux fois
 * quand il est passé, et de les accorder. La refacturation est MENSUELLE — le
 * dictionnaire des tarifs le dit déjà : « un prix qui prend effet le 17
 * laisserait la période en cours à cheval sur deux tarifs ». Relever le 20
 * juillet, c'est relever la période de juillet.
 *
 * ═══ LES DEUX ÉNERGIES DANS UN SEUL GESTE, ET AUCUNE OBLIGATOIRE ═══
 *
 * Une tournée lit les deux compteurs d'affilée ; les séparer ferait deux
 * ouvertures de modale pour un seul déplacement. Aucune n'est exigée pour
 * autant : un compteur inaccessible ce jour-là ne doit pas empêcher d'enregistrer
 * l'autre.
 *
 * Deux appels séparés, donc, et un compte rendu qui dit ce qui est passé. Le
 * serveur refuse chacun pour ses propres raisons — un index qui recule, un
 * relevé déjà saisi pour ce mois — et les fondre en un seul message obligerait à
 * deviner lequel des deux a été refusé.
 */
export function RecordReadingModal({
  onClose,
  /**
   * LA LIGNE À CORRIGER, quand on entre par le geste d'une rangée.
   *
   * La même modale sert les deux gestes, et ce n'est pas une économie : SAISIR
   * et CORRIGER demandent exactement les mêmes champs — un logement, une date,
   * deux index. Deux boîtes jumelles divergeraient au premier ajustement, et il
   * y en aurait une de plus à inscrire dans les deux registres écrits à la main.
   *
   * Ce qui change est l'ADRESSE de l'écriture : `PATCH` par identifiant de
   * relevé au lieu d'un `POST` par logement — d'où les deux identifiants portés
   * par la ligne, un par énergie.
   */
  aCorriger,
}: {
  onClose: () => void
  aCorriger?: MeterReading
}) {
  const t = useT()
  const { units, recordReading, updateReading, deleteReading } = usePortfolio()
  const { notify } = useToast()

  const [unitId, setUnitId] = useState(aCorriger?.unitId ?? units[0]?.id ?? '')
  const [readAt, setReadAt] = useState(() =>
    aCorriger?.readAt
      ? `${aCorriger.readAt.year}-${String(aCorriger.readAt.month + 1).padStart(2, '0')}-${String(aCorriger.readAt.day).padStart(2, '0')}`
      : new Date().toISOString().slice(0, 10),
  )
  const [eau, setEau] = useState(
    aCorriger?.waterCurrent !== null && aCorriger?.waterCurrent !== undefined
      ? String(aCorriger.waterCurrent)
      : '',
  )
  const [courant, setCourant] = useState(
    aCorriger?.powerCurrent !== null && aCorriger?.powerCurrent !== undefined
      ? String(aCorriger.powerCurrent)
      : '',
  )
  /** La ligne dont on a armé le retrait — deux temps, comme sur les tarifs. */
  const [aRetirer, setARetirer] = useState<'water' | 'power' | null>(null)
  const [erreurs, setErreurs] = useState<Record<string, string | undefined>>({})
  const [enCours, setEnCours] = useState(false)
  /**
   * CE QUE LE RELEVÉ A FAIT À L'ARGENT, gardé sous les yeux.
   *
   * « Un versement est déjà tombé sur ce mois, l'échéance ne bouge pas » n'est
   * pas une erreur et ne doit pas partir en bandeau qui s'efface : c'est une
   * conséquence qu'on relit, et qui explique pourquoi le montant refacturé ne
   * change pas alors qu'on vient de relever.
   */
  const [consequence, setConsequence] = useState<'not_called' | 'already_paid' | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  /** Le premier du mois de la date de relevé. */
  const periodeDe = (jour: string) => `${jour.slice(0, 7)}-01`

  const enregistrer = async () => {
    const lu = (valeur: string) => Number(valeur.replace(/\s/g, ''))
    const suivant: Record<string, string | undefined> = {}
    if (!unitId) suivant.unitId = t('app.readings.unitRequired')
    /* AU MOINS UN DES DEUX : une modale validée à vide ferait deux appels pour
       rien, et un compte rendu « 0 relevé saisi » qui ressemblerait à une panne. */
    if (!eau.trim() && !courant.trim()) suivant.water = t('app.readings.oneRequired')
    for (const [champ, valeur] of [
      ['water', eau],
      ['power', courant],
    ] as const) {
      if (valeur.trim() && (!Number.isInteger(lu(valeur)) || lu(valeur) < 0))
        suivant[champ] = t('app.readings.indexInvalid')
    }
    setErreurs(suivant)
    if (Object.values(suivant).some(Boolean)) {
      const premier = (['unitId', 'water', 'power'] as const).find((c) => suivant[c])
      if (premier) formRef.current?.querySelector<HTMLElement>(`[name="${premier}"]`)?.focus()
      return
    }

    setEnCours(true)
    setConsequence(null)
    const periodStart = periodeDe(readAt)
    let poses = 0
    let dernierEtat: 'not_called' | 'already_paid' | null = null

    for (const [utility, valeur, identifiant] of [
      ['water', eau, aCorriger?.waterReadingId],
      ['power', courant, aCorriger?.powerReadingId],
    ] as const) {
      if (!valeur.trim()) continue

      /* CORRIGER PLUTÔT QUE POSER dès qu'un identifiant existe pour cette
         énergie. Une énergie SANS identifiant sur une ligne qu'on corrige est le
         cas courant d'une tournée à moitié faite : l'eau relevée en juillet, le
         courant oublié. Elle se POSE, dans la même validation. */
      if (aCorriger && identifiant) {
        const issue = await updateReading(identifiant, { indexValue: lu(valeur), readAt })
        if (issue.ok) {
          poses += 1
          /* LA PREMIÈRE ÉCHÉANCE QUI N'A PAS BOUGÉ, et son motif. Corriger en
             touche DEUX — la sienne et la suivante —, et la plus parlante est
             celle qu'on n'a pas pu écrire. */
          const bloquee = issue.charges.find((c) => !c.updated && c.reason)
          if (bloquee?.reason === 'already_paid' || bloquee?.reason === 'not_called')
            dernierEtat = bloquee.reason
        } else {
          notify(
            t(
              issue.erreur === 'index_recule'
                ? 'app.readings.indexBackwards'
                : issue.erreur === 'index_depasse_le_suivant'
                  ? 'app.readings.indexAboveNext'
                  : 'common.actionFailed',
              { utility: t(`app.meters.utility.${utility}`) },
            ),
            { tone: 'danger' },
          )
        }
        continue
      }

      const issue = await recordReading(unitId, {
        utility,
        periodStart,
        indexValue: lu(valeur),
        readAt,
      })
      if (issue.ok) {
        poses += 1
        if (!issue.charge.updated && issue.charge.reason) dernierEtat = issue.charge.reason
      } else {
        /* LE REFUS DIT SA CAUSE, ÉNERGIE COMPRISE : « index en recul » sur l'eau
           et « déjà saisi » sur le courant n'ont pas le même remède, et une
           tournée peut buter sur l'un sans l'autre. */
        notify(
          t(
            issue.erreur === 'index_recule'
              ? 'app.readings.indexBackwards'
              : issue.erreur === 'reading_exists'
                ? 'app.readings.alreadyRecorded'
                : 'common.actionFailed',
            { utility: t(`app.meters.utility.${utility}`) },
          ),
          { tone: 'danger' },
        )
      }
    }
    setEnCours(false)

    if (poses === 0) return
    /* LA CONSÉQUENCE RESTE, LA CONFIRMATION PASSE. On ne ferme donc PAS la
       modale quand l'échéance n'a pas bougé : c'est là qu'il faut lire pourquoi. */
    if (dernierEtat) {
      setConsequence(dernierEtat)
      notify(t('app.readings.saved', { count: poses }), { tone: 'ok' })
      return
    }
    onClose()
    notify(t(aCorriger ? 'app.readings.corrected' : 'app.readings.saved', { count: poses }), {
      tone: 'ok',
    })
  }

  /** Retire le relevé d'une énergie, en deux temps. */
  const retirer = async (utility: 'water' | 'power') => {
    const identifiant = utility === 'water' ? aCorriger?.waterReadingId : aCorriger?.powerReadingId
    if (!identifiant) return
    setEnCours(true)
    const fait = await deleteReading(identifiant)
    setEnCours(false)
    setARetirer(null)
    if (fait) {
      onClose()
      notify(t('app.readings.removed'), { tone: 'ok' })
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={t(aCorriger ? 'app.readings.correctTitle' : 'app.readings.title')}
      description={t('app.readings.description')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
          <Button type="submit" form="releve" disabled={enCours || units.length === 0}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      {units.length === 0 ? (
        /* Un relevé se rattache à un logement : sans logement, le formulaire n'a
           pas de sens et on le dit, plutôt que d'offrir un menu vide. */
        <p className="text-body text-muted">{t('app.portfolio.noBuildingYet')}</p>
      ) : (
        <form
          ref={formRef}
          id="releve"
          onSubmit={(e) => {
            e.preventDefault()
            void enregistrer()
          }}
          noValidate
          className="flex flex-col gap-5"
        >
          <Field label={t('app.portfolio.unit')} required error={erreurs.unitId}>
            {(props) => (
              <Select
                {...props}
                name="unitId"
                /* LE LOGEMENT NE CHANGE PAS EN CORRECTION : les relevés qu'on
                   corrige sont ceux de CETTE ligne, et les déplacer voudrait
                   dire les retirer d'un compteur pour les poser sur un autre. */
                disabled={aCorriger !== undefined}
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                    {u.tenant ? ` · ${u.tenant}` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {/* `DatePicker` ET NON `type="date"` : le champ natif ouvre le
              calendrier du SYSTÈME, qu'aucune feuille de style n'atteint, et
              `aucuneDateNative` l'interdit sur toute la source depuis que la
              modale des tarifs a été la dernière à le porter. */}
          <Field
            label={t('app.readings.readAt')}
            hint={t('app.readings.readAtHint')}
            required
          >
            {(props) => (
              <DatePicker {...props} name="readAt" value={readAt} onChange={setReadAt} />
            )}
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={`${t('app.meters.utility.water')} (m³)`}
              hint={t('app.readings.indexHint')}
              optional
              error={erreurs.water}
            >
              {(props) => (
                <Input
                  {...props}
                  name="water"
                  inputMode="numeric"
                  value={eau}
                  onChange={(e) => setEau(e.target.value)}
                />
              )}
            </Field>
            <Field
              label={`${t('app.meters.utility.power')} (kWh)`}
              optional
              error={erreurs.power}
            >
              {(props) => (
                <Input
                  {...props}
                  name="power"
                  inputMode="numeric"
                  value={courant}
                  onChange={(e) => setCourant(e.target.value)}
                />
              )}
            </Field>
          </div>

          {/* LE RETRAIT, UNE ÉNERGIE À LA FOIS ET EN DEUX TEMPS.

              Il n'existe qu'en correction : on ne retire pas un relevé qu'on
              n'a pas encore posé. C'est le seul remède d'un relevé placé sur le
              mauvais MOIS — la période ne se corrige pas, et l'unicité ferme le
              remplacement.

              Deux temps plutôt qu'une confirmation en modale : `Modal` ne
              s'imbrique pas proprement, et `clavierDesModales` exige d'ouvrir,
              tenir, fermer et RENDRE le focus à chaque niveau. */}
          {aCorriger ? (
            <div className="flex flex-wrap gap-2">
              {(['water', 'power'] as const).map((utility) => {
                const identifiant =
                  utility === 'water' ? aCorriger.waterReadingId : aCorriger.powerReadingId
                if (!identifiant) return null
                return aRetirer === utility ? (
                  <Button
                    key={utility}
                    variant="danger"
                    size="sm"
                    disabled={enCours}
                    onClick={() => void retirer(utility)}
                  >
                    {t('app.readings.confirmRemove')}
                  </Button>
                ) : (
                  <Button
                    key={utility}
                    variant="ghost"
                    size="sm"
                    icon="close"
                    onClick={() => setARetirer(utility)}
                  >
                    {t(utility === 'water' ? 'app.readings.removeWater' : 'app.readings.removePower')}
                  </Button>
                )
              })}
            </div>
          ) : null}

          {/* UN RELEVÉ SERT DEUX MOIS, et c'est la surprise qu'on désamorce. */}
          {aCorriger ? (
            <Notice tone="neutral">{t('app.readings.correctionSpread')}</Notice>
          ) : null}

          {/* CE QUE LE RELEVÉ N'A PAS PU FAIRE À L'ARGENT — voir l'en-tête. La
              note ne paraît qu'APRÈS un enregistrement dont l'échéance n'a pas
              bougé ; sans elle, le montant refacturé resterait inchangé sans que
              rien ne l'explique. */}
          {/* DEUX <Notice> ET NON UNE À TERNAIRE, et ce n'est pas du style :
              `notes-conditionnelles` extrait la clé par le premier `t('…')`
              COLLÉ qu'elle trouve dans la balise. Un ternaire multiligne ne
              présente aucun `t('` — la note échappait donc entièrement au
              registre, ce qui est exactement l'angle mort que ce script
              existe pour fermer. Deux balises, deux clés, deux déclarations. */}
          {consequence === 'not_called' ? (
            <Notice tone="neutral">{t('app.readings.chargeNotCalled')}</Notice>
          ) : null}
          {consequence === 'already_paid' ? (
            <Notice tone="warn">{t('app.readings.chargeAlreadyPaid')}</Notice>
          ) : null}
        </form>
      )}
    </Modal>
  )
}
