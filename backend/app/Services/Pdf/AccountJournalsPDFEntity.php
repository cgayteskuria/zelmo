<?php

namespace App\Services\Pdf;

class AccountJournalsPDFEntity extends \TCPDF
{
    private $documentData;
    private $filters;
    private $journalData;
    private $companyName;
    private $headerHeight;
    private $colsWidth;

    public function __construct($documentData)
    {
        if (empty($documentData) || !is_array($documentData)) {
            throw new \InvalidArgumentException("Les données du document sont invalides");
        }

        parent::__construct('P', 'mm', 'A4', true, 'UTF-8', false);

        $this->documentData = $documentData;
        $this->filters = $documentData['filters'] ?? [];
        $this->journalData = [];
        $this->companyName = $documentData['company']['name'] ?? 'Company';

        $this->SetCreator($this->companyName);
        $this->SetAuthor($this->companyName);
        $this->SetTitle("Edition des Journaux");
        $this->SetSubject("Edition des Journaux");

        // OPTIMISATION 1: Désactiver la compression si fichier volumineux
        $this->SetCompression(false);
        
        // OPTIMISATION 2: Optimiser les images et polices
        $this->setImageScale(PDF_IMAGE_SCALE_RATIO);
        $this->setJPEGQuality(75);
        
        // OPTIMISATION 3: Réduire la précision des calculs
        $this->setCellHeightRatio(1.25);

        $this->SetMargins(10, 25, 10);
        $this->SetAutoPageBreak(true, 25);
        $this->SetFont('dejavusans', '', 9);

        $this->generate();
    }

    private function generate()
    {
        $this->prepareJournalData();
        $this->generateContent();
    }

    public function Header()
    {
        $this->Ln(5);
        $this->SetFont('dejavusans', '', 10);
        
        // OPTIMISATION 4: Utiliser Cell au lieu de MultiCell quand possible
        $this->Cell(63, 0, "Dossier : " . $this->companyName, 0, 0, 'L');
        $this->Cell(64, 0, "EDITION DES JOURNAUX", 0, 0, 'C');
        $this->Cell(63, 0, "Le " . date('d/m/Y'), 0, 1, 'R');

        $this->SetLineStyle(['width' => 0.1, 'cap' => 'butt', 'join' => 'miter', 'dash' => 0, 'color' => [102, 102, 102]]);
        $this->Ln(5);

        if ($this->getPage() == 1) {
            $startDate = isset($this->filters["start_date"]) ? date('d/m/Y', strtotime($this->filters["start_date"])) : '';
            $endDate = isset($this->filters["end_date"]) ? date('d/m/Y', strtotime($this->filters["end_date"])) : '';
            $periodText = 'Période du ' . $startDate . ' au ' . $endDate;
            $this->Cell(0, 0, $periodText, 0, 1, 'L');

            $this->SetFont('dejavusans', '', 10);
            if (!empty($this->filters['journal_name'])) {
                $this->Cell(0, 0, 'Journal : ' . $this->filters['journal_name'], 0, 1, 'L');
            }
            $this->Ln(5);
        }

        $this->colsWidth = [10, 25, 50, 65, 20, 20];
        $h = 10;
        $this->SetFillColor(200, 200, 200);
        $this->SetFont('dejavusans', 'B', 7);
        
        // En-têtes de colonnes
        $this->MultiCell($this->colsWidth[0], $h, "Jnl", 1, 'C', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->colsWidth[1], $h, "N°\nde compte", 1, 'C', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->colsWidth[2], $h, "Intitulé\ndu compte", 1, 'C', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->colsWidth[3], $h, "Libellé de l'écriture", 1, 'C', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->colsWidth[4], $h, "Débit", 1, 'C', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->colsWidth[5], $h, "Crédit", 1, 'C', true, 1, '', '', true, 0, false, true, $h, 'M');
        
        $this->SetFont('dejavusans', '', 7);
        $this->headerHeight = $this->getPage() == 1 ? $this->GetY() : $this->GetY() + 7;
    }

    private function prepareJournalData()
    {
        $journalDataRaw = $this->documentData['journaux_data'] ?? [];

        if (isset($journalDataRaw['journals']) && is_array($journalDataRaw['journals'])) {
            $this->journalData = $journalDataRaw['journals'];
        }
    }

    public function generateContent()
    {
        $this->AddPage();
        $this->SetY($this->headerHeight);

        $this->SetDrawColor(150, 150, 150);
        $this->SetLineWidth(0.1);

        $h = 3.8;
        $grandTotalDebit = 0;
        $grandTotalCredit = 0;

        // OPTIMISATION 5: Pré-calculer les largeurs combinées
        $wTotal = array_sum(array_slice($this->colsWidth, 0, 4));

        foreach ($this->journalData as $journalCode => $journalData) {
            $this->Ln(4);
            $this->SetFont('dejavusans', 'B', 8);
            $this->SetFillColor(195, 0, 121);
            $this->Cell(0, $h, $journalData['name'] . " ({$journalCode})", 0, 1, 'L', true);
            $this->Ln(4);

            foreach ($journalData['months'] as $monthKey => $monthData) {
                foreach ($monthData['moves'] as $moveId => $moveData) {
                    $this->SetFont('dejavusans', 'B', 7);
                    $this->SetFillColor(233, 102, 164);
                    
                    $moveHeader = 'Mvt. ' . $moveId . ' Date d\'écriture : ' . date('d/m/Y', strtotime($moveData['date']));
                    if (!empty($moveData['ref'])) {
                        $moveHeader .= ' Pièce n° ' . $moveData['ref'];
                    }
                    $this->Cell(0, $h, $moveHeader, 0, 1, 'L', true);
                    $this->SetFont('dejavusans', '', 7);

                    // OPTIMISATION 6: Traiter les lignes par batch
                    $lineCount = count($moveData['lines']);
                    foreach ($moveData['lines'] as $idx => $line) {
                        // Vérifier saut de page moins souvent
                        if ($idx % 10 == 0 && $this->GetY() > 250) {
                            $this->AddPage();
                        }

                        // OPTIMISATION 7: Pré-formater les valeurs
                        $debitStr = $line['debit'] > 0 ? number_format($line['debit'], 2, ',', ' ') : '';
                        $creditStr = $line['credit'] > 0 ? number_format($line['credit'], 2, ',', ' ') : '';
                        
                        $this->MultiCell($this->colsWidth[0], $h, $journalCode, 1, 'L', false, 0, '', '', true, 0, false, true, $h, 'M');
                        $this->MultiCell($this->colsWidth[1], $h, $line['acc_code'] ?? '', 1, 'L', false, 0, '', '', true, 0, false, true, $h, 'M');
                        $this->MultiCell($this->colsWidth[2], $h, $this->truncateText($line['acc_label'] ?? '', 50), 1, 'L', false, 0, '', '', true, 0, false, true, $h, 'M');
                        $this->MultiCell($this->colsWidth[3], $h, $this->truncateText($line['label'] ?? '', 65), 1, 'L', false, 0, '', '', true, 0, false, true, $h, 'M');
                        $this->MultiCell($this->colsWidth[4], $h, $debitStr, 1, 'R', false, 0, '', '', true, 0, false, true, $h, 'M');
                        $this->MultiCell($this->colsWidth[5], $h, $creditStr, 1, 'R', false, 1, '', '', true, 0, false, true, $h, 'M');
                    }

                    // Total du mouvement
                    $this->SetFont('dejavusans', 'B', 7);
                    $this->MultiCell($wTotal, $h, 'TOTAL Mvt. ' . $moveId, 1, 'L', false, 0, '', '', true, 0, false, true, $h, 'M');
                    $this->MultiCell($this->colsWidth[4], $h, number_format($moveData['move_total_debit'], 2, ',', ' '), 1, 'R', false, 0, '', '', true, 0, false, true, $h, 'M');
                    $this->MultiCell($this->colsWidth[5], $h, number_format($moveData['move_total_credit'], 2, ',', ' '), 1, 'R', false, 1, '', '', true, 0, false, true, $h, 'M');
                    $this->SetFont('dejavusans', '', 7);
                }

                // Total du mois
                $this->SetFont('dejavusans', 'B', 7);
                $this->SetFillColor(249, 208, 229);
                $this->MultiCell($wTotal, $h, 'TOTAL DU MOIS DE ' . $monthData['name'], 1, 'L', true, 0, '', '', true, 0, false, true, $h, 'M');
                $this->MultiCell($this->colsWidth[4], $h, number_format($monthData['month_total_debit'], 2, ',', ' '), 1, 'R', true, 0, '', '', true, 0, false, true, $h, 'M');
                $this->MultiCell($this->colsWidth[5], $h, number_format($monthData['month_total_credit'], 2, ',', ' '), 1, 'R', true, 1, '', '', true, 0, false, true, $h, 'M');
                $this->Ln(5);
            }

            // Total du journal
            $this->SetFont('dejavusans', 'B', 8);
            $this->SetFillColor(195, 0, 121);
            $this->MultiCell($wTotal, $h, 'TOTAL JOURNAL ' . $journalCode, 1, 'L', true, 0, '', '', true, 0, false, true, $h, 'M');
            $this->MultiCell($this->colsWidth[4], $h, number_format($journalData['journal_total_debit'], 2, ',', ' '), 1, 'R', true, 0, '', '', true, 0, false, true, $h, 'M');
            $this->MultiCell($this->colsWidth[5], $h, number_format($journalData['journal_total_credit'], 2, ',', ' '), 1, 'R', true, 1, '', '', true, 0, false, true, $h, 'M');
            $this->Ln(5);

            $grandTotalDebit += $journalData['journal_total_debit'];
            $grandTotalCredit += $journalData['journal_total_credit'];
        }

        // Total général
        $this->SetFont('dejavusans', 'B', 8);
        $this->SetFillColor(180, 180, 180);
        $this->MultiCell($wTotal, $h, 'TOTAL DES JOURNAUX', 1, 'L', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->colsWidth[4], $h, number_format($grandTotalDebit, 2, ',', ' '), 1, 'R', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->colsWidth[5], $h, number_format($grandTotalCredit, 2, ',', ' '), 1, 'R', true, 1, '', '', true, 0, false, true, $h, 'M');
    }

    // OPTIMISATION 8: Cache pour truncateText
    private $truncateCache = [];
    
    private function truncateText($text, $maxWidth)
    {
        $text = trim($text);
        $cacheKey = $text . '_' . $maxWidth;
        
        if (isset($this->truncateCache[$cacheKey])) {
            return $this->truncateCache[$cacheKey];
        }
        
        if ($this->GetStringWidth($text) <= $maxWidth) {
            $this->truncateCache[$cacheKey] = $text;
            return $text;
        }

        while ($this->GetStringWidth($text . '...') > $maxWidth && mb_strlen($text, 'UTF-8') > 1) {
            $text = mb_substr($text, 0, mb_strlen($text, 'UTF-8') - 1, 'UTF-8');
        }

        $result = $text . '...';
        $this->truncateCache[$cacheKey] = $result;
        return $result;
    }

    public function Footer()
    {
        $this->SetY(-15);
        $this->SetFont('dejavusans', '', 8);
        $this->Cell(0, 10, 'Page ' . $this->getAliasNumPage() . '/' . $this->getAliasNbPages(), 0, 0, 'C');
    }
}