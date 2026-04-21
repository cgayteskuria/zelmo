<?php

namespace App\Services;

use App\Models\AccountImportExportModel;
use App\Models\AccountModel;
use App\Models\AccountConfigModel;
use App\Models\AccountJournalModel;
use App\Models\AccountMoveModel;
use App\Models\AccountMoveLineModel;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Exception;

/**
 * Service d'import des données comptables FEC/CIEL
 * Reproduit la logique de AccountImportEntity.php en Laravel moderne
 */
class AccountingImportService
{
    protected DocumentService $documentService;
    protected AccountLetteringService $letteringService;

    // Formats supportés avec leur configuration
    private const FORMATS = [
        'FEC' => [
            'separators' => ['|', "\t"],
            'required_columns' => 18,
            'columns' => [
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
                'MontantDevise',
                'Idevise'
            ]
        ],
        'CIEL' => [
            'separators' => ["\t"],
            'required_columns' => 25,
            'columns' => [
                'EcritureNum',
                'JournalCode',
                'PieceDate',
                'CompteNum',
                'CompteLib',
                'Montant',
                'CreditDebit',
                'CodeStatut',
                'EcritureLib',
                'PieceRef',
                'Type',
                'CodeModePaiement',
                'DateEcheance',
                'CodeAnalytique',
                'LibAnalytique',
                'CodePointage',
                'DatePointage',
                'RefPointage',
                'CodeDevise',
                'TauxDevise',
                'MontantDevise',
                'Quantite',
                'LibMvmt',
                'EcritureLet',
                'DateLet'
            ]
        ]
    ];

    private array $errors = [];
    private array $warnings = [];
    private array $detectedSeparators = [];

    // Cache pour éviter requêtes répétées
    private array $journalCache = [];
    private array $accountCache = [];

    public function __construct(
        DocumentService $documentService,
        AccountLetteringService $letteringService
    ) {
        $this->documentService = $documentService;
        $this->letteringService = $letteringService;
    }

    /**
     * Prévisualise un fichier d'import FEC ou CIEL
     * Retourne directement les données pour affichage
     */
    public function previewFile(UploadedFile $file, string $format): array
    {
        $this->errors = [];
        $this->warnings = [];

        try {
            // Validation format
            if (!isset(self::FORMATS[$format])) {
                throw new Exception("Format non supporté : $format");
            }

            // Lecture du fichier
            $lines = $this->readFile($file->getRealPath());
            if (empty($lines)) {
                throw new Exception("Aucune donnée trouvée dans le fichier");
            }

            // Validation et parsing selon le format
            $parsedLines = $this->validateAndParseStructure($lines, $format);

            // Validation des dates par rapport à l'exercice
            $parsedLines = $this->validateMovesDateInExercise($parsedLines);

            // Validation de l'équilibrage
            $this->validateFileBalance($parsedLines);

            // Validation des codes de lettrage (avec vérification existence en base)
            $parsedLines = $this->letteringService->validateLetteringCodesForImport($parsedLines, $this->warnings);

            return [
                'success' => true,
                'data' => $parsedLines,
                'lines_count' => count($parsedLines),
                'errors' => $this->errors,
                'warnings' => $this->warnings
            ];
        } catch (Exception $e) {
            $this->errors[] = $e->getMessage();
            return [
                'success' => false,
                'data' => [],
                'errors' => $this->errors,
                'warnings' => $this->warnings
            ];
        }
    }

    /**
     * Import final depuis des données validées
     * Les données sont passées directement depuis le frontend
     */
    public function importFromData(array $lines, int $userId): array
    {
        if (empty($lines)) {
            throw new Exception("Aucune donnée à importer");
        }

        // Groupement par mouvement
        $groupedMoves = $this->groupLinesByMove($lines);

        $stats = [
            'moves_created' => 0,
            'lines_created' => 0
        ];

        // Import de chaque mouvement
        foreach ($groupedMoves as $moveLines) {
            $firstLine = $moveLines[0];

            // Récupération ou création du journal
            $journalId = $this->getOrCreateJournal(
                $firstLine['journalcode'],
                $firstLine['journallib'] ?? "Journal {$firstLine['journalcode']}"
            );

            // Préparation des données du mouvement
            $moveData = [
                'fk_ajl_id' => $journalId,
                'amo_date' => $firstLine['piecedate'],
                'amo_created' => $firstLine['ecrituredate'] ?: $firstLine['piecedate'],
                'amo_label' => substr($firstLine['ecriturelib'], 0, 100),
                'amo_ref' => substr($firstLine['pieceref'] ?? '', 0, 100),
                'amo_valid' => $firstLine['validdate'] ?: null,
                'fk_usr_id_author' => $userId
            ];

            // Préparation des données des lignes
            $linesData = [];
            foreach ($moveLines as $line) {
                $accountId = $this->getOrCreateAccount(
                    $line['comptenum'],
                    $line['comptelib'] ?? "Compte {$line['comptenum']}",
                    !empty($line['ecriturelet'])
                );

                $linesData[] = [
                    'fk_acc_id' => $accountId,
                    'aml_label_entry' => substr($line['ecriturelib'], 0, 100),
                    'aml_ref' => substr($line['pieceref'] ?? '', 0, 100),
                    'aml_debit' => $line['debit'] ?: null,
                    'aml_credit' => $line['credit'] ?: null,
                    'aml_lettering_code' => $line['ecriturelet'] ?: null,
                    'aml_lettering_date' => $line['datelet'] ?: null,
                    'aml_abr_code' => $line['codepointage'] ?? null,
                    'aml_abr_date' => $line['datepointage'] ?? null
                ];
            }

            // Utilisation de saveWithValidation pour créer le mouvement et les lignes
            AccountMoveModel::saveWithValidation($moveData, $linesData);

            $stats['moves_created']++;
            $stats['lines_created'] += count($linesData);
        }

        // Création enregistrement historique
        $aie = AccountImportExportModel::create([
            'aie_sens' => 1,
            'aie_type' => $lines[0]['_format'] ?? 'FEC',
            'aie_moves_number' => $stats['moves_created'],
            'aie_transfer_start' => $this->extractMinDate($lines),
            'aie_transfer_end' => $this->extractMaxDate($lines),
            'fk_usr_id_author' => $userId,
            'aie_moves'=> json_encode($lines)
        ]);

        return [
            'success' => true,
            'aie_id' => $aie->aie_id,
            'stats' => $stats
        ];
    }

    /**
     * Lecture du fichier avec gestion encodage
     */
    private function readFile(string $filePath): array
    {
        $lines = [];
        $handle = fopen($filePath, 'r');

        if (!$handle) {
            throw new Exception("Impossible d'ouvrir le fichier");
        }

        $lineNumber = 0;
        while (($line = fgets($handle)) !== false) {
            $lineNumber++;
            $line = trim($line);

            if (empty($line)) {
                continue;
            }

            // Conversion encodage si nécessaire
            if (!mb_check_encoding($line, 'UTF-8')) {
                $line = mb_convert_encoding($line, 'UTF-8', 'ISO-8859-1');
            }

            $lines[] = [
                'number' => $lineNumber,
                'content' => $line
            ];
        }

        fclose($handle);

        if (empty($lines)) {
            throw new Exception("Fichier vide");
        }

        return $lines;
    }

    /**
     * Validation et parsing selon le format
     */
    private function validateAndParseStructure(array $lines, string $format): array
    {
        $config = self::FORMATS[$format];
        $separator = $this->detectSeparator($lines, $format);
        $parsedLines = [];

        if ($format === 'FEC') {
            $parsedLines = $this->parseFecFormat($lines, $config, $separator);
        } elseif ($format === 'CIEL') {
            $parsedLines = $this->parseCielFormat($lines, $config, $separator);
        }

        return $parsedLines;
    }

    /**
     * Parsing format FEC
     */
    private function parseFecFormat(array $lines, array $config, string $separator): array
    {
        // Extraire en-tête
        $headerLine = array_shift($lines);
        $headerFields = array_map('trim', array_map('strtolower', explode($separator, $headerLine['content'])));
        $requiredColumns = array_map('strtolower', $config['columns']);

        // Vérification en-tête
        if (count($headerFields) < $config['required_columns']) {
            throw new Exception("En-tête FEC invalide : " . $config['required_columns'] . " colonnes requises, " . count($headerFields) . " trouvées");
        }

        // Mapping colonnes
        $columnMap = [];
        foreach ($requiredColumns as $col) {
            $index = array_search(strtolower($col), $headerFields);
            if ($index === false) {
                throw new Exception("Colonne manquante dans l'en-tête : $col");
            }
            $columnMap[$col] = $index;
        }

        // Parsing lignes
        $parsedLines = [];
        $rowId = 0;

        foreach ($lines as $line) {
            $lineContent = rtrim($line['content'], "\r\n"); // supprime CR/LF à la fin
            $fields = str_getcsv($lineContent, $separator);

            // S'assurer d'avoir le nombre requis de colonnes
            $fields = array_pad($fields, $config['required_columns'], '');

            if (count($fields) < $config['required_columns']) {
                throw new Exception("Ligne {$line['number']}: nombre de colonnes insuffisant");
            }

            $row = ['id' => $rowId, '_format' => 'FEC'];
            foreach ($columnMap as $name => $index) {
                $row[strtolower($name)] = trim($fields[$index] ?? '');
            }

            $row = $this->validateAndNormalizeLineContent($row, $line['number']);
            $parsedLines[] = $row;
            $rowId++;
        }

        return $parsedLines;
    }

    /**
     * Parsing format CIEL
     */
    private function parseCielFormat(array $lines, array $config, string $separator): array
    {
        // Extraction section ##Section Mvt
        $lines = $this->extractCielSection($lines, 'Mvt');

        $targetColumns = array_map('strtolower', self::FORMATS['FEC']['columns']);
        $cielColumns = array_map('strtolower', $config['columns']);

        $parsedLines = [];
        $rowId = 0;

        foreach ($lines as $line) {
            $fields = explode($separator, $line['content']);
            $fields = array_map(fn($f) => trim($f, "\" \t\n\r\0\x0B"), $fields);

            if (count($fields) < $config['required_columns']) {
                $fields = array_pad($fields, $config['required_columns'], '');
            }

            $cielData = array_combine($cielColumns, $fields);

            // Conversion vers format FEC
            $row = ['id' => $rowId, '_format' => 'CIEL'];
            foreach ($targetColumns as $col) {
                $row[$col] = $cielData[$col] ?? '';
            }

            // Gestion Montant + CreditDebit
            if (isset($cielData['montant']) && isset($cielData['creditdebit'])) {
                $montant = (float) str_replace([' ', ','], ['', '.'], $cielData['montant']);
                $sens = strtoupper(trim($cielData['creditdebit']));

                $row['debit'] = ($sens === 'D') ? $montant : 0;
                $row['credit'] = ($sens === 'C') ? $montant : 0;
            }

            $row = $this->validateAndNormalizeLineContent($row, $line['number']);
            $parsedLines[] = $row;
            $rowId++;
        }

        return $parsedLines;
    }

    /**
     * Extraction section CIEL
     */
    private function extractCielSection(array $lines, string $sectionName): array
    {
        $sectionHeader = "##Section\t" . $sectionName;
        $inSection = false;
        $sectionLines = [];

        foreach ($lines as $lineData) {
            $lineContent = trim($lineData['content']);

            if ($lineContent === $sectionHeader) {
                $inSection = true;
                continue;
            }

            if ($inSection && preg_match('/^##Section\s+/', $lineContent)) {
                break;
            }

            if ($inSection) {
                $sectionLines[] = $lineData;
            }
        }

        if (!$inSection) {
            throw new Exception("Section '$sectionName' non trouvée dans le fichier CIEL");
        }

        return $sectionLines;
    }

    /**
     * Détection du séparateur
     */
    private function detectSeparator(array $lines, string $format): string
    {

        $config = self::FORMATS[$format];

        $separators = $config['separators'];
        $scores = array_fill_keys($separators, 0);

        // On ne garde que les premières lignes utiles
        $lines = array_slice($lines, 0, 10);

        foreach ($lines as $line) {
            $line = trim($line['content']);
            if ($line === '') continue;

            foreach ($separators as $sep) {
                $scores[$sep] += substr_count($line, $sep);
            }
        }

        arsort($scores);
        $bestSeparator = array_key_first($scores);
        return $scores[$bestSeparator] > 0 ? $bestSeparator : false;

    }

    /**
     * Validation et normalisation du contenu d'une ligne
     */
    private function validateAndNormalizeLineContent(array $row, int $lineNumber): array
    {
        // Codes obligatoires
        if (empty($row['journalcode']) || strlen($row['journalcode']) > 20) {
            throw new Exception("Ligne $lineNumber: Code journal invalide ou manquant");
        }

        if (empty($row['ecriturenum']) || strlen($row['ecriturenum']) > 50) {
            throw new Exception("Ligne $lineNumber: Numéro d'écriture invalide ou manquant");
        }

        // Dates
        $row['piecedate'] = $this->validateAndFormatDate($row['piecedate'], "Ligne $lineNumber: Date pièce invalide", true);
        $row['ecrituredate'] = isset($row['ecrituredate']) ? $this->validateAndFormatDate($row['ecrituredate'], "Ligne $lineNumber: Date écriture invalide", false) : '';
        $row['datelet'] = $this->validateAndFormatDate($row['datelet'] ?? '', "Ligne $lineNumber: Date lettrage invalide", false);
        $row['validdate'] = isset($row['validdate']) ? $this->validateAndFormatDate($row['validdate'], "Ligne $lineNumber: Date validation invalide", false) : '';

        // Compte
        $compte = trim($row['comptenum']);
        if (empty($compte) || strlen($compte) > 20 || !preg_match('/^[0-9A-Za-z]+$/', $compte)) {
            throw new Exception("Ligne $lineNumber: Numéro de compte invalide");
        }

        // Récupération longueur compte configurée
        $accountLength = AccountConfigModel::find(1)->aco_account_length;
        $row['comptenum'] = substr($compte, 0, $accountLength);

        // Montants
        $debit = $this->parseAmount($row['debit'] ?? '');
        $credit = $this->parseAmount($row['credit'] ?? '');

        if ($debit == 0 && $credit == 0) {
            throw new Exception("Ligne $lineNumber: Aucun montant saisi");
        }

        if ($debit > 0 && $credit > 0) {
            throw new Exception("Ligne $lineNumber: Débit et crédit simultanés");
        }

        $row['debit'] = $debit;
        $row['credit'] = $credit;

        // Lettrage
        $lettrage = trim($row['ecriturelet'] ?? '');
        if (!empty($lettrage) && strlen($lettrage) > 10) {
            throw new Exception("Ligne $lineNumber: Code lettrage trop long");
        }
        $row['ecriturelet'] = $lettrage;

        // Devise
        $devise = trim($row['idevise'] ?? '');
        if (!empty($devise) && strlen($devise) !== 3) {
            throw new Exception("Ligne $lineNumber: Code devise invalide");
        }
        $row['idevise'] = $devise;

        return $row;
    }

    /**
     * Validation et formatage d'une date
     */
    private function validateAndFormatDate(string $date, string $errorMessage, bool $required): string
    {
        $date = trim($date);

        if (empty($date)) {
            if ($required) {
                throw new Exception($errorMessage);
            }
            return '';
        }

        // Format AAAAMMJJ
        if (preg_match('/^\d{8}$/', $date)) {
            $year = substr($date, 0, 4);
            $month = substr($date, 4, 2);
            $day = substr($date, 6, 2);
        }
        // Format JJ/MM/AAAA
        elseif (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $date, $matches)) {
            $day = $matches[1];
            $month = $matches[2];
            $year = $matches[3];
        } else {
            throw new Exception($errorMessage . " (format attendu: AAAAMMJJ ou JJ/MM/AAAA)");
        }

        if (!checkdate((int)$month, (int)$day, (int)$year) || $year < 1900 || $year > 2100) {
            throw new Exception($errorMessage);
        }

        return sprintf('%04d-%02d-%02d', $year, $month, $day);
    }

    /**
     * Parsing d'un montant
     */
    private function parseAmount(string $amount): float
    {
        if (empty($amount)) {
            return 0.0;
        }

        $cleanAmount = str_replace([' ', ','], ['', '.'], trim($amount));
        return (float) $cleanAmount;
    }

    /**
     * Validation des dates par rapport à l'exercice comptable
     */
    private function validateMovesDateInExercise(array $rows): array
    {
        $writingPeriod = AccountModel::getWritingPeriod();
        $periodStart = strtotime($writingPeriod['startDate']);
        $periodEnd = strtotime($writingPeriod['endDate']);

        $ecritureNumToRemove = [];

        // Identifier les écritures hors période
        foreach ($rows as $row) {
            $piecedate = strtotime($row['piecedate']);

            if ($piecedate === false || $piecedate < $periodStart || $piecedate > $periodEnd) {
                $ecritureNumToRemove[$row['ecriturenum']] = true;
            }
        }

        // Filtrer
        $cleanedRows = array_filter($rows, fn($row) => !isset($ecritureNumToRemove[$row['ecriturenum']]));

        if (count($ecritureNumToRemove) > 0) {
            $this->warnings[] = "Des écritures hors période d'exercice ont été supprimées (" . count($ecritureNumToRemove) . " mouvements)";
        }

        return array_values($cleanedRows);
    }

    /**
     * Validation de l'équilibre des écritures
     */
    private function validateFileBalance(array $rows): void
    {
        $groupedMoves = $this->groupLinesByMove($rows);

        foreach ($groupedMoves as $moveLines) {
            $totalDebit = array_sum(array_column($moveLines, 'debit'));
            $totalCredit = array_sum(array_column($moveLines, 'credit'));
            $difference = abs($totalDebit - $totalCredit);

            if ($difference > 0.01) {
                throw new Exception("Écriture {$moveLines[0]['ecriturenum']} déséquilibrée (différence: " . number_format($difference, 2) . " €)");
            }
        }
    }


    /**
     * Groupement des lignes par mouvement
     */
    private function groupLinesByMove(array $rows): array
    {
        $grouped = [];

        foreach ($rows as $row) {
            $key = $row['ecriturenum'] . '_' . $row['piecedate'];
            if (!isset($grouped[$key])) {
                $grouped[$key] = [];
            }
            $grouped[$key][] = $row;
        }

        return $grouped;
    }

    /**
     * Récupération ou création d'un journal
     */
    private function getOrCreateJournal(string $code, string $label): int
    {
        if (isset($this->journalCache[$code])) {
            return $this->journalCache[$code];
        }

        $journal = AccountJournalModel::where('ajl_code', $code)->first();

        if (!$journal) {
            $journal = AccountJournalModel::create([
                'ajl_code' => $code,
                'ajl_label' => $label,
                'fk_usr_id_author' => Auth::id(),
            ]);
        }

        $this->journalCache[$code] = $journal->ajl_id;
        return $journal->ajl_id;
    }

    /**
     * Récupération ou création d'un compte
     */
    private function getOrCreateAccount(string $code, string $label, bool $letterable): int
    {
        if (isset($this->accountCache[$code])) {
            return $this->accountCache[$code];
        }

        $account = AccountModel::where('acc_code', $code)->first();

        if (!$account) {
            $account = AccountModel::create([
                'acc_code' => $code,
                'acc_label' => $label,
                'acc_is_letterable' => $letterable ? 1 : 0,
                'fk_usr_id_author' => Auth::id(),
            ]);
        }

        $this->accountCache[$code] = $account->acc_id;
        return $account->acc_id;
    }

    /**
     * Extraction date minimum
     */
    private function extractMinDate(array $lines): ?string
    {
        $dates = array_filter(array_column($lines, 'piecedate'));
        return !empty($dates) ? min($dates) : null;
    }

    /**
     * Extraction date maximum
     */
    private function extractMaxDate(array $lines): ?string
    {
        $dates = array_filter(array_column($lines, 'piecedate'));
        return !empty($dates) ? max($dates) : null;
    }
}
