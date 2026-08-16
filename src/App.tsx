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
import { Payments } from './features/dashboard/Payments'
import { Meters } from './features/dashboard/Meters'
import { Inspections } from './features/dashboard/Inspections'
import { Works } from './features/dashboard/Works'
import { Deposits } from './features/dashboard/Deposits'
import { Tenants } from './features/dashboard/Tenants'
import { Alerts } from './features/dashboard/Alerts'
import { Onboarding } from './features/dashboard/Onboarding'
import { SystemStates } from './features/dashboard/SystemStates'
import { TenantPortal } from './features/dashboard/TenantPortal'
import { TenantRestricted } from './features/dashboard/TenantDashboard'

/** Raccourci : un écran réservé, avec le même écran de refus partout. */
function Restricted({ allow, children }: { allow: Role[]; children: ReactNode }) {
  return (
    <RoleGuard allow={allow} fallback={<TenantRestricted />}>
      {children}
    </RoleGuard>
  )
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

      {/* Écrans de gestion : la même liste de rôles que dans la barre
          latérale, pour que navigation et accès ne divergent pas. */}
      <Route path="parc" element={<Restricted allow={['owner', 'manager']}><Portfolio /></Restricted>} />
      <Route path="releves" element={<Restricted allow={['owner', 'manager']}><Meters /></Restricted>} />
      <Route path="cautions" element={<Restricted allow={['owner', 'manager']}><Deposits /></Restricted>} />
      <Route path="locataires" element={<Restricted allow={['owner', 'manager']}><Tenants /></Restricted>} />
      <Route path="onboarding" element={<Restricted allow={['owner']}><Onboarding /></Restricted>} />

      <Route path="systeme" element={<SystemStates />} />
      <Route path="portail" element={<TenantPortal />} />

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
