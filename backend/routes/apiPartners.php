
   
   <?php

    use Illuminate\Support\Facades\Route;

    use App\Http\Controllers\Api\ApiPartnerController;
    use App\Http\Controllers\Api\ApiContactController;
    use App\Http\Controllers\Api\ApiDocumentController;


    Route::middleware('auth:sanctum')->post('/entreprises', [ApiPartnerController::class, 'store']);

    Route::middleware(['auth:sanctum'])->group(function () {
        // Prospects - Liste filtrée des partenaires prospects
        Route::prefix('prospects')->group(function () {
            Route::middleware('permission:prospects.view')->group(function () {
                Route::get('', [ApiPartnerController::class, 'indexProspects']);
            });
        });

        // customers - Routes pour les clients
        Route::prefix('customers')->group(function () {
            Route::middleware('permission:customers.view')->group(function () {
                Route::get('', [ApiPartnerController::class, 'indexCustomers']);
            });
        });

        Route::prefix('suppliers')->group(function () {
            Route::middleware('permission:suppliers.view')->group(function () {
                Route::get('', [ApiPartnerController::class, 'indexSuppliers']);
            });
        });

        // Partner - Routes avec permissions granulaires
        Route::prefix('partners')->group(function () {
            // Routes de consultation (permission: partners.view)
            Route::middleware('permission:partners.view|customers.view|suppliers.view|prospects.view')->group(function () {

                Route::get('', [ApiPartnerController::class, 'indexPartners']);
                Route::get('options', [ApiPartnerController::class, 'options']);
                Route::get('/{id}', [ApiPartnerController::class, 'show']);
                //Route::get('/{partnerId}/bank-details', [ApiBankDetailsController::class, 'getByPartner']);
                Route::get('/{partnerId}/contacts', [ApiContactController::class, 'getByPartner']);
                Route::get('/{partnerId}/linked-objects', [ApiPartnerController::class, 'getLinkedObjects']);
            });

            // Routes de création (permission: partners.create)
            Route::middleware('permission:partners.create|customers.create|suppliers.create|prospects.create')->group(function () {

                Route::post('', [ApiPartnerController::class, 'store']);
                Route::post('/check-account-auxiliary', [ApiPartnerController::class, 'checkAccountAuxiliary']);
                Route::post('/check-linked-records', [ApiPartnerController::class, 'checkLinkedRecords']);
            });

            // Routes de modification (permission: partners.edit)
            Route::middleware('permission:partners.edit|customers.edit|suppliers.edit|prospects.edit')->group(function () {
                // Route::middleware('permission:partners.edit')->group(function () {
                Route::put('/{id}', [ApiPartnerController::class, 'update']);
                Route::patch('/{id}', [ApiPartnerController::class, 'update']);
            });

            // Routes de suppression (permission: partners.delete)
            Route::middleware('permission:partners.delete|customers.delete|suppliers.delete|prospects.delete')->group(function () {
                // Route::middleware('permission:partners.delete')->group(function () {
                Route::delete('/{id}', [ApiPartnerController::class, 'destroy']);
            });

            // Documents - permission: partners.documents.view
            Route::middleware('permission:partners.documents.view')->group(function () {
                Route::get('/{partnerId}/documents', function ($partnerId) {
                    return app(ApiDocumentController::class)->index('partners', $partnerId);
                })->name('partners.documents.index');
                Route::get('/{partnerId}/documents/stats', function ($partnerId) {
                    return app(ApiDocumentController::class)->stats('partners', $partnerId);
                })->name('partners.documents.stats');
            });

            // Documents - permission: partners.documents.create
            Route::middleware('permission:partners.documents.create')->group(function () {
                Route::post('/{partnerId}/documents', function (App\Http\Requests\DocumentUploadRequest $request, $partnerId) {
                    return app(ApiDocumentController::class)->upload($request, 'partners', $partnerId);
                })->name('partners.documents.create');
            });
        });
    });
