<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ApiExpenseReportController;
use App\Http\Controllers\Api\ApiExpenseController;
use App\Http\Controllers\Api\ApiExpenseCategoryController;
use App\Http\Controllers\Api\ApiExpenseConfigController;
use App\Http\Controllers\Api\ApiExpenseOcrController;
use App\Http\Controllers\Api\ApiPaymentController;
use App\Http\Controllers\Api\ApiVehicleController;
use App\Http\Controllers\Api\ApiMileageExpenseController;
use App\Http\Controllers\Api\ApiMileageScaleController;

Route::middleware(['auth:sanctum'])->group(function () {

    // ============================================
    // MY EXPENSE REPORTS (Notes de frais)
    // ============================================

    Route::prefix('my-expense-reports')->group(function () {
        Route::middleware('permission:expenses.my.view')->group(function () {
            Route::get('/', [ApiExpenseReportController::class, 'myExpenseReports']);
            Route::get('/{id}', [ApiExpenseReportController::class, 'show']);
        });

        // Création
        Route::post('/', [ApiExpenseReportController::class, 'store'])
            ->middleware('permission:expenses.my.create');

        Route::middleware('permission:expenses.my.edit')->group(function () {
            Route::put('/{id}', [ApiExpenseReportController::class, 'update']);
            Route::post('/{id}/submit', [ApiExpenseReportController::class, 'submit']);
        });

        // Suppression
        Route::delete('/{id}', [ApiExpenseReportController::class, 'destroy'])
            ->middleware('permission:expenses.my.delete');

        // ============================================
        // EXPENSES nested under MY-EXPENSE-REPORTS
        // ============================================
        Route::prefix('{exrId}/expenses')->group(function () {
            // Lecture
            Route::middleware('permission:expenses.my.view')->group(function () {
                Route::get('/', [ApiExpenseController::class, 'index']);
                Route::get('/{id}', [ApiExpenseController::class, 'show']);
            });

            // Création
            Route::post('/', [ApiExpenseController::class, 'store'])
                ->middleware('permission:expenses.my.create');

            // Modification
            Route::middleware('permission:expenses.my.edit')->group(function () {
                Route::put('/{id}', [ApiExpenseController::class, 'update']);
                Route::post('/{id}/upload-receipt', [ApiExpenseController::class, 'uploadReceipt']);               
            });

            // Suppression
            Route::delete('/{id}', [ApiExpenseController::class, 'destroy'])
                ->middleware('permission:expenses.my.delete');
        });

        // ============================================
        // MILEAGE EXPENSES nested under MY-EXPENSE-REPORTS
        // ============================================
        Route::prefix('{exrId}/mileage-expenses')->group(function () {
            Route::middleware('permission:expenses.my.view')->group(function () {
                Route::get('/', [ApiMileageExpenseController::class, 'index']);
                Route::get('/{id}', [ApiMileageExpenseController::class, 'show']);
            });

            Route::post('/', [ApiMileageExpenseController::class, 'store'])
                ->middleware('permission:expenses.my.create');

            Route::put('/{id}', [ApiMileageExpenseController::class, 'update'])
                ->middleware('permission:expenses.my.edit');

            Route::delete('/{id}', [ApiMileageExpenseController::class, 'destroy'])
                ->middleware('permission:expenses.my.delete');
        });
    });

    // ============================================
    // EXPENSE REPORTS (Notes de frais)
    // ============================================
    Route::prefix('expense-reports')->group(function () {

        // Lecture
        Route::middleware('permission:expenses.view')->group(function () {
            Route::get('/', [ApiExpenseReportController::class, 'index']);
            Route::get('/{id}', [ApiExpenseReportController::class, 'show']);
        });

        // Création
        Route::post('/', [ApiExpenseReportController::class, 'store'])
            ->middleware('permission:expenses.create');

        // Modification
        Route::middleware('permission:expenses.edit')->group(function () {
            Route::put('/{id}', [ApiExpenseReportController::class, 'update']);
            Route::post('/{id}/submit', [ApiExpenseReportController::class, 'submit']);
        });

        // Suppression
        Route::delete('/{id}', [ApiExpenseReportController::class, 'destroy'])
            ->middleware('permission:expenses.delete');

        // Workflow - Approbation
        Route::middleware('permission:expenses.approve')->group(function () {
            Route::post('/{id}/approve', [ApiExpenseReportController::class, 'approve']);
            Route::post('/{id}/reject', [ApiExpenseReportController::class, 'reject']);
            Route::post('/{id}/unapprove', [ApiExpenseReportController::class, 'unapprove']);
        });

     

        // ============================================
        // EXPENSES nested under EXPENSE-REPORTS
        // ============================================
        Route::prefix('{exrId}/expenses')->group(function () {
            // Lecture
            Route::middleware('permission:expenses.view')->group(function () {
                Route::get('/', [ApiExpenseController::class, 'index']);
                Route::get('/{id}', [ApiExpenseController::class, 'show']);
            });

            // Création
            Route::post('/', [ApiExpenseController::class, 'store'])
                ->middleware('permission:expenses.create');

            // Modification
            Route::middleware('permission:expenses.edit')->group(function () {
                Route::put('/{id}', [ApiExpenseController::class, 'update']);
                Route::post('/{id}/upload-receipt', [ApiExpenseController::class, 'uploadReceipt']);           
            });

            // Suppression
            Route::delete('/{id}', [ApiExpenseController::class, 'destroy'])
                ->middleware('permission:expenses.delete');
        });

        // ============================================
        // MILEAGE EXPENSES nested under EXPENSE-REPORTS
        // ============================================
        Route::prefix('{exrId}/mileage-expenses')->group(function () {
            Route::middleware('permission:expenses.view')->group(function () {
                Route::get('/', [ApiMileageExpenseController::class, 'index']);
                Route::get('/{id}', [ApiMileageExpenseController::class, 'show']);
            });

            Route::post('/', [ApiMileageExpenseController::class, 'store'])
                ->middleware('permission:expenses.create');

            Route::put('/{id}', [ApiMileageExpenseController::class, 'update'])
                ->middleware('permission:expenses.edit');

            Route::delete('/{id}', [ApiMileageExpenseController::class, 'destroy'])
                ->middleware('permission:expenses.delete');
        });
    });

    // ============================================
    // VEHICLES (nested under users, admin-managed)
    // ============================================
    Route::prefix('users/{userId}/vehicles')->group(function () {
        Route::middleware('permission:users.view')->group(function () {
            Route::get('/', [ApiVehicleController::class, 'index']);
            Route::get('/options', [ApiVehicleController::class, 'options']);
            Route::get('/{id}', [ApiVehicleController::class, 'show']);
        });

        Route::post('/', [ApiVehicleController::class, 'store'])
            ->middleware('permission:users.edit');

        Route::put('/{id}', [ApiVehicleController::class, 'update'])
            ->middleware('permission:users.edit');

        Route::delete('/{id}', [ApiVehicleController::class, 'destroy'])
            ->middleware('permission:users.edit');

        // Carte grise (registration document)
        Route::middleware('permission:users.view')->group(function () {
            Route::get('/{id}/registration', [ApiVehicleController::class, 'downloadRegistration']);
        });

        Route::middleware('permission:users.edit')->group(function () {
            Route::post('/{id}/registration', [ApiVehicleController::class, 'uploadRegistration']);
            Route::delete('/{id}/registration', [ApiVehicleController::class, 'deleteRegistration']);
        });
    });

    // ============================================
    // MY VEHICLES (utilisateur connecte)
    // ============================================
    Route::prefix('my-vehicles')->group(function () {
        Route::get('/', [ApiVehicleController::class, 'myVehicles']);
        Route::get('/options', [ApiVehicleController::class, 'myVehiclesOptions']);
    });

    // ============================================
    // MILEAGE CALCULATE PREVIEW
    // ============================================
    Route::post('/mileage-expenses/calculate-preview', [ApiMileageExpenseController::class, 'calculatePreview']);

    // ============================================
    // MILEAGE SCALE (Bareme - Settings)
    // ============================================
    Route::prefix('mileage-scale')->group(function () {
        Route::middleware('permission:settings.expenses.view')->group(function () {
            Route::get('/', [ApiMileageScaleController::class, 'index']);
            Route::get('/year/{year}', [ApiMileageScaleController::class, 'getByYear']);
            Route::get('/{id}', [ApiMileageScaleController::class, 'show']);
        });

        Route::post('/', [ApiMileageScaleController::class, 'store'])
            ->middleware('permission:settings.expenses.create');

        Route::post('/duplicate', [ApiMileageScaleController::class, 'duplicate'])
            ->middleware('permission:settings.expenses.create');

        Route::put('/{id}', [ApiMileageScaleController::class, 'update'])
            ->middleware('permission:settings.expenses.edit');

        Route::delete('/{id}', [ApiMileageScaleController::class, 'destroy'])
            ->middleware('permission:settings.expenses.delete');
    });

    // ============================================
    // EXPENSE CATEGORIES (Catégories - Paramètres)
    // ============================================
    Route::prefix('expense-categories')->group(function () {
        //Accessible dans permission
        Route::get('/options', [ApiExpenseCategoryController::class, 'options']);
        // Lecture (pour tous les utilisateurs avec permission expenses)
        Route::middleware('permission:expenses.view')->group(function () {
            Route::get('/', [ApiExpenseCategoryController::class, 'index']);
            Route::get('/active', [ApiExpenseCategoryController::class, 'active']);
        });

        // Administration des catégories (paramètres)
        Route::middleware('permission:settings.expenses.view')->group(function () {
            Route::get('/{id}', [ApiExpenseCategoryController::class, 'show']);
        });

        Route::post('/', [ApiExpenseCategoryController::class, 'store'])
            ->middleware('permission:settings.expenses.create');

        Route::middleware('permission:settings.expenses.edit')->group(function () {
            Route::put('/{id}', [ApiExpenseCategoryController::class, 'update']);
            Route::post('/{id}/toggle-active', [ApiExpenseCategoryController::class, 'toggleActive']);
        });

        Route::delete('/{id}', [ApiExpenseCategoryController::class, 'destroy'])
            ->middleware('permission:settings.expenses.delete');
    });

    // ============================================
    // EXPENSE CONFIG (Configuration du module)
    // ============================================
    Route::prefix('expense-config')->group(function () {
        Route::get('/{id?}', [ApiExpenseConfigController::class, 'show'])->defaults('id', 1);
        // Lecture
        Route::middleware('permission:settings.expenses.view')->group(function () {});

        // Modification
        Route::middleware('permission:settings.expenses.edit')->group(function () {
            Route::put('/{id?}', [ApiExpenseConfigController::class, 'update'])->defaults('id', 1);
            Route::patch('/{id?}', [ApiExpenseConfigController::class, 'update'])->defaults('id', 1);
        });
    });

    // ============================================
    // EXPENSE OCR (Traitement OCR des justificatifs)
    // ============================================
    Route::prefix('expense-ocr')->group(function () {

        // Vérifier si l'OCR est activé
        Route::get('/is-enabled', [ApiExpenseOcrController::class, 'isEnabled']);

        // Traiter un justificatif via OCR
        Route::post('/process', [ApiExpenseOcrController::class, 'processReceipt']);
    });
});
