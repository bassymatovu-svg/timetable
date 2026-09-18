import React from "react"
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react"
import { useDataStore } from "@/stores/useDataStore"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export function InstitutionSwitcher() {
  const {
    currentInstitutionId,
    institutions,
    currentProfile,
    switchInstitution,
    addInstitution,
  } = useDataStore()

  const currentInstitution = institutions.find((i) => i.id === currentInstitutionId) || institutions[0]
  const isSuperAdmin = currentProfile.role === "super_admin"

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 rounded-md border border-slate-200">
        <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
        <span className="truncate">{currentInstitution?.name || "Institution"}</span>
      </div>
    )
  }

  const handleCreateNew = () => {
    const name = window.prompt("Enter new institution name:")
    if (name?.trim()) {
      const newInst = addInstitution({
        name: name.trim(),
        timezone: "UTC",
        settings: { working_days: [1, 2, 3, 4, 5] },
      })
      switchInstitution(newInst.id)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between bg-white text-xs font-medium border-slate-200 hover:bg-slate-50 text-slate-800 h-9 px-2.5"
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="w-3.5 h-3.5 text-[#1D4ED8] shrink-0" />
            <span className="truncate font-medium">{currentInstitution?.name || "Select Institution"}</span>
          </div>
          <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-[10px] text-slate-400 uppercase tracking-wider">
          Multi-Tenant Institutions
        </DropdownMenuLabel>
        {institutions.map((inst) => (
          <DropdownMenuItem
            key={inst.id}
            onClick={() => switchInstitution(inst.id)}
            className="flex items-center justify-between text-xs cursor-pointer py-2"
          >
            <div className="flex flex-col">
              <span className="font-medium text-slate-800">{inst.name}</span>
              <span className="text-[10px] text-slate-400">{inst.timezone}</span>
            </div>
            {inst.id === currentInstitutionId && (
              <Check className="w-4 h-4 text-[#1D4ED8]" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleCreateNew}
          className="text-xs text-[#1D4ED8] font-medium cursor-pointer flex items-center gap-2 py-2"
        >
          <Plus className="w-3.5 h-3.5" />
          Create New Institution
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
