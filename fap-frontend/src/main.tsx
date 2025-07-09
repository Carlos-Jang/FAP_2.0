import { createRoot } from 'react-dom/client'    // ①
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error("root element not found")

createRoot(container).render(                     // ②
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
