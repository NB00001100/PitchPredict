import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/geist-mono/wght.css'
import archivoLatin from '@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2?url'
import geistLatin from '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url'
import { StrictMode } from 'react'
import { preload } from 'react-dom'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// The headline and body faces are needed for first paint: fetch them now
// rather than when the stylesheet is first matched, so text settles early.
for (const href of [archivoLatin, geistLatin]) {
  preload(href, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
