import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom"
import Home from "@/pages/Home"
import Verify from "@/pages/Verify"
import Results from "@/pages/Results"
import { Separator } from "@/components/ui/separator"

function Layout({ children }: { children: React.ReactNode }) {
  const loc = useLocation()

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-200 px-6 py-3 flex items-center justify-between">
        <Link to="/" className="font-mono text-sm font-medium text-zinc-900 no-underline">
          ForestCheck
        </Link>
        <nav className="flex items-center gap-6">
          {[
            { path: "/", label: "Home" },
            { path: "/verify", label: "Verify" },
            { path: "/results?demo=true", label: "Demo" },
          ].map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={`font-mono text-xs no-underline transition-colors ${
                loc.pathname === path.split("?")[0]
                  ? "text-zinc-900"
                  : "text-zinc-400 hover:text-zinc-700"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main>{children}</main>
      <Separator />
      <footer className="px-6 py-4 font-mono text-xs text-zinc-400">
        ForestCheck · PCCOE IGC Hackathon 2026 · AlphaEarth + XGBoost + Causal Counterfactuals
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><Home /></Layout>} />
        <Route path="/verify" element={<Layout><Verify /></Layout>} />
        <Route path="/results" element={<Layout><Results /></Layout>} />
      </Routes>
    </BrowserRouter>
  )
}
