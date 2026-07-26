/**
 * In-app notification bus — aggregates expiry alerts, approval requests,
 * clock anomalies, and FixBot flags into a single subscriber feed used
 * by the topbar bell, dashboard alert banner, and HR home banner.
 *
 * Server-issued notifications still flow through `trpc.notifications.list`
 * (the canonical persistent store). This bus is the ephemeral fan-out
 * for events that need to surface mid-session (e.g. a fresh expiry alert
 * computed in the browser after a document upload). The bell merges both
 * sources for display.
 */
type Severity = 'high' | 'medium' | 'low' | 'info';

export interface BusNotification {
  id: string;
  ts: number;
  source: 'documents' | 'forms' | 'clock' | 'fixbot' | 'ledger' | 'system';
  severity: Severity;
  title: string;
  detail?: string;
  href?: string;
}

type Listener = (n: BusNotification[]) => void;

class NotificationBus {
  private list: BusNotification[] = [];
  private listeners = new Set<Listener>();
  emit(n: Omit<BusNotification, 'id' | 'ts'>) {
    this.list = [{ ...n, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ts: Date.now() }, ...this.list].slice(0, 200);
    this.listeners.forEach(l => l(this.list));
  }
  subscribe(l: Listener) { this.listeners.add(l); l(this.list); return () => this.listeners.delete(l); }
  clear(id?: string) {
    this.list = id ? this.list.filter(n => n.id !== id) : [];
    this.listeners.forEach(l => l(this.list));
  }
  snapshot() { return [...this.list]; }
}

export const notificationBus = new NotificationBus();
