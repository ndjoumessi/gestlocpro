import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { App } from './App'
import { I18nProvider } from './i18n/I18nProvider'
import { CurrencyProvider } from './currency/CurrencyProvider'
import { ToastProvider } from './components/primitives/Toast'
import { PortfolioProvider } from './data/PortfolioProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <CurrencyProvider>
          <ToastProvider>
            <PortfolioProvider>
              <App />
            </PortfolioProvider>
          </ToastProvider>
        </CurrencyProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
)
