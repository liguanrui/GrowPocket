import { BrowserRouter } from 'react-router-dom'
import { Router } from './router'

function App() {
  return (
    <BrowserRouter basename="/admin">
      <Router />
    </BrowserRouter>
  )
}

export default App
