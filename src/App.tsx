import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Landing } from './routes/Landing'
import { KitchenSink } from './routes/KitchenSink'
/*
  L'INSCRIPTION RESTE DANS LE PAQUET D'ENTRÉE, ET C'EST UNE DÉCISION MESURÉE.

  Elle y pèse 12 726 octets, et la détacher en `lazy()` en rendrait 17 170 —
  4 660 sur le fil, 93 ms à 400 kb/s sur CHAQUE première visite. La carte des
  sources la désigne donc comme une cible évidente, et elle ne l'est pas.

  `Combobox` a exactement TROIS consommateurs : `Tenants` et `ParkSettingsModal`
  dans l'espace applicatif, et cet écran. Tant qu'il est ici, `/demo` reçoit
  `Combobox` avec le paquet d'entrée ; détaché, il ne reste que deux morceaux
  DYNAMIQUES qui le partagent, Rollup en extrait un morceau de 3 340 octets, et
  `/demo` doit le demander. Mesuré le 2026-09-07 : `poids-ecrans` refuse,
  « 1 → 2 REQUÊTES », un aller-retour de 300 à 800 ms pour trois kilo-octets.

  Un préchargement au survol des six appels qui mènent ici — `Hero`,
  `FinalCta`, `PricingSection`, deux dans `PublicHeader`, `Login` — réparerait
  le chemin de conversion, mais pas cela : le coût tombe sur `/demo`, pas sur
  `/inscription`. Nelson a tranché le 2026-09-07 : 93 ms pour tous ne valent
  pas 300 à 800 ms pour ceux qui ouvrent la démonstration.

  Ce qui DÉBLOQUERAIT : un consommateur de `Combobox` dans le paquet d'entrée,
  ou le renoncer dans cet écran — il y sert le choix d'indicatif parmi deux
  cents pays, qu'un `Select` rendrait moins bien.
*/
import { SignUp } from './routes/SignUp'
import { Login } from './routes/Login'
import { ForgotPassword } from './routes/ForgotPassword'
import { ResetPassword } from './routes/ResetPassword'
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

        {/*
          LE KITCHEN-SINK NE PART PAS EN PRODUCTION, et le dépôt le disait déjà
          deux fois avant ce lot : `mesure-ui` l'exclut de son balayage —
          « personne ne l'ouvre », « elle déborde à toutes les largeurs, ce qui
          n'apprend rien », six minutes de balayage sur huit pour garder ce que
          nul n'utilise — et l'inventaire des routes ne le compte pas.

          Il coûtait pourtant 12 793 octets à CHAQUE visiteur, analysés avant
          que la vitrine réponde : c'est une planche de référence des
          composants, elle importe donc presque tous, et elle les tirait dans
          le paquet d'entrée que la page d'accueil charge.

          `import.meta.env.DEV` et non un morceau paresseux : détaché, il
          restait DEUX consommateurs dynamiques des mêmes primitives, et Rollup
          en extrayait un morceau partagé de trois kilo-octets que `/demo`
          devait alors demander — un aller-retour de 300 à 800 ms pour 3 Ko,
          exactement ce que `poids-ecrans` refuse. Mesuré, refusé, et voici
          l'autre voie : la page reste entière en développement, où on la
          consulte, et n'existe pas là où personne ne l'ouvre.
        */}
        {import.meta.env.DEV && <Route path="/kitchen-sink" element={<KitchenSink />} />}
        {/* Rendait la landing : une adresse fautive passait alors pour la page
            d'accueil, sans que rien ne signale l'erreur. */}
          <Route path="*" element={<NotFound />} />
      </Routes>
    </FrontiereDErreur>
  )
}
