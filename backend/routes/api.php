<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ApiMenuController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ApiPartnerController;
use App\Http\Controllers\Api\ApiPaymentModeController;
use App\Http\Controllers\Api\ApiPaymentConditionController;
use App\Http\Controllers\Api\ApiBankDetailsController;
use App\Http\Controllers\Api\ApiAccountController;
use App\Http\Controllers\Api\ApiAccountTransferController;
use App\Http\Controllers\Api\ApiUserController;
use App\Http\Controllers\Api\ApiRoleController;
use App\Http\Controllers\Api\ApiUserPermissionController;
use App\Http\Controllers\Api\ApiAccountTaxController;
use App\Http\Controllers\Api\ApiAccountTaxTagController;
use App\Http\Controllers\Api\ApiAccountTaxPositionController;
use App\Http\Controllers\Api\ApiProductController;
use App\Http\Controllers\Api\ApiStockController;
use App\Http\Controllers\Api\ApiStockMovementController;
use App\Http\Controllers\Api\ApiDeliveryNoteController;
use App\Http\Controllers\Api\ApiDeviceController;
use App\Http\Controllers\Api\ApiSaleOrderController;
use App\Http\Controllers\Api\ApiPurchaseOrderController;
use App\Http\Controllers\Api\ApiInvoiceController;
use App\Http\Controllers\Api\ApiContractController;
use App\Http\Controllers\Api\ApiPaymentController;
use App\Http\Controllers\Api\ApiContactController;
use App\Http\Controllers\Api\ApiDocumentController;
use App\Http\Controllers\Api\ApiCompanyController;
use App\Http\Controllers\Api\ApiChargeController;
use App\Http\Controllers\Api\ApiChargeTypeController;
use App\Http\Controllers\Api\ApiAccountMoveController;
use App\Http\Controllers\Api\ApiAccountJournalController;
use App\Http\Controllers\Api\ApiAccountLetteringController;
use App\Http\Controllers\Api\ApiAccountWorkingController;
use App\Http\Controllers\Api\ApiWarehouseController;
use App\Http\Controllers\Api\ApiAccountBankReconciliationController;
use App\Http\Controllers\Api\ApiAccountingEditionController;
use App\Http\Controllers\Api\ApiAccountingBackupController;
use App\Http\Controllers\Api\ApiAccountingClosureController;
use App\Http\Controllers\Api\ApiAccountingImportExportController;
use App\Http\Controllers\Api\ApiMessageTemplateController;
use App\Http\Controllers\Api\ApiMessageEmailAccountController;
use App\Http\Controllers\Api\ApiPurchaseOrderConfigController;
use App\Http\Controllers\Api\ApiSaleOrderConfigController;
use App\Http\Controllers\Api\ApiContractConfigController;
use App\Http\Controllers\Api\ApiInvoiceConfigController;
use App\Http\Controllers\Api\ApiDurationController;
use App\Http\Controllers\Api\ApiAccountConfigController;
use App\Http\Controllers\Api\ApiProspectPipelineStageController;
use App\Http\Controllers\Api\ApiProspectSourceController;
use App\Http\Controllers\Api\ApiProspectLostReasonController;
use App\Http\Controllers\Api\ApiProspectOpportunityController;
use App\Http\Controllers\Api\ApiProspectActivityController;
use App\Http\Controllers\Api\ApiTicketConfigController;
use App\Http\Controllers\Api\ApiTicketController;
use App\Http\Controllers\Api\ApiTicketArticleController;
use App\Http\Controllers\Api\ApiTicketCategoryController;
use App\Http\Controllers\Api\ApiTicketGradeController;
use App\Http\Controllers\Api\ApiTicketStatusController;
use App\Http\Controllers\Api\ApiTicketLinkController;
use App\Http\Controllers\Api\ApiInvoiceOcrController;
use App\Http\Controllers\Api\ApiExpenseReportController;
use App\Http\Controllers\Api\ApiEmailSendController;
use App\Http\Controllers\Api\ApiApplicationController;
use App\Http\Controllers\Api\ApiDashboardController;
use App\Http\Controllers\Api\ApiTimeProjectController;
use App\Http\Controllers\Api\ApiTimeEntryController;
use App\Http\Controllers\Api\ApiTimeConfigController;
use App\Http\Controllers\Api\ApiTimeReportController;
use App\Http\Controllers\Api\ApiSequenceController;
use App\Http\Controllers\Api\ApiAccountVatDeclarationController;
use App\Http\Controllers\Api\ApiAccountVatBoxController;

require base_path('routes/apiExpense.php');
require base_path('routes/apiPartners.php');

// Public routes
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:3,1');
    Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');
});

// Public company branding (used on login page, no auth required)
Route::get('/company/public-branding', [ApiCompanyController::class, 'publicBranding']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Dashboard
    Route::prefix('dashboard')->group(function () {
        Route::get('/activity', [ApiDashboardController::class, 'activity']);
    });

    Route::prefix('auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::put('/me', [AuthController::class, 'updateProfile']);
        Route::post('/me/password', [AuthController::class, 'changePassword']);
        Route::post('/refresh', [AuthController::class, 'refresh']);
    });

    // Legacy route for getting authenticated user
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // Applications (lanceur d'apps)
    Route::get('/applications', [ApiApplicationController::class, 'index']);

    // ── Suivi de temps ──────────────────────────────────────────────────────
    Route::middleware('permission:time.view.all')->group(function () {
        Route::get('/time-reports', [ApiTimeReportController::class, 'report']);
    });
    Route::middleware('permission:time.view')->group(function () {
        Route::get('/time-entries/summary', [ApiTimeEntryController::class, 'summary']);
        Route::get('/time-projects', [ApiTimeProjectController::class, 'index']);
        Route::get('/time-projects/options', [ApiTimeProjectController::class, 'options']);
        Route::get('/time-projects/{id}', [ApiTimeProjectController::class, 'show']);
        Route::get('/time-entries', [ApiTimeEntryController::class, 'index']);
        Route::get('/time-entries/{id}', [ApiTimeEntryController::class, 'show']);
        Route::get('/time-entries/{id}/description-suggestions', [ApiTimeEntryController::class, 'descriptionSuggestions']);
    });
    Route::middleware('permission:time.create')->group(function () {
        Route::post('/time-entries', [ApiTimeEntryController::class, 'store']);
        Route::post('/time-entries/{id}/submit', [ApiTimeEntryController::class, 'submit']);
        Route::post('/time-entries/submit-batch', [ApiTimeEntryController::class, 'submitBatch']);
    });
    Route::middleware('permission:time.edit')->group(function () {
        Route::post('/time-projects', [ApiTimeProjectController::class, 'store']);
        Route::put('/time-projects/{id}', [ApiTimeProjectController::class, 'update']);
        Route::delete('/time-projects/{id}', [ApiTimeProjectController::class, 'destroy']);
        Route::put('/time-entries/{id}', [ApiTimeEntryController::class, 'update']);
        Route::delete('/time-entries/{id}', [ApiTimeEntryController::class, 'destroy']);
    });
    Route::middleware('permission:time.approve')->group(function () {
        Route::post('/time-entries/approve-batch', [ApiTimeEntryController::class, 'approveBatch']);
        Route::post('/time-entries/reject-batch', [ApiTimeEntryController::class, 'rejectBatch']);
    });
    Route::middleware('permission:time.invoice')->group(function () {
        Route::post('/time-entries/generate-invoice', [ApiTimeEntryController::class, 'generateInvoice']);
    });

    // Time Config - Configuration du module temps
    Route::prefix('time-config')->group(function () {
        Route::middleware('permission:time.invoice')->group(function () {
            Route::get('/{id?}', [ApiTimeConfigController::class, 'show'])->defaults('id', 1);
            Route::put('/{id?}', [ApiTimeConfigController::class, 'update'])->defaults('id', 1);
            Route::patch('/{id?}', [ApiTimeConfigController::class, 'update'])->defaults('id', 1);
        });
    });
    // ────────────────────────────────────────────────────────────────────────

    // Menus - Routes avec permissions granulaires
    Route::prefix('menus')->group(function () {
        Route::get('', [ApiMenuController::class, 'index']);

        // Routes de consultation (permission: menus.view)
        Route::middleware('permission:menus.view')->group(function () {
            Route::get('/{id}', [ApiMenuController::class, 'show']);
        });

        // Routes de création (permission: menus.create)
        Route::middleware('permission:menus.create')->group(function () {
            Route::post('', [ApiMenuController::class, 'store']);
        });

        // Routes de modification (permission: menus.edit)
        Route::middleware('permission:menus.edit')->group(function () {
            Route::put('/{id}', [ApiMenuController::class, 'update']);
            Route::patch('/{id}', [ApiMenuController::class, 'update']);
        });

        // Routes de suppression (permission: menus.delete)
        Route::middleware('permission:menus.delete')->group(function () {
            Route::delete('/{id}', [ApiMenuController::class, 'destroy']);
        });
    });

    // Payment Modes - Routes avec permissions granulaires
    Route::prefix('payment-modes')->group(function () {
        // Routes de consultation (permission: accountings.view)
        Route::middleware('permission:accountings.view')->group(function () {
            Route::get('', [ApiPaymentModeController::class, 'index']);
            Route::get('/options', [ApiPaymentModeController::class, 'options']);
            Route::get('/{id}', [ApiPaymentModeController::class, 'show']);
        });

        // Routes de création (permission: accountings.create)
        Route::middleware('permission:accountings.create')->group(function () {
            Route::post('', [ApiPaymentModeController::class, 'store']);
        });

        // Routes de modification (permission: accountings.edit)
        Route::middleware('permission:accountings.edit')->group(function () {
            Route::put('/{id}', [ApiPaymentModeController::class, 'update']);
            Route::patch('/{id}', [ApiPaymentModeController::class, 'update']);
        });

        // Routes de suppression (permission: accountings.delete)
        Route::middleware('permission:accountings.delete')->group(function () {
            Route::delete('/{id}', [ApiPaymentModeController::class, 'destroy']);
        });
    });

    // Payments - Liste globale des paiements
    Route::prefix('payments')->group(function () {
        Route::middleware('permission:payments.view')->group(function () {
            Route::get('', [ApiPaymentController::class, 'index']);
            Route::get('/unpaid-invoices', [ApiPaymentController::class, 'getUnpaidInvoicesByPartner']);
            Route::get('/{payId}', [ApiPaymentController::class, 'getPayment']);
        });
        Route::middleware('permission:payments.create')->group(function () {
            Route::post('', [ApiPaymentController::class, 'saveStandalonePayment']);
        });
        Route::middleware('permission:payments.delete')->group(function () {
            Route::delete('/{payId}', [ApiPaymentController::class, 'deletePayment']);
        });
    });


    Route::middleware('permission:payments.view')->group(function () {

        Route::get('invoices/payments/{payId}', [ApiPaymentController::class, 'getPayment']);
        Route::get('invoices/{invId}/payments', [ApiInvoiceController::class, 'getPayments'])->name('invoices.payments');
        Route::get('invoices/{invId}/unpaid-invoices/{payId}', [ApiInvoiceController::class, 'getUnpaidInvoices'])->name('invoices.unpaid-invoices');
        Route::get('invoices/{invId}/available-credits', [ApiInvoiceController::class, 'getAvailableCredits'])->name('invoices.available-credits');


        Route::get('charges/payments/{payId}', [ApiPaymentController::class, 'getPayment']);
        Route::get('charges/{cheId}/payments', [ApiChargeController::class, 'getPayments'])->name('charges.payments');
        Route::get('charges/{cheId}/unpaid-charges/{payId?}', [ApiChargeController::class, 'getUnpaidCharges'])->name('charges.unpaid-charges');
        Route::get('charges /{cheId}/available-credits', [ApiChargeController::class, 'getAvailableCredits'])->name('charges.available-credits');

        Route::get('expense-reports/payments/{payId}', [ApiPaymentController::class, 'getPayment']);
        Route::get('expense-reports/{exrId}/payments', [ApiExpenseReportController::class, 'getPayments']);
        Route::get('expense-reports/{exrId}/unpaid-expense-reports/{payId?}', [ApiExpenseReportController::class, 'getUnpaidExpenseReports']);
        Route::get('expense-reports/{exrId}/available-credits', [ApiExpenseReportController::class, 'getAvailableCredits'])->name('expense-reports.available-credits');
    });

    Route::middleware('permission:payments.edit')->group(function () {
        Route::put('invoices/payments/{payId}', [ApiPaymentController::class, 'savePayment'])->name('invoices.update-payment');
        Route::post('invoices/payments/{payId}', [ApiPaymentController::class, 'savePayment']);
        Route::patch('invoices/payments/{payId}', [ApiPaymentController::class, 'savePayment']);

        Route::put('charges/payments/{payId}', [ApiPaymentController::class, 'savePayment'])->name('charges.update-payment');
        Route::post('charges/payments/{payId}', [ApiPaymentController::class, 'savePayment']);
        Route::patch('charges/payments/{payId}', [ApiPaymentController::class, 'savePayment']);

        Route::put('expense-reports/payments/{payId}', [ApiPaymentController::class, 'savePayment']);
        Route::post('expense-reports/payments/{payId}', [ApiPaymentController::class, 'savePayment']);
        Route::patch('expense-reports/payments/{payId}', [ApiPaymentController::class, 'savePayment']);
    });

    Route::middleware('permission:payments.create')->group(function () {
        Route::post('invoices/{invId}/payments', [ApiPaymentController::class, 'savePayment'])->name('invoices.save-payment');
        Route::post('invoices/{invId}/use-credit', [ApiInvoiceController::class, 'useCredit'])->name('invoices.use-credit');

        Route::post('charges/{cheId}/payments', [ApiPaymentController::class, 'savePayment'])->name('charges.save-payment');
        Route::post('charges/{cheId}/use-credit', [ApiChargeController::class, 'useCredit'])->name('charges.use-credit');

        Route::post('expense-reports/{exrId}/payments', [ApiPaymentController::class, 'savePayment']);
        Route::post('expense-reports/{exrId}/use-credit', [ApiExpenseReportController::class, 'useCredit'])->name('expense-reports.use-credit');
    });

    Route::middleware('permission:payments.delete')->group(function () {
        Route::delete('invoices/payments/{payId}', [ApiPaymentController::class, 'deletePayment'])->name('invoices.delete-payment');
        Route::delete('charges/payments/{payId}', [ApiPaymentController::class, 'deletePayment'])->name('charges.delete-payment');
        Route::delete('expense-reports/payments/{payId}', [ApiPaymentController::class, 'deletePayment']);
    });

    Route::middleware('permission:payments.edit')->group(function () {
        Route::delete('invoices/{invId}/payments/{payId}/allocation', [ApiInvoiceController::class, 'removePaymentAllocation']);
        Route::delete('charges/{cheId}/payments/{payId}/allocation', [ApiChargeController::class, 'removePaymentAllocation']);
        Route::delete('expense-reports/{exrId}/payments/{payId}/allocation', [ApiExpenseReportController::class, 'removePaymentAllocation']);
    });


    // BankDetailss - Routes avec permissions granulaires
    Route::prefix('bank-details')->group(function () {
        // Routes de consultation (permission: bank-details.view)
        Route::middleware('permission:bank-details.view')->group(function () {
            Route::get('', [ApiBankDetailsController::class, 'index']);
            Route::get('/options', [ApiBankDetailsController::class, 'options']);
            Route::get('/{id}', [ApiBankDetailsController::class, 'show']);
        });

        // Routes de création (permission: bank-details.create)
        Route::middleware('permission:bank-details.create')->group(function () {
            Route::post('', [ApiBankDetailsController::class, 'store']);
        });

        // Routes de modification (permission: bank-details.edit)
        Route::middleware('permission:bank-details.edit')->group(function () {
            Route::put('/{id}', [ApiBankDetailsController::class, 'update']);
            Route::patch('/{id}', [ApiBankDetailsController::class, 'update']);
        });

        // Routes de suppression (permission: bank-details.delete)
        Route::middleware('permission:bank-details.delete')->group(function () {
            Route::delete('/{id}', [ApiBankDetailsController::class, 'destroy']);
        });
    });

    // Tax Tags
    Route::get('tax-tags/options', [ApiAccountTaxTagController::class, 'options'])
        ->middleware('permission:accountings.view');

    // Taxs - Routes avec permissions granulaires
    Route::prefix('taxs')->group(function () {
        Route::get('/options', [ApiAccountTaxController::class, 'options']);
        Route::get('/{id}', [ApiAccountTaxController::class, 'show']);

        // Routes de consultation (permission: accountings.view)
        Route::middleware('permission:accountings.view')->group(function () {
            Route::get('', [ApiAccountTaxController::class, 'index']);
            Route::get('/{id}/repartition-lines', [ApiAccountTaxController::class, 'repartitionLines']);
        });

        // Routes de création (permission: accountings.create)
        Route::middleware('permission:accountings.create')->group(function () {
            Route::post('', [ApiAccountTaxController::class, 'store']);
        });

        // Routes de modification (permission: accountings.edit)
        Route::middleware('permission:accountings.edit')->group(function () {
            Route::put('/{id}', [ApiAccountTaxController::class, 'update']);
            Route::patch('/{id}', [ApiAccountTaxController::class, 'update']);
            Route::put('/{id}/repartition-lines', [ApiAccountTaxController::class, 'saveRepartitionLines']);
        });

        // Routes de suppression (permission: accountings.delete)
        Route::middleware('permission:accountings.delete')->group(function () {
            Route::delete('/{id}', [ApiAccountTaxController::class, 'destroy']);
        });
    });

    // Taxs - Routes avec permissions granulaires
    Route::prefix('account-journals')->group(function () {
        // Routes de consultation (permission: taxs.view)
        Route::middleware('permission:accountings.view')->group(function () {
            Route::get('', [ApiAccountJournalController::class, 'index']);
            Route::get('/options', [ApiAccountJournalController::class, 'options']);
            Route::get('/{id}', [ApiAccountJournalController::class, 'show']);
        });

        // Routes de création (permission: settings.taxs.create)
        Route::middleware('permission:accountings.create')->group(function () {
            Route::post('', [ApiAccountJournalController::class, 'store']);
        });

        // Routes de modification (permission: settings.taxs.edit)
        Route::middleware('permission:accountings.edit')->group(function () {
            Route::put('/{id}', [ApiAccountJournalController::class, 'update']);
            Route::patch('/{id}', [ApiAccountJournalController::class, 'update']);
        });

        // Routes de suppression (permission: taxs.delete)
        Route::middleware('permission:accountings.delete')->group(function () {
            Route::delete('/{id}', [ApiAccountJournalController::class, 'destroy']);
        });
    });


    // Tax Positions - Routes avec permissions granulaires
    Route::prefix('warehouses')->group(function () {
        // Routes de consultation (permission: settings.taxs.view)
        Route::middleware('permission:stocks.view')->group(function () {
            Route::get('', [ApiWarehouseController::class, 'index']);
            Route::get('/options', [ApiWarehouseController::class, 'options']);
            Route::get('/{id}', [ApiWarehouseController::class, 'show']);
        });

        // Routes de création (permission: settings.taxs.create)
        Route::middleware('permission:stocks.create')->group(function () {
            Route::post('', [ApiWarehouseController::class, 'store']);
        });

        // Routes de modification (permission: settings.taxs.edit)
        Route::middleware('permission:stocks.edit')->group(function () {
            Route::put('/{id}', [ApiWarehouseController::class, 'update']);
            Route::patch('/{id}', [ApiWarehouseController::class, 'update']);
        });

        // Routes de suppression (permission: settings.taxs.delete)
        Route::middleware('permission:stocks.delete')->group(function () {
            Route::delete('/{id}', [ApiWarehouseController::class, 'destroy']);
        });
    });

    // Tax Positions - Routes avec permissions granulaires
    Route::prefix('tax-positions')->group(function () {
        // Routes de consultation (permission: settings.taxs.view)
        Route::middleware('permission:settings.taxs.view')->group(function () {
            Route::get('', [ApiAccountTaxPositionController::class, 'index']);
            Route::get('/options', [ApiAccountTaxPositionController::class, 'options']);
            Route::get('/{id}', [ApiAccountTaxPositionController::class, 'show']);
            Route::get('/{id}/correspondences', [ApiAccountTaxPositionController::class, 'getCorrespondences']);
        });

        // Routes de création (permission: settings.taxs.create)
        Route::middleware('permission:settings.taxs.create')->group(function () {
            Route::post('', [ApiAccountTaxPositionController::class, 'store']);
            Route::post('/{id}/correspondences', [ApiAccountTaxPositionController::class, 'storeCorrespondence']);
        });

        // Routes de modification (permission: settings.taxs.edit)
        Route::middleware('permission:settings.taxs.edit')->group(function () {
            Route::put('/{id}', [ApiAccountTaxPositionController::class, 'update']);
            Route::patch('/{id}', [ApiAccountTaxPositionController::class, 'update']);
            Route::put('/{id}/correspondences/{tacId}', [ApiAccountTaxPositionController::class, 'updateCorrespondence']);
        });

        // Routes de suppression (permission: settings.taxs.delete)
        Route::middleware('permission:settings.taxs.delete')->group(function () {
            Route::delete('/{id}', [ApiAccountTaxPositionController::class, 'destroy']);
            Route::delete('/{id}/correspondences/{tacId}', [ApiAccountTaxPositionController::class, 'destroyCorrespondence']);
        });
    });

    // Message Templates - Routes avec permissions granulaires
    Route::prefix('message-templates')->group(function () {
        // Routes de consultation (permission: settings.messagetemplates.view)
        Route::middleware('permission:settings.messagetemplates.view')->group(function () {
            Route::get('', [ApiMessageTemplateController::class, 'index']);
            Route::get('/options', [ApiMessageTemplateController::class, 'options']);
            Route::post('/parse', [ApiMessageTemplateController::class, 'parse']);
            Route::get('/{id}', [ApiMessageTemplateController::class, 'show']);
        });

        // Routes de création (permission: settings.messagetemplates.create)
        Route::middleware('permission:settings.messagetemplates.create')->group(function () {
            Route::post('', [ApiMessageTemplateController::class, 'store']);
        });

        // Routes de modification (permission: settings.messagetemplates.edit)
        Route::middleware('permission:settings.messagetemplates.edit')->group(function () {
            Route::put('/{id}', [ApiMessageTemplateController::class, 'update']);
            Route::patch('/{id}', [ApiMessageTemplateController::class, 'update']);
        });

        // Routes de suppression (permission: settings.messagetemplates.delete)
        Route::middleware('permission:settings.messagetemplates.delete')->group(function () {
            Route::delete('/{id}', [ApiMessageTemplateController::class, 'destroy']);
        });
    });

    // Message Email Accounts - Routes avec permissions granulaires
    Route::prefix('message-email-accounts')->group(function () {
        // Routes de consultation (permission: settings.messageemailaccounts.view)
        Route::middleware('permission:settings.messageemailaccounts.view')->group(function () {
            Route::get('', [ApiMessageEmailAccountController::class, 'index']);
            Route::get('/options', [ApiMessageEmailAccountController::class, 'options']);
            Route::get('/{id}', [ApiMessageEmailAccountController::class, 'show']);
        });

        // Routes de création (permission: settings.messageemailaccounts.create)
        Route::middleware('permission:settings.messageemailaccounts.create')->group(function () {
            Route::post('', [ApiMessageEmailAccountController::class, 'store']);
        });

        // Routes de modification (permission: settings.messageemailaccounts.edit)
        Route::middleware('permission:settings.messageemailaccounts.edit')->group(function () {
            Route::put('/{id}', [ApiMessageEmailAccountController::class, 'update']);
            Route::patch('/{id}', [ApiMessageEmailAccountController::class, 'update']);
            //   Route::post('/test-connection', [ApiMessageEmailAccountController::class, 'testConnection']);
            Route::post('/auto-detect-servers', [ApiMessageEmailAccountController::class, 'autoDetectServers']);
            Route::post('/oauth-exchange', [ApiMessageEmailAccountController::class, 'exchangeOAuthCode']);
            Route::post('/oauth-auth-url', [ApiMessageEmailAccountController::class, 'getOAuthAuthorizationUrl']);
            Route::post('/google-oauth-auth-url', [ApiMessageEmailAccountController::class, 'getGoogleOAuthAuthorizationUrl']);
            Route::post('/google-oauth-exchange', [ApiMessageEmailAccountController::class, 'exchangeGoogleOAuthCode']);
            Route::post('/send-test-email', [ApiMessageEmailAccountController::class, 'sendTestEmail']);
        });

        // Routes de suppression (permission: settings.messageemailaccounts.delete)
        Route::middleware('permission:settings.messageemailaccounts.delete')->group(function () {
            Route::delete('/{id}', [ApiMessageEmailAccountController::class, 'destroy']);
        });
    });

    // Email Sending - Envoi d'email générique
    Route::prefix('emails')->group(function () {
        Route::post('/send', [ApiEmailSendController::class, 'send']);
        Route::get('/default-account', [ApiEmailSendController::class, 'getDefaultAccount']);
    });

    // Bank Details - Routes avec permissions granulaires
    Route::prefix('bank-details')->group(function () {

        Route::get('/options', [ApiBankDetailsController::class, 'options']);

        // Routes publiques (pas de permission requise)
        Route::post('/validate-iban', [ApiBankDetailsController::class, 'validateIban']);

        // Routes de consultation
        Route::middleware('permission:partners.view')->group(function () {
            Route::get('', [ApiBankDetailsController::class, 'index']);

            Route::get('/{id}', [ApiBankDetailsController::class, 'show']);
            Route::get('/partner/{partnerId}', [ApiBankDetailsController::class, 'getByPartner']);
            Route::get('/company/{companyId}', [ApiBankDetailsController::class, 'getByCompany']);
        });

        // Routes de création
        Route::middleware('permission:partners.create')->group(function () {
            Route::post('', [ApiBankDetailsController::class, 'store']);
        });

        // Routes de modification
        Route::middleware('permission:partners.edit')->group(function () {
            Route::put('/{id}', [ApiBankDetailsController::class, 'update']);
            Route::patch('/{id}', [ApiBankDetailsController::class, 'update']);
        });

        // Routes de suppression
        Route::middleware('permission:partners.delete')->group(function () {
            Route::delete('/{id}', [ApiBankDetailsController::class, 'destroy']);
        });
    });

    // Accounts - Routes avec permissions granulaires
    Route::prefix('accounts')->group(function () {
        Route::get('/writing-period', [ApiAccountController::class, 'getWritingPeriod']);

        // Routes de consultation (permission: accountings.view)
        Route::middleware('permission:accountings.view')->group(function () {
            Route::get('', [ApiAccountController::class, 'index']);
            Route::get('/options', [ApiAccountController::class, 'options']);

            Route::get('/{id}', [ApiAccountController::class, 'show']);
        });

        // Routes de création (permission: accountings.create)
        Route::middleware('permission:accountings.create')->group(function () {
            Route::post('', [ApiAccountController::class, 'store']);
            Route::post('/auto-create', [ApiAccountController::class, 'createAutoAccount']);
        });

        // Routes de modification (permission: accountings.edit)
        Route::middleware('permission:accountings.edit')->group(function () {
            Route::put('/{id}', [ApiAccountController::class, 'update']);
            Route::patch('/{id}', [ApiAccountController::class, 'update']);
        });

        // Routes de suppression (permission: accountings.delete)
        Route::middleware('permission:accountings.delete')->group(function () {
            Route::delete('/{id}', [ApiAccountController::class, 'destroy']);
        });
    });

    // Account Transfers - Routes avec permissions granulaires
    Route::prefix('account-transfers')->group(function () {
        // Routes de consultation (permission: accountings.view)
        Route::middleware('permission:accountings.view')->group(function () {
            Route::get('', [ApiAccountTransferController::class, 'index']);
            Route::get('/{id}', [ApiAccountTransferController::class, 'show']);
        });

        // Routes de création (permission: accountings.create)
        Route::middleware('permission:accountings.create')->group(function () {
            Route::post('/preview', [ApiAccountTransferController::class, 'preview']);
            Route::post('', [ApiAccountTransferController::class, 'store']);
        });
    });

    // Account Moves - Routes avec permissions granulaires
    Route::prefix('account-moves')->group(function () {
        // Routes de consultation (permission: accountings.view)
        Route::middleware('permission:accountings.view')->group(function () {
            Route::get('', [ApiAccountMoveController::class, 'index']);
            Route::get('/{id}', [ApiAccountMoveController::class, 'show']);
            Route::get('/{id}/lines', [ApiAccountMoveController::class, 'getLines'])->name('account-moves.lines');
        });

        // Routes de création (permission: accountings.create)
        Route::middleware('permission:accountings.create')->group(function () {
            Route::post('', [ApiAccountMoveController::class, 'store']);
            Route::post('/{id}/duplicate', [ApiAccountMoveController::class, 'duplicate'])->name('account-moves.duplicate');
            Route::post('/{id}/validate', [ApiAccountMoveController::class, 'validate'])->name('account-moves.validate');
        });

        // Routes de modification (permission: accountings.edit)
        Route::middleware('permission:accountings.edit')->group(function () {
            Route::put('/{id}', [ApiAccountMoveController::class, 'update']);
            Route::patch('/{id}', [ApiAccountMoveController::class, 'update']);
        });

        // Routes de suppression (permission: accountings.delete)
        Route::middleware('permission:accountings.delete')->group(function () {
            Route::delete('/{id}', [ApiAccountMoveController::class, 'destroy']);
        });
    });

    // Account Lettering - Routes pour le lettrage comptable
    Route::prefix('account-working')->group(function () {
        Route::middleware('permission:accountings.view')->group(function () {
            Route::get('', [ApiAccountWorkingController::class, 'index']);
            Route::get('/settings', [ApiAccountWorkingController::class, 'getSettings']);
            Route::post('/settings', [ApiAccountWorkingController::class, 'saveSettings']);
        });
    });

    // Account Lettering - Routes pour le lettrage comptable
    Route::prefix('account-lettering')->group(function () {
        // Routes de consultation (permission: accountings.view)
        Route::middleware('permission:accountings.view')->group(function () {
            Route::get('', [ApiAccountLetteringController::class, 'index']);
            Route::get('/settings', [ApiAccountLetteringController::class, 'getSettings']);
            Route::post('/settings', [ApiAccountLetteringController::class, 'saveSettings']);
        });

        // Routes de création/modification (permission: accountings.create ou accountings.edit)
        Route::middleware('permission:accountings.edit')->group(function () {
            Route::post('/apply', [ApiAccountLetteringController::class, 'applyLettering']);
            Route::post('/remove', [ApiAccountLetteringController::class, 'removeLettering']);
        });
    });

    // Account Bank Reconciliations - Routes pour les rapprochements bancaires
    Route::prefix('account-bank-reconciliations')->group(function () {
        // Routes de consultation (permission: accountings.view)
        Route::middleware('permission:accountings.view')->group(function () {
            Route::get('', [ApiAccountBankReconciliationController::class, 'index']);
            Route::get('/{id}', [ApiAccountBankReconciliationController::class, 'show']);
            Route::get('/{id}/lines', [ApiAccountBankReconciliationController::class, 'getLines']);
            Route::get('/last/{btsId}', [ApiAccountBankReconciliationController::class, 'getLastReconciliation']);
        });

        // Routes de création (permission: accountings.create)
        Route::middleware('permission:accountings.create')->group(function () {
            Route::post('', [ApiAccountBankReconciliationController::class, 'store']);
        });

        // Routes de modification (permission: accountings.edit)
        Route::middleware('permission:accountings.edit')->group(function () {
            Route::put('/{id}/pointing', [ApiAccountBankReconciliationController::class, 'updatePointing']);
            Route::patch('/{id}/pointing', [ApiAccountBankReconciliationController::class, 'updatePointing']);
        });

        // Routes de suppression (permission: accountings.delete)
        Route::middleware('permission:accountings.delete')->group(function () {
            Route::delete('/{id}', [ApiAccountBankReconciliationController::class, 'destroy']);
        });

        // Documents - permission: accountings.documents.view
        Route::middleware('permission:accountings.documents.view')->group(function () {
            Route::get('/{abrId}/documents', function ($abrId) {
                return app(ApiDocumentController::class)->index('account-bank-reconciliations', $abrId);
            })->name('account-bank-reconciliations.documents.index');
            Route::get('/{abrId}/documents/stats', function ($abrId) {
                return app(ApiDocumentController::class)->stats('account-bank-reconciliations', $abrId);
            })->name('account-bank-reconciliations.documents.stats');
        });

        // Documents - permission: accountings.documents.create
        Route::middleware('permission:accountings.documents.create')->group(function () {
            Route::post('/{abrId}/documents', function (App\Http\Requests\DocumentUploadRequest $request, $abrId) {
                return app(ApiDocumentController::class)->upload($request, 'account-bank-reconciliations', $abrId);
            })->name('account-bank-reconciliations.documents.create');
        });
    });

    // Accounting Backups - Routes pour les sauvegardes comptables
    Route::prefix('accounting-backups')->group(function () {
        // Routes de consultation (permission: accountings.view)
        Route::middleware('permission:accountings.view')->group(function () {
            Route::get('', [ApiAccountingBackupController::class, 'index']);
            Route::get('/{id}', [ApiAccountingBackupController::class, 'show']);
            Route::get('/{id}/download', [ApiAccountingBackupController::class, 'download']);
        });

        // Routes de création (permission: accountings.create)
        Route::middleware('permission:accountings.create')->group(function () {
            Route::post('', [ApiAccountingBackupController::class, 'store']);
        });

        // Routes de restauration (permission: accountings.restore)
        Route::middleware('permission:accountings.restore')->group(function () {
            Route::post('/{id}/restore', [ApiAccountingBackupController::class, 'restore']);
        });

        // Routes de suppression (permission: accountings.delete)
        Route::middleware('permission:accountings.delete')->group(function () {
            Route::delete('/{id}', [ApiAccountingBackupController::class, 'destroy']);
        });
    });

    // Accounting Closures - Routes pour les clôtures d'exercices
    Route::prefix('accounting-closures')->group(function () {
        // Routes de consultation (permission: accountings.view)
        Route::middleware('permission:accountings.view')->group(function () {
            Route::get('', [ApiAccountingClosureController::class, 'index']);
            Route::get('/current-exercise', [ApiAccountingClosureController::class, 'getCurrentExercise']);
            Route::get('/worker-status', [ApiAccountingClosureController::class, 'workerStatus']);
            Route::get('/{id}', [ApiAccountingClosureController::class, 'show']);
            Route::get('/{id}/download', [ApiAccountingClosureController::class, 'downloadArchive']);
        });

        // Routes de création/démarrage (permission: accountings.create)
        Route::middleware('permission:accountings.create')->group(function () {
            Route::post('/start', [ApiAccountingClosureController::class, 'startClosure']);
            Route::post('/poll', [ApiAccountingClosureController::class, 'pollStatus']);
        });

        // Routes de suppression (permission: accountings.delete)
        Route::middleware('permission:accountings.delete')->group(function () {
            Route::delete('/{id}', [ApiAccountingClosureController::class, 'destroy']);
        });
    });

    // Accounting Imports - Routes pour les imports comptables FEC/CIEL
    Route::prefix('accounting-imports')->group(function () {
        // Routes de consultation (permission: accountings.view)
        Route::middleware('permission:accountings.view')->group(function () {
            Route::get('', [ApiAccountingImportExportController::class, 'indexImports']);
            Route::get('/{id}', [ApiAccountingImportExportController::class, 'showImport']);
        });

        // Routes de création (permission: accountings.create)
        Route::middleware('permission:accountings.create')->group(function () {
            Route::post('/upload', [ApiAccountingImportExportController::class, 'uploadForPreview']);
            Route::post('/import', [ApiAccountingImportExportController::class, 'import']);
        });

        // Routes de suppression (permission: accountings.delete)
        Route::middleware('permission:accountings.delete')->group(function () {
            Route::delete('/{id}', [ApiAccountingImportExportController::class, 'destroyImport']);
        });
    });

    // Accounting Exports - Routes pour les exports comptables FEC
    Route::prefix('accounting-exports')->group(function () {
        // Routes de consultation (permission: accountings.view)
        Route::middleware('permission:accountings.view')->group(function () {
            Route::get('', [ApiAccountingImportExportController::class, 'indexExports']);
            Route::get('/{id}', [ApiAccountingImportExportController::class, 'showExport']);
            Route::get('/{id}/download', [ApiAccountingImportExportController::class, 'downloadExport']);
        });

        // Routes de création (permission: accountings.create)
        Route::middleware('permission:accountings.create')->group(function () {
            Route::post('', [ApiAccountingImportExportController::class, 'export']);
        });

        // Routes de suppression (permission: accountings.delete)
        Route::middleware('permission:accountings.delete')->group(function () {
            Route::delete('/{id}', [ApiAccountingImportExportController::class, 'destroyExport']);
        });
    });

    // Accounting Editions - Routes pour les éditions comptables
    Route::prefix('accounting-editions')->group(function () {
        // Routes de consultation (permission: accountings.view)
        Route::middleware('permission:accountings.view')->group(function () {
            Route::post('/balance', [ApiAccountingEditionController::class, 'balance']);
            Route::post('/grand-livre', [ApiAccountingEditionController::class, 'grandLivre']);
            Route::post('/journaux', [ApiAccountingEditionController::class, 'journaux']);
            Route::post('/journaux-centralisateur', [ApiAccountingEditionController::class, 'journauxCentralisateur']);
            Route::post('/bilan', [ApiAccountingEditionController::class, 'bilan']);

            // Routes de génération de PDF
            Route::post('/balance/pdf', [ApiAccountingEditionController::class, 'balancePdf']);
            Route::post('/grand-livre/pdf', [ApiAccountingEditionController::class, 'grandLivrePdf']);
            Route::post('/journaux/pdf', [ApiAccountingEditionController::class, 'journauxPdf']);
            Route::post('/journaux-centralisateur/pdf', [ApiAccountingEditionController::class, 'journauxCentralisateurPdf']);
            Route::post('/bilan/pdf', [ApiAccountingEditionController::class, 'bilanPdf']);
        });
    });

    // Company - Routes pour la gestion de la société
    Route::prefix('company')->group(function () {
        // Routes publiques (accessibles par tous les utilisateurs authentifiés)
        Route::get('info', [ApiCompanyController::class, 'getCompanyInfo']);
        Route::get('/{companyId}/bank-details', [ApiBankDetailsController::class, 'getByCompany']);
        Route::get('/{id}/logo/{logoType}', [ApiCompanyController::class, 'getLogo']);
        Route::get('/{id}', [ApiCompanyController::class, 'show']);
        // Routes de consultation (permission: settings.company.view)
        Route::middleware('permission:settings.company.view')->group(function () {});

        // Routes de modification (permission: settings.company.edit)
        Route::middleware('permission:settings.company.edit')->group(function () {
            Route::put('/{id}', [ApiCompanyController::class, 'update']);
            Route::patch('/{id}', [ApiCompanyController::class, 'update']);
            Route::post('/{id}/upload-logo', [ApiCompanyController::class, 'uploadLogo']);
            Route::post('/{id}/generate-svg-icon', [ApiCompanyController::class, 'generateSvgFromSquareLogo']);
        });
    });

    // Sequences - Paramétrage des numérotations
    Route::prefix('sequences')->group(function () {
        Route::middleware('permission:settings.company.view')->group(function () {
            Route::get('/', [ApiSequenceController::class, 'index']);
        });
        Route::middleware('permission:settings.company.edit')->group(function () {
            Route::put('/{id}', [ApiSequenceController::class, 'update']);
        });
    });

    // Account Config - Routes pour la configuration comptable
    Route::prefix('account-config')->group(function () {
        // Routes de consultation (permission: accountings.view)
        Route::middleware('permission:accountings.view')->group(function () {
            Route::get('/{id?}', [ApiAccountConfigController::class, 'show'])->defaults('id', 1);
        });

        // Routes de modification (permission: accountings.edit)
        Route::middleware('permission:accountings.edit')->group(function () {
            Route::put('/{id?}', [ApiAccountConfigController::class, 'update'])->defaults('id', 1);
            Route::patch('/{id?}', [ApiAccountConfigController::class, 'update'])->defaults('id', 1);
        });
    });

    // Ticket Config - Routes pour la configuration du module assistance
    Route::prefix('ticket-config')->group(function () {
        // Routes de consultation (permission: settings.ticketingconf.view)
        Route::middleware('permission:settings.ticketingconf.view')->group(function () {
            Route::get('/{id?}', [ApiTicketConfigController::class, 'show'])->defaults('id', 1);
        });

        // Routes de modification (permission: settings.ticketingconf.edit)
        Route::middleware('permission:settings.ticketingconf.edit')->group(function () {
            Route::put('/{id?}', [ApiTicketConfigController::class, 'update'])->defaults('id', 1);
            Route::patch('/{id?}', [ApiTicketConfigController::class, 'update'])->defaults('id', 1);
            Route::post('/force-email-collection', [ApiTicketConfigController::class, 'forceEmailCollection']);
        });
    });

    // Ticket Categories - CRUD
    Route::prefix('ticket-categories')->group(function () {
        Route::middleware('permission:settings.ticketingconf.view')->group(function () {
            Route::get('', [ApiTicketCategoryController::class, 'index']);
            Route::get('/{id}', [ApiTicketCategoryController::class, 'show']);
        });
        Route::middleware('permission:settings.ticketingconf.create')->group(function () {
            Route::post('', [ApiTicketCategoryController::class, 'store']);
        });
        Route::middleware('permission:settings.ticketingconf.edit')->group(function () {
            Route::put('/{id}', [ApiTicketCategoryController::class, 'update']);
            Route::patch('/{id}', [ApiTicketCategoryController::class, 'update']);
        });
        Route::middleware('permission:settings.ticketingconf.delete')->group(function () {
            Route::delete('/{id}', [ApiTicketCategoryController::class, 'destroy']);
        });
    });

    // Ticket Grades - CRUD
    Route::prefix('ticket-grades')->group(function () {
        Route::middleware('permission:settings.ticketingconf.view')->group(function () {
            Route::get('', [ApiTicketGradeController::class, 'index']);
            Route::get('/{id}', [ApiTicketGradeController::class, 'show']);
        });
        Route::middleware('permission:settings.ticketingconf.create')->group(function () {
            Route::post('', [ApiTicketGradeController::class, 'store']);
        });
        Route::middleware('permission:settings.ticketingconf.edit')->group(function () {
            Route::put('/{id}', [ApiTicketGradeController::class, 'update']);
            Route::patch('/{id}', [ApiTicketGradeController::class, 'update']);
        });
        Route::middleware('permission:settings.ticketingconf.delete')->group(function () {
            Route::delete('/{id}', [ApiTicketGradeController::class, 'destroy']);
        });
    });

    // Ticket Statuses - CRUD
    Route::prefix('ticket-statuses')->group(function () {
        Route::middleware('permission:settings.ticketingconf.view')->group(function () {
            Route::get('', [ApiTicketStatusController::class, 'index']);
            Route::get('/{id}', [ApiTicketStatusController::class, 'show']);
        });
        Route::middleware('permission:settings.ticketingconf.create')->group(function () {
            Route::post('', [ApiTicketStatusController::class, 'store']);
        });
        Route::middleware('permission:settings.ticketingconf.edit')->group(function () {
            Route::put('/{id}', [ApiTicketStatusController::class, 'update']);
            Route::patch('/{id}', [ApiTicketStatusController::class, 'update']);
        });
        Route::middleware('permission:settings.ticketingconf.delete')->group(function () {
            Route::delete('/{id}', [ApiTicketStatusController::class, 'destroy']);
        });
    });

    // Tickets - Routes pour le module assistance
    Route::prefix('tickets')->group(function () {
        // Routes de consultation (permission: tickets.view)
        Route::middleware('permission:tickets.view')->group(function () {
            Route::get('', [ApiTicketController::class, 'index']);
            Route::get('/status-options', [ApiTicketController::class, 'statusOptions']);
            Route::get('/priority-options', [ApiTicketController::class, 'priorityOptions']);
            Route::get('/source-options', [ApiTicketController::class, 'sourceOptions']);
            Route::get('/category-options', [ApiTicketController::class, 'categoryOptions']);
            Route::get('/grade-options', [ApiTicketController::class, 'gradeOptions']);
            Route::get('/sidebar-counts', [ApiTicketController::class, 'sidebarCounts']);
            Route::get('/search', [ApiTicketController::class, 'search']);
            Route::get('/message-templates', [ApiMessageTemplateController::class, 'forTickets']);
            Route::get('/{id}', [ApiTicketController::class, 'show']);
            Route::get('/{ticketId}/articles', [ApiTicketArticleController::class, 'index']);
            Route::get('/{ticketId}/history', [ApiTicketController::class, 'history']);
            Route::get('/{ticketId}/links', [ApiTicketLinkController::class, 'index']);
        });

        // Routes de creation (permission: tickets.create)
        Route::middleware('permission:tickets.create')->group(function () {
            Route::post('', [ApiTicketController::class, 'store']);
            Route::post('/{ticketId}/articles', [ApiTicketArticleController::class, 'store']);
            Route::post('/{ticketId}/links', [ApiTicketLinkController::class, 'store']);
        });

        // Routes de modification (permission: tickets.edit)
        Route::middleware('permission:tickets.edit')->group(function () {
            Route::put('/{id}', [ApiTicketController::class, 'update']);
            Route::patch('/{id}', [ApiTicketController::class, 'update']);
            Route::post('/{id}/merge', [ApiTicketController::class, 'merge']);
            Route::patch('/{ticketId}/articles/{articleId}', [ApiTicketArticleController::class, 'update']);
        });

        // Routes de suppression (permission: tickets.delete)
        Route::middleware('permission:tickets.delete')->group(function () {
            Route::delete('/{id}', [ApiTicketController::class, 'destroy']);
            Route::delete('/{ticketId}/articles/{articleId}', [ApiTicketArticleController::class, 'destroy']);
            Route::delete('/{ticketId}/links/{linkId}', [ApiTicketLinkController::class, 'destroy']);
        });

        // Documents pour les articles de ticket
        Route::middleware('permission:tickets.view')->group(function () {
            Route::get('/{ticketId}/articles/{articleId}/documents', function ($ticketId, $articleId) {
                return app(\App\Http\Controllers\Api\ApiDocumentController::class)->index('ticket-articles', $articleId);
            });
        });
        Route::middleware('permission:tickets.create')->group(function () {
            Route::post('/{ticketId}/articles/{articleId}/documents', function (\App\Http\Requests\DocumentUploadRequest $request, $ticketId, $articleId) {
                return app(\App\Http\Controllers\Api\ApiDocumentController::class)->upload($request, 'ticket-articles', $articleId);
            });
        });
    });

    // Purchase Order Config - Routes avec permissions granulaires
    Route::prefix('purchase-order-conf')->group(function () {
        // Routes de consultation (permission: settings.purchaseorderconf.view)
        Route::middleware('permission:settings.purchaseorderconf.view')->group(function () {
            Route::get('/{id}', [ApiPurchaseOrderConfigController::class, 'show']);
        });

        // Routes de modification (permission: settings.purchaseorderconf.edit)
        Route::middleware('permission:settings.purchaseorderconf.edit')->group(function () {
            Route::put('/{id}', [ApiPurchaseOrderConfigController::class, 'update']);
            Route::patch('/{id}', [ApiPurchaseOrderConfigController::class, 'update']);
        });
    });

    // Sale Order Config - Routes avec permissions granulaires
    Route::prefix('sale-order-conf')->group(function () {
        // Routes de consultation (permission: settings.saleorderconf.view)
        Route::middleware('permission:settings.saleorderconf.view')->group(function () {
            Route::get('/{id}', [ApiSaleOrderConfigController::class, 'show']);
        });

        // Routes de modification (permission: settings.saleorderconf.edit)
        Route::middleware('permission:settings.saleorderconf.edit')->group(function () {
            Route::put('/{id}', [ApiSaleOrderConfigController::class, 'update']);
            Route::patch('/{id}', [ApiSaleOrderConfigController::class, 'update']);
        });
    });

    //  Config - Routes avec permissions granulaires
    Route::prefix('contract-conf')->group(function () {
        // Routes de consultation (permission: settings.saleorderconf.view)
        Route::middleware('permission:settings.contractconf.view')->group(function () {
            Route::get('/{id}', [ApiContractConfigController::class, 'show']);
        });

        // Routes de modification (permission: settings.saleorderconf.edit)
        Route::middleware('permission:settings.contractconf.edit')->group(function () {
            Route::put('/{id}', [ApiContractConfigController::class, 'update']);
            Route::patch('/{id}', [ApiContractConfigController::class, 'update']);
        });
    });


    //  Config - Routes avec permissions granulaires
    Route::prefix('invoice-conf')->group(function () {
        // Routes de consultation (permission: settings.saleorderconf.view)
        Route::middleware('permission:settings.invoiceconf.view')->group(function () {
            Route::get('/{id}', [ApiInvoiceConfigController::class, 'show']);
        });

        // Routes de modification (permission: settings.saleorderconf.edit)
        Route::middleware('permission:settings.invoiceconf.edit')->group(function () {
            Route::put('/{id}', [ApiInvoiceConfigController::class, 'update']);
            Route::patch('/{id}', [ApiInvoiceConfigController::class, 'update']);
        });
    });


    // Durations
    // Routes de rétrocompatibilité pour les options (anciennes URLs)
    // Ces routes pointent maintenant vers le contrôleur unifié
    Route::get('commitment-durations/options', function () {
        return app(ApiDurationController::class)->options(request(), 'commitment-durations');
    });
    Route::get('notice-durations/options', function () {
        return app(ApiDurationController::class)->options(request(), 'notice-durations');
    });
    Route::get('renew-durations/options', function () {
        return app(ApiDurationController::class)->options(request(), 'renew-durations');
    });
    Route::get('invoicing-durations/options', function () {
        return app(ApiDurationController::class)->options(request(), 'invoicing-durations');
    });
    Route::get('payment-conditions/options', function () {
        return app(ApiDurationController::class)->options(request(), 'payment-conditions');
    });

    // Durations - Routes unifiées pour tous les types de durées
    // Types: commitment-durations, notice-durations, renew-durations, invoicing-durations, payment-conditions
    Route::prefix('durations/{type}')->group(function () {
        // Routes de consultation (permission: {type}.view)
        Route::middleware('duration.permission:view')->group(function () {
            Route::get('', [ApiDurationController::class, 'index']);
            Route::get('/{id}', [ApiDurationController::class, 'show']);
        });

        // Routes de création (permission: {type}.create)
        Route::middleware('duration.permission:create')->group(function () {
            Route::post('', [ApiDurationController::class, 'store']);
        });

        // Routes de modification (permission: {type}.edit)
        Route::middleware('duration.permission:edit')->group(function () {
            Route::put('/{id}', [ApiDurationController::class, 'update']);
            Route::patch('/{id}', [ApiDurationController::class, 'update']);
        });

        // Routes de suppression (permission: {type}.delete)
        Route::middleware('duration.permission:delete')->group(function () {
            Route::delete('/{id}', [ApiDurationController::class, 'destroy']);
        });
    });

    // Products - Routes avec permissions granulaires
    Route::prefix('products')->group(function () {
        // Routes de consultation (permission: products.view)
        Route::middleware('permission:products.view')->group(function () {
            Route::get('', [ApiProductController::class, 'index']);
            Route::get('/options', [ApiProductController::class, 'options']);
            Route::get('/{id}', [ApiProductController::class, 'show']);
            Route::get('/{id}/stock', [ApiProductController::class, 'getStockData']);
        });

        // Routes de création (permission: products.create)
        Route::middleware('permission:products.create')->group(function () {
            Route::post('', [ApiProductController::class, 'store']);
        });

        // Routes de modification (permission: products.edit)
        Route::middleware('permission:products.edit')->group(function () {
            Route::put('/{id}', [ApiProductController::class, 'update']);
            Route::patch('/{id}', [ApiProductController::class, 'update']);
        });

        // Routes de suppression (permission: products.delete)
        Route::middleware('permission:products.delete')->group(function () {
            Route::delete('/{id}', [ApiProductController::class, 'destroy']);
        });
    });
    // Stocks - Routes avec permissions granulaires
    Route::prefix('stocks')->group(function () {
        // Routes de consultation (permission: stocks.view)
        Route::middleware('permission:stocks.view')->group(function () {
            Route::get('', [ApiStockController::class, 'index']);
            Route::get('/{id}', [ApiStockController::class, 'show']);
            Route::get('/{id}/movements', [ApiStockController::class, 'getMovements']);
        });
    });

    // Stock Movements - Routes avec permissions granulaires
    Route::prefix('stock-movements')->group(function () {
        // Routes de consultation (permission: stocks.view)
        Route::middleware('permission:stocks.view')->group(function () {
            Route::get('', [ApiStockMovementController::class, 'index']);
            Route::get('/{id}', [ApiStockMovementController::class, 'show']);
        });

        // Routes de création (permission: stocks.create)
        Route::middleware('permission:stocks.create')->group(function () {
            Route::post('/transfer', [ApiStockMovementController::class, 'transfer']);
            Route::post('', [ApiStockMovementController::class, 'store']);
        });

        // Routes de modification (permission: stocks.edit)
        Route::middleware('permission:stocks.edit')->group(function () {
            Route::put('/{id}', [ApiStockMovementController::class, 'update']);
            Route::patch('/{id}', [ApiStockMovementController::class, 'update']);
        });

        // Routes de suppression (permission: stocks.delete)
        Route::middleware('permission:stocks.delete')->group(function () {
            Route::delete('/{id}', [ApiStockMovementController::class, 'destroy']);
        });
    });

    // Compteur des BL/BR brouillons
    Route::middleware('permission:stocks.view')->group(function () {
        Route::get('delivery-notes/draft-counts', [ApiDeliveryNoteController::class, 'getDraftCounts']);
    });

    // Bons de livraison client - Routes avec permissions granulaires
    Route::prefix('customer-delivery-notes')->group(function () {
        Route::middleware('permission:stocks.view')->group(function () {
            Route::get('', [ApiDeliveryNoteController::class, 'indexCustomer']);
            Route::get('/{id}', [ApiDeliveryNoteController::class, 'show']);
            Route::get('/{id}/lines', [ApiDeliveryNoteController::class, 'getLines']);
            Route::get('/{id}/linked-objects', [ApiDeliveryNoteController::class, 'getLinkedObjects']);
            Route::get('/{id}/print-pdf', [ApiDeliveryNoteController::class, 'printPdf']);
        });

        Route::middleware('permission:stocks.create')->group(function () {
            Route::post('', [ApiDeliveryNoteController::class, 'storeCustomer']);
        });

        Route::middleware('permission:stocks.edit')->group(function () {
            Route::put('/{id}', [ApiDeliveryNoteController::class, 'update']);
            Route::post('/{id}/lines', [ApiDeliveryNoteController::class, 'saveLine']);
            Route::post('/{id}/validate', [ApiDeliveryNoteController::class, 'validate']);
        });

        Route::middleware('permission:stocks.delete')->group(function () {
            Route::delete('/{id}', [ApiDeliveryNoteController::class, 'destroy']);
            Route::delete('/{id}/lines/{lineId}', [ApiDeliveryNoteController::class, 'deleteLine']);
        });

        // Documents
        Route::middleware('permission:stocks.view')->group(function () {
            Route::get('/{id}/documents', function ($id) {
                return app(ApiDocumentController::class)->index('customer-delivery-notes', $id);
            });
        });
        Route::middleware('permission:stocks.create')->group(function () {
            Route::post('/{id}/documents', function (\App\Http\Requests\DocumentUploadRequest $request, $id) {
                return app(ApiDocumentController::class)->upload($request, 'customer-delivery-notes', $id);
            });
        });
    });

    // Bons de réception fournisseur - Routes avec permissions granulaires
    Route::prefix('supplier-reception-notes')->group(function () {
        Route::middleware('permission:stocks.view')->group(function () {
            Route::get('', [ApiDeliveryNoteController::class, 'indexSupplier']);
            Route::get('/{id}', [ApiDeliveryNoteController::class, 'show']);
            Route::get('/{id}/lines', [ApiDeliveryNoteController::class, 'getLines']);
            Route::get('/{id}/linked-objects', [ApiDeliveryNoteController::class, 'getLinkedObjects']);
            Route::get('/{id}/print-pdf', [ApiDeliveryNoteController::class, 'printPdf']);
        });

        Route::middleware('permission:stocks.create')->group(function () {
            Route::post('', [ApiDeliveryNoteController::class, 'storeSupplier']);
        });

        Route::middleware('permission:stocks.edit')->group(function () {
            Route::put('/{id}', [ApiDeliveryNoteController::class, 'update']);
            Route::post('/{id}/lines', [ApiDeliveryNoteController::class, 'saveLine']);
            Route::post('/{id}/validate', [ApiDeliveryNoteController::class, 'validate']);
        });

        Route::middleware('permission:stocks.delete')->group(function () {
            Route::delete('/{id}', [ApiDeliveryNoteController::class, 'destroy']);
            Route::delete('/{id}/lines/{lineId}', [ApiDeliveryNoteController::class, 'deleteLine']);
        });

        // Documents
        Route::middleware('permission:stocks.view')->group(function () {
            Route::get('/{id}/documents', function ($id) {
                return app(ApiDocumentController::class)->index('supplier-reception-notes', $id);
            });
        });
        Route::middleware('permission:stocks.create')->group(function () {
            Route::post('/{id}/documents', function (\App\Http\Requests\DocumentUploadRequest $request, $id) {
                return app(ApiDocumentController::class)->upload($request, 'supplier-reception-notes', $id);
            });
        });
    });

    // Routes pour récupérer les produits à livrer/réceptionner depuis les commandes
    Route::middleware('permission:sale-orders.view')->group(function () {
        Route::get('/sale-orders/{id}/products-to-deliver', [ApiDeliveryNoteController::class, 'getProductsToDeliver']);
    });

    Route::middleware('permission:purchase-orders.view')->group(function () {
        Route::get('/purchase-orders/{id}/products-to-receive', [ApiDeliveryNoteController::class, 'getProductsToReceive']);
    });

    // Contacts - Routes avec permissions granulaires
    Route::prefix('contacts')->group(function () {
        // Routes de consultation (permission: contacts.view)
        Route::middleware('permission:contacts.view')->group(function () {
            Route::get('', [ApiContactController::class, 'index']);
            Route::get('options', [ApiContactController::class, 'options']);
            Route::get('/{id}', [ApiContactController::class, 'show']);
            Route::get('/{contactId}/devices', [ApiContactController::class, 'getDevices']);
        });

        // Routes de création (permission: contacts.create)
        Route::middleware('permission:contacts.create')->group(function () {
            Route::post('', [ApiContactController::class, 'store']);
            Route::post('/{contactId}/devices', [ApiContactController::class, 'linkDevice']);
        });

        // Routes de modification (permission: contacts.edit)
        Route::middleware('permission:contacts.edit')->group(function () {
            Route::put('/{id}', [ApiContactController::class, 'update']);
            Route::patch('/{id}', [ApiContactController::class, 'update']);
            Route::post('/{contactId}/attach-partner', [ApiContactController::class, 'attachPartner']);
        });

        // Routes de suppression (permission: contacts.delete)
        Route::middleware('permission:contacts.delete')->group(function () {
            Route::delete('/{id}', [ApiContactController::class, 'destroy']);
            Route::delete('/{contactId}/devices/{ctdId}', [ApiContactController::class, 'unlinkDevice']);
        });
    });

    // Devices - Routes avec permissions granulaires
    Route::prefix('devices')->group(function () {
        // Routes de consultation (permission: devices.view)
        Route::middleware('permission:devices.view')->group(function () {
            Route::get('', [ApiDeviceController::class, 'index']);
            Route::get('options', [ApiDeviceController::class, 'options']);
            Route::get('/{id}', [ApiDeviceController::class, 'show']);
            Route::get('/{deviceId}/contacts', [ApiDeviceController::class, 'getContacts']);
        });

        // Routes de création (permission: devices.create)
        Route::middleware('permission:devices.create')->group(function () {
            Route::post('', [ApiDeviceController::class, 'store']);
            Route::post('/{deviceId}/contacts', [ApiDeviceController::class, 'linkContact']);
        });

        // Routes de modification (permission: devices.edit)
        Route::middleware('permission:devices.edit')->group(function () {
            Route::put('/{id}', [ApiDeviceController::class, 'update']);
            Route::patch('/{id}', [ApiDeviceController::class, 'update']);
        });

        // Routes de suppression (permission: devices.delete)
        Route::middleware('permission:devices.delete')->group(function () {
            Route::delete('/{id}', [ApiDeviceController::class, 'destroy']);
            Route::delete('/{deviceId}/contacts/{ctdId}', [ApiDeviceController::class, 'unlinkContact']);
        });
    });


    // SaleQuotations - Routes pour les devis (ord_status < 3 ou null)
    Route::prefix('sale-quotations')->group(function () {
        // Routes de consultation (permission: sale-orders.view)
        Route::middleware('permission:sale-orders.view')->group(function () {
            Route::get('', [ApiSaleOrderController::class, 'indexQuotations']);
        });
    });

    // SaleOrders - Routes pour les commandes (ord_status >= 3)
    /* Route::prefix('sale-orders')->group(function () {
        // Routes de consultation (permission: sale-orders.view)
        Route::middleware('permission:sale-orders.view')->group(function () {
            Route::get('', [ApiSaleOrderController::class, 'indexOrders']);
        });
    });*/

    // SaleOrders - Routes avec permissions granulaires
    Route::prefix('sale-orders')->group(function () {
        // Routes de consultation (permission: sale-orders.view)
        Route::middleware('permission:sale-orders.view')->group(function () {
            Route::get('', [ApiSaleOrderController::class, 'index']);
            Route::get('/{id}', [ApiSaleOrderController::class, 'show']);
            Route::get('/{id}/lines', [ApiSaleOrderController::class, 'getLines'])->name('sale-orders.lines');
            Route::get('/{orderId}/linked-objects', [ApiSaleOrderController::class, 'getLinkedObjects'])->name('sale-orders.linked-objects');
            Route::get('/{id}/print-pdf', [ApiSaleOrderController::class, 'printPdf'])->name('sale-orders.print-pdf');
        });

        // Documents - permission: sale-orders.documents.view
        Route::middleware('permission:sale-orders.documents.view')->group(function () {
            Route::get('/{orderId}/documents', function ($orderId) {
                return app(ApiDocumentController::class)->index('sale-orders', $orderId);
            })->name('sale-orders.documents.index');
            Route::get('/{orderId}/documents/stats', function ($orderId) {
                return app(ApiDocumentController::class)->stats('sale-orders', $orderId);
            })->name('sale-orders.documents.stats');
        });

        // Documents - permission: sale-orders.documents.create
        Route::middleware('permission:sale-orders.documents.create')->group(function () {
            Route::post('/{orderId}/documents', function (App\Http\Requests\DocumentUploadRequest $request, $orderId) {
                return app(ApiDocumentController::class)->upload($request, 'sale-orders', $orderId);
            })->name('sale-orders.documents.create');
        });

        // Routes de création (permission: sale-orders.create)
        Route::middleware('permission:sale-orders.create')->group(function () {
            Route::post('', [ApiSaleOrderController::class, 'store']);
            Route::post('/{orderId}/lines', [ApiSaleOrderController::class, 'saveLine'])->name('sale-orders.save-line');
            Route::post('/{id}/duplicate', [ApiSaleOrderController::class, 'duplicate'])->name('sale-orders.duplicate');
        });

        // Routes de génération de facture et contrat (permission: invoices.create)
        Route::middleware('permission:invoices.create')->group(function () {
            Route::post('/{orderId}/generate-invoice', [ApiSaleOrderController::class, 'generateInvoiceAndContract'])->name('sale-orders.generate-invoice-and-contract');
        });

        // Routes de modification (permission: sale-orders.edit)
        Route::middleware('permission:sale-orders.edit')->group(function () {
            Route::put('/{id}', [ApiSaleOrderController::class, 'update']);
            Route::patch('/{id}', [ApiSaleOrderController::class, 'update']);
            Route::put('/{orderId}/lines/order', [ApiSaleOrderController::class, 'updateLinesOrder'])->name('sale-orders.update-lines-order');
        });

        // Routes de suppression (permission: sale-orders.delete)
        Route::middleware('permission:sale-orders.delete')->group(function () {
            Route::delete('/{id}', [ApiSaleOrderController::class, 'destroy']);
            Route::delete('/{orderId}/lines/{lineId}', [ApiSaleOrderController::class, 'deleteLine'])->name('sale-orders.delete-line');
        });
    });

    // SaleQuotations - Routes pour les devis (ord_status < 3 ou null)
    Route::prefix('purchase-quotations')->group(function () {
        // Routes de consultation (permission: sale-orders.view)
        Route::middleware('permission:purchase-orders.view')->group(function () {
            Route::get('', [ApiPurchaseOrderController::class, 'indexQuotations']);
        });
    });


    // PurchaseOrders - Routes avec permissions granulaires
    Route::prefix('purchase-orders')->group(function () {
        // Routes de consultation (permission: purchase-orders.view)
        Route::middleware('permission:purchase-orders.view')->group(function () {
            Route::get('', [ApiPurchaseOrderController::class, 'index']);
            Route::get('/{id}', [ApiPurchaseOrderController::class, 'show']);
            Route::get('/{id}/lines', [ApiPurchaseOrderController::class, 'getLines'])->name('purchase-orders.lines');
            Route::get('/{porId}/linked-objects', [ApiPurchaseOrderController::class, 'getLinkedObjects'])->name('purchase-orders.linked-objects');
            Route::get('/{id}/print-pdf', [ApiPurchaseOrderController::class, 'printPdf'])->name('purchase-orders.print-pdf');
        });

        // Documents - permission: purchase-orders.documents.view
        Route::middleware('permission:purchase-orders.documents.view')->group(function () {
            Route::get('/{porId}/documents', function ($porId) {
                return app(ApiDocumentController::class)->index('purchase-orders', $porId);
            })->name('purchase-orders.documents.index');
            Route::get('/{porId}/documents/stats', function ($porId) {
                return app(ApiDocumentController::class)->stats('purchase-orders', $porId);
            })->name('purchase-orders.documents.stats');
        });

        // Documents - permission: purchase-orders.documents.create
        Route::middleware('permission:purchase-orders.documents.create')->group(function () {
            Route::post('/{porId}/documents', function (App\Http\Requests\DocumentUploadRequest $request, $porId) {
                return app(ApiDocumentController::class)->upload($request, 'purchase-orders', $porId);
            })->name('purchase-orders.documents.create');
        });

        // Routes de création (permission: purchase-orders.create)
        Route::middleware('permission:purchase-orders.create')->group(function () {
            Route::post('', [ApiPurchaseOrderController::class, 'store']);
            Route::post('/{porId}/lines', [ApiPurchaseOrderController::class, 'saveLine'])->name('purchase-orders.save-line');
            Route::post('/{id}/duplicate', [ApiPurchaseOrderController::class, 'duplicate'])->name('purchase-orders.duplicate');
        });

        // Routes de création de bon de réception (permission: stocks.edit)
        Route::middleware('permission:stocks.edit')->group(function () {
            Route::post('/{porId}/delivery-note', [ApiDeliveryNoteController::class, 'createFromPurchaseOrder'])->name('purchase-orders.create-delivery-note');
        });

        // Routes de modification (permission: purchase-orders.edit)
        Route::middleware('permission:purchase-orders.edit')->group(function () {
            Route::put('/{id}', [ApiPurchaseOrderController::class, 'update']);
            Route::patch('/{id}', [ApiPurchaseOrderController::class, 'update']);
            Route::put('/{porId}/lines/order', [ApiPurchaseOrderController::class, 'updateLinesOrder'])->name('purchase-orders.update-lines-order');
        });

        // Routes de suppression (permission: purchase-orders.delete)
        Route::middleware('permission:purchase-orders.delete')->group(function () {
            Route::delete('/{id}', [ApiPurchaseOrderController::class, 'destroy']);
            Route::delete('/{porId}/lines/{lineId}', [ApiPurchaseOrderController::class, 'deleteLine'])->name('purchase-orders.delete-line');
        });
    });

    // CustomerInvoices - Routes pour les factures client
    Route::prefix('customer-invoices')->group(function () {
        // Routes de consultation (permission: invoices.view)
        Route::middleware('permission:invoices.view')->group(function () {
            Route::get('', [ApiInvoiceController::class, 'indexCustomerInvoices']);
        });
    });

    // SupplierInvoices - Routes pour les factures fournisseur
    Route::prefix('supplier-invoices')->group(function () {
        // Routes de consultation (permission: invoices.view)
        Route::middleware('permission:invoices.view')->group(function () {
            Route::get('', [ApiInvoiceController::class, 'indexSupplierInvoices']);
        });
    });

    // Invoices - Routes avec permissions granulaires
    Route::prefix('invoices')->group(function () {
        // Routes de consultation (permission: invoices.view)
        Route::middleware('permission:invoices.view')->group(function () {
            Route::get('', [ApiInvoiceController::class, 'index']);
            Route::get('/{id}', [ApiInvoiceController::class, 'show']);
            Route::get('/{id}/lines', [ApiInvoiceController::class, 'getLines'])->name('invoices.lines');
            Route::get('/{invId}/linked-objects', [ApiInvoiceController::class, 'getLinkedObjects'])->name('invoices.linked-objects');
            Route::get('/{id}/print-pdf', [ApiInvoiceController::class, 'printPdf'])->name('invoices.print-pdf');
            Route::get('/{id}/check-usage', [ApiInvoiceController::class, 'checkUsage'])->name('invoices.check-usage');
        });

        // Documents - permission: invoices.documents.view
        Route::middleware('permission:invoices.documents.view')->group(function () {
            Route::get('/{invId}/documents', function ($invId) {
                return app(ApiDocumentController::class)->index('invoices', $invId);
            })->name('invoices.documents.index');
            Route::get('/{invId}/documents/stats', function ($invId) {
                return app(ApiDocumentController::class)->stats('invoices', $invId);
            })->name('invoices.documents.stats');
        });

        // Documents - permission: invoices.documents.create
        Route::middleware('permission:invoices.documents.create')->group(function () {
            Route::post('/{invId}/documents', function (App\Http\Requests\DocumentUploadRequest $request, $invId) {
                return app(ApiDocumentController::class)->upload($request, 'invoices', $invId);
            })->name('invoices.documents.create');
        });

        // Routes de création (permission: invoices.create)
        Route::middleware('permission:invoices.create')->group(function () {
            Route::post('', [ApiInvoiceController::class, 'store']);
            Route::post('/{invId}/lines', [ApiInvoiceController::class, 'saveLine'])->name('invoices.save-line');


            Route::post('/{id}/duplicate', [ApiInvoiceController::class, 'duplicate'])->name('invoices.duplicate');
            Route::post('/calculate-due-date', [ApiInvoiceController::class, 'calculateDueDate']);
        });

        // Routes de modification (permission: invoices.edit)
        Route::middleware('permission:invoices.edit')->group(function () {
            Route::put('/{id}', [ApiInvoiceController::class, 'update']);
            Route::patch('/{id}', [ApiInvoiceController::class, 'update']);
            Route::put('/{invId}/lines/order', [ApiInvoiceController::class, 'updateLinesOrder'])->name('invoices.update-lines-order');
            Route::post('/{invId}/update-lines-tax-position', [ApiInvoiceController::class, 'updateLinesTaxPosition'])->name('invoices.update-lines-tax-position');
        });

        // Routes de suppression (permission: invoices.delete)
        Route::middleware('permission:invoices.delete')->group(function () {
            Route::delete('/{id}', [ApiInvoiceController::class, 'destroy']);
            Route::delete('/{invId}/lines/{lineId}', [ApiInvoiceController::class, 'deleteLine'])->name('invoices.delete-line');
        });

        // OCR Import - Routes pour l'import de factures via OCR (permission: invoices.create)
        Route::prefix('ocr')->middleware('permission:invoices.create')->group(function () {
            Route::post('/upload', [ApiInvoiceOcrController::class, 'uploadAndProcess'])->name('invoices.ocr.upload');
            Route::get('/preview/{token}', [ApiInvoiceOcrController::class, 'getPreview'])->name('invoices.ocr.preview');
            Route::post('/confirm', [ApiInvoiceOcrController::class, 'confirmImport'])->name('invoices.ocr.confirm');
            Route::post('/cancel', [ApiInvoiceOcrController::class, 'cancelImport'])->name('invoices.ocr.cancel');
        });
    });

    // CustomerContracts - Routes pour les contrats clients (con_operation = 1)
    Route::prefix('customercontracts')->group(function () {
        // Routes de consultation (permission: contracts.view)
        Route::middleware('permission:contracts.view')->group(function () {
            Route::get('', [ApiContractController::class, 'indexCustomerContracts']);
        });
    });

    // SupplierContracts - Routes pour les contrats fournisseurs (con_operation = 2)
    Route::prefix('suppliercontracts')->group(function () {
        // Routes de consultation (permission: contracts.view)
        Route::middleware('permission:contracts.view')->group(function () {
            Route::get('', [ApiContractController::class, 'indexSupplierContracts']);
        });
    });

    // Contracts - Routes avec permissions granulaires
    Route::prefix('contracts')->group(function () {
        // Routes spécifiques sans paramètres - DOIVENT être AVANT les routes avec {id}
        Route::middleware('permission:contracts.create')->group(function () {
            Route::post('/calculate-end-commitment-date', [ApiContractController::class, 'calculateEndCommitmentDate'])->name('contracts.calculate-end-commitment-date');
        });

        // Génération de factures depuis contrats (permission: invoices.create)
        Route::middleware('permission:invoices.create')->group(function () {
            Route::get('/eligible-for-invoicing', [ApiContractController::class, 'getEligibleForInvoicing'])->name('contracts.eligible-for-invoicing');
            Route::post('/generate-invoices', [ApiContractController::class, 'generateInvoices'])->name('contracts.generate-invoices');
            Route::post('/{id}/generate-invoice', [ApiContractController::class, 'generateInvoice'])->name('contracts.generate-invoice');
        });

        // Routes de consultation (permission: contracts.view)
        Route::middleware('permission:contracts.view')->group(function () {
            Route::get('', [ApiContractController::class, 'index']);

            Route::get('/{id}', [ApiContractController::class, 'show']);
            Route::get('/{id}/lines', [ApiContractController::class, 'getLines'])->name('contracts.lines');
            Route::get('/{contractId}/linked-objects', [ApiContractController::class, 'getLinkedObjects'])->name('contracts.linked-objects');
            Route::get('/{contractId}/termination-data', [ApiContractController::class, 'getTerminationData'])->name('contracts.termination-data');
            Route::get('/{id}/print-pdf', [ApiContractController::class, 'printPdf'])->name('contracts.print-pdf');
        });

        // Documents - permission: contracts.documents.view
        Route::middleware('permission:contracts.documents.view')->group(function () {
            Route::get('/{contractId}/documents', function ($contractId) {
                return app(ApiDocumentController::class)->index('contracts', $contractId);
            })->name('contracts.documents.index');
            Route::get('/{contractId}/documents/stats', function ($contractId) {
                return app(ApiDocumentController::class)->stats('contracts', $contractId);
            })->name('contracts.documents.stats');
        });

        // Documents - permission: contracts.documents.create
        Route::middleware('permission:contracts.documents.create')->group(function () {
            Route::post('/{contractId}/documents', function (App\Http\Requests\DocumentUploadRequest $request, $contractId) {
                return app(ApiDocumentController::class)->upload($request, 'contracts', $contractId);
            })->name('contracts.documents.create');
        });

        // Routes de création (permission: contracts.create)
        Route::middleware('permission:contracts.create')->group(function () {
            Route::post('', [ApiContractController::class, 'store']);
            Route::post('/{contractId}/lines', [ApiContractController::class, 'saveLine'])->name('contracts.save-line');
            Route::post('/{id}/duplicate', [ApiContractController::class, 'duplicate'])->name('contracts.duplicate');
            Route::post('/{contractId}/calculate-next-invoice-date', [ApiContractController::class, 'calculateNextInvoiceDate'])->name('contracts.calculate-next-invoice-date');
        });

        // Routes de modification (permission: contracts.edit)
        Route::middleware('permission:contracts.edit')->group(function () {
            Route::put('/{id}', [ApiContractController::class, 'update']);
            Route::patch('/{id}', [ApiContractController::class, 'update']);
            Route::put('/{contractId}/lines/order', [ApiContractController::class, 'updateLinesOrder'])->name('contracts.update-lines-order');
            Route::post('/{contractId}/terminate', [ApiContractController::class, 'terminate'])->name('contracts.terminate');
        });

        // Routes de suppression (permission: contracts.delete)
        Route::middleware('permission:contracts.delete')->group(function () {
            Route::delete('/{id}', [ApiContractController::class, 'destroy']);
            Route::delete('/{contractId}/lines/{lineId}', [ApiContractController::class, 'deleteLine'])->name('contracts.delete-line');
        });
    });

    // Charge Types - Routes avec permissions granulaires
    Route::prefix('charge-types')->group(function () {
        // Routes de consultation (permission: settings.charges.view)
        Route::middleware('permission:settings.charges.view')->group(function () {
            Route::get('', [ApiChargeTypeController::class, 'index']);
            Route::get('/options', [ApiChargeTypeController::class, 'options']);
            Route::get('/{id}', [ApiChargeTypeController::class, 'show']);
        });

        // Routes de création (permission: settings.charges.create)
        Route::middleware('permission:settings.charges.create')->group(function () {
            Route::post('', [ApiChargeTypeController::class, 'store']);
        });

        // Routes de modification (permission: settings.charges.edit)
        Route::middleware('permission:settings.charges.edit')->group(function () {
            Route::put('/{id}', [ApiChargeTypeController::class, 'update']);
            Route::patch('/{id}', [ApiChargeTypeController::class, 'update']);
        });

        // Routes de suppression (permission: settings.charges.delete)
        Route::middleware('permission:settings.charges.delete')->group(function () {
            Route::delete('/{id}', [ApiChargeTypeController::class, 'destroy']);
        });
    });

    // Charges - Routes avec permissions granulaires
    Route::prefix('charges')->group(function () {
        // Routes de consultation (permission: charges.view)
        Route::middleware('permission:charges.view')->group(function () {
            Route::get('', [ApiChargeController::class, 'index']);
            Route::get('/{id}', [ApiChargeController::class, 'show']);
        });

        // Documents - permission: charges.documents.view
        Route::middleware('permission:charges.documents.view')->group(function () {
            Route::get('/{chargeId}/documents', function ($chargeId) {
                return app(ApiDocumentController::class)->index('charges', $chargeId);
            })->name('charges.documents.index');
            Route::get('/{chargeId}/documents/stats', function ($chargeId) {
                return app(ApiDocumentController::class)->stats('charges', $chargeId);
            })->name('charges.documents.stats');
        });

        // Documents - permission: charges.documents.create
        Route::middleware('permission:charges.documents.create')->group(function () {
            Route::post('/{chargeId}/documents', function (App\Http\Requests\DocumentUploadRequest $request, $chargeId) {
                return app(ApiDocumentController::class)->upload($request, 'charges', $chargeId);
            })->name('charges.documents.create');
        });

        // Routes de création (permission: charges.create)
        Route::middleware('permission:charges.create')->group(function () {
            Route::post('', [ApiChargeController::class, 'store']);
            Route::post('/{id}/duplicate', [ApiChargeController::class, 'duplicate'])->name('charges.duplicate');
        });

        // Routes de modification (permission: charges.edit)
        Route::middleware('permission:charges.edit')->group(function () {
            Route::put('/{id}', [ApiChargeController::class, 'update']);
            Route::patch('/{id}', [ApiChargeController::class, 'update']);
        });

        // Routes de suppression (permission: charges.delete)
        Route::middleware('permission:charges.delete')->group(function () {
            Route::delete('/{id}', [ApiChargeController::class, 'destroy']);
        });
    });

    // Users - Routes avec permissions granulaires
    Route::prefix('users')->group(function () {
        Route::get('options', [ApiUserController::class, 'options']);
        Route::get('sellers', [ApiUserController::class, 'getSellers']);
        Route::get('employees', [ApiUserController::class, 'getEmployees']);

        // Routes de consultation (permission: users.view)
        Route::middleware('permission:users.view')->group(function () {
            Route::get('', [ApiUserController::class, 'index']);
            Route::get('/{id}', [ApiUserController::class, 'show']);
        });

        // Routes de création (permission: users.create)
        Route::middleware('permission:users.create')->group(function () {
            Route::post('', [ApiUserController::class, 'store']);
        });

        // Routes de modification (permission: users.edit)
        Route::middleware('permission:users.edit')->group(function () {
            Route::put('/{id}', [ApiUserController::class, 'update']);
            Route::patch('/{id}', [ApiUserController::class, 'update']);
        });

        // Routes de suppression (permission: users.delete)
        Route::middleware('permission:users.delete')->group(function () {
            Route::delete('/{id}', [ApiUserController::class, 'destroy']);
        });
    });

    // Routes pour la gestion des permissions utilisateur (nécessite permission: users.edit)
    Route::prefix('users/{userId}')->middleware('permission:users.edit')->group(function () {
        Route::get('/permissions', [ApiUserPermissionController::class, 'show']);
        Route::put('/roles', [ApiUserPermissionController::class, 'syncRoles']);
        Route::put('/permissions', [ApiUserPermissionController::class, 'syncPermissions']);
        Route::post('/permissions/give', [ApiUserPermissionController::class, 'givePermission']);
        Route::post('/permissions/revoke', [ApiUserPermissionController::class, 'revokePermission']);
    });

    // Roles - Routes avec permissions granulaires
    Route::prefix('roles')->group(function () {
        // Routes de consultation (permission: settings.roles.view)
        Route::middleware('permission:settings.roles.view')->group(function () {
            Route::get('', [ApiRoleController::class, 'index']);
            Route::get('options', [ApiRoleController::class, 'options']);
            Route::get('permissions', [ApiRoleController::class, 'getAllPermissions']);
            Route::get('/{id}', [ApiRoleController::class, 'show']);
        });

        // Routes de création (permission: settings.roles.create)
        Route::middleware('permission:settings.roles.create')->group(function () {
            Route::post('', [ApiRoleController::class, 'store']);
        });

        // Routes de modification (permission: settings.roles.edit)
        Route::middleware('permission:settings.roles.edit')->group(function () {
            Route::put('/{id}', [ApiRoleController::class, 'update']);
            Route::patch('/{id}', [ApiRoleController::class, 'update']);
        });

        // Routes de suppression (permission: settings.roles.delete)
        Route::middleware('permission:settings.roles.delete')->group(function () {
            Route::delete('/{id}', [ApiRoleController::class, 'destroy']);
        });
    });

    // ==========================================
    // PROSPECTION - Module commercial
    // ==========================================

    // Prospect Pipeline Stages - Settings CRUD
    Route::prefix('prospect-pipeline-stages')->group(function () {
        Route::middleware('permission:settings.prospectconf.view|opportunities.view|prospect.view')->group(function () {
            Route::get('', [ApiProspectPipelineStageController::class, 'index']);
            Route::get('/options', [ApiProspectPipelineStageController::class, 'options']);
            Route::get('/{id}', [ApiProspectPipelineStageController::class, 'show']);
        });
        Route::middleware('permission:settings.prospectconf.create')->group(function () {
            Route::post('', [ApiProspectPipelineStageController::class, 'store']);
        });
        Route::middleware('permission:settings.prospectconf.edit')->group(function () {
            Route::put('/{id}', [ApiProspectPipelineStageController::class, 'update']);
            Route::patch('/{id}', [ApiProspectPipelineStageController::class, 'update']);
        });
        Route::middleware('permission:settings.prospectconf.delete')->group(function () {
            Route::delete('/{id}', [ApiProspectPipelineStageController::class, 'destroy']);
        });
    });

    // Prospect Sources - Settings CRUD
    Route::prefix('prospect-sources')->group(function () {
        Route::middleware('permission:settings.prospectconf.view|opportunities.view|prospect.view')->group(function () {
            Route::get('', [ApiProspectSourceController::class, 'index']);
            Route::get('/options', [ApiProspectSourceController::class, 'options']);
            Route::get('/{id}', [ApiProspectSourceController::class, 'show']);
        });
        Route::middleware('permission:settings.prospectconf.create')->group(function () {
            Route::post('', [ApiProspectSourceController::class, 'store']);
        });
        Route::middleware('permission:settings.prospectconf.edit')->group(function () {
            Route::put('/{id}', [ApiProspectSourceController::class, 'update']);
            Route::patch('/{id}', [ApiProspectSourceController::class, 'update']);
        });
        Route::middleware('permission:settings.prospectconf.delete')->group(function () {
            Route::delete('/{id}', [ApiProspectSourceController::class, 'destroy']);
        });
    });

    // Prospect Lost Reasons - Settings CRUD
    Route::prefix('prospect-lost-reasons')->group(function () {
        Route::middleware('permission:settings.prospectconf.view|opportunities.view|prospect.view')->group(function () {
            Route::get('', [ApiProspectLostReasonController::class, 'index']);
            Route::get('/options', [ApiProspectLostReasonController::class, 'options']);
            Route::get('/{id}', [ApiProspectLostReasonController::class, 'show']);
        });
        Route::middleware('permission:settings.prospectconf.create')->group(function () {
            Route::post('', [ApiProspectLostReasonController::class, 'store']);
        });
        Route::middleware('permission:settings.prospectconf.edit')->group(function () {
            Route::put('/{id}', [ApiProspectLostReasonController::class, 'update']);
            Route::patch('/{id}', [ApiProspectLostReasonController::class, 'update']);
        });
        Route::middleware('permission:settings.prospectconf.delete')->group(function () {
            Route::delete('/{id}', [ApiProspectLostReasonController::class, 'destroy']);
        });
    });



    // Opportunities - CRUD + Pipeline + Statistics
    Route::prefix('opportunities')->group(function () {
        Route::middleware('permission:opportunities.view')->group(function () {
            Route::get('', [ApiProspectOpportunityController::class, 'index']);
            Route::get('/pipeline', [ApiProspectOpportunityController::class, 'pipeline']);
            Route::get('/statistics', [ApiProspectOpportunityController::class, 'statistics']);
            Route::get('/sales-rep-stats', [ApiProspectOpportunityController::class, 'salesRepStats']);
            Route::get('/options', [ApiProspectOpportunityController::class, 'options']);
            Route::get('/by-partner/{ptrId}', [ApiProspectOpportunityController::class, 'byPartner']);
            Route::get('/{id}', [ApiProspectOpportunityController::class, 'show']);
        });
        Route::middleware('permission:opportunities.create')->group(function () {
            Route::post('', [ApiProspectOpportunityController::class, 'store']);
        });
        Route::middleware('permission:opportunities.edit')->group(function () {
            Route::put('/{id}', [ApiProspectOpportunityController::class, 'update']);
            Route::patch('/{id}', [ApiProspectOpportunityController::class, 'update']);
            Route::post('/{id}/mark-won', [ApiProspectOpportunityController::class, 'markAsWon']);
            Route::post('/{id}/mark-lost', [ApiProspectOpportunityController::class, 'markAsLost']);
            Route::post('/{id}/convert-customer', [ApiProspectOpportunityController::class, 'convertToCustomer']);
        });
        Route::middleware('permission:opportunities.delete')->group(function () {
            Route::delete('/{id}', [ApiProspectOpportunityController::class, 'destroy']);
        });
        // Documents sur opportunités
        Route::middleware('permission:opportunities.view')->group(function () {
            Route::get('/{id}/documents', function ($id) {
                return app(ApiDocumentController::class)->index('opportunities', $id);
            });
        });
        Route::middleware('permission:opportunities.create')->group(function () {
            Route::post('/{id}/documents', function (\App\Http\Requests\DocumentUploadRequest $request, $id) {
                return app(ApiDocumentController::class)->upload($request, 'opportunities', $id);
            });
        });
    });

    // Prospect Activities - CRUD
    Route::prefix('prospect-activities')->group(function () {
        Route::middleware('permission:opportunities.view')->group(function () {
            Route::get('', [ApiProspectActivityController::class, 'index']);
            Route::get('/upcoming', [ApiProspectActivityController::class, 'upcoming']);
            Route::get('/by-partner/{ptrId}', [ApiProspectActivityController::class, 'byPartner']);
            Route::get('/{id}', [ApiProspectActivityController::class, 'show']);
        });
        Route::middleware('permission:opportunities.create')->group(function () {
            Route::post('', [ApiProspectActivityController::class, 'store']);
        });
        Route::middleware('permission:opportunities.edit')->group(function () {
            Route::put('/{id}', [ApiProspectActivityController::class, 'update']);
            Route::patch('/{id}', [ApiProspectActivityController::class, 'update']);
            Route::post('/{id}/mark-done', [ApiProspectActivityController::class, 'markAsDone']);
        });
        Route::middleware('permission:opportunities.delete')->group(function () {
            Route::delete('/{id}', [ApiProspectActivityController::class, 'destroy']);
        });
    });

    // Activités par opportunité
    Route::middleware('permission:opportunities.view')->group(function () {
        Route::get('/opportunities/{oppId}/activities', [ApiProspectActivityController::class, 'byOpportunity']);
    });

    // Cases de déclaration TVA (mapping comptable)
    Route::get('/vat-boxes',          [ApiAccountVatBoxController::class, 'index'])->middleware('permission:accountings.view');
    Route::put('/vat-boxes/accounts', [ApiAccountVatBoxController::class, 'updateAccounts'])->middleware('permission:accountings.edit');

    // Déclarations TVA (CA3 / CA12)
    Route::prefix('vat-declarations')->middleware('permission:accountings.view')->group(function () {
        Route::get('/',                            [ApiAccountVatDeclarationController::class, 'index']);
        Route::post('/',                           [ApiAccountVatDeclarationController::class, 'store']);
        Route::get('/next-deadline',               [ApiAccountVatDeclarationController::class, 'nextDeadline']);
        Route::post('/preview',                    [ApiAccountVatDeclarationController::class, 'preview']);
        Route::get('/{id}',                        [ApiAccountVatDeclarationController::class, 'show']);
        Route::delete('/{id}',                     [ApiAccountVatDeclarationController::class, 'destroy']);
        Route::patch('/{id}/label',                [ApiAccountVatDeclarationController::class, 'updateLabel']);
        Route::post('/{id}/close',                 [ApiAccountVatDeclarationController::class, 'close']);
        Route::get('/{id}/box-lines/{box}',        [ApiAccountVatDeclarationController::class, 'boxLines']);
        Route::patch('/{id}/lines/{vdlId}/amount', [ApiAccountVatDeclarationController::class, 'updateLineAmount'])->middleware('permission:accountings.edit');
    });

    // Mapping TVA (admin — lecture du paramétrage CA3/CA12)
    Route::get('/vat-report-mappings', [ApiAccountVatDeclarationController::class, 'mapping'])
        ->middleware('permission:accountings.view');

    // Routes génériques pour les documents
    // Note: Les permissions sont vérifiées via DocumentPolicy qui vérifie les permissions spécifiques au module
    // Exemple: sale-orders.documents.view, partners.documents.view, etc.
    Route::prefix('documents')->group(function () {
        Route::get('/{documentId}/download', [ApiDocumentController::class, 'download'])->name('documents.download');
        Route::get('/{documentId}/signed-url', [ApiDocumentController::class, 'getSignedUrl'])->name('documents.signed-url');
        Route::delete('/{documentId}', [ApiDocumentController::class, 'delete'])->name('documents.delete');
    });
});
