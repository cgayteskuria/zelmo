import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Spin, ConfigProvider, App as AntdApp } from 'antd';
import frFR from 'antd/locale/fr_FR';
import { themeConfig } from './theme/antdTheme';

import { AuthProvider } from './contexts/AuthContext';
import { AntdStaticProvider } from './utils/antdStatic';
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";


// Lazy-loaded pages (code splitting)
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const Partners = lazy(() => import("./pages/crm/Partners"));
const Products = lazy(() => import("./pages/sales/Products"));
const Stocks = lazy(() => import("./pages/stock/Stocks"));
const StockMovementsList = lazy(() => import("./pages/stock/StockMovements"));
const DeliveryNotes = lazy(() => import("./pages/stock/DeliveryNotes"));
const DeliveryNote = lazy(() => import("./pages/stock/DeliveryNote"));

const Contacts = lazy(() => import("./pages/crm/Contacts"));
const Devices = lazy(() => import("./pages/crm/Devices"));
const SaleOrders = lazy(() => import("./pages/sales/SaleOrders"));
const SaleOrder = lazy(() => import("./pages/sales/SaleOrder"));
const PurchaseOrders = lazy(() => import("./pages/purchases/PurchaseOrders"));
const PurchaseOrder = lazy(() => import("./pages/purchases/PurchaseOrder"));

const Contracts = lazy(() => import("./pages/sales/Contracts"));
const Contract = lazy(() => import("./pages/sales/Contract"));
const GenerateContractInvoices = lazy(() => import("./pages/sales/GenerateContractInvoices"));

const Invoices = lazy(() => import("./pages/sales/Invoices"));
const Invoice = lazy(() => import("./pages/sales/Invoice"));

const Charges = lazy(() => import("./pages/accounting/Charges"));
const Charge = lazy(() => import("./pages/accounting/Charge"));

const AccountTransfers = lazy(() => import("./pages/accounting/AccountTransfers"));
const AccountTransfer = lazy(() => import("./pages/accounting/AccountTransfer"));
const AccountingEditions = lazy(() => import("./pages/accounting/AccountingEditions"));
const VatDeclarations = lazy(() => import("./pages/accounting/VatDeclarations"));
const VatDeclaration = lazy(() => import("./pages/accounting/VatDeclaration"));

const ExpenseReportWrapper = lazy(() => import("./pages/hr/expense/ExpenseReportWrapper"));
const ExpenseReports = lazy(() => import("./pages/hr/expense/ExpenseReports"));

const AccountMoves = lazy(() => import("./pages/accounting/AccountMoves"));
const AccountMove = lazy(() => import("./pages/accounting/AccountMove"));
const AccountLettering = lazy(() => import("./pages/accounting/AccountLettering"));
const AccountWorking = lazy(() => import("./pages/accounting/AccountWorking"));
const AccountingBackups = lazy(() => import("./pages/accounting/AccountingBackups"));
const AccountingImports = lazy(() => import("./pages/accounting/AccountingImports"));
const AccountingExports = lazy(() => import("./pages/accounting/AccountingExports"));
const AccountBankReconciliations = lazy(() => import("./pages/accounting/AccountBankReconciliations"));
const AccountBankReconciliation = lazy(() => import("./pages/accounting/AccountBankReconciliation"));
const AccountingClosures = lazy(() => import("./pages/accounting/AccountingClosures"));

const Tickets = lazy(() => import("./pages/assistance/Tickets"));
const Ticket = lazy(() => import("./pages/assistance/Ticket"));

const Payments = lazy(() => import("./pages/sales/Payments"));

const Users = lazy(() => import("./pages/settings/Users"));
// Settings
const Settings = lazy(() => import("./pages/settings/Settings"));
const Roles = lazy(() => import("./pages/settings/Roles"));
const TaxPositions = lazy(() => import("./pages/settings/TaxPositions"));
const Warehouses = lazy(() => import("./pages/settings/Warehouses"));
const Durations = lazy(() => import("./pages/settings/Durations"));
const Company = lazy(() => import("./pages/settings/Company"));
const MessageTemplates = lazy(() => import("./pages/settings/MessageTemplates"));
const MessageEmailAccounts = lazy(() => import("./pages/settings/MessageEmailAccounts"));
const ChargeTypes = lazy(() => import("./pages/settings/ChargeTypes"));
const ExpenseCategories = lazy(() => import("./pages/settings/ExpenseCategories"));
const Accounts = lazy(() => import("./pages/accounting/Accounts"));
const AccountJournals = lazy(() => import("./pages/accounting/AccountJournals"));
const PaymentModes = lazy(() => import("./pages/settings/PaymentModes"));
const Taxs = lazy(() => import("./pages/settings/Taxs"));
const TicketCategories = lazy(() => import("./pages/settings/TicketCategories"));
const TicketGrades = lazy(() => import("./pages/settings/TicketGrades"));
const TicketStatuses = lazy(() => import("./pages/settings/TicketStatuses"));
const TimeEntries  = lazy(() => import("./pages/time/TimeEntries"));
const TimeProjects = lazy(() => import("./pages/time/TimeProjects"));
const TimeWeekPage = lazy(() => import("./pages/time/TimeWeekPage"));
const TimeApproval = lazy(() => import("./pages/time/TimeApproval"));
const TimeInvoicing = lazy(() => import("./pages/time/TimeInvoicing"));
const TimeReports = lazy(() => import("./pages/time/TimeReports"));
const MyProfile = lazy(() => import("./pages/settings/MyProfile"));
const Sequences = lazy(() => import("./pages/settings/Sequences"));

// Prospection
const ProspectDashboard = lazy(() => import("./pages/crm/ProspectDashboard"));

const Opportunities = lazy(() => import("./pages/crm/Opportunities"));
const OpportunityPipeline = lazy(() => import("./pages/crm/OpportunityPipeline"));
const ProspectActivities = lazy(() => import("./pages/crm/ProspectActivities"));
const ProspectPipelineStages = lazy(() => import("./pages/settings/ProspectPipelineStages"));
const ProspectSources = lazy(() => import("./pages/settings/ProspectSources"));
const ProspectLostReasons = lazy(() => import("./pages/settings/ProspectLostReasons"));

import ProtectedRoute from "./components/common/ProtectedRoute";
import { isAuthenticated } from "./services/auth";
import AppLayout from './layout/AppLayout';
import { clearMenuCache } from './hooks/useMenu';

import './App.css'

function App() {

  //Vide le cache du menu
  useEffect(() => {
    const needsRefresh = sessionStorage.getItem('menu_needs_refresh');
    if (needsRefresh === '1') {
      clearMenuCache();
      sessionStorage.removeItem('menu_needs_refresh');
    }
  }, []);

  return (
    <ConfigProvider theme={themeConfig} locale={frFR}>
      <AuthProvider>
        <AntdApp>
          <AntdStaticProvider />
          <BrowserRouter>
            <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>}>
              <Routes>
                {/* Route racine : redirige selon l'authentification */}
                <Route
                  path="/"
                  element={
                    isAuthenticated() ? (
                      <Navigate to="/dashboard" replace />
                    ) : (
                      <Navigate to="/login" replace />
                    )
                  }
                />

                {/* Routes publiques : Login et reset password */}
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* Route protégée : Dashboard (authentification seulement) */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <AppLayout><Dashboard /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Partners - require permission */}
                <Route
                  path="/partners"
                  element={
                    <ProtectedRoute permission="partners.view">
                      <AppLayout><Partners /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Partners - require permission */}
                <Route
                  path="/suppliers"
                  element={
                    <ProtectedRoute permission="suppliers.view">
                      <AppLayout><Partners /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/customers"
                  element={
                    <ProtectedRoute permission="customers.view">
                      <AppLayout><Partners /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Products - require permission */}
                <Route
                  path="/products"
                  element={
                    <ProtectedRoute permission="products.view">
                      <AppLayout><Products /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Stocks - require permission */}
                <Route
                  path="/stocks"
                  element={
                    <ProtectedRoute permission="stocks.view">
                      <AppLayout><Stocks /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Stock Movements - require permission */}
                <Route
                  path="/stock-movements"
                  element={
                    <ProtectedRoute permission="stocks.view">
                      <AppLayout><StockMovementsList /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Customer Delivery Notes - require permission */}
                <Route
                  path="/customer-delivery-notes"
                  element={
                    <ProtectedRoute permission="stocks.view">
                      <AppLayout><DeliveryNotes /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Supplier Reception Notes - require permission */}
                <Route
                  path="/supplier-reception-notes"
                  element={
                    <ProtectedRoute permission="stocks.view">
                      <AppLayout><DeliveryNotes /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Customer Delivery Note Detail - require permission */}
                <Route
                  path="/customer-delivery-notes/:id"
                  element={
                    <ProtectedRoute permission="stocks.view">
                      <AppLayout><DeliveryNote /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Supplier Reception Note Detail - require permission */}
                <Route
                  path="/supplier-reception-notes/:id"
                  element={
                    <ProtectedRoute permission="stocks.view">
                      <AppLayout><DeliveryNote /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Contacts - require permission */}
                <Route
                  path="/contacts"
                  element={
                    <ProtectedRoute permission="contacts.view">
                      <AppLayout><Contacts /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Devices - require permission */}
                <Route
                  path="/devices"
                  element={
                    <ProtectedRoute permission="devices.view">
                      <AppLayout><Devices /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Sale Quotations - require permission */}
                <Route
                  path="/sale-quotations"
                  element={
                    <ProtectedRoute permission="sale-orders.view">
                      <AppLayout><SaleOrders /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/sale-quotations/:id"
                  element={
                    <ProtectedRoute permission="sale-orders.view">
                      <AppLayout><SaleOrder /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Sale Orders - require permission */}
                <Route
                  path="/sale-orders"
                  element={
                    <ProtectedRoute permission="sale-orders.view">
                      <AppLayout><SaleOrders /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/sale-orders/:id"
                  element={
                    <ProtectedRoute permission="sale-orders.view">
                      <AppLayout><SaleOrder /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Sale Quotations - require permission */}
                <Route
                  path="/purchase-quotations"
                  element={
                    <ProtectedRoute permission="purchase-orders.view">
                      <AppLayout><PurchaseOrders /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/purchase-quotations/:id"
                  element={
                    <ProtectedRoute permission="purchase-orders.view">
                      <AppLayout><PurchaseOrder /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Purchase Orders - require permission */}
                <Route
                  path="/purchase-orders"
                  element={
                    <ProtectedRoute permission="purchase-orders.view">
                      <AppLayout><PurchaseOrders /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/purchase-orders/:id"
                  element={
                    <ProtectedRoute permission="purchase-orders.view">
                      <AppLayout><PurchaseOrder /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Customer Invoices - require permission */}
                <Route
                  path="/customer-invoices"
                  element={
                    <ProtectedRoute permission="invoices.view">
                      <AppLayout><Invoices /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/customer-invoices/:id"
                  element={
                    <ProtectedRoute permission="invoices.view">
                      <AppLayout><Invoice /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Supplier Invoices - require permission */}
                <Route
                  path="/supplier-invoices"
                  element={
                    <ProtectedRoute permission="invoices.view">
                      <AppLayout><Invoices /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/supplier-invoices/:id"
                  element={
                    <ProtectedRoute permission="invoices.view">
                      <AppLayout><Invoice /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Customer Contracts - require permission */}
                <Route
                  path="/customercontracts"
                  element={
                    <ProtectedRoute permission="contracts.view">
                      <AppLayout><Contracts /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/customercontracts/:id"
                  element={
                    <ProtectedRoute permission="contracts.view">
                      <AppLayout><Contract /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Generate Invoices from Contracts - require permission */}
                <Route
                  path="/generate-contract-invoices"
                  element={
                    <ProtectedRoute permission="invoices.create">
                      <AppLayout><GenerateContractInvoices /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Supplier Contracts - require permission */}
                <Route
                  path="/suppliercontracts"
                  element={
                    <ProtectedRoute permission="contracts.view">
                      <AppLayout><Contracts /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/suppliercontracts/:id"
                  element={
                    <ProtectedRoute permission="contracts.view">
                      <AppLayout><Contract /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Charges - require permission */}
                <Route
                  path="/charges"
                  element={
                    <ProtectedRoute permission="charges.view">
                      <AppLayout><Charges /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/charges/:id"
                  element={
                    <ProtectedRoute permission="charges.view">
                      <AppLayout><Charge /></AppLayout>
                    </ProtectedRoute>
                  }
                />


                {/* Tickets (Assistance) */}
                <Route
                  path="/tickets"
                  element={
                    <ProtectedRoute permission="tickets.view">
                      <AppLayout><Tickets /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/tickets/:id"
                  element={
                    <ProtectedRoute permission="tickets.view">
                      <AppLayout><Ticket /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/expense-reports"
                  element={
                    <ProtectedRoute permission="expenses.approve">
                      <AppLayout><ExpenseReports /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/my-expense-reports"
                  element={
                    <ProtectedRoute permission="expenses.my.view">
                      <AppLayout><ExpenseReports /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/my-expense-reports/:id"
                  element={
                    <ProtectedRoute permission="expenses.my.view">
                      <AppLayout><ExpenseReportWrapper /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/expense-reports/:id"
                  element={
                    <ProtectedRoute permission="expenses.view">
                      <AppLayout><ExpenseReportWrapper /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Account Transfers - require permission */}
                <Route
                  path="/account-transfers"
                  element={
                    <ProtectedRoute permission="accountings.view">
                      <AppLayout><AccountTransfers /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/account-transfers/:id"
                  element={
                    <ProtectedRoute permission="accountings.view">
                      <AppLayout><AccountTransfer /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Account Moves - require permission */}
                <Route
                  path="/account-moves"
                  element={
                    <ProtectedRoute permission="accountings.view">
                      <AppLayout><AccountMoves /></AppLayout>
                    </ProtectedRoute>
                  }
                />



                <Route
                  path="/account-moves/:id"
                  element={
                    <ProtectedRoute permission="accountings.view">
                      <AppLayout><AccountMove /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Account Lettering - require permission */}
                <Route
                  path="/account-lettering"
                  element={
                    <ProtectedRoute permission="accountings.view">
                      <AppLayout><AccountLettering /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Account working - require permission */}
                <Route
                  path="/account-working"
                  element={
                    <ProtectedRoute permission="accountings.view">
                      <AppLayout><AccountWorking /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Account editions - require permission */}
                <Route
                  path="/accounting-editions"
                  element={
                    <ProtectedRoute permission="accountings.view">
                      <AppLayout><AccountingEditions /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Déclarations TVA */}
                <Route
                  path="/vat-declarations"
                  element={
                    <ProtectedRoute permission="accountings.view">
                      <AppLayout><VatDeclarations /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/vat-declarations/:id"
                  element={
                    <ProtectedRoute permission="accountings.view">
                      <AppLayout><VatDeclaration /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Account backups - require permission */}
                <Route
                  path="/accounting-backups"
                  element={
                    <ProtectedRoute permission="accountings.view">
                      <AppLayout><AccountingBackups /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Account imports - require permission */}
                <Route
                  path="/accounting-imports"
                  element={
                    <ProtectedRoute permission="accountings.view">
                      <AppLayout><AccountingImports /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Account exports - require permission */}
                <Route
                  path="/accounting-exports"
                  element={
                    <ProtectedRoute permission="accountings.view">
                      <AppLayout><AccountingExports /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                {/* Account exports - require permission */}
                <Route
                  path="/accounting-closures"
                  element={
                    <ProtectedRoute permission="accountings.view">
                      <AppLayout><AccountingClosures /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Account Bank Reconciliations - require permission */}
                <Route
                  path="/account-bank-reconciliations"
                  element={
                    <ProtectedRoute permission="accountings.view">
                      <AppLayout><AccountBankReconciliations /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/account-bank-reconciliations/:id"
                  element={
                    <ProtectedRoute permission="accountings.view">
                      <AppLayout><AccountBankReconciliation /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Customer Payments - require permission */}
                <Route
                  path="/customer-payments"
                  element={
                    <ProtectedRoute permission="payments.view">
                      <AppLayout><Payments /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Supplier Payments - require permission */}
                <Route
                  path="/supplier-payments"
                  element={
                    <ProtectedRoute permission="payments.view">
                      <AppLayout><Payments /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                {/* Supplier Payments - require permission */}
                <Route
                  path="/expense-payments"
                  element={
                    <ProtectedRoute permission="payments.view">
                      <AppLayout><Payments /></AppLayout>
                    </ProtectedRoute>
                  }
                />


                {/* Charge Payments - require permission */}
                <Route
                  path="/charge-payments"
                  element={
                    <ProtectedRoute permission="payments.view">
                      <AppLayout><Payments /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Users - require permission */}
                <Route
                  path="/users"
                  element={
                    <ProtectedRoute permission="users.view">
                      <AppLayout><Users /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Roles - require permission */}
                <Route
                  path="/settings/roles"
                  element={
                    <ProtectedRoute permission="users.view">
                      <AppLayout><Roles /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Tax Positions - require permission */}
                <Route
                  path="/settings/taxpositions"
                  element={
                    <ProtectedRoute permission="settings.taxs.view">
                      <AppLayout><TaxPositions /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                {/* Tax Positions - require permission */}
                <Route
                  path="/settings/company"
                  element={
                    <ProtectedRoute permission="settings.company.view">
                      <AppLayout><Company /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings/message-templates"
                  element={
                    <ProtectedRoute permission="settings.messagetemplates.view">
                      <AppLayout><MessageTemplates /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings/message-email-accounts"
                  element={
                    <ProtectedRoute permission="settings.messageemailaccounts.view">
                      <AppLayout><MessageEmailAccounts /></AppLayout>
                    </ProtectedRoute>
                  }
                />



                <Route
                  path="/settings/warehouses"
                  element={
                    <ProtectedRoute permission="stocks.edit">
                      <AppLayout><Warehouses /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Durations - route unifiée pour tous les types de durées */}
                <Route
                  path="/settings/durations/:type"
                  element={
                    <ProtectedRoute>
                      <AppLayout><Durations /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Charge Types */}
                <Route
                  path="/settings/charge-types"
                  element={
                    <ProtectedRoute permission="settings.charges.view">
                      <AppLayout><ChargeTypes /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Ticket Categories */}
                <Route
                  path="/settings/ticket-categories"
                  element={
                    <ProtectedRoute permission="settings.ticketingconf.view">
                      <AppLayout><TicketCategories /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Ticket Grades */}
                <Route
                  path="/settings/ticket-grades"
                  element={
                    <ProtectedRoute permission="settings.ticketingconf.view">
                      <AppLayout><TicketGrades /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Ticket Statuses */}
                <Route
                  path="/settings/ticket-statuses"
                  element={
                    <ProtectedRoute permission="settings.ticketingconf.view">
                      <AppLayout><TicketStatuses /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Expense Categories */}
                <Route
                  path="/settings/expense-categories"
                  element={
                    <ProtectedRoute permission="settings.expenses.view">
                      <AppLayout><ExpenseCategories /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Accounts */}
                <Route
                  path="/settings/accounts"
                  element={
                    <ProtectedRoute permission="accountings.view">
                      <AppLayout><Accounts /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Account Journals */}
                <Route
                  path="/settings/account-journals"
                  element={
                    <ProtectedRoute permission="accountings.view">
                      <AppLayout><AccountJournals /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Payment Modes */}
                <Route
                  path="/settings/payment-modes"
                  element={
                    <ProtectedRoute permission="accountings.view">
                      <AppLayout><PaymentModes /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Taxs */}
                <Route
                  path="/settings/taxs"
                  element={
                    <ProtectedRoute permission="accountings.view">
                      <AppLayout><Taxs /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Prospection */}
                <Route
                  path="/prospect-dashboard"
                  element={
                    <ProtectedRoute permission="opportunities.view">
                      <AppLayout><ProspectDashboard /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/prospects"
                  element={
                    <ProtectedRoute permission="prospects.view">
                      <AppLayout><Partners /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/opportunities"
                  element={
                    <ProtectedRoute permission="opportunities.view">
                      <AppLayout><Opportunities /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/opportunities/pipeline"
                  element={
                    <ProtectedRoute permission="opportunities.view">
                      <AppLayout><OpportunityPipeline /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/prospect-activities"
                  element={
                    <ProtectedRoute permission="opportunities.view">
                      <AppLayout><ProspectActivities /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Settings Prospection */}
                <Route
                  path="/settings/prospect-pipeline-stages"
                  element={
                    <ProtectedRoute permission="settings.prospectconf.view">
                      <AppLayout><ProspectPipelineStages /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings/prospect-sources"
                  element={
                    <ProtectedRoute permission="settings.prospectconf.view">
                      <AppLayout><ProspectSources /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings/prospect-lost-reasons"
                  element={
                    <ProtectedRoute permission="settings.prospectconf.view">
                      <AppLayout><ProspectLostReasons /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Suivi de temps */}
                <Route
                  path="/time-entries"
                  element={
                    <ProtectedRoute permission="time.view">
                      <AppLayout><TimeEntries /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/time-projects"
                  element={
                    <ProtectedRoute permission="time.view">
                      <AppLayout><TimeProjects /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/time-week"
                  element={
                    <ProtectedRoute permission="time.view">
                      <AppLayout><TimeWeekPage /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/time-approval"
                  element={
                    <ProtectedRoute permission="time.approve">
                      <AppLayout><TimeApproval /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/time-invoicing"
                  element={
                    <ProtectedRoute permission="time.invoice">
                      <AppLayout><TimeInvoicing /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/time-reports"
                  element={
                    <ProtectedRoute permission="time.view.all">
                      <AppLayout><TimeReports /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/my-profile"
                  element={
                    <ProtectedRoute>
                      <AppLayout><MyProfile /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Sequences */}
                <Route
                  path="/settings/sequences"
                  element={
                    <ProtectedRoute permission="settings.company.view">
                      <AppLayout><Sequences /></AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Settings - accessible to all authenticated users, filtering is done inside the component */}
                <Route
                  path="/settings/*"
                  element={
                    <ProtectedRoute>
                      <AppLayout><Settings /></AppLayout>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AntdApp>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default App
