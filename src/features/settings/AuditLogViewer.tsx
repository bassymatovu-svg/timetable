import React, { useState } from "react"
import { History, Search, Filter } from "lucide-react"
import { useDataStore } from "@/stores/useDataStore"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

export function AuditLogViewer() {
  const { auditLogs, currentInstitutionId } = useDataStore()
  const instLogs = auditLogs.filter((l) => l.institution_id === currentInstitutionId)

  const [search, setSearch] = useState("")
  const [filterAction, setFilterAction] = useState("all")

  const filteredLogs = instLogs.filter((l) => {
    const matchesSearch =
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.entity.toLowerCase().includes(search.toLowerCase()) ||
      (l.entity_id && l.entity_id.toLowerCase().includes(search.toLowerCase())) ||
      (l.diff && JSON.stringify(l.diff).toLowerCase().includes(search.toLowerCase()))

    const matchesAction = filterAction === "all" || l.action === filterAction

    return matchesSearch && matchesAction
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Audit Trail &amp; Activity Log</h2>
          <p className="text-xs text-slate-500">
            Immutable log of manual timetable moves, teacher substitutions, and curriculum requirement edits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <Input
              placeholder="Search action or entity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <select
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
          >
            <option value="all">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="batch_update">Batch Update</option>
            <option value="switch_institution">Tenant Switch</option>
          </select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Target ID</TableHead>
                <TableHead>Change Details / Diff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-slate-400">
                    <History className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    No audit records match the selected criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-[11px] font-mono text-slate-500">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.action === "create"
                            ? "primary"
                            : log.action === "delete"
                            ? "destructive"
                            : "outline"
                        }
                        className="text-[10px] font-mono py-0"
                      >
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-800">
                      {log.entity}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-slate-500">
                      {log.entity_id ? log.entity_id.substring(0, 18) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 font-mono max-w-md truncate">
                      {log.diff ? JSON.stringify(log.diff) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
