import { I18nProvider } from '@yongstack/i18n-web'
import { ErrorBoundary } from '@yongstack/ui/components/error-boundary'
import { Toaster } from '@yongstack/ui/components/sonner'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider defaultLocale="zh-CN">
      <ErrorBoundary
        onError={(error, info) => {
          // 浏览器端无 Sentry SDK 时至少保留可检索的控制台日志
          console.error('[ui] uncaught render error', error, info.componentStack)
        }}
      >
        <App />
        <Toaster position="top-center" richColors />
      </ErrorBoundary>
    </I18nProvider>
  </StrictMode>,
)
