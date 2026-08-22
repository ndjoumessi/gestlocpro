import { useState } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input, Select, Textarea } from '@/components/primitives/Input'
import { RadioCards, type RadioCardOption } from '@/components/primitives/Choice'
import { useToast } from '@/components/primitives/Toast'
import { useT } from '@/i18n/I18nProvider'
import { usePortfolio } from '@/data/PortfolioProvider'
import { TRADES, type TradeKey, type UrgencyKey } from '@/data/portfolio'

/**
 * Le bailleur OUVRE un chantier — il ne signale pas un problème.
 *
 * Une modale distincte de `ReportModal`, et non une variante paramétrée. Le
 * dépôt a déjà tranché ce partage une fois, dans le commentaire de
 * `TRADES_REPORTABLE` : ce qui se met en commun, c'est le VOCABULAIRE, pas la
 * présentation. `Signaler.tsx` est d'ailleurs déjà une seconde présentation du
 * même formulaire, rendue à plat au lieu d'en modale.
 *
 * Tout diverge ici, sauf les corps de métier :
 *
 * — Le LOGEMENT se choisit. `ReportModal` le reçoit tout fait — « le serveur
 *   revérifie qu'il est bien celui du déclarant » — parce qu'un locataire n'en
 *   a qu'un. Le bailleur choisit dans son parc, et c'est le seul changement qui
 *   touche la forme du formulaire plutôt que ses mots.
 *
 * — Les MÉTIERS sont tous offerts, `multi` compris. `TRADES_REPORTABLE`
 *   l'exclut délibérément de ce qu'un locataire peut déclarer : « multi-corps
 *   qualifie un chantier que le bailleur arbitre, jamais un problème que le
 *   locataire constate ». C'est précisément le sien.
 *
 * — Le VOCABULAIRE change de camp. « Votre gestionnaire et votre bailleur le
 *   reçoivent immédiatement » n'a aucun sens servi au bailleur lui-même.
 *
 * — Aucun MONTANT. La règle du serveur tient pour les deux : « déclarer n'est
 *   pas chiffrer », et poser un devis à la création ferait apparaître un
 *   montant dans la carte des arbitrages avant que quiconque ait arbitré. Le
 *   bailleur ouvre, puis chiffre avec le bouton qui existe déjà.
 */
export function OpenWorkModal({
  open,
  onClose,
  unitIds,
}: {
  open: boolean
  onClose: () => void
  /** Les logements du parc, dans l'ordre où l'écran les liste. */
  unitIds: { id: string; label: string }[]
}) {
  const t = useT()
  const { notify } = useToast()
  const { addWork } = usePortfolio()

  const [unite, setUnite] = useState(unitIds[0]?.id ?? '')
  const [titre, setTitre] = useState('')
  const [erreur, setErreur] = useState(false)
  const [metier, setMetier] = useState<TradeKey>('multi')
  const [urgence, setUrgence] = useState<UrgencyKey>('normal')
  const [detail, setDetail] = useState('')
  /* Le vol en cours : le bouton s'éteint le temps de l'aller-retour. Une
     attente devenue visible invite à recliquer, et deux fiches naîtraient du
     même constat. */
  const [envoi, setEnvoi] = useState(false)

  /* Le vocabulaire vient de `portfolio`, jamais d'une liste recopiée ici : le
     commentaire de `TRADES_REPORTABLE` annonçait deux copieurs, il y en avait
     trois, et c'est le troisième qui a raté l'ajout de la peinture. */
  const options: RadioCardOption<TradeKey>[] = TRADES.map((cle) => ({
    value: cle,
    title: t(`app.trades.${cle}` as 'app.trades.plumbing'),
    description: '',
  }))

  const urgences: RadioCardOption<UrgencyKey>[] = (
    ['blocking', 'normal', 'low'] as UrgencyKey[]
  ).map((cle) => ({
    value: cle,
    title: t(`app.works.urgency_${cle}` as 'app.works.urgency_blocking'),
    description: '',
  }))

  async function ouvrir() {
    // La même borne que le serveur, et que la modale du locataire : le refus
    // arrive avant l'aller-retour.
    if (titre.trim().length < 3 || !unite) {
      setErreur(true)
      return
    }
    // Même règle que l'écran « Signaler » : le chantier n'est annoncé ouvert
    // qu'une fois le serveur d'accord, et la saisie survit au refus.
    setEnvoi(true)
    const ouvert = await addWork(unite, {
      title: titre.trim(),
      trade: metier,
      urgency: urgence,
      ...(detail.trim() ? { description: detail.trim() } : {}),
    })
    setEnvoi(false)
    if (!ouvert) return
    onClose()
    setTitre('')
    setDetail('')
    notify(t('app.works.openedToast'), { tone: 'ok' })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('app.works.openTitle')}
      description={t('app.works.openBody')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={envoi}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="ouverture-travaux" loading={envoi}>
            {t('app.works.openSubmit')}
          </Button>
        </>
      }
    >
      {/*
        UN VRAI `<form>`, ET LE BOUTON DU PIED LUI EST RATTACHÉ.

        `Modal` rend le corps et le pied dans deux `<div>` FRÈRES : un `<form>`
        autour du corps ne peut donc pas contenir le bouton du pied — et faute
        de l'avoir résolu, cette modale n'avait pas de formulaire du tout.
        Entrée n'y validait rien.

        Le coût n'est pas seulement au clavier. Sur un clavier virtuel de
        téléphone, un champ hors formulaire perd sa touche d'action « Aller » :
        le clavier reste ouvert par-dessus la barre d'actions, au moment précis
        où il faut l'atteindre.

        L'attribut `form` est fait pour ce cas. `noValidate` l'accompagne
        toujours : sans lui la validation native rouvre ses bulles à côté des
        messages de `Field`, deux refus pour la même faute.
      */}
      <form
        id="ouverture-travaux"
        onSubmit={(e) => {
          e.preventDefault()
          void ouvrir()
        }}
        noValidate
        className="flex flex-col gap-5"
      >
        <Field label={t('app.works.openUnit')} required>
          {(champ) => (
            <Select {...champ} value={unite} onChange={(e) => setUnite(e.target.value)}>
              {unitIds.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label={t('app.works.openWhat')}
          hint={t('app.works.openWhatHint')}
          required
          {...(erreur ? { error: t('app.report.whatError') } : {})}
        >
          {(champ) => (
            <Input
              {...champ}
              value={titre}
              placeholder={t('app.works.openWhatPlaceholder')}
              invalid={erreur}
              onChange={(e) => {
                setTitre(e.target.value)
                if (erreur) setErreur(false)
              }}
            />
          )}
        </Field>

        {/* EN PASTILLES, ET NON EN TUILES — mesuré. Les six métiers et les
            trois urgences portent `description: ''` et aucune icône : la tuile
            n'avait rien à mettre dedans, et rendait donc six fois la MÊME icône
            de repli, promettant une distinction inexistante. Neuf mots dans
            neuf boîtes pleine largeur valaient 1033 px de défilement à 360 px.
            Le vocabulaire ne change pas, la sémantique non plus : mêmes radios,
            mêmes flèches, même annonce « 2 sur 6 ». */}
        <RadioCards
          legend={t('app.report.trade')}
          name="chantier-metier"
          value={metier}
          onChange={setMetier}
          options={options}
          variant="puces"
        />

        <RadioCards
          legend={t('app.report.urgency')}
          name="chantier-urgence"
          value={urgence}
          onChange={setUrgence}
          options={urgences}
          variant="puces"
        />

        <Field label={t('app.report.detail')} optional>
          {(champ) => (
            <Textarea {...champ} value={detail} onChange={(e) => setDetail(e.target.value)} />
          )}
        </Field>
      </form>
    </Modal>
  )
}
