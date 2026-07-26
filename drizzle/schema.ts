import { mysqlTable, mysqlSchema, AnyMySqlColumn, primaryKey, varchar, timestamp, foreignKey, int, mysqlEnum, text, index, decimal, json, datetime, date, unique, time, tinyint, boolean } from "drizzle-orm/mysql-core"
import { sql, relations } from "drizzle-orm"

export const migrationsApplied = mysqlTable("_migrations_applied", {
	tag: varchar({ length: 120 }).notNull(),
	appliedAt: timestamp("applied_at", { mode: 'date' }).defaultNow().notNull(),
	checksum: varchar({ length: 32 }).notNull(),
},
(table) => [
	primaryKey({ columns: [table.tag], name: "_migrations_applied_tag"})
]);

export const appointmentDiagnostics = mysqlTable("appointment_diagnostics", {
	id: int().autoincrement().primaryKey().notNull(),
	appointmentId: int().notNull().references(() => serviceAppointments.id),
	faultCode: varchar({ length: 32 }).notNull(),
	severity: mysqlEnum(['low','medium','high','critical']).notNull(),
	workOrder: text(),
	sequence: int().default(0).notNull(),
	createdAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
	sequenceNo: int(),
	systemComponent: varchar({ length: 120 }),
	actionRequired: text(),
},
(table) => [
]);

export const appointmentParts = mysqlTable("appointment_parts", {
	id: int().autoincrement().primaryKey().notNull(),
	appointmentId: int().notNull().references(() => serviceAppointments.id),
	inventoryItemId: int(),
	partName: varchar({ length: 255 }).notNull(),
	supplier: varchar({ length: 255 }),
	buyPrice: decimal({ precision: 10, scale: 2 }).notNull(),
	sellPrice: decimal({ precision: 10, scale: 2 }).notNull(),
	quantity: int().default(1).notNull(),
	createdAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'date' }).defaultNow().onUpdateNow().notNull(),
	sirId: int(),
	qtyReturned: int().default(0).notNull(),
},
(table) => [
	index("appointment_parts_sirId_idx").on(table.sirId)
]);

export const appointmentRecalls = mysqlTable("appointment_recalls", {
	id: int().autoincrement().primaryKey().notNull(),
	originalAppointmentId: int().notNull().references(() => serviceAppointments.id),
	recallReason: text().notNull(),
	penaltyAmount: decimal({ precision: 10, scale: 2 }).notNull(),
	mechanicIds: json().notNull(),
	status: mysqlEnum(['open','resolved']).default('open').notNull(),
	createdAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
	resolvedAt: timestamp({ mode: 'date' }),
},
(table) => [
]);

export const auditLog = mysqlTable("audit_log", {
	id: int().autoincrement().primaryKey().notNull(),
	at: timestamp({ mode: 'date' }).defaultNow().notNull(),
	userId: varchar({ length: 64 }),
	userName: varchar({ length: 255 }),
	action: varchar({ length: 120 }).notNull(),
	category: mysqlEnum(['mutation','auth','access']).notNull(),
	meta: json(),
	ip: varchar({ length: 45 }),
},
(table) => [
	index("audit_log_at_idx").on(table.at),
	index("audit_log_action_idx").on(table.action),
	index("audit_log_category_idx").on(table.category),
	index("audit_log_userId_at_idx").on(table.userId, table.at)
]);

export const botLogs = mysqlTable("bot_logs", {
	id: int().autoincrement().primaryKey().notNull(),
	tenantId: varchar({ length: 64 }),
	userId: int(),
	channel: mysqlEnum(['web','whatsapp','slack','api']).default('web').notNull(),
	command: varchar({ length: 40 }),
	inputText: text().notNull(),
	outputText: text(),
	tokensUsed: int(),
	latencyMs: int(),
	errorMessage: text(),
	createdAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
},
(table) => [
	index("bot_logs_userId_idx").on(table.userId),
	index("bot_logs_command_idx").on(table.command)
]);

export const communicationLog = mysqlTable("communication_log", {
	id: int().autoincrement().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	customerId: int().notNull().references(() => customers.id),
	appointmentId: int().references(() => serviceAppointments.id),
	channel: mysqlEnum(['sms','whatsapp','email']).notNull(),
	message: text().notNull(),
	status: mysqlEnum(['sent','delivered','failed','pending']).notNull(),
	provider: text(),
	externalId: text(),
	tenantId: text(),
},
(table) => [
]);

export const complaints = mysqlTable("complaints", {
	id: int().autoincrement().primaryKey().notNull(),
	tenantId: varchar({ length: 64 }).notNull(),
	customerId: int(),
	vsrId: int(),
	raisedBy: int(),
	description: text().notNull(),
	status: mysqlEnum(['open','in_progress','resolved']).default('open').notNull(),
	resolvedAt: datetime({ mode: 'string'}),
	resolvedBy: int(),
	resolutionNotes: text(),
	createdAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'date' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("complaints_tenant_status_idx").on(table.tenantId, table.status),
	index("complaints_customerId_idx").on(table.customerId)
]);

export const creditSales = mysqlTable("credit_sales", {
	id: int().autoincrement().primaryKey().notNull(),
	customerName: varchar("customer_name", { length: 255 }).notNull(),
	customerContact: varchar("customer_contact", { length: 20 }),
	totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
	amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).default('0.00'),
	amountDue: decimal("amount_due", { precision: 10, scale: 2 }).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	saleDate: date("sale_date", { mode: 'date' }).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	dueDate: date("due_date", { mode: 'date' }),
	status: mysqlEnum(['Pending','Partially Paid','Fully Paid','Overdue']).notNull(),
	notes: text(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
]);

export const customerSubscriptions = mysqlTable("customer_subscriptions", {
	id: int().autoincrement().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
	tenantId: int().notNull().references(() => tenants.id),
	customerId: int().notNull().references(() => customers.id),
	planId: int().notNull().references(() => subscriptionPlans.id),
	status: mysqlEnum(['active','paused','canceled']).default('active').notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	startDate: date({ mode: 'date' }).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	nextBillingDate: date({ mode: 'date' }),
	paymentMethod: varchar({ length: 100 }),
	autoRenew: tinyint().default(1).notNull(),
},
(table) => [
]);

// W4 — Wizardly ports: daily activity entries, planned schedules,
// training records, service catalog, KPI targets.

export const dailyEntries = mysqlTable("daily_entries", {
	id: int().autoincrement().primaryKey().notNull(),
	tenantId: int().notNull().references(() => tenants.id),
	entryDate: date({ mode: 'date' }).notNull(),
	category: mysqlEnum(['opening','cash_reconciliation','sales_summary','inventory_check','closing','handover','other']).default('other').notNull(),
	loggedBy: varchar({ length: 160 }),
	summary: varchar({ length: 255 }),
	details: text(),
	amountGhs: decimal({ precision: 12, scale: 2 }),
	flagged: tinyint().default(0).notNull(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
	index("de_tenant_date_idx").on(table.tenantId, table.entryDate),
	index("de_category_idx").on(table.category),
]);

export const staffSchedules = mysqlTable("staff_schedules", {
	id: int().autoincrement().primaryKey().notNull(),
	tenantId: int().notNull().references(() => tenants.id),
	staffId: int().notNull().references(() => staff.id),
	shiftDate: date({ mode: 'date' }).notNull(),
	startTime: time(),
	endTime: time(),
	role: varchar({ length: 60 }),
	notes: text(),
	status: mysqlEnum(['planned','confirmed','swapped','cancelled','no_show']).default('planned').notNull(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
	index("sched_staff_date_idx").on(table.staffId, table.shiftDate),
	index("sched_tenant_date_idx").on(table.tenantId, table.shiftDate),
]);

export const staffTraining = mysqlTable("staff_training", {
	id: int().autoincrement().primaryKey().notNull(),
	tenantId: int().notNull().references(() => tenants.id),
	staffId: int().notNull().references(() => staff.id),
	sessionCode: varchar({ length: 20 }).notNull(),
	sessionTitle: varchar({ length: 255 }).notNull(),
	sessionDate: date({ mode: 'date' }).notNull(),
	deliveredBy: varchar({ length: 160 }),
	competencyLevel: mysqlEnum(['aware','practising','competent','expert']),
	passed: tinyint().default(0).notNull(),
	notes: text(),
	signedOffBy: varchar({ length: 160 }),
	signedOffAt: datetime({ mode: 'string' }),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
	index("train_staff_idx").on(table.staffId),
	index("train_session_idx").on(table.sessionCode, table.sessionDate),
]);

export const serviceCatalog = mysqlTable("service_catalog", {
	id: int().autoincrement().primaryKey().notNull(),
	tenantId: int().notNull().references(() => tenants.id),
	serviceName: varchar({ length: 255 }).notNull(),
	category: varchar({ length: 120 }),
	priceGhs: decimal({ precision: 12, scale: 2 }),
	active: tinyint().default(1).notNull(),
	notes: text(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
	unique("service_name_uidx").on(table.tenantId, table.serviceName),
]);

export const kpiTargets = mysqlTable("kpi_targets", {
	id: int().autoincrement().primaryKey().notNull(),
	tenantId: int().notNull().references(() => tenants.id),
	metric: varchar({ length: 120 }).notNull(),
	target: decimal({ precision: 14, scale: 2 }).notNull(),
	unit: varchar({ length: 20 }).default('GHS').notNull(),
	period: mysqlEnum(['daily','weekly','monthly','quarterly','yearly']).default('monthly').notNull(),
	notes: varchar({ length: 255 }),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
	unique("kpi_metric_uidx").on(table.tenantId, table.metric, table.period),
]);

/**
 * AGL-CCR-001 — Customer Complaint Record.
 * One row per logged complaint. Categories/immediateActions are JSON arrays
 * so the form's checkbox sets can grow without migrations.
 */
export const customerComplaints = mysqlTable("customer_complaints", {
	id: int().autoincrement().primaryKey().notNull(),
	tenantId: int().notNull().references(() => tenants.id),
	complaintNo: varchar({ length: 40 }).notNull(),
	customerId: int(),
	customerName: varchar({ length: 255 }).notNull(),
	customerContact: varchar({ length: 64 }),
	vehicleId: int(),
	vehicleLabel: varchar({ length: 255 }),
	previousInvoiceRef: varchar({ length: 80 }),
	channel: mysqlEnum(['walk_in','whatsapp','phone','email','remote','other']).default('walk_in').notNull(),
	loggedBy: varchar({ length: 160 }),
	loggedAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	categories: json(),
	customerWords: text().notNull(),
	staffInvolved: varchar({ length: 400 }),
	immediateActions: json(),
	actionDescription: text(),
	promisedResolution: date({ mode: 'date' }),
	resolutionDeadline: date({ mode: 'date' }),
	actualResolution: text(),
	resolvedAt: date({ mode: 'date' }),
	customerSatisfied: tinyint(),
	status: mysqlEnum(['open','in_progress','resolved','escalated','closed']).default('open').notNull(),
	reviewedBy: varchar({ length: 160 }),
	escalatedToCeo: tinyint().default(0).notNull(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
	unique("complaints_no_uidx").on(table.complaintNo),
	index("complaints_tenant_idx").on(table.tenantId),
	index("complaints_status_idx").on(table.status),
	index("complaints_customer_idx").on(table.customerId),
]);

export const customers = mysqlTable("customers", {
	id: int().autoincrement().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
	name: text().notNull(),
	phone: varchar({ length: 20 }).notNull(),
	email: varchar({ length: 320 }),
	preferredContact: mysqlEnum(['sms','whatsapp','email']),
	notificationsEnabled: tinyint().default(1).notNull(),
	notes: text(),
	tenantId: text(),
},
(table) => [
	index("customers_tenantId_idx").on(table.tenantId),
	unique("customers_phone_unique").on(table.phone)
]);

export const expenses = mysqlTable("expenses", {
	id: int().autoincrement().primaryKey().notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	expenseDate: date("expense_date", { mode: 'date' }).notNull(),
	category: varchar({ length: 100 }).notNull(),
	description: text().notNull(),
	amount: decimal({ precision: 10, scale: 2 }).notNull(),
	paymentMethod: varchar("payment_method", { length: 50 }),
	// W3 — AGL daily sales reports separate Petty Cash (NOT deducted from
	// gross) from Sales Cash (deducted). Bank / MoMo are settlement
	// channels that don't move from the till at all.
	cashSource: mysqlEnum(['petty_cash','sales_cash','bank','momo','other']),
	deductedFromSales: tinyint().default(0).notNull(),
	vendor: varchar({ length: 255 }),
	approvedBy: varchar("approved_by", { length: 100 }),
	notes: text(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
	externalId: varchar("external_id", { length: 40 }),
},
(table) => [
	unique("expenses_external_id_uidx").on(table.externalId)
]);

export const fixbotConversations = mysqlTable("fixbot_conversations", {
	id: int().autoincrement().primaryKey().notNull(),
	tenantId: int(),
	userId: int().notNull(),
	title: varchar({ length: 240 }),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
]);

export const fixbotMessages = mysqlTable("fixbot_messages", {
	id: int().autoincrement().primaryKey().notNull(),
	conversationId: int().notNull(),
	role: mysqlEnum(['user','assistant','tool']).notNull(),
	content: text().notNull(),
	toolName: varchar({ length: 120 }),
	toolInput: json(),
	toolResult: json(),
	tokensIn: int(),
	tokensOut: int(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
},
(table) => [
]);

export const inventory = mysqlTable("inventory", {
	id: int().autoincrement().primaryKey().notNull(),
	itemName: varchar("item_name", { length: 255 }).notNull(),
	itemCode: varchar("item_code", { length: 50 }).notNull(),
	category: varchar({ length: 100 }).notNull(),
	// W8 — Discrete vehicle-fitment columns lifted from inventory_fitment
	// (most-specific row wins). cleanDescription = item_name with the
	// "— fits …" suffix stripped, so the UI can show a tidy column.
	vehicleMake: varchar({ length: 120 }),
	vehicleModel: varchar({ length: 255 }),
	yearMin: int(),
	yearMax: int(),
	engineCapacity: varchar({ length: 64 }),
	cleanDescription: varchar({ length: 255 }),
	// 2026-05: switched to DECIMAL(10,2) so fractional units (e.g. 1.5 L
	// of engine oil) can be tracked. Reads come back as strings via
	// drizzle's decimal type — the UI parses them with parseFloat.
	quantity: decimal({ precision: 10, scale: 2 }).notNull(),
	minStockLevel: decimal("min_stock_level", { precision: 10, scale: 2 }).notNull(),
	unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
	supplier: varchar({ length: 255 }),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	lastRestockDate: date("last_restock_date", { mode: 'date' }),
	notes: text(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
	unique("inventory_item_code_unique").on(table.itemCode)
]);

export const inventoryCategories = mysqlTable("inventory_categories", {
	id: int().autoincrement().primaryKey().notNull(),
	tenantId: int(),
	name: varchar({ length: 120 }).notNull(),
	description: text(),
	sortOrder: int().default(0),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
]);

export const inventoryFitment = mysqlTable("inventory_fitment", {
	id: int().autoincrement().primaryKey().notNull(),
	inventoryItemId: int().notNull().references(() => inventory.id),
	make: varchar({ length: 80 }).notNull(),
	model: varchar({ length: 255 }),
	yearMin: int(),
	yearMax: int(),
	engineCapacity: varchar({ length: 32 }),
	notes: text(),
	createdAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
},
(table) => [
	index("inventory_fitment_make_idx").on(table.make),
	unique("inventory_fitment_natural_uidx").on(table.inventoryItemId, table.make, table.model, table.yearMin, table.yearMax, table.engineCapacity)
]);

export const marketingSpend = mysqlTable("marketing_spend", {
	id: int().autoincrement().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
	tenantId: int().notNull().references(() => tenants.id),
	campaignName: varchar({ length: 255 }).notNull(),
	channel: mysqlEnum(['facebook','google','whatsapp','radio']).notNull(),
	budget: decimal({ precision: 12, scale: 2 }).notNull(),
	spent: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	leads: int().default(0),
	roi: decimal({ precision: 10, scale: 4 }),
	flaggedForReview: tinyint().default(0),
},
(table) => [
]);

export const monthlySummary = mysqlTable("monthly_summary", {
	id: int().autoincrement().primaryKey().notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	month: date({ mode: 'date' }).notNull(),
	totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }),
	totalTransactions: int("total_transactions"),
	avgTransactionValue: decimal("avg_transaction_value", { precision: 10, scale: 2 }),
	totalVehiclesServiced: int("total_vehicles_serviced"),
	workingDays: int("working_days"),
	avgVehiclesPerDay: decimal("avg_vehicles_per_day", { precision: 5, scale: 2 }),
	totalExpenses: decimal("total_expenses", { precision: 12, scale: 2 }),
	totalPoSpend: decimal("total_po_spend", { precision: 12, scale: 2 }),
	netPosition: decimal("net_position", { precision: 12, scale: 2 }),
	summaryData: json("summary_data"),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
	unique("monthly_summary_month_unique").on(table.month)
]);

export const notificationReads = mysqlTable("notification_reads", {
	id: int().autoincrement().primaryKey().notNull(),
	notificationId: int().notNull().references(() => notifications.id),
	userId: int().notNull().references(() => users.id),
	readAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
},
(table) => [
	unique("notification_reads_unique").on(table.notificationId, table.userId)
]);

export const notifications = mysqlTable("notifications", {
	id: int().autoincrement().primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	content: text().notNull(),
	type: mysqlEnum(['revenue_alert','attendance_alert','vehicle_alert','payment_alert','inventory_alert','general']).notNull(),
	recipientRole: varchar("recipient_role", { length: 50 }).notNull(),
	isRead: tinyint("is_read").default(0),
	readAt: timestamp("read_at", { mode: 'date' }),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
},
(table) => [
]);

export const payables = mysqlTable("payables", {
	id: int().autoincrement().primaryKey().notNull(),
	vendorName: varchar({ length: 255 }).notNull(),
	vendorContact: varchar({ length: 64 }),
	totalAmount: decimal({ precision: 12, scale: 2 }).notNull(),
	amountPaid: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	amountDue: decimal({ precision: 12, scale: 2 }).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	incurredOn: date({ mode: 'date' }).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	dueDate: date({ mode: 'date' }),
	status: mysqlEnum(['Pending','Partially Paid','Fully Paid','Overdue']).default('Pending').notNull(),
	category: varchar({ length: 80 }),
	notes: text(),
	createdAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'date' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("payables_status_idx").on(table.status),
	index("payables_dueDate_idx").on(table.dueDate)
]);

export const payrollRuns = mysqlTable("payroll_runs", {
	id: int().autoincrement().primaryKey().notNull(),
	tenantId: int().notNull().references(() => tenants.id),
	staffId: int().notNull().references(() => staff.id),
	year: int().notNull(),
	month: int().notNull(),
	baseMonthlyNet: decimal({ precision: 10, scale: 2 }).notNull(),
	bonusShare: decimal({ precision: 10, scale: 2 }).default('0.00').notNull(),
	overtimePay: decimal({ precision: 10, scale: 2 }).default('0.00').notNull(),
	latePenalty: decimal({ precision: 10, scale: 2 }).default('0.00').notNull(),
	noClockOutPenalty: decimal({ precision: 10, scale: 2 }).default('0.00').notNull(),
	recallPenaltyShare: decimal({ precision: 10, scale: 2 }).default('0.00').notNull(),
	netPay: decimal({ precision: 10, scale: 2 }).notNull(),
	finalizedAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
	finalizedBy: varchar({ length: 64 }),
},
(table) => [
]);

export const purchaseOrders = mysqlTable("purchase_orders", {
	id: int().autoincrement().primaryKey().notNull(),
	poNumber: varchar("po_number", { length: 50 }).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	poDate: date("po_date", { mode: 'date' }).notNull(),
	vendor: varchar({ length: 255 }).notNull(),
	description: text().notNull(),
	amount: decimal({ precision: 10, scale: 2 }).notNull(),
	status: mysqlEnum(['Pending','Approved','Received','Cancelled']).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	deliveryDate: date("delivery_date", { mode: 'date' }),
	notes: text(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
	unique("purchase_orders_po_number_unique").on(table.poNumber)
]);

export const salesTransactions = mysqlTable("sales_transactions", {
	id: int().autoincrement().primaryKey().notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	transactionDate: date("transaction_date", { mode: 'date' }).notNull(),
	customerName: varchar("customer_name", { length: 255 }),
	customerContact: varchar("customer_contact", { length: 64 }),
	channel: mysqlEnum(['Walk-In','WhatsApp','Phone','Instagram','TikTok','Boss','Delivery','Order']).notNull(),
	vehicle: varchar({ length: 255 }),
	partService: text("part_service").notNull(),
	quantity: decimal({ precision: 10, scale: 2 }),
	unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
	totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
	paymentMethod: mysqlEnum("payment_method", ['Cash','MoMo','Bank Transfer','Credit','POS']).notNull(),
	receiptNo: varchar("receipt_no", { length: 50 }),
	salesRep: varchar("sales_rep", { length: 100 }),
	mechanic: varchar({ length: 100 }),
	status: mysqlEnum(['Completed','Pending Payment','Pending','Cancelled','Queued','Awaiting','Delivered']).notNull(),
	workmanshipFee: decimal("workmanship_fee", { precision: 10, scale: 2 }),
	notes: text(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
	externalId: varchar("external_id", { length: 40 }),
},
(table) => [
	unique("sales_transactions_external_id_uidx").on(table.externalId)
]);

export const serviceAppointments = mysqlTable("service_appointments", {
	id: int().autoincrement().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
	customerId: int().notNull().references(() => customers.id),
	vehicleId: int().notNull().references(() => vehicles.id),
	scheduledDate: text().notNull(),
	scheduledTime: text(),
	serviceType: text().notNull(),
	status: mysqlEnum(['Scheduled','Checked In','In Progress','Ready','Completed','Cancelled','intake','diagnosis','awaiting_approval','approved','in_progress','quality_check','awaiting_payment','released']).default('Scheduled').notNull(),
	assignedMechanic: text(),
	estimatedCost: decimal({ precision: 10, scale: 2 }),
	actualCost: decimal({ precision: 10, scale: 2 }),
	notes: text(),
	notifiedAt: text(),
	tenantId: text(),
	customerComplaint: text(),
	observedSymptoms: text(),
	serviceFee: decimal({ precision: 10, scale: 2 }),
	vsrNo: varchar({ length: 20 }),
	intakeBy: int(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	dateIn: date({ mode: 'date' }),
	timeIn: time(),
	expectedCollection: datetime({ mode: 'string'}),
	reasonForVisit: text(),
	preExistingDamage: text(),
	customerAuthSignedAt: datetime({ mode: 'string'}),
	quoteRef: varchar({ length: 40 }),
	quotedAmountGhs: decimal({ precision: 12, scale: 2 }),
	approvedAmountGhs: decimal({ precision: 12, scale: 2 }),
	customerApprovedAt: datetime({ mode: 'string'}),
	partsTotalGhs: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	labourTotalGhs: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	jobTotalGhs: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	paymentMethod: varchar({ length: 32 }),
	amountPaidGhs: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	balanceGhs: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	receiptNo: varchar({ length: 40 }),
	cashierId: int(),
	paymentConfirmedAt: datetime({ mode: 'string'}),
	paystackReference: varchar({ length: 80 }),
	vehicleCleaned: tinyint().default(0).notNull(),
	testDrivePerformed: tinyint().default(0).notNull(),
	careAdvice: text(),
	customerFeedback: text(),
	releasedAt: datetime({ mode: 'string'}),
	// W3 — Job-card handover fields aligned with AGL-JC-001.
	vifNo: varchar({ length: 40 }),
	dateClosed: date({ mode: 'date' }),
	testDriveStatus: mysqlEnum(['yes','no','na']),
	supervisorSignoff: varchar({ length: 160 }),
	salesRepNotified: varchar({ length: 160 }),
	customerCollected: varchar({ length: 160 }),
	customerCollectedAt: datetime({ mode: 'string' }),
},
(table) => [
	index("service_appointments_tenantId_status_idx").on(table.tenantId, table.status),
	index("service_appointments_status_idx").on(table.status),
	unique("service_appointments_vsrNo_uidx").on(table.vsrNo)
]);

export const sopDocuments = mysqlTable("sop_documents", {
	id: int().autoincrement().primaryKey().notNull(),
	tenantId: varchar({ length: 64 }).notNull(),
	source: varchar({ length: 160 }).notNull(),
	section: varchar({ length: 160 }),
	pageRef: varchar({ length: 40 }),
	content: text().notNull(),
	createdAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
},
(table) => [
	index("sop_tenant_idx").on(table.tenantId),
	index("sop_documents_content_ft").on(table.content)
]);

/**
 * WS4-C — Form submissions. Stores each submitted form template state,
 * the staff submitter, the optional manager approval (with signature),
 * and a JSON blob of the field values. The `signature` column carries
 * a base64 PNG so the original handwritten or typed signature can be
 * re-rendered on any retrieval.
 */
export const formSubmissions = mysqlTable('form_submissions', {
  id: int().autoincrement().primaryKey().notNull(),
  createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
  updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
  tenantId:    int().notNull().references(() => tenants.id),
  formId:      varchar({ length: 64 }).notNull(),
  formLabel:   varchar({ length: 200 }).notNull(),
  valuesJson:  text().notNull(),
  signature:   text(),
  submittedBy: varchar({ length: 160 }).notNull(),
  approvedBy:  varchar({ length: 160 }),
  approvedAt:  timestamp({ mode: 'date' }),
  status:      mysqlEnum(['draft','submitted','approved','rejected']).default('submitted').notNull(),
  notes:       text(),
});

/**
 * WS5-A — Employee documents (contracts, IDs, licences, certifications).
 * The file binary lives outside the DB — we keep only the metadata and
 * a relative storage path so the existing FS / S3 / Drive integration
 * can take over. `expiresAt` is optional; when present, the reminder
 * scheduler fires 30-day and 7-day pre-expiry alerts.
 */
export const staffDocuments = mysqlTable('staff_documents', {
  id: int().autoincrement().primaryKey().notNull(),
  createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
  updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
  tenantId:   int().notNull().references(() => tenants.id),
  staffId:    int().notNull().references(() => staff.id),
  docType:    mysqlEnum(['contract','national_id','ghana_card','drivers_license','certification','medical','training','other']).notNull(),
  filename:   varchar({ length: 200 }).notNull(),
  mimeType:   varchar('mime_type', { length: 100 }).notNull(),
  sizeBytes:  int('size_bytes').notNull(),
  storagePath:varchar('storage_path', { length: 500 }).notNull(),
  expiresAt:  date('expires_at', { mode: 'date' }),
  uploadedBy: int('uploaded_by'),
  notes:      text(),
});

export const staff = mysqlTable("staff", {
	id: int().autoincrement().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
	tenantId: int().notNull().references(() => tenants.id),
	name: text().notNull(),
	phone: varchar({ length: 20 }),
	email: varchar({ length: 320 }),
	role: mysqlEnum([
		'owner',
		'manager',
		'mechanic',
		'receptionist',
		'accountant',
		'sales_attendant',
		'sales_supervisor',
		'workshop_supervisor',
		'inventory_attendant',
	]).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	hireDate: date({ mode: 'date' }),
	status: mysqlEnum(['active','suspended','terminated']).default('active').notNull(),
	hourlyRate: decimal({ precision: 10, scale: 2 }),
	salaryType: mysqlEnum(['hourly','salary','monthly','commission']).notNull(),
	lastClockIn: timestamp({ mode: 'date' }),
	lastClockOut: timestamp({ mode: 'date' }),
	baseMonthlyNet: decimal({ precision: 10, scale: 2 }),
	// 2026-05 compliance fields. All nullable so the migration is
	// non-breaking; UI prompts for them on Add Member.
	ghanaCardId:    varchar('ghana_card_id',    { length: 24 }),
	ssnit:          varchar('ssnit',            { length: 24 }),
	healthInsurance:varchar('health_insurance', { length: 64 }),
	// Daily work envelope in HH:MM. When present, payroll uses this to
	// compute hoursPerDay; otherwise it falls back to 10 (08:00–18:00).
	workStart:      varchar('work_start',       { length: 5 }),
	workEnd:        varchar('work_end',         { length: 5 }),
},
(table) => [
]);

export const staffAttendance = mysqlTable("staff_attendance", {
	id: int().autoincrement().primaryKey().notNull(),
	staffName: varchar("staff_name", { length: 100 }).notNull(),
	role: varchar({ length: 100 }).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	clockInDate: date("clock_in_date", { mode: 'date' }).notNull(),
	clockInTime: varchar("clock_in_time", { length: 10 }),
	clockOutTime: varchar("clock_out_time", { length: 10 }),
	hoursWorked: decimal("hours_worked", { precision: 5, scale: 2 }),
	isLate: tinyint("is_late").default(0),
	notes: text(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
	externalId: varchar("external_id", { length: 40 }),
},
(table) => [
	unique("staff_attendance_external_id_uidx").on(table.externalId)
]);

export const staffAttendanceLogs = mysqlTable("staff_attendance_logs", {
	id: int().autoincrement().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
	staffId: int().notNull().references(() => staff.id),
	clockInTime: timestamp({ mode: 'date' }),
	clockOutTime: timestamp({ mode: 'date' }),
	locationGps: text(),
	deviceFingerprint: text(),
	overtimeHours: decimal({ precision: 5, scale: 2 }),
	approvedBy: int().references(() => staff.id),
},
(table) => [
]);

export const staffPerformance = mysqlTable("staff_performance", {
	id: int().autoincrement().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
	staffId: int().notNull().references(() => staff.id),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	monthStart: date({ mode: 'date' }).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	monthEnd: date({ mode: 'date' }).notNull(),
	jobsCompleted: int().default(0),
	avgJobTime: decimal({ precision: 10, scale: 2 }),
	customerRating: decimal({ precision: 3, scale: 2 }),
	revenueGenerated: decimal({ precision: 12, scale: 2 }),
	deductionsApplied: decimal({ precision: 10, scale: 2 }),
},
(table) => [
]);

export const stockIssueRequests = mysqlTable("stock_issue_requests", {
	id: int().autoincrement().primaryKey().notNull(),
	vsrId: int().notNull(),
	requestedBy: int().notNull(),
	approvedBy: int(),
	status: mysqlEnum(['pending','approved','issued','rejected']).default('pending').notNull(),
	notes: text(),
	createdAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'date' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("sir_vsrId_idx").on(table.vsrId),
	index("sir_status_idx").on(table.status)
]);

export const subscriptionPlans = mysqlTable("subscription_plans", {
	id: int().autoincrement().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
	tenantId: int().notNull().references(() => tenants.id),
	name: varchar({ length: 255 }).notNull(),
	monthlyPrice: decimal({ precision: 10, scale: 2 }).notNull(),
	yearlyPrice: decimal({ precision: 10, scale: 2 }).notNull(),
	benefitsJson: text(),
	isActive: tinyint().default(1).notNull(),
},
(table) => [
]);

export const tasks = mysqlTable("tasks", {
	id: int().autoincrement().primaryKey().notNull(),
	tenantId: varchar({ length: 64 }).notNull(),
	createdBy: int().notNull(),
	assignedTo: int(),
	title: varchar({ length: 200 }).notNull(),
	details: text(),
	dueDatetime: datetime({ mode: 'string'}),
	status: mysqlEnum(['open','done','cancelled']).default('open').notNull(),
	completedAt: datetime({ mode: 'string'}),
	createdAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'date' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("tasks_tenant_status_idx").on(table.tenantId, table.status),
	index("tasks_assignedTo_idx").on(table.assignedTo)
]);

export const tenants = mysqlTable("tenants", {
	id: int().autoincrement().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
	businessName: text().notNull(),
	ownerEmail: varchar({ length: 320 }).notNull(),
	subscriptionTier: mysqlEnum(['free','starter','pro','enterprise']).default('free').notNull(),
	isActive: tinyint().default(1).notNull(),
	brandingJson: text(),
	timezone: varchar({ length: 64 }),
},
(table) => [
]);

export const transactions = mysqlTable("transactions", {
	id: int().autoincrement().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
	tenantId: int().notNull().references(() => tenants.id),
	appointmentId: int().references(() => serviceAppointments.id),
	type: mysqlEnum(['sale','refund','expense','payroll','subscription']).notNull(),
	amount: decimal({ precision: 12, scale: 2 }).notNull(),
	currency: varchar({ length: 10 }).default('GHS').notNull(),
	paymentMethod: mysqlEnum(['cash','mobile_money','card']).notNull(),
	processedBy: int().references(() => staff.id),
	status: mysqlEnum(['pending','completed','flagged']).default('pending').notNull(),
},
(table) => [
	index("transactions_tenantId_type_idx").on(table.tenantId, table.type)
]);

export const users = mysqlTable("users", {
	id: int().autoincrement().primaryKey().notNull(),
	openId: varchar({ length: 64 }).notNull(),
	name: text(),
	email: varchar({ length: 320 }),
	loginMethod: varchar({ length: 64 }),
	role: mysqlEnum(['user','admin','owner','manager','staff','operations_manager','sales_supervisor','workshop_supervisor','sales_rep','mechanic','cashier']).default('user').notNull(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
	lastSignedIn: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	passwordHash: varchar({ length: 255 }),
},
(table) => [
	unique("users_openId_unique").on(table.openId),
	unique("users_email_unique").on(table.email)
]);

export const vehicles = mysqlTable("vehicles", {
	id: int().autoincrement().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
	customerId: int().notNull().references(() => customers.id),
	registrationNo: varchar({ length: 50 }).notNull(),
	make: text().notNull(),
	model: text(),
	year: text(),
	color: text(),
	notes: text(),
	tenantId: text(),
	chassisNumber: varchar({ length: 64 }),
	engineCapacity: varchar({ length: 32 }),
},
(table) => [
	unique("vehicles_registrationNo_unique").on(table.registrationNo)
]);

export const whatsappDeliveries = mysqlTable("whatsapp_deliveries", {
	id: int().autoincrement().primaryKey().notNull(),
	tenantId: int(),
	templateId: int(),
	customerId: int(),
	vehicleId: int(),
	toPhone: varchar({ length: 32 }).notNull(),
	renderedBody: text().notNull(),
	status: mysqlEnum(['queued','sending','sent','delivered','read','failed']).default('queued').notNull(),
	retryCount: int().default(0).notNull(),
	failureReason: text(),
	metaMessageId: varchar({ length: 120 }),
	scheduledFor: timestamp({ mode: 'date' }),
	sentAt: timestamp({ mode: 'date' }),
	deliveredAt: timestamp({ mode: 'date' }),
	readAt: timestamp({ mode: 'date' }),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
]);

export const whatsappTemplates = mysqlTable("whatsapp_templates", {
	id: int().autoincrement().primaryKey().notNull(),
	tenantId: int(),
	name: varchar({ length: 120 }).notNull(),
	category: mysqlEnum(['service_due','payment_reminder','renewal','follow_up','general']).default('general').notNull(),
	body: text().notNull(),
	variables: json(),
	approvedByMeta: tinyint().default(0),
	active: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
},
(table) => [
]);

export const workshopJobs = mysqlTable("workshop_jobs", {
	id: int().autoincrement().primaryKey().notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	jobDate: date("job_date", { mode: 'date' }).notNull(),
	vehicle: varchar({ length: 255 }).notNull(),
	registrationNo: varchar("registration_no", { length: 50 }),
	mechanics: text().notNull(),
	jobDescription: text("job_description").notNull(),
	status: mysqlEnum(['Completed','In Progress','Pending','On Hold']).notNull(),
	notes: text(),
	completedAt: timestamp("completed_at", { mode: 'date' }),
	createdAt: timestamp({ mode: 'date' }).default(sql`(now())`).notNull(),
	updatedAt: timestamp({ mode: 'date' }).default(sql`(now())`).onUpdateNow().notNull(),
	externalId: varchar("external_id", { length: 40 }),
},
(table) => [
	unique("workshop_jobs_external_id_uidx").on(table.externalId)
]);

/* ─────────────────────────────  Type helpers  ──────────────────────────────
 * The introspected schema doesn't export inferred row types. Hand-roll the
 * ones the rest of the codebase imports.
 */
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;
export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = typeof vehicles.$inferInsert;
export type ServiceAppointment = typeof serviceAppointments.$inferSelect;
export type InsertServiceAppointment = typeof serviceAppointments.$inferInsert;
export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = typeof inventory.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
export type MarketingSpend = typeof marketingSpend.$inferSelect;
export type InsertMarketingSpend = typeof marketingSpend.$inferInsert;
export type Staff = typeof staff.$inferSelect;
export type InsertStaff = typeof staff.$inferInsert;
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;
export type SalesTransaction = typeof salesTransactions.$inferSelect;
export type InsertSalesTransaction = typeof salesTransactions.$inferInsert;
export type WorkshopJob = typeof workshopJobs.$inferSelect;
export type InsertWorkshopJob = typeof workshopJobs.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = typeof purchaseOrders.$inferInsert;
export type CreditSale = typeof creditSales.$inferSelect;
export type InsertCreditSale = typeof creditSales.$inferInsert;
export type AppointmentPart = typeof appointmentParts.$inferSelect;
export type AppointmentRecall = typeof appointmentRecalls.$inferSelect;
