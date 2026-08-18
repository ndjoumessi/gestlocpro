import { useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input, Textarea } from '@/components/primitives/Input'
import { RadioCards, type RadioCardOption } from '@/components/primitives/Choice'
import { useToast } from '@/components/primitives/Toast'
import { useT } from '@/i18n/I18nProvider'
import { usePortfolio } from '@/data/PortfolioProvider'
import { TRADES_REPORTABLE } from '@/data/portfolio'
import type { TradeKey, UrgencyKey } from '@/data/portfolio'

/**
 * Signalement d'un problème par le LOCATAIRE.
 *
 * C'est l'origine normale d'une intervention — l'écran des travaux l'énonce
 * lui-même : « une intervention naît d'un signalement de locataire, jamais d'une
 * saisie du bailleur ». Le produit ne l'offrait pourtant nulle part, et le champ
 * `reportedByTenantId` du modèle n'a jamais été écrit : la chaîne partait de son
 * deuxième maillon.
 *
 * Ce que le formulaire demande, et rien de plus : ce qui se passe, où, et à quel
 * point c'est urgent. Pas de montant, pas de corps de métier à choisir dans une
 * nomenclature — le locataire décrit ce qu'il voit, le gestionnaire qualifie.
 */


export function ReportModal({
  open,
  onClose,
  unitId,
}: {
  open: boolean
  onClose: () => void
  /** Logement concerné. Le serveur revérifie qu'il est bien celui du déclarant. */
  unitId: string
}) {
  const t = useT()
  const { notify } = useToast()
  const { addWork } = usePortfolio()

  const [titre, setTitre] = useState('')
  const [erreur, setErreur] = useState(false)
  const [metier, setMetier] = useState<TradeKey>('plumbing')
  const [urgence, setUrgence] = useState<UrgencyKey>('normal')
  const [detail, setDetail] = useState('')

  /* Le vocabulaire des corps de métier est DÉJÀ partagé par les travaux et le
     portail : le redéclarer ici en ferait une troisième source, et elles
     divergeraient au premier ajout. */
  const options: RadioCardOption<TradeKey>[] = TRADES_REPORTABLE.map((cle) => ({
    value: cle,
    title: t(`app.trades.${cle}` as 'app.trades.plumbing'),
    description: '',
  }))

  const urgences: RadioCardOption<UrgencyKey>[] = (
    ['blocking', 'normal', 'low'] as UrgencyKey[]
  ).map((cle) => ({
    value: cle,
    title: t(`app.works.urgency_${cle}` as 'app.works.urgency_blocking'),
    description: t(`app.report.urgency_${cle}` as 'app.report.urgency_blocking'),
  }))

  function envoyer() {
    // La même borne que le serveur : le refus arrive avant l'aller-retour.
    if (titre.trim().length < 3) {
      setErreur(true)
      return
    }
    addWork(unitId, {
      title: titre.trim(),
      trade: metier,
      urgency: urgence,
      ...(detail.trim() ? { description: detail.trim() } : {}),
    })
    onClose()
    setTitre('')
    setDetail('')
    notify(t('app.report.sent'), { tone: 'ok' })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('app.report.title')}
      description={t('app.report.body')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={envoyer}>{t('app.report.send')}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field
          label={t('app.report.what')}
          hint={t('app.report.whatHint')}
          required
          {...(erreur ? { error: t('app.report.whatError') } : {})}
        >
          {(champ) => (
            <Input
              {...champ}
              value={titre}
              invalid={erreur}
              placeholder={t('app.report.whatPlaceholder')}
              onChange={(e) => {
                setTitre(e.target.value)
                setErreur(false)
              }}
            />
          )}
        </Field>

        <RadioCards
          legend={t('app.report.trade')}
          name="signalement-metier"
          value={metier}
          onChange={setMetier}
          options={options}
          columns={1}
        />

        <RadioCards
          legend={t('app.report.urgency')}
          name="signalement-urgence"
          value={urgence}
          onChange={setUrgence}
          options={urgences}
          columns={1}
        />

        <Field label={t('app.report.detail')} optional hint={t('app.report.detailHint')}>
          {(champ) => (
            <Textarea
              {...champ}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
          )}
        </Field>
      </div>
    </Modal>
  )
}
