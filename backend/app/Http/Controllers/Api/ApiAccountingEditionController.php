<?php

namespace App\Http\Controllers\Api;

use App\Models\AccountModel;
use App\Services\AccountingEditionPdfService;
use App\Services\AccountBilanService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApiAccountingEditionController extends Controller
{
    protected $pdfService;

    public function __construct(AccountingEditionPdfService $pdfService)
    {
        $this->pdfService = $pdfService;
    }
    /**
     * Génération de la Balance
     */
    public function balancePdf(Request $request)
    {
        $filters = $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date',
            'account_from_id' => 'nullable|integer',
            'account_to_id' => 'nullable|integer',
            'journal_id' => 'nullable|integer',
        ]);
        try {
            $this->validateWritingPeriod($filters);

            // Utiliser le service pour générer les données
            $balanceData = $this->pdfService->generateBalanceData($filters);

            // Générer le PDF
            $pdfBase64 = $this->pdfService->generateBalancePdf($balanceData, $filters);

            return response()->json([
                'pdf' => $pdfBase64,
                'filename' => 'Balance_' . $filters['start_date'] . '_' . $filters['end_date'] . '.pdf'
            ]);
        } catch (\Exception $e) {
            return response()->json([
               'message' =>$e->getMessage(),
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Génération du Grand Livre
     */
    public function grandLivrePdf(Request $request)
    {
        $filters = $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date',
            'account_from_id' => 'nullable|integer',
            'account_to_id' => 'nullable|integer',
            'journal_id' => 'nullable|integer',
        ]);
        try {
            $this->validateWritingPeriod($filters);

            // Utiliser le service pour générer les données
            $grandLivreData = $this->pdfService->generateGrandLivreData($filters);

            // Générer le PDF
            $pdfBase64 = $this->pdfService->generateGrandLivrePdf($grandLivreData, $filters);

            return response()->json([
                'pdf' => $pdfBase64,
                'filename' => 'GrandLivre_' . $filters['start_date'] . '_' . $filters['end_date'] . '.pdf'
            ]);
        } catch (\Exception $e) {
            return response()->json([
               'message' =>$e->getMessage(),
                'error' => $e->getMessage()
            ], 500);
        }
    }


    /**
     * Génération des Journaux
     */
    public function journauxPdf(Request $request)
    {
        $filters = $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date',
            'journal_id' => 'nullable|integer',
        ]);

        try {
            $this->validateWritingPeriod($filters);

            // Utiliser le service pour générer les données
            $journauxData = $this->pdfService->generateJournauxData($filters);

            // Générer le PDF
            $pdfBase64 = $this->pdfService->generateJournauxPdf($journauxData, $filters);

            return response()->json([
                'pdf' => $pdfBase64,
                'filename' => 'Journaux_' . $filters['start_date'] . '_' . $filters['end_date'] . '.pdf'
            ]);
        } catch (\Exception $e) {
            return response()->json([
               'message' =>$e->getMessage(),
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Génération des Journaux Centralisateur
     */
    public function journauxCentralisateurPdf(Request $request)
    {
        try {
            $filters = $request->validate([
                'start_date' => 'required|date',
                'end_date' => 'required|date',
                'journal_id' => 'nullable|integer',
            ]);

            $this->validateWritingPeriod($filters);

            // Utiliser le service pour générer les données
            $centralisateurData = $this->pdfService->generateCentralisateurData($filters);

            // Générer le PDF
            $pdfBase64 = $this->pdfService->generateCentralisateurPdf($centralisateurData, $filters);

            return response()->json([
                'pdf' => $pdfBase64,
                'filename' => 'JournauxCentralisateur_' . $filters['start_date'] . '_' . $filters['end_date'] . '.pdf'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' =>$e->getMessage(),
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Génération du Bilan
     */
    public function bilanPdf(Request $request)
    {
        $filters = $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date',
        ]);
        try {
            $this->validateWritingPeriod($filters);

            // Utilisation
            $service = new AccountBilanService();
            $bilanData = $service->generateBilan([
                'aml_date_start' => $filters["start_date"],
                'aml_date_end' => $filters["end_date"],
            ]);

            // Générer le PDF
            $pdfBase64 = $this->pdfService->generateBilanPdf($bilanData, $filters);

            return response()->json([
                'pdf' => $pdfBase64,
                'filename' => 'Bilan_' . $filters['end_date'] . '.pdf'
            ]);
        } catch (\Exception $e) {
            return response()->json([
               'message' =>$e->getMessage(),
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Vérifie qu'une période est bien dans la période comptable.
     *
     * @param array $filters ['start_date' => 'Y-m-d', 'end_date' => 'Y-m-d']
     * @throws \Exception si la période est invalide
     */
    function validateWritingPeriod(array $filters): void
    {
        $writingPeriod = AccountModel::getWritingPeriod();

        $startDate = $filters['start_date'] ?? null;
        $endDate   = $filters['end_date'] ?? null;

        if ($startDate && $startDate < $writingPeriod['startDate']->format('Y-m-d')) {
            throw new \Exception(
                "La date de début ({$startDate}) est antérieure au début de la période de saisie (" .
                    $writingPeriod['startDate']->format('d/m/Y') . ")"
            );
        }

        if ($endDate && $endDate > $writingPeriod['endDate']->format('Y-m-d')) {
            throw new \Exception(
                "La date de fin ({$endDate}) est postérieure à la fin de l'exercice (" .
                    $writingPeriod['endDate']->format('d/m/Y') . ")"
            );
        }
    }
}
