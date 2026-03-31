import React from 'react'
import ReactDOM from 'react-dom/client'
import '../index.css'
import { App } from '../popup/App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App variant="tab" />
  </React.StrictMode>,
)
