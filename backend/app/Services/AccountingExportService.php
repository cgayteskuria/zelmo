<?php

namespace App\Services;

use App\Models\AccountImportExportModel;
use App\Models\AccountMoveLineModel;
use App\Models\CompanyModel;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Exception;

/**
 * Service d'export des données comptables au format FEC
 * Reproduit la logique de AccountExportManager.php::exportFEC()
 */
class AccountingExportService
{
    protected DocumentService $documentService;

    public function __construct(DocumentService $documentService)
    {
        $this->documentService = $documentService;
    }

    // En-têtes FEC conformes norme DGFiP
    private const FEC_HEADERS = [
        'JournalCode',
        'JournalLib',
        'EcritureNum',
        'EcritureDate',
        'CompteNum',
        'CompteLib',
        'CompAuxNum',
        'CompAuxLib',
        'PieceRef',
        'PieceDate',
        'EcritureLib',
        'Debit',
        'Credit',
        'EcritureLet',
        'DateLet',
        'ValidDate',
        'Montantdevise',
        'Idevise'
    ];

    /**
     * Exporte les écritures comptables au format FEC
     *
     * @param array $filters Filtres d'export (start_date, end_date, acc_code_start, acc_code_end, ajl_id)
     * @param int $userId ID utilisateur auteur
     * @return array Résultat avec aie_id, filename, size
     */
    public function exportFec(array $filters, int $userId, bool $returnBase64 = false): array
    {
        try {
            // Récupération SIREN société
            $company = CompanyModel::first();
            if (!$company) {
                throw new Exception("Aucune société configurée");
            }

            $siren = str_replace(' ', '', $company->cop_registration_code ?? '');
            if (empty($siren)) {
                throw new Exception("SIREN non configuré pour la société");
            }

            // Génération nom fichier FEC
            $filename = $this->generateFilename($siren, $filters['start_date'], $filters['end_date']);

            // Construction requête avec filtres
            $query = $this->buildExportQuery($filters);

            // Génération contenu fichier FEC en mémoire
            $fileContent = $this->generateFecContent($query);

            if ($returnBase64) {
                return [
                    'filename' => $filename,
                    'base64' => base64_encode($fileContent)];
            } else {


                // Création enregistrement historique
                $aie = AccountImportExportModel::create([
                    'aie_sens' => -1, // Export
                    'aie_type' => 'FEC',
                    'aie_transfer_start' => $filters['start_date'],
                    'aie_transfer_end' => $filters['end_date'],
                    'aie_moves_number' => $this->countMoves($query),
                    'fk_usr_id_author' => $userId
                ]);

                // Stockage du fichier via DocumentService
                $document = $this->documentService->storeFileFromContent(
                    $fileContent,
                    $filename,
                    'text/plain',
                    'accounting-exports',
                    $aie->aie_id,
                    $userId,
                    false // Pas de nom sécurisé pour garder le nom réglementaire
                );
                return [
                    'aie_id' => $aie->aie_id,
                    'filename' => $filename,
                    'size' => $document->doc_filesize
                ];
            }
        } catch (Exception $e) {
            throw new Exception("Erreur lors de l'export FEC : " . $e->getMessage());
        }
    }

    /**
     * Génère le nom de fichier FEC selon nomenclature réglementaire
     * Format : {SIREN}FEC{YYYYMMDD}{YYYYMMDD}.txt
     */
    private function generateFilename(string $siren, string $start_date, string $end_date): string
    {
        $startFormatted = str_replace('-', '', $start_date); // YYYYMMDD
        $endFormatted = str_replace('-', '', $end_date);     // YYYYMMDD

        return "{$siren}FEC{$startFormatted}{$endFormatted}.txt";
    }

    /**
     * Construction de la requête SQL avec filtres
     */
    private function buildExportQuery(array $filters)
    {
        $query = AccountMoveLineModel::query()
            ->select([
                'ajl.ajl_code as JournalCode',
                'ajl.ajl_label as JournalLib',
                'amo.amo_id as EcritureNum',
                DB::raw('DATE_FORMAT(amo.amo_created, "%Y%m%d") as EcritureDate'),
                'acc.acc_code as CompteNum',
                'acc.acc_label as CompteLib',
                DB::raw('"" as CompAuxNum'),
                DB::raw('"" as CompAuxLib'),
                DB::raw('IFNULL(amo.amo_ref, "") as PieceRef'),
                DB::raw('DATE_FORMAT(amo.amo_date, "%Y%m%d") as PieceDate'),
                DB::raw('IFNULL(aml.aml_label_entry, amo.amo_label) as EcritureLib'),
                DB::raw('IFNULL(aml.aml_debit, 0.00) as Debit'),
                DB::raw('IFNULL(aml.aml_credit, 0.00) as Credit'),
                DB::raw('IFNULL(aml.aml_lettering_code, "") as EcritureLet'),
                DB::raw('IFNULL(DATE_FORMAT(aml.aml_lettering_date, "%Y%m%d"), "") as DateLet'),
                DB::raw('CASE WHEN amo.amo_valid = "0000-00-00" OR amo.amo_valid IS NULL THEN "" ELSE DATE_FORMAT(amo.amo_valid, "%Y%m%d") END as ValidDate'),
                DB::raw('"" as Montantdevise'),
                DB::raw('"" as Idevise')
            ])
            ->from('account_move_line_aml as aml')
            ->join('account_move_amo as amo', 'aml.fk_amo_id', '=', 'amo.amo_id')
            ->join('account_journal_ajl as ajl', 'amo.fk_ajl_id', '=', 'ajl.ajl_id')
            ->join('account_account_acc as acc', 'aml.fk_acc_id', '=', 'acc.acc_id')
            ->whereBetween('amo.amo_date', [$filters['start_date'], $filters['end_date']]);

        // Filtres optionnels
        if (!empty($filters['acc_code_start'])) {
            $query->where('acc.acc_code', '>=', $filters['acc_code_start']);
        }

        if (!empty($filters['acc_code_end'])) {
            $query->where('acc.acc_code', '<=', $filters['acc_code_end']);
        }

        if (!empty($filters['ajl_id'])) {
            $query->where('amo.fk_ajl_id', '=', $filters['ajl_id']);
        }

        // Tri chronologique puis par ID
        $query->orderBy('amo.amo_date')
            ->orderBy('amo.amo_id')
            ->orderBy('aml.aml_id');

        return $query;
    }

    /**
     * Génère le contenu du fichier FEC en mémoire
     */
    private function generateFecContent($query): string
    {
        $content = '';

        // Écriture en-tête
        $content .= implode("\t", self::FEC_HEADERS) . "\n";

        // Écriture des lignes
        foreach ($query->cursor() as $line) {
            $formattedLine = $this->formatFecLine($line);
            $content .= implode("\t", $formattedLine) . "\n";
        }

        return $content;
    }

    /**
     * Formate une ligne pour le fichier FEC
     */
    private function formatFecLine($line): array
    {
        return [
            $line->JournalCode,
            $this->cleanValue($line->JournalLib),
            $line->EcritureNum,
            $line->EcritureDate,
            $line->CompteNum,
            $this->cleanValue($line->CompteLib),
            $line->CompAuxNum,
            $line->CompAuxLib,
            $this->cleanValue($line->PieceRef),
            $line->PieceDate,
            $this->cleanValue($line->EcritureLib),
            number_format((float)$line->Debit, 2, ',', ''),      // Virgule séparateur décimal
            number_format((float)$line->Credit, 2, ',', ''),     // Virgule séparateur décimal
            $line->EcritureLet,
            $line->DateLet,
            $line->ValidDate,
            $line->Montantdevise,
            $line->Idevise
        ];
    }

    /**
     * Nettoie une valeur pour export FEC
     * Supprime tabulations et entités HTML
     */
    private function cleanValue(?string $value): string
    {
        if (empty($value)) {
            return '';
        }

        // Décode entités HTML
        $value = html_entity_decode($value, ENT_QUOTES, 'UTF-8');

        // Remplace tabulations par espaces
        $value = str_replace("\t", " ", $value);

        return $value;
    }

    /**
     * Compte le nombre de mouvements distincts
     */
    private function countMoves($query): int
    {
        return (clone $query)
            ->select('amo.amo_id')
            ->distinct()
            ->count('amo.amo_id');
    }
}
