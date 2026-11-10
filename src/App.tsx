/* Main App Component - Handles routing (using react-router-dom), query client and other providers - use this file to add all routes */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Index from './pages/Index'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'
import Login from './pages/Login'
import { AuthProvider, useAuth } from '@/lib/auth'
import { Loader2 } from 'lucide-react'

// ONLY IMPORT AND RENDER WORKING PAGES, NEVER ADD PLACEHOLDER COMPONENTS OR PAGES IN THIS FILE
// AVOID REMOVING ANY CONTEXT PROVIDERS FROM THIS FILE (e.g. TooltipProvider, Toaster, Sonner)

/** Sem sessão válida não há tela: o app inteiro exige login. */
function Portao({ children }: { children: React.ReactNode }) {
  const { autenticado, carregando } = useAuth()

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!autenticado) return <Login />
  return <>{children}</>
}

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Portao>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Index />} />
              {/* ADD ALL CUSTOM ROUTES MUST BE ADDED HERE */}
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Portao>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
