<?php

namespace App\Http\Controllers\Api;

use App\Models\AccountConfigModel;
use App\Models\AccountExerciseModel;
use App\Models\AccountMoveLineModel;
use App\Services\AccountingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;


class ApiAccountConfigController extends Controller
{
    /**
     * Afficher la configuration comptable (il n'y en a qu'une seule, ID=1)
     */
    public function show($id = 1)
    {
        $config = AccountConfigModel::with([
            'author:usr_id,usr_firstname,usr_lastname',
            'updater:usr_id,usr_firstname,usr_lastname',
            'saleAccount:acc_id,acc_code,acc_label',
            'saleIntraAccount:acc_id,acc_code,acc_label',
            'saleDepositAccount:acc_id,acc_code,acc_label',
            'saleVatWaitingAccount:acc_id,acc_code,acc_label',
            'saleExportAccount:acc_id,acc_code,acc_label',
            'purchaseAccount:acc_id,acc_code,acc_label',
            'purchaseIntraAccount:acc_id,acc_code,acc_label',
            'purchaseDepositAccount:acc_id,acc_code,acc_label',
            'purchaseVatWaitingAccount:acc_id,acc_code,acc_label',
            'purchaseImportAccount:acc_id,acc_code,acc_label',
            'customerAccount:acc_id,acc_code,acc_label',
            'supplierAccount:acc_id,acc_code,acc_label',
            'employeeAccount:acc_id,acc_code,acc_label',
            'bankAccount:acc_id,acc_code,acc_label',
            'profitAccount:acc_id,acc_code,acc_label',
            'lossAccount:acc_id,acc_code,acc_label',
            'carryForwardAccount:acc_id,acc_code,acc_label',
            'mileageExpenseAccount:acc_id,acc_code,acc_label',
            'purchaseJournal:ajl_id,ajl_code,ajl_label',
            'saleJournal:ajl_id,ajl_code,ajl_label',
            'bankJournal:ajl_id,ajl_code,ajl_label',
            'openingJournal:ajl_id,ajl_code,ajl_label',
            'miscJournal:ajl_id,ajl_code,ajl_label',
            'productSaleTax:tax_id,tax_label,tax_rate',
            'vatPayableAccount:acc_id,acc_code,acc_label',
            'vatCreditAccount:acc_id,acc_code,acc_label',
            'vatRegularisationAccount:acc_id,acc_code,acc_label',
            'vatRefundAccount:acc_id,acc_code,acc_label',
            'vatAdvanceAccount:acc_id,acc_code,acc_label',
            'vatAlertTemplate:emt_id,emt_label',
        ])->findOrFail($id);

        // Vérifier si des lignes comptables existent (frozen state)
        $hasMoves = AccountMoveLineModel::exists();

        $accountingService = new AccountingService();
        $currentExercise = $accountingService->getCurrentExercise();
        $nextExercise = $accountingService->getNextExercise();
        $curExer = [];
        $nextExer = [];
        if ($currentExercise) {
            $curExer = [
                'startDate' => $currentExercise["start_date"] ?? '',
                'endDate' => $currentExercise["end_date"] ?? '',
            ];
        }

        if ($nextExercise) {
            $nextExer = [
                'startDate' => $nextExercise["start_date"] ?? '',
                'endDate' => $nextExercise["end_date"] ?? '',
            ];
        }
        $config['frozen'] = $hasMoves;
        $config['curExercise'] = $curExer;
        $config['nextExercise'] = $nextExer;
        return response()->json([
            'status' => true,
            'data' => $config,
            //'frozen' => $hasMoves,
            //'curExercise' => $curExer,
            // 'nextExercise' => $nextExer,
        ], 200);
    }

    /**
     * Mettre à jour la configuration comptable
     */
    public function update(Request $request, $id = 1)
    {

        try {
            // Vérifier si des lignes comptables existent
            $hasMoves = AccountMoveLineModel::exists();

            $validatedData = $request->validate([
                // Exercices
                'aco_first_exercise_start_date' => $hasMoves ? 'prohibited' : 'nullable|date',
                'aco_first_exercise_end_date'   => $hasMoves ? 'prohibited' : 'nullable|date|after:aco_first_exercise_start_date',

                'aco_cur_exercise_start_date'   => $hasMoves ? 'prohibited' : 'nullable|date',
                'aco_cur_exercise_end_date'     => $hasMoves ? 'prohibited' : 'nullable|date|after:aco_cur_exercise_start_date',

                // Longueur des comptes (immutable si mouvements existent)
                'aco_account_length' => $hasMoves ? 'nullable|integer|min:6|max:8' : 'nullable|integer|min:6|max:8',

                // Comptes vente
                'fk_acc_id_sale' => 'nullable|exists:account_account_acc,acc_id',
                'fk_acc_id_sale_intra' => 'nullable|exists:account_account_acc,acc_id',
                'fk_acc_id_sale_export' => 'nullable|exists:account_account_acc,acc_id',
                'fk_acc_id_sale_advance' => 'nullable|exists:account_account_acc,acc_id',
                'fk_acc_id_sale_vat_waiting' => [
                    $request->input('aco_vat_regime') === 'encaissements' ? 'required' : 'nullable',
                    'exists:account_account_acc,acc_id',
                ],

                // Comptes achat
                'fk_acc_id_purchase' => 'nullable|exists:account_account_acc,acc_id',
                'fk_acc_id_purchase_intra' => 'nullable|exists:account_account_acc,acc_id',
                'fk_acc_id_purchase_import' => 'nullable|exists:account_account_acc,acc_id',
                'fk_acc_id_purchase_advance' => 'nullable|exists:account_account_acc,acc_id',
                'fk_acc_id_purchase_vat_waiting' => [
                    $request->input('aco_vat_regime') === 'encaissements' ? 'required' : 'nullable',
                    'exists:account_account_acc,acc_id',
                ],
                 'fk_acc_id_mileage_expense' => 'exists:account_account_acc,acc_id',
                

                // Comptes tiers
                'fk_acc_id_customer' => 'nullable|exists:account_account_acc,acc_id',
                'fk_acc_id_supplier' => 'nullable|exists:account_account_acc,acc_id',
                'fk_acc_id_employee' => 'nullable|exists:account_account_acc,acc_id',

                // Autres comptes
                'fk_acc_id_bank' => 'nullable|exists:account_account_acc,acc_id',
                'fk_acc_id_profit' => 'nullable|exists:account_account_acc,acc_id',
                'fk_acc_id_loss' => 'nullable|exists:account_account_acc,acc_id',
                'fk_acc_id_carry_forward' => 'nullable|exists:account_account_acc,acc_id',

                // TVA
                'fk_tax_id_product_sale' => 'nullable|exists:account_tax_tax,tax_id',

                // Journaux
                'fk_ajl_id_purchase' => 'nullable|exists:account_journal_ajl,ajl_id',
                'fk_ajl_id_sale' => 'nullable|exists:account_journal_ajl,ajl_id',
                'fk_ajl_id_bank' => 'nullable|exists:account_journal_ajl,ajl_id',
                'fk_ajl_id_an' => 'nullable|exists:account_journal_ajl,ajl_id',
                'fk_ajl_id_od' => 'nullable|exists:account_journal_ajl,ajl_id',

                // Configuration TVA CA3
                'aco_vat_system'                   => 'required|in:reel,simplifie',
                'aco_vat_regime'                   => 'required|in:debits,encaissements',
                'aco_vat_periodicity'              => 'required|in:monthly,quarterly,mini_reel',
                'fk_acc_id_vat_payable'            => 'required|exists:account_account_acc,acc_id',
                'fk_acc_id_vat_credit'             => 'required|exists:account_account_acc,acc_id',
                'fk_acc_id_vat_regularisation'     => 'nullable|exists:account_account_acc,acc_id',
                'fk_acc_id_vat_refund'             => 'required|exists:account_account_acc,acc_id',
                'fk_acc_id_vat_advance'            => 'nullable|exists:account_account_acc,acc_id',
                'aco_vat_alert_enabled'            => 'required|boolean',
                'aco_vat_alert_days'               => 'required|integer|min:1|max:60',
                'fk_emt_id_vat_alert'              => 'nullable|exists:message_template_emt,emt_id',
                'aco_vat_alert_emails'             => 'nullable|array',
                'aco_vat_alert_emails.*'           => 'email',
            ], [
                // Exercices
                'aco_first_exercise_start_date.prohibited' => 'La date de début du premier exercice ne peut pas être modifiée (des écritures existent).',
                'aco_first_exercise_start_date.date'       => 'La date de début du premier exercice est invalide.',
                'aco_first_exercise_end_date.prohibited'   => 'La date de fin du premier exercice ne peut pas être modifiée (des écritures existent).',
                'aco_first_exercise_end_date.date'         => 'La date de fin du premier exercice est invalide.',
                'aco_first_exercise_end_date.after'        => 'La date de fin du premier exercice doit être postérieure à la date de début.',
                'aco_cur_exercise_start_date.prohibited'   => 'La date de début de l\'exercice courant ne peut pas être modifiée (des écritures existent).',
                'aco_cur_exercise_start_date.date'         => 'La date de début de l\'exercice courant est invalide.',
                'aco_cur_exercise_end_date.prohibited'     => 'La date de fin de l\'exercice courant ne peut pas être modifiée (des écritures existent).',
                'aco_cur_exercise_end_date.date'           => 'La date de fin de l\'exercice courant est invalide.',
                'aco_cur_exercise_end_date.after'          => 'La date de fin de l\'exercice courant doit être postérieure à la date de début.',

                // Longueur des comptes
                'aco_account_length.integer' => 'La longueur des comptes doit être un entier.',
                'aco_account_length.min'     => 'La longueur des comptes doit être d\'au moins 6 caractères.',
                'aco_account_length.max'     => 'La longueur des comptes ne peut pas dépasser 8 caractères.',

                // Comptes vente
                'fk_acc_id_sale.exists'            => 'Le compte de vente sélectionné est introuvable.',
                'fk_acc_id_sale_intra.exists'       => 'Le compte de vente intracommunautaire est introuvable.',
                'fk_acc_id_sale_export.exists'      => 'Le compte de vente export est introuvable.',
                'fk_acc_id_sale_advance.exists'     => 'Le compte d\'acompte vente est introuvable.',
                'fk_acc_id_sale_vat_waiting.required' => 'Le compte TVA en attente vente est obligatoire en régime encaissements.',
                'fk_acc_id_sale_vat_waiting.exists'   => 'Le compte TVA en attente vente est introuvable.',

                // Comptes achat
                'fk_acc_id_purchase.exists'               => 'Le compte d\'achat sélectionné est introuvable.',
                'fk_acc_id_purchase_intra.exists'          => 'Le compte d\'achat intracommunautaire est introuvable.',
                'fk_acc_id_purchase_import.exists'         => 'Le compte d\'achat import est introuvable.',
                'fk_acc_id_purchase_advance.exists'        => 'Le compte d\'acompte achat est introuvable.',
                'fk_acc_id_purchase_vat_waiting.required'  => 'Le compte TVA en attente achat est obligatoire en régime encaissements.',
                'fk_acc_id_purchase_vat_waiting.exists'    => 'Le compte TVA en attente achat est introuvable.',
                'fk_acc_id_mileage_expense.exists'         => 'Le compte de frais kilométriques est introuvable.',

                // Comptes tiers
                'fk_acc_id_customer.exists' => 'Le compte client sélectionné est introuvable.',
                'fk_acc_id_supplier.exists' => 'Le compte fournisseur sélectionné est introuvable.',
                'fk_acc_id_employee.exists' => 'Le compte salarié sélectionné est introuvable.',

                // Autres comptes
                'fk_acc_id_bank.exists'          => 'Le compte banque sélectionné est introuvable.',
                'fk_acc_id_profit.exists'        => 'Le compte bénéfice sélectionné est introuvable.',
                'fk_acc_id_loss.exists'          => 'Le compte perte sélectionné est introuvable.',
                'fk_acc_id_carry_forward.exists' => 'Le compte report à nouveau est introuvable.',

                // TVA
                'fk_tax_id_product_sale.exists' => 'La taxe de vente produit sélectionnée est introuvable.',

                // Journaux
                'fk_ajl_id_purchase.exists' => 'Le journal d\'achats sélectionné est introuvable.',
                'fk_ajl_id_sale.exists'     => 'Le journal de ventes sélectionné est introuvable.',
                'fk_ajl_id_bank.exists'     => 'Le journal de banque sélectionné est introuvable.',
                'fk_ajl_id_an.exists'       => 'Le journal d\'à-nouveaux sélectionné est introuvable.',
                'fk_ajl_id_od.exists'       => 'Le journal des OD sélectionné est introuvable.',

                // Configuration TVA CA3
                'aco_vat_system.required'      => 'Le régime de TVA est obligatoire.',
                'aco_vat_system.in'            => 'Le régime de TVA doit être "réel" ou "simplifié".',
                'aco_vat_regime.required'      => 'Le régime d\'exigibilité TVA est obligatoire.',
                'aco_vat_regime.in'            => 'Le régime d\'exigibilité TVA doit être "débits" ou "encaissements".',
                'aco_vat_periodicity.required' => 'La périodicité TVA est obligatoire.',
                'aco_vat_periodicity.in'       => 'La périodicité TVA doit être mensuelle, trimestrielle ou mini-réel.',

                'fk_acc_id_vat_payable.required'        => 'Le compte TVA collectée est obligatoire.',
                'fk_acc_id_vat_payable.exists'          => 'Le compte TVA collectée est introuvable.',
                'fk_acc_id_vat_credit.required'         => 'Le compte crédit de TVA est obligatoire.',
                'fk_acc_id_vat_credit.exists'           => 'Le compte crédit de TVA est introuvable.',
                'fk_acc_id_vat_regularisation.required' => 'Le compte de régularisation TVA est obligatoire.',
                'fk_acc_id_vat_regularisation.exists'   => 'Le compte de régularisation TVA est introuvable.',
                'fk_acc_id_vat_refund.required'         => 'Le compte de remboursement TVA est obligatoire.',
                'fk_acc_id_vat_refund.exists'           => 'Le compte de remboursement TVA est introuvable.',
                'fk_acc_id_vat_advance.required'        => 'Le compte d\'acompte TVA est obligatoire.',
                'fk_acc_id_vat_advance.exists'          => 'Le compte d\'acompte TVA est introuvable.',

                'aco_vat_alert_enabled.required' => 'L\'activation de l\'alerte TVA est obligatoire.',
                'aco_vat_alert_enabled.boolean'  => 'L\'activation de l\'alerte TVA doit être vrai ou faux.',
                'aco_vat_alert_days.required'    => 'Le nombre de jours d\'alerte TVA est obligatoire.',
                'aco_vat_alert_days.integer'     => 'Le nombre de jours d\'alerte TVA doit être un entier.',
                'aco_vat_alert_days.min'         => 'Le nombre de jours d\'alerte TVA doit être d\'au moins 1.',
                'aco_vat_alert_days.max'         => 'Le nombre de jours d\'alerte TVA ne peut pas dépasser 60.',
                'fk_emt_id_vat_alert.required'   => 'Le modèle d\'alerte TVA est obligatoire.',
                'fk_emt_id_vat_alert.exists'     => 'Le modèle d\'alerte TVA sélectionné est introuvable.',
                'aco_vat_alert_emails.required'  => 'Au moins une adresse e-mail d\'alerte TVA est obligatoire.',
                'aco_vat_alert_emails.array'     => 'Les adresses e-mail d\'alerte TVA doivent être une liste.',
                'aco_vat_alert_emails.*.email'   => 'Une adresse e-mail d\'alerte TVA est invalide.',
            ]);


            DB::beginTransaction();

            $config = AccountConfigModel::findOrFail($id);

            // 2. Gestion des exercices : On n'entre ici QUE si $hasMoves est FAUX
            if (!$hasMoves && $request->filled('aco_cur_exercise_start_date') && $request->filled('aco_cur_exercise_end_date')) {             
                $firstStart = new \DateTime($request->aco_cur_exercise_start_date);
                $firstEnd = new \DateTime($request->aco_cur_exercise_end_date);

                // Validation: l'exercice ne dépasse pas 24 mois
                $interval = $firstStart->diff($firstEnd);
                $months = $interval->y * 12 + $interval->m;
                if ($months > 24) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Le premier exercice ne peut pas dépasser 24 mois'
                    ], 422);
                }

                $accountingService = new AccountingService();
                $currentExercise = $accountingService->getCurrentExercise();

                // Si aucun exercice n'existe, utiliser addNewExercise pour créer l'exercice courant et suivant
                if ($currentExercise === null) {
                    try {
                        $accountingService->addNewExercise(
                            $request->aco_first_exercise_start_date,
                            $request->aco_first_exercise_end_date
                        );

                        // Récupérer les exercices créés
                        $createdCurrentExercise = AccountExerciseModel::where('aex_is_current_exercise', 1)->first();
                        $createdNextExercise = AccountExerciseModel::where('aex_is_next_exercise', 1)->first();

                        if ($createdCurrentExercise) {
                            $validatedData['fk_aex_id_current'] = $createdCurrentExercise->aex_id;
                        }
                        if ($createdNextExercise) {
                            $validatedData['fk_aex_id_next'] = $createdNextExercise->aex_id;
                        }
                    } catch (\Exception $e) {
                        DB::rollBack();
                        return response()->json([
                            'success' => false,
                            'message' => 'Erreur lors de la création des exercices: ' . $e->getMessage()
                        ], 500);
                    }
                } else {
                    // Si un exercice existe déjà, mettre à jour manuellement (pour permettre la modification)
                    $existingCurrentExercise = AccountExerciseModel::where('aex_is_current_exercise', 1)->first();
                    $existingNextExercise = AccountExerciseModel::where('aex_is_next_exercise', 1)->first();

                    if ($existingCurrentExercise) {
                        $existingCurrentExercise->update([
                            'aex_start_date' => $firstStart,
                            'aex_end_date' => $firstEnd,
                            'fk_usr_id_updater' => $request->user()->usr_id,
                        ]);

                        $validatedData['fk_aex_id_current'] = $existingCurrentExercise->aex_id;

                        // Recalculer l'exercice suivant
                        $nextStart = (clone $firstEnd)->modify('+1 day');
                        $nextEnd = (clone $nextStart)->modify('+1 year')->modify('-1 day');

                        if ($existingNextExercise) {
                            $existingNextExercise->update([
                                'aex_start_date' => $nextStart,
                                'aex_end_date' => $nextEnd,
                                'fk_usr_id_updater' => $request->user()->usr_id,
                            ]);
                        } else {
                            $existingNextExercise = AccountExerciseModel::create([
                                'fk_usr_id_author' => $request->user()->usr_id,
                                'fk_usr_id_updater' => $request->user()->usr_id,
                                'aex_start_date' => $nextStart,
                                'aex_end_date' => $nextEnd,
                                'aex_is_next_exercise' => 1,
                            ]);
                        }

                        $validatedData['fk_aex_id_next'] = $existingNextExercise->aex_id;
                    }
                }
            }

            $validatedData['fk_usr_id_updater'] = $request->user()->usr_id;

            $config->update($validatedData);

            DB::commit();

            return response()->json([
                'message' => 'Configuration comptable mise à jour avec succès',
                'data' => $config->load([
                    'author',
                    'updater',
                    'saleAccount',
                    'saleIntraAccount',
                    'saleDepositAccount',
                    'saleVatWaitingAccount',
                    'saleExportAccount',
                    'purchaseAccount',
                    'purchaseIntraAccount',
                    'purchaseDepositAccount',
                    'purchaseVatWaitingAccount',
                    'purchaseImportAccount',
                    'customerAccount',
                    'supplierAccount',
                    'employeeAccount',
                    'bankAccount',
                    'profitAccount',
                    'lossAccount',
                    'carryForwardAccount',
                    'purchaseJournal',
                    'saleJournal',
                    'bankJournal',
                    'openingJournal',
                    'miscJournal',
                    'productSaleTax',
                    'vatPayableAccount',
                    'vatCreditAccount',
                    'vatRegularisationAccount',
                    'vatRefundAccount',
                    'vatAdvanceAccount',
                    'vatAlertTemplate',
                ]),
            ]);
        } catch (ValidationException $e) {
            $message = collect($e->errors())->flatten()->implode(' | ');
            return response()->json([
                'success' => false,
                'message' => $message,
                'errors'  => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la mise à jour: ' . $e->getMessage()
            ], 500);
        }
    }
}
