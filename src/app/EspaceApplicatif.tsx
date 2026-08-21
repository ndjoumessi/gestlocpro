import type { ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import type { Role } from '@/features/auth/signupState'
import { Demo } from '@/routes/Demo'
import { NotFoundInApp } from '@/routes/NotFoundInApp'
import { AppShell, RoleGuard } from '@/components/layout/AppShell'
import { RequireAuth } from '@/api/RequireAuth'
import { PortfolioProvider } from '@/data/PortfolioProvider'
import { useSession } from '@/api/SessionProvider'
import { Dashboard } from '@/features/dashboard/Dashboard'
import { Portfolio } from '@/features/dashboard/Portfolio'
import { UnitFile } from '@/features/dashboard/UnitFile'
import { Payments } from '@/features/dashboard/Payments'
import { Meters } from '@/features/dashboard/Meters'
import { Inspections } from '@/features/dashboard/Inspections'
import { Works } from '@/features/dashboard/Works'
import { Deposits } from '@/features/dashboard/Deposits'
import { Tenants } from '@/features/dashboard/Tenants'
import { Alerts } from '@/features/dashboard/Alerts'
import { Signaler } from '@/features/dashboard/Signaler'
import { Access } from '@/features/dashboard/Access'
import { Onboarding } from '@/features/dashboard/Onboarding'
import { SystemStates } from '@/features/dashboard/SystemStates'
import { TenantPortal } from '@/features/dashboard/TenantPortal'
import { TenantDashboard, TenantRestricted } from '@/features/dashboard/TenantDashboard'
import { TenantDocuments } from '@/features/dashboard/TenantDocuments'

/**
 * TOUT L'ESPACE APPLICATIF, chargé par UNE seule frontière.
 *
 * `App.tsx` ne monte plus ce fichier directement : il le charge par
 * `React.lazy`, une fois, quand l'adresse entre sous `/app` ou `/demo`. Ce
 * fichier statique importe à son tour les vingt écrans de gestion, la
 * coquille qui les porte et les données du parc — tout ce qui, avant ce lot,
 * partait dans le même paquet qu'un prospect qui n'ouvre que la page de vente.
 *
 * MESURÉ avant de trancher (voir le commit de ce lot) : `PortfolioProvider`
 * pèse à lui seul plus que les vingt écrans réunis — 70 Ko compressés contre
 * 39. Il n'a AUCUN consommateur public — `usePortfolio` ne s'appelle nulle
 * part hors de ce fichier et de ses écrans — et le laisser envelopper `<App/>`
 * dans `main.tsx`, comme avant, aurait rendu le découpage des ROUTES presque
 * inutile : la vitrine aurait continué de le télécharger. Il descend donc ICI,
 * à l'intérieur de la même frontière que les écrans qui le consomment.
 *
 * UNE SEULE FRONTIÈRE, PAS VINGT : `/app` et `/demo` partagent ce fichier au
 * lieu d'avoir chacun le leur, et un gestionnaire qui passe de `/app/paiements`
 * à `/app/parc` ne retraverse jamais la frontière — tout est déjà chargé. La
 * scinder par écran aurait payé un aller-retour réseau à chaque clic dans la
 * barre latérale, vingt fois par jour, pour économiser un octet qu'un visiteur
 * de la vitrine ne télécharge de toute façon jamais.
 */

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

/**
 * `<Routes>` IMBRIQUÉES, et non une liste de `<Route>` de plus dans `App.tsx`.
 *
 * C'est ce que React Router appelle des « routes descendantes » : elles se
 * matchent contre la portion d'adresse qui RESTE une fois `/app/*` ou
 * `/demo/*` reconnue par `App.tsx`, exactement comme si cette portion était
 * montée à la racine. Les chemins relatifs de `ecransDeLApplication` —
 * `paiements`, `parc/:unitId` — n'ont donc rien à changer : c'est le mécanisme
 * qui les rend imbricables, pas leur écriture.
 *
 * `PortfolioProvider` ENVELOPPE LES DEUX BRANCHES, pas une chacune : `/app` et
 * `/demo` partageaient une seule instance avant ce lot, montée une fois pour
 * toute la session. Deux instances distinctes changeraient un comportement que
 * ce lot n'a pas à toucher.
 */
export function EspaceApplicatif({ mode }: { mode: 'app' | 'demo' }) {
  return (
    <PortfolioProvider>
      <Routes>
        <Route
          element={
            mode === 'app' ? (
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            ) : (
              <Demo />
            )
          }
        >
          {ecransDeLApplication()}
        </Route>
      </Routes>
    </PortfolioProvider>
  )
}
