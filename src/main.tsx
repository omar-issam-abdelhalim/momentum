import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { ToastProvider } from '@/components/ui/Toast'
import { registerSW } from 'virtual:pwa-register'
import './index.css'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
)
