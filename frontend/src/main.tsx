import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
// Initialize theme store early so the saved theme is applied before first paint
import './store/useThemeStore'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
