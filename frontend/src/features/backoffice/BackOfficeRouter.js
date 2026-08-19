import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AdminDashboard from '../admin/pages/AdminDashboardPage';
import { BackOfficeAuthProvider, useBackOfficeAuth } from './BackOfficeAuthContext';
import BackOfficeShell from './BackOfficeShell';
import { AuditLogsPage, CarsPage, CommissionsPage, CustomersPage, DashboardPage, DisputesPage, FinancePage, FlightBookingsPage, HotelsPage, IntegrationsPage, LeadDetailPage, LeadsPage, PaymentsPage, PlaceholderPage, ProductBookingDetailPage, RefundsPage, ReportsPage, RolesPage, SecurityPage, SettingsPage, SupplierPaymentsPage, SuppliersPage, TasksPage, TeamPage, TeamsPage, TripDetailPage, TripsPage } from './BackOfficeDataPages';
import { PaymentAuthorizationDetailPage, PaymentAuthorizationsPage } from './SecurePaymentAdminPages';
import PaymentFlowTestPage from './PaymentFlowTestPage';
import './SecurePaymentAdmin.css';

function Guard({ permission, children }) { const { loading, profile, hasPermission } = useBackOfficeAuth(); if (loading) return <div className="bo-card">Loading back office…</div>; if (!profile) return <Navigate to="/admin/login" replace />; if (permission && !hasPermission(permission)) return <div className="bo-card"><h2>Access denied</h2><p>You do not have permission to open this module.</p></div>; return children; }
function Page({ permission, children }) { return <Guard permission={permission}><BackOfficeShell>{children}</BackOfficeShell></Guard>; }

export default function BackOfficeRouter() { return <BackOfficeAuthProvider><Routes>
  <Route path="backoffice" element={<Page permission="dashboard.view"><DashboardPage /></Page>} />
  <Route path="crm" element={<Navigate to="/admin/crm/leads" replace />} />
  <Route path="crm/leads" element={<Page permission="crm.leads.view"><LeadsPage /></Page>} />
  <Route path="crm/leads/:id" element={<Page permission="crm.leads.view"><LeadDetailPage /></Page>} />
  <Route path="crm/customers" element={<Page permission="crm.customers.view"><CustomersPage /></Page>} />
  <Route path="crm/customers/:id" element={<Page permission="crm.customers.view"><CustomersPage /></Page>} />
  <Route path="crm/tasks" element={<Page permission="crm.tasks.view"><TasksPage /></Page>} />
  <Route path="trips" element={<Page permission="trips.view"><TripsPage /></Page>} />
  <Route path="trips/:id" element={<Page permission="trips.view"><TripDetailPage /></Page>} />
  <Route path="bookings" element={<Navigate to="/admin/bookings/flights" replace />} />
  <Route path="bookings/flights" element={<Page permission="bookings.flights.view"><FlightBookingsPage /></Page>} />
  <Route path="bookings/flights/:code" element={<Page permission="bookings.flights.view"><AdminDashboard /></Page>} />
  <Route path="bookings/hotels" element={<Page permission="bookings.hotels.view"><HotelsPage /></Page>} />
  <Route path="bookings/hotels/:id" element={<Page permission="bookings.hotels.view"><ProductBookingDetailPage type="hotel" /></Page>} />
  <Route path="bookings/cars" element={<Page permission="bookings.cars.view"><CarsPage /></Page>} />
  <Route path="bookings/cars/:id" element={<Page permission="bookings.cars.view"><ProductBookingDetailPage type="car" /></Page>} />
  <Route path="payments" element={<Page permission="payments.view"><PaymentsPage /></Page>} />
  <Route path="payments/authorizations" element={<Page permission="authorization.view"><PaymentAuthorizationsPage /></Page>} />
  <Route path="payments/authorizations/:id" element={<Page permission="authorization.view"><PaymentAuthorizationDetailPage /></Page>} />
  <Route path="payments/refunds" element={<Page permission="payments.view"><RefundsPage /></Page>} />
  <Route path="payments/disputes" element={<Page permission="payments.view"><DisputesPage /></Page>} />
  <Route path="testing/payment-flow" element={<Page permission="admin.settings"><PaymentFlowTestPage /></Page>} />
  <Route path="finance" element={<Page permission="finance.view"><FinancePage /></Page>} />
  <Route path="finance/commissions" element={<Page permission="finance.commissions"><CommissionsPage /></Page>} />
  <Route path="finance/supplier-payments" element={<Page permission="finance.view"><SupplierPaymentsPage /></Page>} />
  <Route path="suppliers" element={<Page permission="suppliers.view"><SuppliersPage /></Page>} />
  <Route path="reports" element={<Page permission="reports.view"><ReportsPage /></Page>} />
  <Route path="team" element={<Navigate to="/admin/team/users" replace />} />
  <Route path="team/users" element={<Page permission="team.view"><TeamPage /></Page>} />
  <Route path="team/roles" element={<Page permission="team.view"><RolesPage /></Page>} />
  <Route path="team/teams" element={<Page permission="team.view"><TeamsPage /></Page>} />
  <Route path="settings" element={<Page permission="admin.settings"><SettingsPage /></Page>} />
  <Route path="settings/integrations" element={<Page permission="admin.integrations"><IntegrationsPage /></Page>} />
  <Route path="settings/email" element={<Page permission="admin.settings"><PlaceholderPage title="Email Templates" description="Existing booking email actions remain preserved; template management is a safe extension point." /></Page>} />
  <Route path="settings/security" element={<Page permission="admin.settings"><SecurityPage /></Page>} />
  <Route path="settings/audit-logs" element={<Page permission="admin.audit_logs"><AuditLogsPage /></Page>} />
  <Route path="*" element={<Navigate to="/admin/backoffice" replace />} />
</Routes></BackOfficeAuthProvider>; }
