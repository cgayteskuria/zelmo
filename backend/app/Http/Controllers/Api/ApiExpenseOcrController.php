<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use App\Services\VeryfiService;
use App\Models\ExpenseConfigModel;
use App\Models\ExpenseCategoryModel;
use App\Models\ExpenseModel;
use App\Models\AccountTaxModel;

class ApiExpenseOcrController extends Controller
{
    private VeryfiService $veryfiService;

    public function __construct(VeryfiService $veryfiService)
    {
        $this->veryfiService = $veryfiService;
    }

    /**
     * Vérifier si l'OCR est activé
     */
    public function isEnabled(): JsonResponse
    {
        $config = ExpenseConfigModel::find(1);

        return response()->json([
            'success' => true,
            'data' => [
                'ocr_enabled' => $config ? (bool) $config->eco_ocr_enable : false
            ]
        ]);
    }

    /**
     * Traiter un justificatif via OCR et retourner les données extraites
     * Ne crée PAS la dépense, retourne juste les données pour pré-remplir le formulaire
     */
    public function processReceipt(Request $request): JsonResponse
    {
        // Vérifier si OCR est activé
        $config = ExpenseConfigModel::find(1);
        if (!$config || !$config->eco_ocr_enable) {
            return response()->json([
                'success' => false,
                'message' => 'L\'OCR n\'est pas activé pour les notes de frais'
            ], 400);
        }

        $request->validate([
            'file' => 'required|file|mimes:pdf,jpg,jpeg,png|max:5120' // Max 5MB
        ]);

        try {
            $file = $request->file('file');

            // Stocker temporairement
            $tempPath = $file->store('tmp/ocr-expenses', 'private');
            $fullPath = Storage::disk('private')->path($tempPath);

            // Traiter via Veryfi
            $ocrResponse = $this->veryfiService->processDocument($fullPath);
            // Nettoyer le fichier temporaire
            Storage::disk('private')->delete($tempPath);

            // Extraire et normaliser les données pour le formulaire de dépense
            $extractedData = $this->normalizeForExpense($ocrResponse);

            return response()->json([
                'success' => true,
                'data' => $extractedData
            ]);
        } catch (\Exception $e) {
            // Nettoyer le fichier temporaire en cas d'erreur
            if (isset($tempPath)) {
                Storage::disk('private')->delete($tempPath);
            }

            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Normaliser la réponse Veryfi pour le formulaire de dépense
     */
    private function normalizeForExpense(array $ocrResponse): array
    {
        $data = [
            'exp_date' => null,
            'exp_merchant' => null,
            'fk_exc_id' => null,
            'category_name' => null,
            'lines' => [],
            'notes' => null,
        ];

        // Date
        if (!empty($ocrResponse['date'])) {
            $data['exp_date'] = $ocrResponse['date'];
        }

        // Commerçant / Vendeur
        if (!empty($ocrResponse['vendor']['name'])) {
            $data['exp_merchant'] = $ocrResponse['vendor']['name'];
        } elseif (!empty($ocrResponse['vendor']['raw_name'])) {
            $data['exp_merchant'] = $ocrResponse['vendor']['raw_name'];
        }

        // Catégorie - D'abord chercher une dépense existante avec le même commerçant
        if (!empty($data['exp_merchant'])) {
            $existingExpense = ExpenseModel::where('exp_merchant', 'like', '%' . $data['exp_merchant'] . '%')
                ->whereNotNull('fk_exc_id')
                ->orderBy('exp_date', 'desc')
                ->first();

            if ($existingExpense) {
                $data['fk_exc_id'] = $existingExpense->fk_exc_id;
            }
        }

        // Si pas de catégorie trouvée via le commerçant, essayer avec la catégorie OCR
        if (empty($data['fk_exc_id']) && !empty($ocrResponse['vendor']['category'])) {
            $categoryName = $ocrResponse['vendor']['category'];
            $data['category_name'] = $categoryName;

            // Chercher une catégorie correspondante
            $category = ExpenseCategoryModel::where('exc_is_active', true)
                ->where('exc_name', 'like', '%' . $categoryName . '%')
                ->first();

            if ($category) {
                $data['fk_exc_id'] = $category->exc_id;
            }
        }

        // Lignes de dépense
        $lines = [];

        // Si pas de lignes détaillées, créer une ligne avec les totaux
        if (empty($lines)) {
            // Si des lignes de TVA sont disponibles, créer une ligne par taux de TVA
            if (!empty($ocrResponse['tax_lines']) && is_array($ocrResponse['tax_lines'])) {
                // Compter le nombre de lignes de TVA
                $taxLinesCount = count($ocrResponse['tax_lines']);

                foreach ($ocrResponse['tax_lines'] as $taxLine) {
                    $line = [
                        'exl_amount_ht' => 0,
                        'exl_amount_tva' => 0,
                        'exl_amount_ttc' => 0,
                        'exl_tax_rate' => 0,
                        'fk_tax_id' => null,
                    ];

                    // Montant de la TVA
                    if (isset($taxLine['total'])) {
                        $line['exl_amount_tva'] = round((float) $taxLine['total'], 2);
                    }

                    // Taux de TVA
                    if (isset($taxLine['rate'])) {
                        $line['exl_tax_rate'] = (float) $taxLine['rate'];
                    }

                    // Si une seule ligne de TVA, utiliser le total TTC global et calculer HT à partir de TTC et taux
                    if ($taxLinesCount === 1 && isset($ocrResponse['total']) && $line['exl_tax_rate'] > 0) {
                        $line['exl_amount_ttc'] = round((float) $ocrResponse['total'], 2);
                        // Calcul HT = TTC / (1 + taux/100)
                        $line['exl_amount_ht'] = round($line['exl_amount_ttc'] / (1 + $line['exl_tax_rate'] / 100), 2);
                        // Recalculer la TVA pour cohérence
                        $line['exl_amount_tva'] = round($line['exl_amount_ttc'] - $line['exl_amount_ht'], 2);
                    } else {
                        // Plusieurs lignes de TVA : utiliser la logique existante
                        // Calculer la base HT si on a le montant de base
                        if (isset($taxLine['base']) && $taxLine['base'] !== null) {
                            $line['exl_amount_ht'] = round((float) $taxLine['base'], 2);
                        } elseif ($line['exl_amount_tva'] > 0 && $line['exl_tax_rate'] > 0) {
                            // Calculer HT à partir de la TVA et du taux
                            $line['exl_amount_ht'] = round(($line['exl_amount_tva'] * 100) / $line['exl_tax_rate'], 2);
                        }

                        // Calculer TTC
                        if ($line['exl_amount_ht'] > 0) {
                            $line['exl_amount_ttc'] = round($line['exl_amount_ht'] + $line['exl_amount_tva'], 2);
                        }
                    }

                    // Chercher une taxe correspondante
                    if ($line['exl_tax_rate'] > 0) {
                        $tax = AccountTaxModel::where('tax_rate', $line['exl_tax_rate'])
                            ->where('tax_use', 'purchase')
                            ->first();
                        if ($tax) {
                            $line['fk_tax_id'] = $tax->tax_id;
                        }
                    }

                    if ($line['exl_amount_ttc'] > 0 || $line['exl_amount_ht'] > 0) {
                        $lines[] = $line;
                    }
                }
            }

            // Si toujours pas de lignes après le parcours des tax_lines, créer une ligne unique avec les totaux
            if (empty($lines)) {
                $line = [
                    'exl_amount_ht' => 0,
                    'exl_amount_tva' => 0,
                    'exl_amount_ttc' => 0,
                    'exl_tax_rate' => 0,
                    'fk_tax_id' => null,
                ];

                // Total TTC
                if (isset($ocrResponse['total'])) {
                    $line['exl_amount_ttc'] = round((float) $ocrResponse['total'], 2);
                }

                // Total TVA
                if (isset($ocrResponse['tax'])) {
                    $line['exl_amount_tva'] = round((float) $ocrResponse['tax'], 2);
                }

                // Taux de TVA
                if (isset($ocrResponse['tax_rate'])) {
                    $line['exl_tax_rate'] = (float) $ocrResponse['tax_rate'];
                } elseif ($line['exl_amount_ht'] > 0 && $line['exl_amount_tva'] > 0) {
                    // Calculer le taux
                    $line['exl_tax_rate'] = round(($line['exl_amount_tva'] / $line['exl_amount_ht']) * 100, 2);
                }

                // Total HT - Privilégier le calcul à partir de TTC et taux si disponibles
                if ($line['exl_amount_ttc'] > 0 && $line['exl_tax_rate'] > 0) {
                    // Calcul HT = TTC / (1 + taux/100)
                    $line['exl_amount_ht'] = round($line['exl_amount_ttc'] / (1 + $line['exl_tax_rate'] / 100), 2);
                    // Recalculer la TVA pour cohérence
                    $line['exl_amount_tva'] = round($line['exl_amount_ttc'] - $line['exl_amount_ht'], 2);
                } elseif (isset($ocrResponse['subtotal'])) {
                    $line['exl_amount_ht'] = round((float) $ocrResponse['subtotal'], 2);
                } elseif ($line['exl_amount_ttc'] > 0) {
                    // Calculer HT à partir de TTC - TVA
                    $line['exl_amount_ht'] = round($line['exl_amount_ttc'] - $line['exl_amount_tva'], 2);
                }

                // Chercher une taxe correspondante
                if ($line['exl_tax_rate'] > 0) {
                    $tax = AccountTaxModel::where('tax_rate', $line['exl_tax_rate'])
                        ->where('tax_use', 'purchase')
                        ->first();
                    if ($tax) {
                        $line['fk_tax_id'] = $tax->tax_id;
                    }
                }

                if ($line['exl_amount_ttc'] > 0 || $line['exl_amount_ht'] > 0) {
                    $lines[] = $line;
                }
            }
        }

        $data['lines'] = $lines;

        // Notes additionnelles (numéro de document, etc.)
        $notes = [];
        if (!empty($ocrResponse['invoice_number'])) {
            $notes[] = 'N° document: ' . $ocrResponse['invoice_number'];
        }
        if (!empty($ocrResponse['reference_number'])) {
            $notes[] = 'Réf: ' . $ocrResponse['reference_number'];
        }
        if (!empty($notes)) {
            $data['notes'] = implode(' | ', $notes);
        }

        return $data;
    }
}
