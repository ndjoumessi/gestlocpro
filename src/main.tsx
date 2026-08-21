import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { App } from './App'
import { I18nProvider } from './i18n/I18nProvider'
import { ThemeProvider } from './theme/ThemeProvider'
import { CurrencyProvider } from './currency/CurrencyProvider'
import { ToastProvider } from './components/primitives/Toast'
import { SessionProvider } from './api/SessionProvider'
import { BandeauVersion } from './components/feedback/BandeauVersion'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        {/* Au-dessus de tout ce qui peint : le thème est une préférence de
            présentation, personne en dessous n'a besoin de la connaître. Le
            choix explicite est déjà posé sur `<html>` par le script d'amorçage
            de `index.html` ; ce fournisseur ne fait que le rendre modifiable. */}
        <ThemeProvider>
          <CurrencyProvider>
            <ToastProvider>
              {/*
                `PortfolioProvider` ne vit plus ici depuis ce lot : mesuré, il
                pèse à lui seul plus que les vingt écrans de gestion réunis, et
                aucune page publique ne l'a jamais consommé. Il descend avec
                l'espace applicatif dans `src/App.tsx`, sous la même frontière
                paresseuse — voir `src/app/EspaceApplicatif.tsx`. `SessionProvider`
                reste ICI : `Login` et `SignUp`, publics, en dépendent pour la
                connexion elle-même.
              */}
              <SessionProvider>
                <App />
                {/* Hors de `<App />` : l'avertissement vaut sur TOUTE page, y
                    compris l'accueil et l'inscription — c'est précisément là
                    qu'un code périmé a fait perdre le plus de temps. */}
                <BandeauVersion />
              </SessionProvider>
            </ToastProvider>
          </CurrencyProvider>
        </ThemeProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
)
