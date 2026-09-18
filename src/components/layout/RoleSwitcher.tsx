import React from "react"
import { Shield, UserCheck } from "lucide-react"
import { useDataStore } from "@/stores/useDataStore"
import type { UserRole } from "@/types/database"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const ROLE_LABELS: Record<UserRole, { label: string; badge: "default" | "secondary" | "outline" | "primary" }> = {
  super_admin: { label: "Super Admin", badge: "default" },
  school_admin: { label: "School Admin", badge: "primary" },
  dept_head: { label: "Department Head", badge: "secondary" },
  teacher: { label: "Teacher", badge: "outline" },
  viewer: { label: "Student / Parent (Read Only)", badge: "outline" },
}

export function RoleSwitcher() {
  const { currentProfile, switchRole } = useDataStore()

  const currentRoleConfig = ROLE_LABELS[currentProfile.role] || {
    label: currentProfile.role,
    badge: "outline" as const,
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px] gap-1.5 px-2 bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
        >
          <Shield className="w-3 h-3 text-[#1D4ED8]" />
          <span>Role: <strong>{currentRoleConfig.label}</strong></span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[10px] text-slate-400 uppercase tracking-wider">
          Simulate Role &amp; RLS View
        </DropdownMenuLabel>
        {(Object.keys(ROLE_LABELS) as UserRole[]).map((roleKey) => (
          <DropdownMenuItem
            key={roleKey}
            onClick={() => switchRole(roleKey)}
            className="flex items-center justify-between text-xs py-1.5 cursor-pointer"
          >
            <span>{ROLE_LABELS[roleKey].label}</span>
            {currentProfile.role === roleKey && (
              <Badge variant="primary" className="text-[10px] py-0 px-1">
                Active
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
