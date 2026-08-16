import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { App } from './App'
import { I18nProvider } from './i18n/I18nProvider'
import { CurrencyProvider } from './currency/CurrencyProvider'
import { ToastProvider } from './components/primitives/Toast'
import { PortfolioProvider } from './data/PortfolioProvider'
import { SessionProvider } from './api/SessionProvider'
import { BandeauVersion } from './components/feedback/BandeauVersion'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <CurrencyProvider>
          <ToastProvider>
            {/* Au-dessus du parc : celui-ci lira à terme les données du compte
                connecté, là où il sert encore un jeu de démonstration commun. */}
            <SessionProvider>
              <PortfolioProvider>
                <App />
                {/* Hors de `<App />` : l'avertissement vaut sur TOUTE page, y
                    compris l'accueil et l'inscription — c'est précisément là
                    qu'un code périmé a fait perdre le plus de temps. */}
                <BandeauVersion />
              </PortfolioProvider>
            </SessionProvider>
          </ToastProvider>
        </CurrencyProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
)
