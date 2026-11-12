import { createRoot } from 'react-dom/client'
import App from './App'
import './style.css'

const root_el = document.getElementById('root')
if (root_el === null) {
  throw new Error('root element missing')
}

createRoot(root_el).render(<App />)
