<?php

namespace App\Services;


use App\Models\AccountModel;
use App\Models\AccountJournalModel;
use App\Models\AccountMoveLineModel;
use App\Models\AccountMoveModel;
use App\Models\AccountConfigModel;
use App\Models\CompanyModel;
use App\Services\Pdf\AccountBalancePDFEntity;

use App\Services\Pdf\AccountBalanceSheetPDFEntity;
use App\Services\Pdf\AccountCentralizingPDFEntity;
use App\Services\Pdf\AccountJournalsPDFEntity;
use App\Services\Pdf\AccountLedgerPDFEntity;

use Illuminate\Support\Facades\DB;

/**
 * Service de génération de PDF pour les éditions comptables
 * Gère la préparation des données et la génération des PDF
 */
class AccountingEditionPdfService
{
    /**
     * Récupère les données de l'entreprise
     *
     * @return CompanyModel
     */
    private function getCompany(): CompanyModel
    {
        return CompanyModel::first();
    }

    /**
     * Prépare les données communes à toutes les éditions
     *
     * @param array $filters
     * @return array
     */
    private function prepareCommonData(array $filters): array
    {
        $company = $this->getCompany();
        $writingPeriod = AccountModel::getWritingPeriod();


        $data = [
            'company' => [
                'name' => $company->cop_label ?? '',
                'address' => $company->cop_address ?? '',
                'zip' => $company->cop_zip ?? '',
                'city' => $company->cop_city ?? '',
            ],
            'filters' => [
                'start_date' => $filters['start_date'],
                'end_date' => $filters['end_date'],
                'account_from_id' => $filters['account_from_id'] ?? null,
                'account_to_id' => $filters['account_to_id'] ?? null,
                'journal_id' => $filters['journal_id'] ?? null,
            ],
            'writing_period' => [
                'start_date' => $writingPeriod['startDate'] ?? null,
                'end_date' => $writingPeriod['endDate'] ?? null,
            ],
        ];

        // Ajouter les informations du journal si filtré
        if (!empty($filters['journal_id'])) {
            $journal = AccountJournalModel::find($filters['journal_id']);
            $data['filters']['journal_name'] = $journal ? $journal->acj_label : '';
            $data['filters']['journal_code'] = $journal ? $journal->acj_code : '';
        }

        // Ajouter les informations des comptes si filtrés
        if (!empty($filters['account_from_id'])) {
            $accountFrom = AccountModel::find($filters['account_from_id']);
            $data['filters']['account_from_code'] = $accountFrom ? $accountFrom->acc_code : '';
            $data['filters']['account_from_label'] = $accountFrom ? $accountFrom->acc_label : '';
        }

        if (!empty($filters['account_to_id'])) {
            $accountTo = AccountModel::find($filters['account_to_id']);
            $data['filters']['account_to_code'] = $accountTo ? $accountTo->acc_code : '';
            $data['filters']['account_to_label'] = $accountTo ? $accountTo->acc_label : '';
        }

        return $data;
    }

    /**
     * Génère le PDF de la Balance
     *
     * @param array $balanceData Données de la balance
     * @param array $filters Filtres appliqués
     * @return string PDF en base64
     */
    public function generateBalancePdf(array $balanceData, array $filters): string
    {
        $data = $this->prepareCommonData($filters);
        $data['balance_data'] = $balanceData;

        $pdf = new AccountBalancePDFEntity($data);

        return base64_encode($pdf->Output('', 'S'));
    }

    /**
     * Génère le PDF du Grand Livre
     *
     * @param array $grandLivreData Données du grand livre
     * @param array $filters Filtres appliqués
     * @return string PDF en base64
     */
    public function generateGrandLivrePdf(array $grandLivreData, array $filters): string
    {
        $data = $this->prepareCommonData($filters);
        $data['grand_livre_data'] = $grandLivreData;

        $pdf = new AccountLedgerPDFEntity($data);

        return base64_encode($pdf->Output('', 'S'));
    }

    /**
     * Génère le PDF des Journaux
     *
     * @param array $journauxData Données des journaux
     * @param array $filters Filtres appliqués
     * @return string PDF en base64
     */
    public function generateJournauxPdf(array $journauxData, array $filters): string
    {
        try {
            $data = $this->prepareCommonData($filters);
            $data['journaux_data'] = $journauxData;

            $pdf = new AccountJournalsPDFEntity($data);

            return base64_encode($pdf->Output('', 'S'));
        } catch (\Exception $e) {
            throw new \Exception("generateJournauxPdf : " . $e->getMessage());
        }
    }

    /**
     * Génère le PDF du Centralisateur
     *
     * @param array $centralisateurData Données du centralisateur
     * @param array $filters Filtres appliqués
     * @return string PDF en base64
     */
    public function generateCentralisateurPdf(array $centralisateurData, array $filters): string
    {
        $data = $this->prepareCommonData($filters);
        $data['centralisateur_data'] = $centralisateurData;

        $pdf = new AccountCentralizingPDFEntity($data);

        return base64_encode($pdf->Output('', 'S'));
    }

    /**
     * Génère le PDF du Bilan
     *
     * @param array $bilanData Données du bilan
     * @param array $filters Filtres appliqués
     * @return string PDF en base64
     */
    public function generateBilanPdf(array $bilanData, array $filters): string
    {
        $data = $this->prepareCommonData($filters);
        $data['bilan_data'] = $bilanData;

        $pdf = new AccountBalanceSheetPDFEntity($data);

        return base64_encode($pdf->Output('', 'S'));
    }

    /**
     * Génère les données de la Balance
     *
     * @param array $filters
     * @return array
     */
    public function generateBalanceData(array $filters): array
    {
        $query = DB::table('account_account_acc as acc')
            ->whereBetween('aml.aml_date', [$filters['start_date'], $filters['end_date']])
            ->leftJoin('account_move_line_aml as aml', 'acc.acc_id', 'aml.fk_acc_id')
            ->leftJoin('account_move_amo as amo', 'aml.fk_amo_id', 'amo.amo_id')
            ->select(
                'acc.acc_code as numero_compte',
                'acc.acc_label as intitule_compte',
                DB::raw('COALESCE(SUM(aml.aml_debit), 0) as cumul_debit'),
                DB::raw('COALESCE(SUM(aml.aml_credit), 0) as cumul_credit'),
                DB::raw('CASE
                    WHEN COALESCE(SUM(aml.aml_debit), 0) > COALESCE(SUM(aml.aml_credit), 0)
                    THEN COALESCE(SUM(aml.aml_debit), 0) - COALESCE(SUM(aml.aml_credit), 0)
                    ELSE 0
                END as solde_debit'),
                DB::raw('CASE
                    WHEN COALESCE(SUM(aml.aml_credit), 0) > COALESCE(SUM(aml.aml_debit), 0)
                    THEN COALESCE(SUM(aml.aml_credit), 0) - COALESCE(SUM(aml.aml_debit), 0)
                    ELSE 0
                END as solde_credit')
            );

        // Filtre journal
        if (!empty($filters['journal_id'])) {
            $query->where('aml.fk_ajl_id', $filters['journal_id']);
        }

        // Filtres plage de comptes
        if (!empty($filters['account_from_id'])) {
            $account = AccountModel::find($filters['account_from_id']);
            $query->where('acc.acc_code', '>=', $account->acc_code);
        }
        if (!empty($filters['account_to_id'])) {
            $account = AccountModel::find($filters['account_to_id']);
            $query->where('acc.acc_code', '<=', $account->acc_code);
        }

        $results = $query->groupBy('acc.acc_id', 'acc.acc_code', 'acc.acc_label')
            ->havingRaw('(COALESCE(SUM(aml.aml_debit), 0) + COALESCE(SUM(aml.aml_credit), 0)) > 0')
            ->orderBy('acc.acc_code')
            ->get();

        $balanceData = [];
        $classSubtotals = [];
        $grandTotal = ['debit' => 0, 'credit' => 0, 'solde_debit' => 0, 'solde_credit' => 0];

        foreach ($results as $row) {
            $classCode = substr($row->numero_compte, 0, 1);

            if (!isset($balanceData[$classCode])) {
                $balanceData[$classCode] = [];
                $classSubtotals[$classCode] = ['debit' => 0, 'credit' => 0, 'solde_debit' => 0, 'solde_credit' => 0];
            }

            $balanceData[$classCode][] = (array) $row;

            $classSubtotals[$classCode]['debit'] += $row->cumul_debit;
            $classSubtotals[$classCode]['credit'] += $row->cumul_credit;
            $classSubtotals[$classCode]['solde_debit'] += $row->solde_debit;
            $classSubtotals[$classCode]['solde_credit'] += $row->solde_credit;

            $grandTotal['debit'] += $row->cumul_debit;
            $grandTotal['credit'] += $row->cumul_credit;
            $grandTotal['solde_debit'] += $row->solde_debit;
            $grandTotal['solde_credit'] += $row->solde_credit;
        }

        return [
            'balanceData' => $balanceData,
            'classSubtotals' => $classSubtotals,
            'grandTotal' => $grandTotal
        ];
    }

    /**
     * Génère les données du Grand Livre
     *
     * @param array $filters
     * @return array
     */
    public function generateGrandLivreData(array $filters): array
    {
        $query = DB::table('account_move_line_aml as aml')
            ->whereBetween('aml.aml_date', [$filters['start_date'], $filters['end_date']])
            ->join('account_account_acc as acc', 'aml.fk_acc_id', 'acc.acc_id')
            ->join('account_journal_ajl as ajl', 'aml.fk_ajl_id', 'ajl.ajl_id')
            ->join('account_move_amo as amo', 'aml.fk_amo_id', 'amo.amo_id')
            ->select(
                'aml.fk_amo_id as amo_id',
                'ajl.ajl_code',
                'aml.aml_date',
                'amo.amo_ref',
                'aml.aml_label_entry',
                DB::raw('COALESCE(aml.aml_debit, 0) as aml_debit'),
                DB::raw('COALESCE(aml.aml_credit, 0) as aml_credit'),
                'aml.aml_lettering_code',
                'acc.acc_code',
                'acc.acc_label as account_label'
            );

        // Filtre journal
        if (!empty($filters['journal_id'])) {
            $query->where('aml.fk_ajl_id', $filters['journal_id']);
        }

        // Filtres plage de comptes
        if (!empty($filters['account_from_id'])) {
            $account = AccountModel::find($filters['account_from_id']);
            $query->where('acc.acc_code', '>=', $account->acc_code);
        }
        if (!empty($filters['account_to_id'])) {
            $account = AccountModel::find($filters['account_to_id']);
            $query->where('acc.acc_code', '<=', $account->acc_code);
        }

        $results = $query->orderBy('acc.acc_code')
            ->orderBy('aml.aml_date')
            ->orderBy('aml.aml_id')
            ->get();

        $grandLivreData = [];
        $accountSubtotals = [];
        $classSubtotals = [];
        $grandTotal = ['debit' => 0, 'credit' => 0];

        foreach ($results as $row) {
            $accountCode = $row->acc_code;
            $accountClass = substr($accountCode, 0, 1);

            if (!isset($grandLivreData[$accountCode])) {
                $grandLivreData[$accountCode] = [
                    'account_code' => $accountCode,
                    'account_label' => $row->account_label,
                    'lines' => []
                ];
                $accountSubtotals[$accountCode] = ['debit' => 0, 'credit' => 0];
            }

            if (!isset($classSubtotals[$accountClass])) {
                $classSubtotals[$accountClass] = ['debit' => 0, 'credit' => 0];
            }

            $grandLivreData[$accountCode]['lines'][] = (array) $row;

            $accountSubtotals[$accountCode]['debit'] += $row->aml_debit;
            $accountSubtotals[$accountCode]['credit'] += $row->aml_credit;

            $classSubtotals[$accountClass]['debit'] += $row->aml_debit;
            $classSubtotals[$accountClass]['credit'] += $row->aml_credit;

            $grandTotal['debit'] += $row->aml_debit;
            $grandTotal['credit'] += $row->aml_credit;
        }

        return [
            'grandLivreData' => $grandLivreData,
            'accountSubtotals' => $accountSubtotals,
            'classSubtotals' => $classSubtotals,
            'grandTotal' => $grandTotal
        ];
    }

    /**
     * Génère les données des Journaux
     *
     * @param array $filters
     * @return array
     */
    public function generateJournauxData(array $filters): array
    {
        $query = DB::table('account_move_line_aml as aml')
            ->whereBetween('aml.aml_date', [$filters["start_date"], $filters["end_date"]])
            ->join('account_move_amo as amo', 'aml.fk_amo_id', 'amo.amo_id')
            ->join('account_journal_ajl as ajl', 'aml.fk_ajl_id', 'ajl.ajl_id')
            ->leftJoin('account_account_acc as acc', 'aml.fk_acc_id', 'acc.acc_id')
            ->select(
                'ajl.ajl_code',
                'ajl.ajl_label',
                'amo.amo_id',
                'amo.amo_date',
                'amo.amo_ref',
                'amo.amo_label',
                'aml.aml_date',
                'aml.aml_label_entry',
                'aml.aml_ref',
                'aml.aml_debit',
                'aml.aml_credit',
                'acc.acc_code',
                'acc.acc_label'
            );

        // Filtre journal
        if (!empty($filters['journal_id'])) {
            $query->where('aml.fk_ajl_id', $filters['journal_id']);
        }

        $results = $query->orderBy('ajl.ajl_code')
            ->orderBy('amo.amo_date')
            ->orderBy('amo.amo_id')
            ->get();

        // Organisation simple
        $data = [];
        foreach ($results as $row) {
            $jCode = $row->ajl_code;
            $month = date('Y-m', strtotime($row->amo_date));
            $moveId = $row->amo_id;

            // Init journal
            if (!isset($data[$jCode])) {
                $data[$jCode] = [
                    'name' => $row->ajl_label,
                    'months' => [],
                    'journal_total_debit' => 0,
                    'journal_total_credit' => 0
                ];
            }

            // Init mois
            if (!isset($data[$jCode]['months'][$month])) {
                $data[$jCode]['months'][$month] = [
                    'name' => date('F Y', strtotime($row->amo_date)),
                    'moves' => [],
                    'month_total_debit' => 0,
                    'month_total_credit' => 0
                ];
            }

            // Init mouvement
            if (!isset($data[$jCode]['months'][$month]['moves'][$moveId])) {
                $data[$jCode]['months'][$month]['moves'][$moveId] = [
                    'date' => $row->amo_date,
                    'ref' => $row->amo_ref,
                    'label' => $row->amo_label,
                    'lines' => [],
                    'move_total_debit' => 0,
                    'move_total_credit' => 0
                ];
            }

            // Ajouter ligne
            $debit = $row->aml_debit ?? 0;
            $credit = $row->aml_credit ?? 0;

            $data[$jCode]['months'][$month]['moves'][$moveId]['lines'][] = [
                'date' => $row->aml_date,
                'acc_code' => $row->acc_code,
                'acc_label' => $row->acc_label,
                'label' => $row->aml_label_entry,
                'ref' => $row->aml_ref,
                'debit' => $debit,
                'credit' => $credit
            ];

            // Totaux
            $data[$jCode]['months'][$month]['moves'][$moveId]['move_total_debit'] += $debit;
            $data[$jCode]['months'][$month]['moves'][$moveId]['move_total_credit'] += $credit;
            $data[$jCode]['months'][$month]['month_total_debit'] += $debit;
            $data[$jCode]['months'][$month]['month_total_credit'] += $credit;
            $data[$jCode]['journal_total_debit'] += $debit;
            $data[$jCode]['journal_total_credit'] += $credit;
        }

        // Tri mois
        foreach ($data as &$journal) {
            ksort($journal['months']);
        }

        $journauxData = [
            'journals' => $data,
        ];

        return $journauxData;
    }

    /**
     * Génère les données du Centralisateur
     *
     * @param array $filters
     * @return array
     */
    public function generateCentralisateurData(array $filters): array
    {
        $query = DB::table('account_move_line_aml as aml')
                ->join('account_move_amo as amo', 'aml.fk_amo_id', 'amo.amo_id')
                ->join('account_journal_ajl as ajl', 'aml.fk_ajl_id', 'ajl.ajl_id')
                ->whereBetween('aml.aml_date', [$filters["start_date"], $filters["end_date"]])
                ->select(
                    'ajl.ajl_code',
                    'ajl.ajl_label',
                    DB::raw('YEAR(amo.amo_date) as year'),
                    DB::raw('MONTH(amo.amo_date) as month'),
                    DB::raw('SUM(CASE WHEN aml_debit > 0 THEN aml_debit ELSE 0 END) as total_debit'),
                    DB::raw('SUM(CASE WHEN aml_credit > 0 THEN aml_credit ELSE 0 END) as total_credit')
                );

            // Filtre journal
            if (!empty($filters['journal_id'])) {
                $query->where('aml.fk_ajl_id', $filters['journal_id']);
            }

            $results = $query->groupBy('ajl.ajl_code', 'ajl.ajl_label', DB::raw('YEAR(amo.amo_date)'), DB::raw('MONTH(amo.amo_date)'))
                ->orderBy('ajl.ajl_code')
                ->orderBy('year')
                ->orderBy('month')
                ->get();

            // Organisation des données
            $data = [];
            foreach ($results as $row) {
                $code = $row->ajl_code;
                $monthKey = $row->year . '-' . str_pad($row->month, 2, '0', STR_PAD_LEFT);

                if (!isset($data[$code])) {
                    $data[$code] = [
                        'name' => strtoupper($row->ajl_label),
                        'months' => [],
                        'total_debit' => 0,
                        'total_credit' => 0
                    ];
                }

                $data[$code]['months'][$monthKey] = [
                    'debit' => $row->total_debit,
                    'credit' => $row->total_credit
                ];

                $data[$code]['total_debit'] += $row->total_debit;
                $data[$code]['total_credit'] += $row->total_credit;
            }


           return  [
                'journals' => $data,
            ];
    }
}
