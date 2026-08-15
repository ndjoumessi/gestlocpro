import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { App } from './App'
import { I18nProvider } from './i18n/I18nProvider'
import { CurrencyProvider } from './currency/CurrencyProvider'
import { ToastProvider } from './components/primitives/Toast'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <CurrencyProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </CurrencyProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
)
