import { useState } from 'react'
import { useRole } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/primitives/Button'
import { Card, CardHeader } from '@/components/primitives/Card'
import { Field } from '@/components/primitives/Field'
import { RadioCards } from '@/components/primitives/Choice'
import { Input, Textarea } from '@/components/primitives/Input'
import { StatusPill, type StatusTone } from '@/components/primitives/StatusPill'
import { EmptyState } from '@/components/primitives/DataTable'
import { useToast } from '@/components/primitives/Toast'
import { useT } from '@/i18n/I18nProvider'
import { useDates } from '@/lib/useDates'
import { usePortfolio } from '@/data/PortfolioProvider'
import { workTitle } from '@/data/workTitle'
import { TRADES_REPORTABLE } from '@/data/portfolio'
import type { TradeKey, UrgencyKey, WorkOrder } from '@/data/portfolio'

/**
 * « Signaler » — l'écran que les maquettes décrivent.
 *
 * Le formulaire vivait en MODALE, derrière un bouton. Les maquettes le posent à
 * plat, à côté de « Mes signalements », et la raison n'est pas cosmétique : un
 * locataire qui déclare un problème veut d'abord savoir si le précédent a été
 * traité. Derrière une modale, la liste est masquée à l'instant précis où elle
 * sert — il redéclare donc ce qui est déjà en cours.
 *
 * Les signalements SONT les interventions de son logement : le produit n'a pas
 * deux objets pour un seul fait, et la chaîne « signalé → chiffré → validé →
 * clos » est celle que le bailleur voit de son côté.
 *
 * DEUX MODALES SURVIVENT DANS L'ÉCRAN DES TRAVAUX, et ce n'est pas ce que cette
 * phrase disait. Elle annonçait que « la modale survit pour le bailleur » ;
 * `ReportModal` y est en réalité montée sous `role === 'tenant'`, c'est-à-dire
 * pour le locataire qui passe par les travaux plutôt que par ici. Le bailleur,
 * lui, ouvre `OpenWorkModal` — une autre modale, avec un choix de logement dans
 * TOUT le parc, ce qui est précisément la différence de forme qui interdisait de
 * partager la première. Le commentaire attribuait à l'un ce qui appartient à
 * l'autre.
 *
 * Le VOCABULAIRE des corps de métier est importé et non recopié — deux
 * présentations, une seule source.
 */

const TONE: Record<WorkOrder['status'], StatusTone> = {
  reported: 'warn',
  quoted: 'info',
  approved: 'info',
  done: 'ok',
}

const URGENCES: UrgencyKey[] = ['low', 'normal', 'blocking']

export function Signaler() {
  const t = useT()
  const d = useDates()
  const { role } = useRole()
  const { notify } = useToast()
  const { works, units, isMine, addWork, alerts, loading, replyToWork } = usePortfolio()

  const [titre, setTitre] = useState('')
  const [erreur, setErreur] = useState(false)
  const [metier, setMetier] = useState<TradeKey>('plumbing')
  const [urgence, setUrgence] = useState<UrgencyKey>('normal')
  const [detail, setDetail] = useState('')
  /* Le vol en cours : le bouton s'éteint, sans quoi une attente devenue visible
     ferait naître deux fiches d'intervention de la même fuite. */
  const [envoi, setEnvoi] = useState(false)

  /**
   * LA RÉPONSE EN COURS, ET SUR QUEL SIGNALEMENT.
   *
   * Un seul état pour toute la liste, indexé par l'identifiant du chantier : le
   * locataire répond à UNE conversation à la fois, et un état par ligne ferait
   * autant de champs vivants que de signalements ouverts. C'est aussi ce qui
   * permet de rouvrir le champ là où il était après un envoi refusé, sans
   * perdre ce qui venait d'être écrit — le défaut que le formulaire du dessus a
   * déjà payé une fois.
   */
  const [repond, setRepond] = useState<string | null>(null)
  const [reponse, setReponse] = useState('')
  const [reponseErreur, setReponseErreur] = useState(false)
  const [reponseEnvoi, setReponseEnvoi] = useState(false)

  async function envoyerLaReponse(work: WorkOrder) {
    // La même borne que le serveur : le refus arrive avant l'aller-retour.
    if (reponse.trim().length < 3) {
      setReponseErreur(true)
      return
    }
    setReponseEnvoi(true)
    const parti = await replyToWork(work.id, work.unitId, reponse.trim())
    setReponseEnvoi(false)
    /* Le champ ne se vide QUE si la phrase est partie. Vidé d'avance, un refus
       laisserait le locataire sans même de quoi recommencer — c'est mot pour
       mot ce que le formulaire de signalement a corrigé chez lui. */
    if (!parti) return
    setReponse('')
    setReponseErreur(false)
    setRepond(null)
    notify(t('app.report.replySent'), { tone: 'ok' })
  }

  /*
    L'ATTENTE PASSE AVANT LE FORMULAIRE, et pas seulement avant la liste.

    Le fournisseur sert le parc de DÉMONSTRATION tant que le vrai n'est pas
    arrivé — `TenantDocuments` le pose en toutes lettres : « pendant le
    chargement, le jeu de démonstration fournit toujours une unité, et l'écran
    montrerait le dossier d'un autre ». Ici c'était pire qu'un affichage : le
    formulaire restait vivant et postait sur `mesUnites[0]`, c'est-à-dire sur un
    logement qui n'est pas celui du locataire. Une fiche d'intervention ouverte
    chez quelqu'un d'autre.

    La liste, elle, attendait déjà. Le correctif n'avait traversé que la moitié
    de l'écran.
  */
  const mesUnites = loading ? [] : units.filter((u) => isMine(u.id))
  const miens = works.filter((w) => isMine(w.unitId))
  /**
   * LES RÉPONSES, RANGÉES PAR SIGNALEMENT.
   *
   * `workId` est ce qui les rattache — c'est la raison d'être du champ, écrite
   * dans la route qui les émet. Sans ce regroupement, elles vivraient dans
   * « Signalements » à côté d'impayés qui ne concernent pas le locataire, et
   * l'écran où il a DÉCLARÉ resterait muet.
   *
   * DE LA PLUS ANCIENNE À LA PLUS RÉCENTE : un échange se lit dans l'ordre où
   * il s'est tenu. `alerts` arrive du plus récent au plus ancien — l'ordre
   * d'une boîte de réception, qui n'est pas celui d'une conversation.
   */
  const reponses = new Map<string, typeof alerts>()
  for (const a of alerts) {
    /* LES DEUX SENS, et c'est ce qui fait un fil plutôt qu'une boîte aux
       lettres. `workReply` descend, `tenantReply` remonte ; les ranger dans la
       même liste par `workId` est exactement ce que `workId` sert à faire. */
    if (a.message !== 'workReply' && a.message !== 'tenantReply') continue
    const cible = a.data.workId
    if (!cible) continue
    reponses.set(cible, [a, ...(reponses.get(cible) ?? [])])
  }
  /* Le geste appartient au locataire : le bailleur ne signale pas un problème
     chez quelqu'un d'autre, il le reçoit. */
  const peutDeclarer = role === 'tenant' && mesUnites[0]

  async function envoyer() {
    if (!mesUnites[0]) return
    // La même borne que le serveur : le refus arrive avant l'aller-retour.
    if (titre.trim().length < 3) {
      setErreur(true)
      return
    }
    /**
     * « SIGNALEMENT ENVOYÉ » attend maintenant que le serveur l'ait accepté.
     *
     * La phrase partait avec l'appel et non avec sa réponse : sur un refus, le
     * locataire lisait qu'il avait signalé sa fuite PUIS que rien n'avait été
     * enregistré — et le formulaire s'était déjà vidé de ce qu'il venait
     * d'écrire, si bien qu'il ne restait même pas de quoi recommencer.
     */
    setEnvoi(true)
    const ouvert = await addWork(mesUnites[0].id, {
      title: titre.trim(),
      trade: metier,
      urgency: urgence,
      ...(detail.trim() ? { description: detail.trim() } : {}),
    })
    setEnvoi(false)
    // La saisie SURVIT au refus. Le motif est déjà dit par `signalerEchec` ;
    // faire retaper le locataire le punirait d'une panne qui n'est pas la sienne.
    if (!ouvert) return
    setTitre('')
    setDetail('')
    setErreur(false)
    notify(t('app.report.sent'), { tone: 'ok' })
  }

  return (
    <>
      <PageHeader title={t('app.report.title')} description={t('app.report.body')} />

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {peutDeclarer ? (
          /*
            UN VRAI `<form>`, ET IL N'Y EN AVAIT PAS.

            Quatre champs et un `<Button onClick>` dans une carte nue : Entrée
            dans « Que se passe-t-il ? » ne validait rien, et le clavier virtuel
            d'un téléphone — l'appareil du marché visé — perdait sa touche
            d'action, qui n'a de sens que si le champ appartient à un formulaire.

            La modale jumelle porte le récit complet de ce défaut : « faute de
            l'avoir résolu, cette modale n'avait pas de formulaire du tout ». Le
            correctif ne l'avait pas quittée.

            `noValidate` : la validation est celle du produit — trois caractères
            minimum, la même borne que le serveur — et non celle du navigateur,
            dont les bulles ne se traduisent ni ne se stylent.
            `flush` : le rembourrage passe au `<form>`, sans quoi `cn` laisserait
            les deux jeux de classes cohabiter — il concatène, il ne fusionne
            pas, et c'est l'ordre du CSS émis qui trancherait.
          */
          <Card flush>
            {/*
              `data-mesure` PARCE QUE CE FORMULAIRE N'EXISTE QUE POUR UN RÔLE.

              `peutDeclarer` le garde derrière `role === 'tenant'`, et le
              balayage de `scripts/mesure-ui.mjs` tourne en PROPRIÉTAIRE : mesuré
              le 2026-08-30 à 1280 px, cet écran rend 430 caractères et ZÉRO
              commande dans `<main>` pour le bailleur, contre 684 et ONZE pour le
              locataire. Onze commandes — dont ce groupe d'urgence et cette zone
              de texte — qu'aucune porte au navigateur n'avait jamais peintes :
              ni contraste, ni cible de 44 px, ni nom accessible.

              L'attribut est le TÉMOIN de la surface `declaration-du-locataire`,
              qui bascule le rôle avant de mesurer. Il porte le même rôle que
              `data-mesure="barre-locataire"` dans `AppShell.tsx`, et pour la même
              raison : une classe utilitaire change au premier ajustement de mise
              en page, un attribut de mesure dit ce qu'il est.

              Un sélecteur sémantique — `main form` — aurait suffi AUJOURD'HUI,
              puisque le bailleur ne rend aucun formulaire sur cet écran. Il
              deviendrait menteur le jour où il en rend un : la surface
              s'ouvrirait sur le mauvais formulaire et la porte se déclarerait
              verte en ayant audité autre chose. Un témoin nomme sa cible.
            */}
            <form
              data-mesure="declaration-du-locataire"
              onSubmit={(e) => {
                e.preventDefault()
                void envoyer()
              }}
              noValidate
              className="flex flex-col gap-5 p-4 sm:p-5"
            >
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
                  placeholder={t('app.report.whatPlaceholder')}
                  onChange={(e) => {
                    setTitre(e.target.value)
                    if (erreur) setErreur(false)
                  }}
                />
              )}
            </Field>

            {/* Pastilles plutôt que cartes radio : cinq métiers tiennent sur une
                rangée, et le locataire choisit — il n'arbitre pas.

                `radiogroup` et non une rangée de boutons : ces cinq choix sont
                EXCLUSIFS, et le rôle le dit au lecteur d'écran, qui annonce
                « 3 sur 5 ». `aria-checked` porte l'état ; la couleur ne le porte
                jamais seule. */}
            {/*
              LA PRIMITIVE, ET NON UNE TROISIÈME COPIE.

              Ce groupe était refait à la main sur des `<button role="radio">`
              avec un clavier maison. `RadioCards variant="puces"` existe pour ce
              cas précis — son commentaire cite « six métiers et trois urgences »
              — et apporte trois choses que la copie n'avait pas : la COCHE, dont
              la raison est écrite (« sous deutéranopie, deux teintes de statut
              sont à 3,4 de ΔE00 »), l'ANNEAU DE FOCUS, et le clavier NATIF d'un
              vrai `input[type=radio]` — flèches, annonce « 3 sur 5 », saut des
              entrées désactivées, groupe atteignable à la tabulation.
            */}
            <RadioCards
              variant="puces"
              legend={t('app.report.trade')}
              name="metier"
              value={metier}
              onChange={setMetier}
              options={TRADES_REPORTABLE.map((cle) => ({
                value: cle,
                title: t(`app.trades.${cle}` as 'app.trades.plumbing'),
                description: '',
              }))}
            />

            {/*
              ET LES TROIS DESCRIPTIONS D'URGENCE REVIENNENT.

              Elles sont traduites, chargées, et affichées par la modale jumelle
              — `app.report.urgency_*` : « Le logement n'est pas utilisable en
              l'état », « Gênant, mais on peut vivre avec quelques jours ». Son
              commentaire les appelle « les seules phrases qui disent au locataire
              où placer son problème ». Cet écran-ci les jetait et ne rendait
              qu'un mot par urgence, laissant le choix au flair.

              `cartes` et non `puces` : trois options qui portent deux lignes
              d'explication sont exactement ce que le variant en tuiles sert, et
              c'est l'arbitrage que la primitive écrit elle-même.
            */}
            <RadioCards
              legend={t('app.report.urgency')}
              name="urgence"
              value={urgence}
              onChange={setUrgence}
              columns={3}
              options={URGENCES.map((cle) => ({
                value: cle,
                /* Le MÊME couple de clés que la modale jumelle : le titre vient
                   de `app.works.urgency_*`, la description de
                   `app.report.urgency_*`. Deux écrans, un vocabulaire. */
                title: t(`app.works.urgency_${cle}` as 'app.works.urgency_blocking'),
                description: t(`app.report.urgency_${cle}` as 'app.report.urgency_blocking'),
              }))}
            />

            <Field label={t('app.report.detail')} optional hint={t('app.report.detailHint')}>
              {(champ) => (
                <Textarea {...champ} value={detail} onChange={(e) => setDetail(e.target.value)} />
              )}
            </Field>

            <div>
              {/* `type="submit"` : c'est lui qui relie la touche Entrée au
                  geste, et qui donne au clavier virtuel sa touche d'action. */}
              <Button type="submit" loading={envoi}>
                {t('app.report.send')}
              </Button>
            </div>
            </form>
          </Card>
        ) : (
          /* Le bailleur atteint cet écran depuis sa navigation : il y lit ce
             qu'on lui signale, sans pouvoir déclarer à la place d'un autre. */
          <Card>
            <EmptyState
              icon="bell"
              level={2}
              title={t('app.report.title')}
              body={t('app.report.body')}
            />
          </Card>
        )}

        {/*
          `self-start` : LA LISTE FINIT OÙ FINIT LE DERNIER SIGNALEMENT.

          Le formulaire d'en face est long par nature — quatre champs, une zone
          de texte, un bouton. Étirée sur sa hauteur, cette carte portait 179 px
          de vide sous ses trois lignes, 53 % d'elle-même, et le locataire y
          lisait un cadre à moitié creux là où il n'a que trois signalements.
          Rien ne relie le socle d'un formulaire à celui d'une liste : une carte
          finit où son contenu finit. Mesuré par la sonde du BLANC IMPOSÉ.
        */}
        <Card flush className="self-start">
          <CardHeader
            title={t('app.report.mine')}
            level={2}
            className="px-4 pt-4 sm:px-5 sm:pt-5"
          />

          {/*
            L'état vide n'est PAS servi pendant l'attente.

            Un en-tête nu était rendu tant que `loading`, sans région
            `aria-busy` : rien n'annonçait l'attente, ni aux technologies
            d'assistance, ni au test qui l'écoute. Et « Aucun signalement »
            s'affichait alors sur des données pas encore arrivées — le locataire
            redéclare ce qu'il croit perdu.
          */}
          {loading ? (
            <div
              role="status"
              aria-busy="true"
              className="px-4 pb-4 text-body text-muted sm:px-5 sm:pb-5"
            >
              {t('common.loading')}
            </div>
          ) : miens.length === 0 ? (
            <div className="px-4 pb-4 sm:px-5 sm:pb-5">
              <EmptyState
                icon="bell"
                title={t('app.report.emptyTitle')}
                body={t('app.report.emptyBody')}
              />
            </div>
          ) : (
            <ul className="divide-y divide-divider border-t border-divider">
              {miens.map((work) => (
                <li key={work.id} className="flex flex-col gap-1 px-4 py-3.5 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    {/*
                      Le STATUT, sans le montant. Le devis et le coût regardent
                      le bailleur ; ce qui intéresse le locataire est où en est
                      SA demande.
                    */}
                    <StatusPill tone={TONE[work.status]} size="sm">
                      {t(`app.works.status.${work.status}` as 'app.works.status.reported')}
                    </StatusPill>
                    {work.reference && (
                      <span className="numeric text-caps text-muted">{work.reference}</span>
                    )}
                  </div>
                  <p className="text-body font-medium">{workTitle(work, t)}</p>
                  {/* CE QU'IL A ÉCRIT, et son écran ne le lui rendait pas.

                      Il saisit trois lignes sous « depuis quand, à quel moment,
                      ce que vous avez déjà tenté », les envoie, et la liste ne
                      portait que le titre : ni vérifier ce qu'il a transmis, ni
                      s'y référer au téléphone, ni voir qu'il a oublié
                      l'essentiel.

                      `text-pretty` et aucune coupe : c'est sa phrase, de
                      longueur non bornée, et la tronquer rendrait le rappel
                      inutile — c'est justement la fin qu'on relit. */}
                  {work.description && (
                    <p className="text-body text-pretty text-muted">{work.description}</p>
                  )}
                  <p className="text-caps text-muted">{d.dayMonth(work.reportedAt)}</p>
                  {/*
                    LE FIL, et il n'existait nulle part.

                    `workReply` est écrite par le serveur depuis longtemps :
                    quand le gestionnaire répond, une notification part vers le
                    compte du locataire, avec le texte et le `workId` qui la
                    rattache — son propre commentaire le dit, « sans lui, les
                    réponses s'empileraient sans dire de quoi elles parlent ».
                    Cette liste ne la lisait PAS. Le locataire déclarait, lisait
                    « Signalé », et n'avait plus aucune nouvelle.

                    C'est le défaut du lot précédent dans l'autre sens : là, ce
                    qui montait n'arrivait pas ; ici, ce qui descend n'était pas
                    montré.

                    LE TEXTE EST RENDU TEL QUEL — il vient d'un humain, comme
                    l'annonce. Il ne se traduit pas et n'est pas borné : c'est
                    `text-pretty` qui le tient, jamais une coupe.
                  */}
                  {(reponses.get(work.id) ?? []).map((r) => (
                    <div key={r.id} className="mt-1 border-l-2 border-divider pl-3">
                      {/* QUI A PARLÉ, et la carte le dit maintenant. Le fil ne
                          portait qu'un sens : toute ligne y était « Réponse de
                          votre gestionnaire ». Depuis que le locataire peut
                          répondre, la même étiquette sur sa propre phrase
                          ferait d'un échange un monologue. */}
                      <p className="text-caps text-muted">
                        {r.message === 'tenantReply'
                          ? t('app.report.replyMine')
                          : t('app.report.replyFrom')}{' '}
                        · {d.relative(r.at)}
                      </p>
                      <p className="text-body text-pretty">{r.data.text}</p>
                    </div>
                  ))}
                  {/* L'ABSENCE DE RÉPONSE SE DIT AUSSI, et seulement tant qu'on
                      en attend une : un chantier clos n'attend plus rien. Sans
                      cette ligne, « on ne m'a pas répondu » et « la réponse ne
                      s'affiche pas » se ressemblent, et le locataire n'a aucun
                      moyen de faire la différence. */}
                  {(reponses.get(work.id) ?? []).length === 0 && work.status !== 'done' && (
                    <p className="text-caps text-muted">{t('app.report.noReply')}</p>
                  )}
                  {/*
                    À TOUT STATUT, `done` COMPRIS — et le premier jet ne le
                    faisait pas.

                    Il calquait la condition sur la ligne « pas encore de
                    réponse » juste au-dessus, qui est bornée aux chantiers
                    ouverts pour une raison juste : un chantier clos n'ATTEND
                    plus rien. Mais répondre n'est pas attendre. L'écran des
                    travaux ouvre déjà la réponse du gestionnaire à tout statut,
                    et dit pourquoi : « c'est réparé, l'artisan est passé jeudi »
                    est précisément la réponse qui manque le plus.
                    Symétriquement, « non, ça fuit encore » est celle qu'il faut
                    pouvoir lui rendre — et la refuser rouvrait l'impasse que ce
                    lot ferme, un cran plus loin.
                  */}
                  {role === 'tenant' &&
                    (repond === work.id ? (
                      <div className="mt-2 grid gap-2">
                        <Field
                          label={t('app.report.replyLabel')}
                          hint={t('app.report.replyHint')}
                          {...(reponseErreur ? { error: t('app.report.replyError') } : {})}
                        >
                          {(champ) => (
                            <Textarea
                              {...champ}
                              rows={3}
                              value={reponse}
                              onChange={(e) => {
                                setReponse(e.target.value)
                                setReponseErreur(false)
                              }}
                            />
                          )}
                        </Field>
                        <div>
                          <Button
                            onClick={() => void envoyerLaReponse(work)}
                            disabled={reponseEnvoi}
                          >
                            {t('app.report.replySend')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setRepond(work.id)
                            setReponse('')
                            setReponseErreur(false)
                          }}
                        >
                          {t('app.report.replyLabel')}
                        </Button>
                      </div>
                    ))}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

