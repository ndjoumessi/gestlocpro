import { lazy, Suspense, type ReactNode } from 'react'
import {
  hoteApplicatif,
  RenvoiVersLApplication,
} from './routes/RenvoiVersLApplication'
import { Route, Routes } from 'react-router-dom'
import { Landing } from './routes/Landing'
import { Login } from './routes/Login'
import { ForgotPassword } from './routes/ForgotPassword'
import { ResetPassword } from './routes/ResetPassword'
import { SignUp } from './routes/SignUp'
import { KitchenSink } from './routes/KitchenSink'
import { NotFound } from './routes/NotFound'
import { useT } from './i18n/I18nProvider'
import { FrontiereDErreur } from './components/feedback/FrontiereDErreur'

/**
 * L'ESPACE APPLICATIF NE SE TÉLÉCHARGE QUE POUR QUI Y ENTRE.
 *
 * Mesuré avant ce lot : un seul paquet de 173 Ko compressés, pour toute
 * adresse — la page de vente comme le tableau de bord. Un prospect qui ouvre
 * `/` téléchargeait les vingt écrans de gestion, leurs données et leur
 * fournisseur de portefeuille avant de lire la première phrase.
 *
 * `React.lazy` scinde ici la SEULE frontière qui compte : un visiteur ne
 * retraverse jamais, dans le sens coûteux, la limite entre la vitrine et
 * l'application — qui se connecte a de toute façon un temps d'attente, qui
 * lit la vitrine n'ouvre jamais le tableau de bord. Le détail de ce qui vit de
 * l'autre côté est dans `src/app/EspaceApplicatif.tsx`, avec la mesure qui l'a
 * décidé.
 *
 * `.then((m) => ({ default: m.EspaceApplicatif }))` : le fichier exporte une
 * fonction NOMMÉE, comme le reste du dépôt, et non un export par défaut —
 * `scripts/check-orphelins.mjs` ne suit que `export function Nom`. `lazy()`
 * exige pourtant un module dont la résolution porte un `default` ; ce
 * `.then` fait le pont sans que le fichier lui-même ait à s'y plier.
 */
/**
 * LA PROMESSE DE LA FRONTIÈRE, MÉMORISÉE ET EXPORTÉE.
 *
 * Même forme, et pour la même raison, que `chargerAnglais` dans
 * `I18nProvider` : la frontière paresseuse expose la promesse qu'elle attend,
 * plutôt que de laisser ses observateurs GUETTER son effet dans le DOM.
 *
 * Ce qui l'a rendue nécessaire : `renderApp` attendait la DISPARITION du repli
 * de chargement, avec le budget d'horloge de mille millisecondes que
 * `waitForElementToBeRemoved` applique par défaut. Un budget n'est pas un
 * signal — il gagne quand la machine est rapide et perd quand elle ne l'est
 * pas, et le vert obtenu en relançant enseigne à relancer. `chargerAnglais`
 * n'avait jamais eu ce défaut, précisément parce qu'elle donne sa promesse à
 * attendre ; cette frontière-ci ne la donnait pas, faute de l'avoir extraite.
 *
 * `??=` : la promesse est un COUP UNIQUE et partagé. `lazy` en garde une, les
 * tests en attendent une autre — il faut que ce soit la MÊME, sans quoi on
 * attendrait un second `import()` pendant que React en résout un premier, et
 * l'attente redeviendrait une course.
 */
let promesseEspaceApplicatif: Promise<{ default: typeof import('./app/EspaceApplicatif').EspaceApplicatif }> | undefined

export function chargerEspaceApplicatif() {
  promesseEspaceApplicatif ??= import('./app/EspaceApplicatif').then((m) => ({
    default: m.EspaceApplicatif,
  }))
  return promesseEspaceApplicatif
}

const EspaceApplicatif = lazy(chargerEspaceApplicatif)

/**
 * Le repli du temps de téléchargement, PAS un squelette de données.
 *
 * Ce que `PortfolioProvider` sert plus loin — la doctrine du dépôt le dit déjà
 * dans son propre fichier — c'est qu'un squelette qu'aucune réponse ne vient
 * effacer est pire qu'une erreur : il promet que quelque chose arrive. Ce
 * repli-ci n'a pas ce risque : il ne dépend d'aucune réponse serveur, seulement
 * du paquet JavaScript qui vient de finir de se charger. Il disparaît donc
 * TOUJOURS, dans le temps d'un `import()`.
 *
 * `bg-canvas` et centré, sans mise en page : `Attente()` dans `RequireAuth.tsx`
 * pose le même fond pour la même raison juste après lui — rien ne doit
 * clignoter entre les deux, et `RequireAuth` vit désormais dans le paquet
 * paresseux, donc son propre repli ne peut pas servir ICI, avant que ce
 * paquet n'existe.
 *
 * `data-testid` : c'est le seul repère stable que `src/test/render.tsx` a
 * pour attendre la résolution du découpage avant de rendre la main à un
 * test — un texte traduit se retraduit, un rôle ARIA se réutilise ailleurs.
 */
function ChargementEspaceApplicatif() {
  const t = useT()
  return (
    <div
      data-testid="chargement-espace-applicatif"
      className="flex min-h-dvh items-center justify-center bg-canvas px-5"
    >
      <p aria-live="polite" className="text-body text-muted">
        {t('common.loading')}
      </p>
    </div>
  )
}

/**
 * CE QUI EXIGE UN SERVEUR NE S'AFFICHE PAS SUR UNE VITRINE QUI N'EN A PAS.
 *
 * `hoteApplicatif()` est vide partout sauf sur la vitrine — voir
 * `RenvoiVersLApplication` pour le récit complet, et pourquoi les redirections
 * du bord ne suffisaient pas. Ici, une seule ligne : ou l'écran, ou le renvoi.
 *
 * La DÉMONSTRATION et la page d'accueil ne passent pas par là : elles ne
 * parlent à aucun serveur, et ce sont elles que la vitrine existe pour montrer.
 */
function horsVitrine(ecran: ReactNode): ReactNode {
  return hoteApplicatif() ? <RenvoiVersLApplication /> : ecran
}

export function App() {
  /*
    LA FRONTIÈRE ENVELOPPE LES ROUTES, et rien de plus haut.

    Mesuré : une exception de rendu, qu'elle vienne d'un composant de route ou
    d'un composant imbriqué dans un écran sain, vidait `#root` — 0 élément,
    0 titre, 0 sortie. Les deux cas, pas seulement le premier.

    Ici, et pas dans `main.tsx` : au-dessus de `SessionProvider`, sa
    réinitialisation relancerait la lecture de session, jusqu'à 13,88 s sur
    3G lente. Voir l'en-tête de `FrontiereDErreur` pour l'échange complet et
    pour les six corps de rendu qui restent au-dessus d'elle.
  */
  return (
    <FrontiereDErreur>
      <Routes>
        <Route path="/" element={<Landing />} />

        <Route path="/inscription" element={<SignUp />} />
        {/* Entrée directe dans un parcours depuis la landing : l'étape de choix
            de rôle est alors sautée, mais reste atteignable par « Retour ». */}
        <Route path="/inscription/:role" element={horsVitrine(<SignUp />)} />
        <Route path="/connexion" element={horsVitrine(<Login />)} />
        <Route path="/mot-de-passe-oublie" element={horsVitrine(<ForgotPassword />)} />
        <Route path="/reinitialiser" element={horsVitrine(<ResetPassword />)} />

        {/*
          `/*` sur les deux : ce sont désormais des ROUTES DESCENDANTES.
          `EspaceApplicatif` porte sa propre `<Routes>` interne, qui matche la
          portion d'adresse restante — voir ce fichier pour le détail et pour ce
          que la mesure a décidé d'y enfermer.
        */}
        <Route
          path="/app/*"
          element={horsVitrine(
            <Suspense fallback={<ChargementEspaceApplicatif />}>
              <EspaceApplicatif mode="app" />
            </Suspense>,
          )}
        />
        <Route
          path="/demo/*"
          element={
            <Suspense fallback={<ChargementEspaceApplicatif />}>
              <EspaceApplicatif mode="demo" />
            </Suspense>
          }
        />

        <Route path="/kitchen-sink" element={<KitchenSink />} />
        {/* Rendait la landing : une adresse fautive passait alors pour la page
            d'accueil, sans que rien ne signale l'erreur. */}
          <Route path="*" element={<NotFound />} />
      </Routes>
    </FrontiereDErreur>
  )
}
