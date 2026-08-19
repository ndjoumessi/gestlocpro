import type { ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import type { Role } from './features/auth/signupState'
import { Landing } from './routes/Landing'
import { Demo } from './routes/Demo'
import { Login } from './routes/Login'
import { ForgotPassword } from './routes/ForgotPassword'
import { ResetPassword } from './routes/ResetPassword'
import { SignUp } from './routes/SignUp'
import { KitchenSink } from './routes/KitchenSink'
import { NotFound, NotFoundInApp } from './routes/NotFound'
import { AppShell, RoleGuard } from './components/layout/AppShell'
import { RequireAuth } from './api/RequireAuth'
import { Dashboard } from './features/dashboard/Dashboard'
import { Portfolio } from './features/dashboard/Portfolio'
import { UnitFile } from './features/dashboard/UnitFile'
import { Payments } from './features/dashboard/Payments'
import { Meters } from './features/dashboard/Meters'
import { Inspections } from './features/dashboard/Inspections'
import { Works } from './features/dashboard/Works'
import { Deposits } from './features/dashboard/Deposits'
import { Tenants } from './features/dashboard/Tenants'
import { Alerts } from './features/dashboard/Alerts'
import { Signaler } from './features/dashboard/Signaler'
import { Access } from './features/dashboard/Access'
import { Onboarding } from './features/dashboard/Onboarding'
import { SystemStates } from './features/dashboard/SystemStates'
import { TenantPortal } from './features/dashboard/TenantPortal'
import { TenantDashboard, TenantRestricted } from './features/dashboard/TenantDashboard'
import { TenantDocuments } from './features/dashboard/TenantDocuments'
import { useSession } from './api/SessionProvider'

/** Raccourci : un écran réservé, avec le même écran de refus partout. */
function Restricted({ allow, children }: { allow: Role[]; children: ReactNode }) {
  return (
    <RoleGuard allow={allow} fallback={<TenantRestricted />}>
      {children}
    </RoleGuard>
  )
}

/**
 * Un écran de VITRINE : il montre le produit au lieu de le rendre.
 *
 * Le garde double celui de la navigation, et pour la raison que ce fichier
 * donne déjà des écrans de gestion — « pour que navigation et accès ne
 * divergent pas ». Retirer l'entrée en laissant l'adresse ouverte n'aurait
 * caché la vitrine qu'à qui ne l'avait jamais mise en signet.
 *
 * `NotFoundInApp` et non une redirection : sous un vrai compte, ces adresses
 * n'existent pas, et c'est ce qu'un 404 dit. Rediriger vers le tableau de bord
 * ferait passer une page absente pour une page déplacée.
 */
function Vitrine({ children }: { children: ReactNode }) {
  const { estDemo } = useSession()
  return <>{estDemo ? children : <NotFoundInApp />}</>
}

/**
 * Les écrans de l'application, montés sous DEUX adresses.
 *
 * `/app` pour un vrai espace, `/demo` pour la démonstration. Une seule
 * définition : deux listes de routes finiraient par diverger, et la
 * démonstration cesserait silencieusement de montrer ce que le produit fait.
 */
function ecransDeLApplication() {
  return (
    <>
      <Route index element={<Dashboard />} />
      {/* Écrans partagés : chacun applique son propre filtrage par rôle. */}
      <Route path="paiements" element={<Payments />} />
      <Route path="etats-des-lieux" element={<Inspections />} />
      <Route path="travaux" element={<Works />} />
      <Route path="signalements" element={<Alerts />} />
      {/* Les trois écrans du LOCATAIRE, aux adresses que porte sa navigation.
          « Mon espace » est une VRAIE route et non l'index : l'index sert trois
          rôles, et le locataire doit pouvoir mettre son espace en favori,
          revenir en arrière et partager l'adresse comme n'importe quel écran. */}
      <Route path="mon-espace" element={<TenantDashboard />} />
      <Route path="documents" element={<TenantDocuments />} />
      {/* Il déclare, et suit ses propres déclarations. */}
      <Route path="signaler" element={<Signaler />} />

      {/* Écrans de gestion : la même liste de rôles que dans la barre
          latérale, pour que navigation et accès ne divergent pas. */}
      <Route path="parc" element={<Restricted allow={['owner', 'manager']}><Portfolio /></Restricted>} />
      {/* Le dossier d'UN logement. Même garde que la liste dont il vient : une
          adresse forgée ne doit pas ouvrir à un locataire le dossier du voisin,
          et le serveur borne déjà ce qu'il rend. */}
      <Route
        path="parc/:unitId"
        element={
          <Restricted allow={['owner', 'manager']}>
            <UnitFile />
          </Restricted>
        }
      />
      {/* Ouverts au locataire : ce sont SES relevés et SA caution, et le
          portefeuille les borne déjà à son unité côté serveur. */}
      <Route path="releves" element={<Meters />} />
      <Route path="cautions" element={<Deposits />} />
      <Route path="locataires" element={<Restricted allow={['owner', 'manager']}><Tenants /></Restricted>} />
      {/* Le registre des accès : ouvert aux deux rôles de gestion, parce que le
          gestionnaire émet des codes de locataire au quotidien et qu'un code
          qu'on ne peut pas retrouver est un code qu'on réémet en double. Ce
          qu'il ne peut pas faire — retirer un accès, reprendre un code de
          gestionnaire — l'écran ne le lui propose pas. */}
      <Route path="acces" element={<Restricted allow={['owner', 'manager']}><Access /></Restricted>} />
      <Route path="prise-en-main" element={<Restricted allow={['owner']}><Onboarding /></Restricted>} />

      {/* Vitrines : le même garde que dans la barre latérale, où elles portent
          `vitrine: true`. */}
      <Route path="systeme" element={<Vitrine><SystemStates /></Vitrine>} />
      <Route path="portail" element={<Vitrine><TenantPortal /></Vitrine>} />

      {/* Écran inconnu sous /app : la coque et sa barre latérale restent
          affichées, puisqu'elles listent justement les écrans qui existent. */}
      <Route path="*" element={<NotFoundInApp />} />
    </>
  )
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route path="/inscription" element={<SignUp />} />
      {/* Entrée directe dans un parcours depuis la landing : l'étape de choix
          de rôle est alors sautée, mais reste atteignable par « Retour ». */}
      <Route path="/inscription/:role" element={<SignUp />} />
      <Route path="/connexion" element={<Login />} />
      <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
      <Route path="/reinitialiser" element={<ResetPassword />} />

      {/* La barrière enveloppe la coquille elle-même : la poser sur chaque
          écran laisserait la barre latérale s'afficher avant la redirection, et
          un visiteur verrait un instant la navigation d'un parc qui n'est pas
          le sien. */}
      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        {ecransDeLApplication()}
      </Route>

      {/* La démonstration porte sa propre adresse.
          Elle a d'abord vécu sous `/app`, signalée par un bandeau — et l'auteur
          du produit l'a prise deux fois pour son espace dans la même
          après-midi. Un avertissement se lit ; une adresse se regarde. */}
      <Route path="/demo" element={<Demo />}>
        {ecransDeLApplication()}
      </Route>

      <Route path="/kitchen-sink" element={<KitchenSink />} />
      {/* Rendait la landing : une adresse fautive passait alors pour la page
          d'accueil, sans que rien ne signale l'erreur. */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
