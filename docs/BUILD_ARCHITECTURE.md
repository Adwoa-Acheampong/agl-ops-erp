# AGL Ops ERP Build Architecture

This document is the duplication handoff for the AGL Ops ERP build. It explains the app shape, front-end and back-end architecture, data model, major logic flows, and the checklist for duplicating the system later.

## Product Shape

AGL Ops is one React/Express/tRPC/MySQL ERP with two browser experiences served by the same codebase:

- Command Center: desktop-first ERP for management, finance, HR, workshop, inventory, sales, reporting, exports, audit logs, and administration.
- Staff Portal: mobile/tablet-first portal for QR clock-in/out, personal attendance, payroll summary, tasks, training, FixBot, and workshop supervisor access.

The app chooses the experience from hostname and route:

- `agl.software/*` opens the Command Center.
- `staff.agl.software/*` opens the Staff Portal.
- `agl.software/staff/*` also opens the Staff Portal.

## Stack

| Layer | Technology | Main Files |
|---|---|---|
| Frontend | React 18, Vite, React Router, Tailwind CSS, lucide-react | `src/`, `src/App.tsx`, `src/pages/` |
| API | Express + tRPC | `server/_core/index.ts`, `server/routers.ts` |
| Auth | Local signed session cookie with SDK fallback | `server/routers/auth.ts`, `server/_core/session.ts`, `server/_core/context.ts` |
| Database | MySQL via Drizzle ORM | `drizzle/schema.ts`, `server/db.ts`, `server/db.insert.ts` |
| Imports | SheetJS / XLSX scripts | `scripts/import-*.mjs`, `server/import.ts` |
| Audit | Persistent `audit_log` with memory fallback | `server/audit.ts`, `server/_core/trpc.ts` |
| Exports | CSV/XLSX/ZIP export center | `server/routers/exports.ts`, `src/pages/ExportCenterPage.tsx` |
| AI/FixBot | Optional Anthropic / built-in API configuration | `server/routers/fixbot.ts`, `src/pages/FixBotPage.tsx` |

## System Context

```mermaid
flowchart LR
  Admin["Admin / owner / manager"] --> Main["AGL Ops Command Center"]
  Staff["Staff phone / tablet"] --> Portal["Staff Portal"]
  Main --> API["Express + tRPC API"]
  Portal --> API
  API --> DB["MySQL"]
  API --> Audit["audit_log"]
  API --> Exports["CSV / XLSX / ZIP exports"]
  API --> AI["Optional FixBot AI"]
  Excel["Excel ledgers"] --> Scripts["Import scripts"]
  Scripts --> DB
```

## Runtime Request Flow

```mermaid
flowchart LR
  Browser["Browser / PWA"] --> React["React app"]
  React --> TRPCClient["tRPC React client<br/>src/lib/trpc.ts"]
  TRPCClient --> Express["Express server<br/>server/_core/index.ts"]
  Express --> Context["createContext<br/>session cookie -> user"]
  Context --> Router["appRouter<br/>server/routers.ts"]
  Router --> Procedures["public / protected / admin / tenant procedures"]
  Procedures --> Drizzle["Drizzle ORM"]
  Drizzle --> MySQL["MySQL database"]
  Procedures --> Audit["recordAudit()"]
  Audit --> AuditTable["audit_log"]
```

The server starts in `server/_core/index.ts`. It mounts tRPC at `/api/trpc`, registers OAuth callback routes, serves Vite middleware in development, and serves static `dist/` in production.

## Frontend Route Architecture

```mermaid
flowchart TD
  App["src/App.tsx"] --> HostCheck{"Hostname starts with staff.?"}
  HostCheck -->|Yes| StaffRoutes["Staff Portal routes<br/>/login, /kiosk, /*"]
  HostCheck -->|No| MainRoutes["Command Center routes"]
  MainRoutes --> Auth["RequireAuth"]
  Auth --> Tenant["RequireTenant"]
  Tenant --> Shell["AppShell navigation + footer"]
  Shell --> Pages["Lazy-loaded pages"]
  StaffRoutes --> StaffAuth["RequireAuth + RequireTenant"]
  StaffAuth --> StaffPortal["StaffPortalPage / StaffKioskPage"]
```

Important route groups:

| Route | Page | Purpose |
|---|---|---|
| `/` | `DashboardPage` | Command Center overview |
| `/workshop` | `WorkshopPage` | Kanban job board and workshop job creation |
| `/vsr/:id` | `VsrDetailPage` | Job-card details, parts, diagnostics, recalls |
| `/vehicles` | `VehiclesPage` | Fleet/customer vehicle records |
| `/inventory` | `InventoryPage` | SKU/service catalog, stock levels, import/export |
| `/sales` | `SalesPage` | Parts/POS sales and sales ledger workflow |
| `/finance`, `/expenses-hub`, `/creditors` | Finance pages | Sales ledger, expenses, purchases, creditors, P&L |
| `/hr` | `HRPage` | Roster, attendance, payroll, performance, documents |
| `/reports` | `ReportsPage` | BI, business reports, forms |
| `/marketing` | `MarketingPage` | Marketing spend / ROI tracker |
| `/audit` | `AuditPage` | Persistent audit log viewer |
| `/exports` | `ExportCenterPage` | CSV/XLSX/full ERP export |
| `/staff/*` or `staff.agl.software/*` | `StaffPortalPage` | Mobile staff workspace |

## Backend Router Map

The root API router is `server/routers.ts`.

```mermaid
flowchart TD
  AppRouter["appRouter"] --> Core["dashboard, sales, partsSales, workshop, expenses, purchaseOrders, inventory, creditSales, notifications"]
  AppRouter --> Appts["appointmentsRouter"]
  AppRouter --> Staff["staffManagement router"]
  AppRouter --> StaffPortal["staffPortal router"]
  AppRouter --> Payroll["payroll router"]
  AppRouter --> Finance["finance router"]
  AppRouter --> Reports["reports router"]
  AppRouter --> Admin["tenants, audit, exports, config, subscription"]
  AppRouter --> Ops["customers, schedules, share, sheets, monitoring, notify, fixbot"]
```

Procedure types:

- `publicProcedure`: no user required. Use sparingly.
- `protectedProcedure`: requires signed-in user and automatically audit-logs mutations.
- `adminProcedure`: requires `user.role === "admin"` and audit-logs admin mutations.
- `tenantProcedure`: requires signed-in user and resolves `tenantId`.
- `tenantAdminProcedure`: tenant-scoped and admin-only.

## Database Domain Map

```mermaid
erDiagram
  tenants ||--o{ staff : owns
  users ||--o{ audit_log : acts
  customers ||--o{ vehicles : owns
  customers ||--o{ service_appointments : books
  vehicles ||--o{ service_appointments : serviced
  service_appointments ||--o{ appointment_parts : includes
  service_appointments ||--o{ appointment_diagnostics : includes
  service_appointments ||--o{ appointment_recalls : can_have
  inventory ||--o{ appointment_parts : selected_for
  staff ||--o{ staff_attendance_logs : clocks
  staff ||--o{ payroll_runs : paid
  staff ||--o{ staff_training : assigned
  staff ||--o{ tasks : assigned
```

Primary tables by module:

| Module | Tables |
|---|---|
| Sales | `sales_transactions`, `credit_sales`, `transactions` |
| Workshop | `service_appointments`, `appointment_parts`, `appointment_diagnostics`, `appointment_recalls`, `workshop_jobs` |
| Customers/Vehicles | `customers`, `vehicles`, `customer_subscriptions` |
| Inventory | `inventory`, `inventory_categories`, `inventory_fitment`, `stock_issue_requests`, `appointment_parts` |
| Expenses/Purchases | `expenses`, `purchase_orders`, `payables` |
| HR | `staff`, `staff_attendance`, `staff_attendance_logs`, `staff_documents`, `staff_training`, `staff_schedules`, `staff_performance` |
| Payroll | `payroll_runs`, `staff`, `staff_attendance`, `staff_attendance_logs` |
| Reports/BI | Reads across sales, expenses, staff, attendance, payroll, appointments, inventory |
| Admin/Security | `users`, `tenants`, `audit_log` |
| Marketing | `marketing_spend` |

## Core Logic Flows

### Authentication And Tenant Resolution

```mermaid
sequenceDiagram
  participant U as User
  participant UI as React UI
  participant API as tRPC API
  participant CTX as createContext
  participant DB as MySQL

  U->>UI: Sign in
  UI->>API: auth.login mutation
  API->>DB: Validate users.email/passwordHash
  API-->>UI: Set signed session cookie
  UI->>API: Protected query/mutation
  API->>CTX: readSessionFromReq()
  CTX->>DB: Load user by session.userId
  API->>DB: tenantMiddleware resolves tenant by ownerEmail or tenant #1 fallback
```

Notes:

- Local credentials live in `users`.
- Roster records live in `staff`.
- Staff Portal links a login to a roster member by matching signed-in `users.email` to `staff.email`.
- Admin-only operations use `adminProcedure`.
- Tenant-scoped operations use `tenantProcedure`.

### Audit Logging

```mermaid
flowchart LR
  ProtectedMutation["Any protected/admin mutation"] --> AuditMiddleware["auditMutations middleware"]
  AuditMiddleware --> Record["recordAudit()"]
  Record --> Memory["In-memory last 500 fallback"]
  Record --> Table["audit_log table"]
  AuditPage["AuditPage"] --> AuditRouter["audit.list / audit.prune"]
  AuditRouter --> Table
```

Every protected mutation records action name, actor, IP, outcome, duration, and error if available. Unauthenticated and forbidden access attempts are also recorded by the auth/admin middleware.

### Sales Flow

```mermaid
flowchart TD
  SalesPage["SalesPage / POSPage"] --> PartsSales["partsSales router"]
  FinancePage["FinancePage edit"] --> SalesRouter["sales router"]
  PartsSales --> SalesTx["sales_transactions"]
  SalesRouter --> SalesTx
  SalesTx --> Reports["Dashboard / Finance / Reports"]
  SalesTx --> Creditors["Creditors if payment method/status indicates credit"]
```

Current behavior:

- Sales ledger revenue is read from `sales_transactions`.
- `SalesPage` and `POSPage` use the `partsSales` compatibility router.
- Finance ledger editing uses `sales.update`.
- Creditors are stored in `credit_sales` / `payables` depending on workflow.

### Workshop And Job Card Flow

```mermaid
flowchart TD
  Customer["Customer"] --> Vehicle["Vehicle"]
  Vehicle --> Appointment["service_appointments"]
  Appointment --> Kanban["Workshop Kanban columns"]
  Appointment --> VSR["/vsr/:id Job Card"]
  VSR --> Parts["appointment_parts"]
  VSR --> Diagnostics["appointment_diagnostics"]
  VSR --> Recalls["appointment_recalls"]
  Parts --> Invoice["/print/invoice/:id"]
  Diagnostics --> JobCard["/print/jobcard/:id"]
  Recalls --> JobCard
  Appointment --> MechanicTracker["Mechanic tracker / performance"]
```

Current implementation notes:

- `appointments.create` requires an existing customer and vehicle.
- `appointments.list` powers the Kanban board and mechanic tracker.
- `appointments.addPart` accepts manual parts/services or an `inventoryItemId`.
- In the current code, adding an inventory-linked appointment part decrements `inventory.quantity`; removing it restores quantity.
- Job card and invoice prints read from `service_appointments`, `appointment_parts`, `appointment_diagnostics`, and `appointment_recalls`.

If duplicating into a business where job-card inventory selection should not deduct stock, change that rule in `server/routers/appointments.ts` before deployment.

### Inventory Flow

```mermaid
flowchart TD
  InventoryPage["InventoryPage"] --> InvList["inventory.list"]
  InventoryPage --> InvCreate["inventory.create"]
  InventoryPage --> InvUpdate["inventory.update"]
  InventoryPage --> InvDelete["inventory.delete"]
  InvCreate --> Inventory["inventory table"]
  InvUpdate --> Inventory
  InvDelete --> Inventory
  WorkshopParts["appointment_parts with inventoryItemId"] --> Inventory
  Inventory --> InventoryLog["InventoryLogPage derived events"]
```

Inventory supports SKU/service catalog, decimal quantities, vehicle fitment fields, low-stock monitoring, import scripts, and export through the Export Center.

### HR, Attendance, Payroll

```mermaid
flowchart TD
  HRRoster["HR roster"] --> Staff["staff table"]
  ManualAttendance["Manual attendance form"] --> ImportedAttendance["staff_attendance"]
  StaffPortalClock["Staff Portal QR clock"] --> ImportedAttendance
  LiveClock["ClockInOutPage live clock"] --> Logs["staff_attendance_logs"]
  ImportedAttendance --> Payroll["payroll.computeMonthly"]
  Logs --> Payroll
  Staff --> Payroll
  Payroll --> PayrollRuns["payroll_runs on finalize"]
  Staff --> Training["staff_training"]
  Staff --> Documents["staff_documents"]
  Staff --> Performance["staff_performance"]
```

Attendance rules:

- `staff_attendance` stores imported/manual/portal-visible attendance ledger rows.
- `staff_attendance_logs` stores live clock logs.
- Admin, owner, and principal access roles are excluded from attendance/payroll reporting.
- Legal absence notes such as Holiday, PTO, and Sickday are treated as excused and should not receive penalties.
- Payroll is attendance-day based: base earned is proportional to payable days, then overtime and penalties are applied.

### Staff Portal QR Clock-In

```mermaid
sequenceDiagram
  participant K as Shop kiosk
  participant S as Staff phone
  participant API as staffPortal router
  participant DB as MySQL

  K->>API: qrChallenge(site)
  API-->>K: 30-second signed token
  S->>K: Scan live QR
  S->>API: clockIn/clockOut(token, site, device, gps?)
  API->>API: Verify HMAC token + time block
  API->>DB: Match user email to active staff.email
  API->>DB: Insert/update staff_attendance row
  API-->>S: Approved or rejected
```

Rules:

- QR token changes every 30 seconds.
- Server allows only the current block or one previous block for network lag.
- Screenshots or old QR links expire.
- Staff Portal blocks owner/admin accounts from staff clocking.
- Clock-in opens at 07:30; clock-out opens at 18:00.

### Reports And Exports

```mermaid
flowchart LR
  ReportsPage["ReportsPage"] --> BI["BI Dashboard"]
  ReportsPage --> Business["BusinessReportPage"]
  ReportsPage --> Forms["FormsPage"]
  BI --> Sales["sales_transactions"]
  BI --> Expenses["expenses"]
  Business --> HR["staff + attendance + payroll"]
  Business --> Workshop["service_appointments"]
  ExportCenter["ExportCenterPage"] --> ExportsRouter["exports.download"]
  ExportsRouter --> Tables["Selected ledger tables"]
  Tables --> CSVXLSX["CSV / XLSX / ZIP"]
```

Export targets include sales, inventory, inventory movements, expenses, purchase orders, creditors, workshop, customers, vehicles, HR attendance, payroll, staff, tasks/training, marketing, daily entries, audit logs, and full ERP backup.

## Revenue Logic Notes

Current implementation reads revenue primarily from `sales_transactions`. Workshop job cards are operational records for mechanic performance, invoices, diagnostics, parts, recalls, and vehicle history.

Important current behavior to review before any duplicate deployment:

- Appointment parts selected from inventory currently decrement stock.
- Manual appointment parts/services are stored in `appointment_parts`.
- Print invoices total appointment parts/services.
- Business reports and dashboards primarily read sales revenue from `sales_transactions`.
- If the intended rule is "sales ledger is revenue, workshop parts are records only except outhouse margin", implement that centrally in the finance/reporting layer and keep it documented there.

## Security And Access Model

```mermaid
flowchart TD
  User["users.role"] --> AppShell["Frontend nav visibility"]
  User --> Procedures["Backend procedure guards"]
  Procedures --> Protected["protectedProcedure"]
  Procedures --> Admin["adminProcedure"]
  Procedures --> Tenant["tenantProcedure"]
  Admin --> AdminOnly["Tenants, audit pruning, exports, admin operations"]
  Tenant --> TenantScoped["Staff portal, staff management, payroll"]
```

Role intent:

- `admin`: developer/system administrator; full access.
- `owner`: business owner; access to business system except developer-only admin areas.
- `manager` / operations manager: management workflows.
- Supervisors and staff: operational modules such as sales, workshop, inventory depending on role.
- Attendance reporting excludes admin/owner/principal roles.

Do not rely only on frontend hiding. Every sensitive operation must also be guarded in the backend procedure.

## Deployment And Duplication Checklist

1. Clone repository.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create `.env` from `.env.example`.
4. Set required environment values:

   ```bash
   DATABASE_URL=mysql://USER:PASSWORD@HOST:PORT/DATABASE
   JWT_SECRET=<48+ random bytes hex>
   TENANT_TIMEZONE=Africa/Accra
   STAFF_QR_SECRET=<random secret for staff QR clock>
   ANTHROPIC_API_KEY=<optional FixBot key>
   ```

5. Create or restore the MySQL database.
6. Apply schema/migrations:

   ```bash
   node scripts/apply-all-migrations.mjs
   ```

7. Build:

   ```bash
   npm run build
   ```

8. Start production:

   ```bash
   npm start
   ```

9. Configure web server/cPanel Node app to run the app root and serve the domain.
10. Configure DNS for the main ERP and staff portal.
11. Create the principal/admin account and tenant.
12. Create staff roster records with exact staff email addresses.
13. Test login, tenant resolution, sales, workshop, inventory, staff QR, attendance/payroll, audit logs, and exports.

## Files To Keep Out Of Git

Never commit:

- `.env`
- Database passwords / live connection strings
- `logins/`
- Excel imports and operational ledgers
- `dist/`
- `node_modules/`
- cPanel temporary patch scripts in `tmp/`
- ZIP archives generated for upload
- Production backups containing customer/staff data

The current `.gitignore` is configured to exclude those categories.

## Useful Maintenance Commands

```bash
# Build check
npm run build

# Start dev server
npm run dev

# Apply migrations
node scripts/apply-all-migrations.mjs

# List DB tables using DATABASE_URL
node scripts/list-tables.mjs

# Reset an admin password intentionally
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='new-secret' node scripts/reset-admin-password.mjs
```

## Root-Fix Rule For Future Changes

Before changing a feature, check what uses the same data path:

1. Frontend page or component.
2. tRPC procedure.
3. Drizzle table and column.
4. Reports, dashboard, exports, print pages, and audit side effects.
5. Role/access behavior.

Avoid patching only the screen. Fix the shared backend logic when a behavior affects more than one module.
