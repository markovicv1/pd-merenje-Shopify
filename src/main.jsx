import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import PDMeasurement from './PDMeasurement'

// ?app=oblik → prepoznavanje oblika lica (poseban interfejs); inače PD kalkulator
const FaceShape = lazy(() => import('./FaceShape'))
const app = new URLSearchParams(window.location.search).get('app')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {app === 'oblik'
      ? <Suspense fallback={null}><FaceShape /></Suspense>
      : <PDMeasurement />}
  </React.StrictMode>
)
