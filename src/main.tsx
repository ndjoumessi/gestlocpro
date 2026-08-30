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

/**
 * L'AGENT DE SERVICE, ET LES TROIS CONDITIONS DE SON ENREGISTREMENT.
 *
 * IL N'EXISTE QU'EN PRODUCTION. En développement, un cache entre le serveur de
 * Vite et la page rendrait le rechargement à chaud imprévisible — et c'est le
 * genre de doute qui coûte une heure avant qu'on y pense.
 *
 * APRÈS `load`, jamais avant. L'enregistrement est du réseau et du travail ; le
 * faire pendant que la page se peint retarde le premier rendu pour un bénéfice
 * qui ne sert qu'à la visite SUIVANTE.
 *
 * `updateViaCache: 'none'` — l'agent lui-même ne se lit jamais depuis le cache
 * HTTP. `express.static` pose `max-age=1h` sur tout ce qu'il sert, y compris
 * `/sw.js` : sans cette option, une correction d'agent pourrait attendre une
 * heure avant d'être seulement TÉLÉCHARGÉE. C'est exactement le genre de délai
 * qu'on ne veut pas entre une bévue de cache et son remède.
 *
 * L'ÉCHEC EST AVALÉ. Un navigateur qui refuse — mode privé, réglage
 * d'entreprise, contexte non sécurisé — doit rendre une application qui marche,
 * simplement sans sa moitié hors ligne. Rien ici n'est nécessaire au produit.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
      /* Sans agent, le produit fonctionne : il ne s'ouvre simplement pas hors
         ligne. Ce n'est pas une panne à signaler à l'utilisateur. */
    })
  })
}

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
