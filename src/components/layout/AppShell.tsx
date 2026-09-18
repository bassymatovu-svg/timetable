import React, { useState } from "react"
import { Sidebar, type NavView } from "./Sidebar"
import { Header } from "./Header"

interface AppShellProps {
  children: (currentView: NavView, setView: (v: NavView) => void) => React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [currentView, setCurrentView] = useState<NavView>("master_grid")

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Sidebar navigation */}
      <Sidebar currentView={currentView} onSelectView={setCurrentView} />

      {/* Main content column */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Header currentView={currentView} />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[1600px] mx-auto">
            {children(currentView, setCurrentView)}
          </div>
        </main>
      </div>
    </div>
  )
}
