import { lazy, Suspense } from 'react'
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
const EspaceApplicatif = lazy(() =>
  import('./app/EspaceApplicatif').then((m) => ({ default: m.EspaceApplicatif })),
)

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
        <Route path="/inscription/:role" element={<SignUp />} />
        <Route path="/connexion" element={<Login />} />
        <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
        <Route path="/reinitialiser" element={<ResetPassword />} />

        {/*
          `/*` sur les deux : ce sont désormais des ROUTES DESCENDANTES.
          `EspaceApplicatif` porte sa propre `<Routes>` interne, qui matche la
          portion d'adresse restante — voir ce fichier pour le détail et pour ce
          que la mesure a décidé d'y enfermer.
        */}
        <Route
          path="/app/*"
          element={
            <Suspense fallback={<ChargementEspaceApplicatif />}>
              <EspaceApplicatif mode="app" />
            </Suspense>
          }
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
