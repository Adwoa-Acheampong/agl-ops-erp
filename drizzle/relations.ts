import { relations } from "drizzle-orm/relations";
import { serviceAppointments, appointmentDiagnostics, appointmentParts, appointmentRecalls, communicationLog, customers, customerSubscriptions, subscriptionPlans, tenants, inventory, inventoryFitment, marketingSpend, notifications, notificationReads, users, staff, payrollRuns, vehicles, staffAttendanceLogs, staffPerformance, transactions } from "./schema";

export const appointmentDiagnosticsRelations = relations(appointmentDiagnostics, ({one}) => ({
	serviceAppointment: one(serviceAppointments, {
		fields: [appointmentDiagnostics.appointmentId],
		references: [serviceAppointments.id]
	}),
}));

export const serviceAppointmentsRelations = relations(serviceAppointments, ({one, many}) => ({
	appointmentDiagnostics: many(appointmentDiagnostics),
	appointmentParts: many(appointmentParts),
	appointmentRecalls: many(appointmentRecalls),
	communicationLogs: many(communicationLog),
	customer: one(customers, {
		fields: [serviceAppointments.customerId],
		references: [customers.id]
	}),
	vehicle: one(vehicles, {
		fields: [serviceAppointments.vehicleId],
		references: [vehicles.id]
	}),
	transactions: many(transactions),
}));

export const appointmentPartsRelations = relations(appointmentParts, ({one}) => ({
	serviceAppointment: one(serviceAppointments, {
		fields: [appointmentParts.appointmentId],
		references: [serviceAppointments.id]
	}),
}));

export const appointmentRecallsRelations = relations(appointmentRecalls, ({one}) => ({
	serviceAppointment: one(serviceAppointments, {
		fields: [appointmentRecalls.originalAppointmentId],
		references: [serviceAppointments.id]
	}),
}));

export const communicationLogRelations = relations(communicationLog, ({one}) => ({
	serviceAppointment: one(serviceAppointments, {
		fields: [communicationLog.appointmentId],
		references: [serviceAppointments.id]
	}),
	customer: one(customers, {
		fields: [communicationLog.customerId],
		references: [customers.id]
	}),
}));

export const customersRelations = relations(customers, ({many}) => ({
	communicationLogs: many(communicationLog),
	customerSubscriptions: many(customerSubscriptions),
	serviceAppointments: many(serviceAppointments),
	vehicles: many(vehicles),
}));

export const customerSubscriptionsRelations = relations(customerSubscriptions, ({one}) => ({
	customer: one(customers, {
		fields: [customerSubscriptions.customerId],
		references: [customers.id]
	}),
	subscriptionPlan: one(subscriptionPlans, {
		fields: [customerSubscriptions.planId],
		references: [subscriptionPlans.id]
	}),
	tenant: one(tenants, {
		fields: [customerSubscriptions.tenantId],
		references: [tenants.id]
	}),
}));

export const subscriptionPlansRelations = relations(subscriptionPlans, ({one, many}) => ({
	customerSubscriptions: many(customerSubscriptions),
	tenant: one(tenants, {
		fields: [subscriptionPlans.tenantId],
		references: [tenants.id]
	}),
}));

export const tenantsRelations = relations(tenants, ({many}) => ({
	customerSubscriptions: many(customerSubscriptions),
	marketingSpends: many(marketingSpend),
	payrollRuns: many(payrollRuns),
	staff: many(staff),
	subscriptionPlans: many(subscriptionPlans),
	transactions: many(transactions),
}));

export const inventoryFitmentRelations = relations(inventoryFitment, ({one}) => ({
	inventory: one(inventory, {
		fields: [inventoryFitment.inventoryItemId],
		references: [inventory.id]
	}),
}));

export const inventoryRelations = relations(inventory, ({many}) => ({
	inventoryFitments: many(inventoryFitment),
}));

export const marketingSpendRelations = relations(marketingSpend, ({one}) => ({
	tenant: one(tenants, {
		fields: [marketingSpend.tenantId],
		references: [tenants.id]
	}),
}));

export const notificationReadsRelations = relations(notificationReads, ({one}) => ({
	notification: one(notifications, {
		fields: [notificationReads.notificationId],
		references: [notifications.id]
	}),
	user: one(users, {
		fields: [notificationReads.userId],
		references: [users.id]
	}),
}));

export const notificationsRelations = relations(notifications, ({many}) => ({
	notificationReads: many(notificationReads),
}));

export const usersRelations = relations(users, ({many}) => ({
	notificationReads: many(notificationReads),
}));

export const payrollRunsRelations = relations(payrollRuns, ({one}) => ({
	staff: one(staff, {
		fields: [payrollRuns.staffId],
		references: [staff.id]
	}),
	tenant: one(tenants, {
		fields: [payrollRuns.tenantId],
		references: [tenants.id]
	}),
}));

export const staffRelations = relations(staff, ({one, many}) => ({
	payrollRuns: many(payrollRuns),
	tenant: one(tenants, {
		fields: [staff.tenantId],
		references: [tenants.id]
	}),
	staffAttendanceLogs_approvedBy: many(staffAttendanceLogs, {
		relationName: "staffAttendanceLogs_approvedBy_staff_id"
	}),
	staffAttendanceLogs_staffId: many(staffAttendanceLogs, {
		relationName: "staffAttendanceLogs_staffId_staff_id"
	}),
	staffPerformances: many(staffPerformance),
	transactions: many(transactions),
}));

export const vehiclesRelations = relations(vehicles, ({one, many}) => ({
	serviceAppointments: many(serviceAppointments),
	customer: one(customers, {
		fields: [vehicles.customerId],
		references: [customers.id]
	}),
}));

export const staffAttendanceLogsRelations = relations(staffAttendanceLogs, ({one}) => ({
	staff_approvedBy: one(staff, {
		fields: [staffAttendanceLogs.approvedBy],
		references: [staff.id],
		relationName: "staffAttendanceLogs_approvedBy_staff_id"
	}),
	staff_staffId: one(staff, {
		fields: [staffAttendanceLogs.staffId],
		references: [staff.id],
		relationName: "staffAttendanceLogs_staffId_staff_id"
	}),
}));

export const staffPerformanceRelations = relations(staffPerformance, ({one}) => ({
	staff: one(staff, {
		fields: [staffPerformance.staffId],
		references: [staff.id]
	}),
}));

export const transactionsRelations = relations(transactions, ({one}) => ({
	serviceAppointment: one(serviceAppointments, {
		fields: [transactions.appointmentId],
		references: [serviceAppointments.id]
	}),
	staff: one(staff, {
		fields: [transactions.processedBy],
		references: [staff.id]
	}),
	tenant: one(tenants, {
		fields: [transactions.tenantId],
		references: [tenants.id]
	}),
}));