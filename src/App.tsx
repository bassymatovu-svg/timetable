import React from "react"
import { AppShell } from "./components/layout/AppShell"
import { MasterGrid } from "./features/timetable/MasterGrid"
import { GeneratorPage } from "./features/generator/GeneratorPage"
import { IndividualTimetableView } from "./features/timetable/IndividualTimetableView"
import { SubstitutionManager } from "./features/substitutions/SubstitutionManager"
import { ImportWizard } from "./features/import/ImportWizard"
import { CurriculumBuilder } from "./features/curriculum/CurriculumBuilder"
import { ConstraintsConfigView } from "./features/constraints/ConstraintsConfigView"
import { TermsManager } from "./features/setup/TermsManager"
import { PeriodsBuilder } from "./features/setup/PeriodsBuilder"
import { RoomsManager } from "./features/setup/RoomsManager"
import { SubjectsManager } from "./features/setup/SubjectsManager"
import { TeachersManager } from "./features/setup/TeachersManager"
import { ClassGroupsManager } from "./features/setup/ClassGroupsManager"
import { WorkloadDashboard } from "./features/reports/WorkloadDashboard"
import { InstitutionManager } from "./features/setup/InstitutionManager"
import { AuditLogViewer } from "./features/settings/AuditLogViewer"
import type { NavView } from "./components/layout/Sidebar"

export function App() {
  return (
    <AppShell>
      {(currentView, setView) => {
        switch (currentView) {
          case "master_grid":
            return <MasterGrid />
          case "generator":
            return <GeneratorPage onNavigateToGrid={() => setView("master_grid")} />
          case "individual_views":
            return <IndividualTimetableView />
          case "substitutions":
            return <SubstitutionManager />
          case "smart_import":
            return <ImportWizard onNavigateToGrid={() => setView("master_grid")} />
          case "curriculum":
            return <CurriculumBuilder />
          case "constraints":
            return <ConstraintsConfigView />
          case "setup_terms":
            return <TermsManager />
          case "setup_periods":
            return <PeriodsBuilder />
          case "setup_rooms":
            return <RoomsManager />
          case "setup_subjects":
            return <SubjectsManager />
          case "setup_teachers":
            return <TeachersManager />
          case "setup_classes":
            return <ClassGroupsManager />
          case "reports":
            return <WorkloadDashboard />
          case "institutions_mgmt":
            return <InstitutionManager />
          case "audit_logs":
            return <AuditLogViewer />
          default:
            return <MasterGrid />
        }
      }}
    </AppShell>
  )
}

export default App
