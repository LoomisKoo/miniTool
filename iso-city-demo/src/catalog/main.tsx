import { createRoot } from 'react-dom/client'
import { Preview } from './preview'

const el = document.getElementById('root')
if (el) createRoot(el).render(<Preview />)
