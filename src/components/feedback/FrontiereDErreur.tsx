import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useT } from '@/i18n/I18nProvider'
import { Button } from '@/components/primitives/Button'
import { EcranSysteme } from './EcranSysteme'

/**
 * LA FRONTIÈRE D'ERREUR — parce que sans elle, une exception rend une PAGE BLANCHE.
 *
 * MESURÉ sur le paquet construit, avant ce lot, en injectant une exception à
 * deux endroits :
 *   · dans un composant de ROUTE (`Deposits`, sur `/demo/cautions`) ;
 *   · dans un composant IMBRIQUÉ dans un écran par ailleurs sain
 *     (`StackedBarChart`, dans `/demo`).
 * Les deux donnent le MÊME résultat : `#root` vide, 0 élément, 0 titre,
 * 0 sortie. La coquille n'est pas conservée, le panneau fautif n'est pas isolé —
 * React démonte l'arbre entier. Le second cas comptait : il aurait pu ne coûter
 * qu'un panneau, il coûte la page.
 *
 * OÙ ELLE EST POSÉE, ET CE QUE ÇA COÛTE.
 *
 * Dans `App`, autour des routes — donc SOUS les cinq fournisseurs. Elle couvre
 * le rendu de 108 des 111 modules ; échappent les six corps de rendu qui vivent
 * au-dessus (`I18nProvider`, `ThemeProvider`, `CurrencyProvider`,
 * `ToastProvider`, `SessionProvider`, `BandeauVersion`).
 *
 * La poser AU-DESSUS de `SessionProvider` les couvrirait, et c'est l'échange
 * qu'on refuse : sa réinitialisation remonterait le fournisseur, donc
 * relancerait la lecture de session — jusqu'à 13,88 s sur 3G lente, mesuré au
 * lot précédent — pour un plantage qui, dans 108 cas sur 111, n'a rien à voir
 * avec la session. On ne fait pas ressaisir une attente de quatorze secondes
 * pour une exception dans un graphe.
 *
 * ELLE N'AVALE PAS. Une exception attrapée qui ne laisse aucune trace change un
 * défaut visible en défaut invisible — le pire des deux. Sans télémétrie, qui
 * n'est pas le sujet, il reste deux traces : `console.error` avec la pile du
 * composant, que React écrit déjà et que ce composant complète ; et le message
 * de l'exception, RENDU dans l'écran de repli sous un dépliant. Il n'est pas
 * beau à lire ; il est la seule chose qu'un utilisateur puisse recopier dans un
 * message pour qu'on sache quoi chercher.
 *
 * PAS DE REPRISE AUTOMATIQUE. Une frontière qui se réinitialise seule remonte le
 * sous-arbre cassé, qui relève, qui la réinitialise : la boucle. Ici la reprise
 * est un GESTE — le bouton, ou un changement d'adresse. Si le sous-arbre relève
 * aussitôt, la frontière l'attrape à nouveau et s'arrête là : un rendu, pas une
 * boucle.
 */

interface Props {
  children: ReactNode
  /** Change à chaque navigation : la frontière s'efface alors d'elle-même. */
  cleDeRoute: string
  repli: (erreur: Error, reprendre: () => void) => ReactNode
}

interface State {
  erreur: Error | null
  /** La route sur laquelle l'erreur a été attrapée. */
  cleAuMomentDeLErreur: string | null
}

class Frontiere extends Component<Props, State> {
  state: State = { erreur: null, cleAuMomentDeLErreur: null }

  static getDerivedStateFromError(erreur: Error): Partial<State> {
    return { erreur }
  }

  /**
   * L'EFFACEMENT AU CHANGEMENT D'ADRESSE, et pourquoi il vit ici.
   *
   * Sans lui, l'écran de repli SURVIT à la navigation : on clique « Retour à
   * l'accueil », l'adresse change, et la même erreur reste affichée — la
   * frontière a piégé l'utilisateur sur l'écran censé le libérer. C'est le
   * défaut que ce composant est le plus susceptible d'avoir, parce qu'il ne se
   * voit qu'en essayant de sortir.
   *
   * On compare à la clé RETENUE AU MOMENT DE L'ERREUR plutôt que d'effacer sur
   * tout changement de props : sans cela, le rendu qui SUIT immédiatement la
   * capture effacerait l'erreur qu'on vient de poser, et la page redeviendrait
   * blanche au lieu de montrer le repli.
   */
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (state.erreur === null) return null
    if (state.cleAuMomentDeLErreur === null) return { cleAuMomentDeLErreur: props.cleDeRoute }
    if (state.cleAuMomentDeLErreur !== props.cleDeRoute) {
      return { erreur: null, cleAuMomentDeLErreur: null }
    }
    return null
  }

  componentDidCatch(erreur: Error, infos: ErrorInfo) {
    // La trace CONSULTABLE, et elle n'est envoyée nulle part. React écrit déjà
    // sa propre ligne ; celle-ci ajoute la pile de composants, qui dit QUEL
    // sous-arbre a lâché — la seule information qui manque quand on lit un
    // rapport d'utilisateur.
    console.error('[frontière] rendu interrompu :', erreur, infos.componentStack)
  }

  reprendre = () => {
    this.setState({ erreur: null, cleAuMomentDeLErreur: null })
  }

  render() {
    if (this.state.erreur) return this.props.repli(this.state.erreur, this.reprendre)
    return this.props.children
  }
}

/**
 * L'écran de repli.
 *
 * IL N'EST PAS MESURÉ PAR LA PORTE, et il faut le dire plutôt que de le laisser
 * croire : `scripts/mesure-ui.mjs` balaie des adresses, et aucune adresse ne
 * plante. Ce qui EST mesuré, ce sont ses matériaux — `Button` porte son plancher
 * de cible, `title-l` et `text-muted` leurs contrastes, et l'écran d'erreur de
 * session bâti sur les mêmes pièces au lot précédent tient les onze largeurs.
 * Emprunter ses pièces à un écran mesuré n'est pas une mesure ; c'est le
 * meilleur substitut disponible tant qu'aucune adresse ne mène ici.
 */
function RepliDErreur({ erreur, reprendre }: { erreur: Error; reprendre: () => void }) {
  const t = useT()
  return (
    <EcranSysteme
      ton="danger"
      titre={t('app.crash.title')}
      corps={t('app.crash.body')}
      actions={
        <>
          <Button onClick={reprendre}>{t('common.retry')}</Button>
          <Button to="/" variant="ghost">
            {t('common.backToHome')}
          </Button>
        </>
      }
    >
      {/* Replié : personne n'a besoin de lire une pile d'exception pour
          comprendre qu'il faut réessayer. Mais elle est LÀ, recopiable, pour
          qui veut dire ce qui s'est passé. */}
      <details className="mt-6 text-left">
        {/*
          `min-h-11` : UN DÉPLIANT EST UNE COMMANDE.

          Mesuré au navigateur, en atteignant cet écran par une exception
          injectée : 22 px de haut. La moitié du plancher de 44 que le produit
          tient partout ailleurs, et que `mesure-ui` vérifie sur 506 points — mais
          aucun de ces points ne mène ici, puisque aucune adresse ne plante. Le
          seul contrôle de tout l'écran qui échappait à la règle était celui de
          l'écran que la règle ne visite pas.

          `inline-flex items-center` et non un simple `block` : sans eux, la
          hauteur imposée laisserait le texte collé en haut de sa boîte.
        */}
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-body text-muted">
          {t('app.crash.details')}
        </summary>
        <p className="mt-2 break-words text-body text-muted">{erreur.message}</p>
      </details>
    </EcranSysteme>
  )
}

/** La frontière telle qu'on la monte : elle lit l'adresse pour savoir s'effacer. */
export function FrontiereDErreur({ children }: { children: ReactNode }) {
  const location = useLocation()
  return (
    <Frontiere
      cleDeRoute={location.pathname + location.search}
      repli={(erreur, reprendre) => <RepliDErreur erreur={erreur} reprendre={reprendre} />}
    >
      {children}
    </Frontiere>
  )
}
