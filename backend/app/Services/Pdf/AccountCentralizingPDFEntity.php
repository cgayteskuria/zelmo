<?php

namespace App\Services\Pdf;


class AccountCentralizingPDFEntity extends \TCPDF
{
    private $documentData;
    private $filters;
    private $journalData;
    private $companyName;
    private $headerHeight;
    private $colsWidth;

    /**
     * Constructeur
     *
     * @param array $documentData Données structurées du document
     */
    public function __construct($documentData)
    {
        // Valider les données essentielles
        if (empty($documentData) || !is_array($documentData)) {
            throw new \InvalidArgumentException("Les données du document sont invalides");
        }

        // Initialiser TCPDF avec l'orientation portrait, unité mm, format A4
        parent::__construct('P', 'mm', 'A4', true, 'UTF-8', false);

        $this->documentData = $documentData;
        $this->filters = $documentData['filters'] ?? [];
        $this->journalData = [];

        // Configuration de base du document
        $this->companyName = $documentData['company']['name'] ?? 'Company';

        $this->SetCreator($this->companyName);
        $this->SetAuthor($this->companyName);
        $this->SetTitle("Centralisateur");
        $this->SetSubject("Centralisateur");

        // Marges (gauche, haut, droite)
        $this->SetMargins(10, 25, 10);
        $this->SetAutoPageBreak(true, 25);
        $this->SetFont('helvetica', '', 9);

        // Générer le PDF
        $this->generate();
    }

    /**
     * Génère le PDF complet
     */
    private function generate()
    {
        // Préparer les données
        $this->prepareJournalData();

        // Générer le PDF
        $this->generateContent();
    }

    /**
     * Header personnalisé
     */
    public function Header()
    {
        $this->Ln(5);
        $this->SetFont('helvetica', '', 10);
        $this->MultiCell(63, 0, "Dossier : " . $this->companyName, '', 'L', false, 0);
        $this->MultiCell(64, 0, "CENTRALISATEUR", '', 'C', false, 0);
        $this->MultiCell(63, 0, "Le " . date('d/m/Y'), '', 'R', false, 1);

        $this->SetLineStyle(array('width' => 0.1, 'cap' => 'butt', 'join' => 'miter', 'dash' => 0, 'color' => array(102, 102, 102)));
        $this->Ln(5);

        if ($this->getPage() == 1) {
            $startDate = isset($this->filters["start_date"]) ? date('d/m/Y', strtotime($this->filters["start_date"])) : '';
            $endDate = isset($this->filters["end_date"]) ? date('d/m/Y', strtotime($this->filters["end_date"])) : '';
            $periodText = 'Période du ' . $startDate . ' au ' . $endDate;
            $this->MultiCell(0, 0, $periodText, '', 'L', false, 1);

            $this->SetFont('helvetica', '', 10);
            $filterText = '';

            if (!empty($this->filters['journal_name'])) {
                $filterText .= 'Journal : ' . $this->filters['journal_name'] . ' ';
            }

            if (!empty($filterText)) {
                $this->MultiCell(0, 0, $filterText, '', 'L', false, 1);
            }
            $this->Ln(5);
        }

        $this->colsWidth = [20, 40, 70, 30, 30];
        $h = 10;
        $this->SetFillColor(200, 200, 200);
        $this->SetFont('helvetica', 'B', 7);
        $this->MultiCell($this->colsWidth[0], $h, "Code Journal", 1, 'C', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->colsWidth[1], $h, "Journal", 1, 'C', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->colsWidth[2], $h, "Mois", 1, 'C', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->colsWidth[3], $h, "Cumul\nDébit", 1, 'C', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->colsWidth[4], $h, "Cumul\nCrédit", 1, 'C', true, 1, '', '', true, 0, false, true, $h, 'M');
        $this->SetFont('helvetica', '', 7);
        $this->headerHeight = $this->getPage() == 1 ? $this->GetY() : $this->GetY() + 7;
    }

    /**
     * Prépare les données des journaux à partir des données reçues
     */
    private function prepareJournalData()
    {
        $journalDataRaw = $this->documentData['centralisateur_data'] ?? [];

        if (isset($journalDataRaw['journals']) && is_array($journalDataRaw['journals'])) {
            $this->journalData = $journalDataRaw['journals'];
        }
    }

    /**
     * Génère le PDF
     */
    public function generateContent()
    {
        $this->AddPage();
        $this->SetY($this->headerHeight);

        $h = 8;
        $grandTotalDebit = 0;
        $grandTotalCredit = 0;

        foreach ($this->journalData as $journalCode => $journalData) {
            $this->SetFont('helvetica', 'B', 8);
            $w = $this->colsWidth[0] + $this->colsWidth[1] + $this->colsWidth[2];
            $this->MultiCell($w, $h, $journalData['name'] . " ({$journalCode})", 0, 'L', false, 1, '', '', true, 0, false, true, $h, 'B');
            $this->SetFont('helvetica', '', 7);

            foreach ($journalData['months'] as $monthKey => $monthData) {
                $monthName = $this->formatMonthName($monthKey);
                $this->MultiCell($this->colsWidth[0], $h, $journalCode, 1, 'L', false, 0, '', '', true, 0, false, true, $h, 'M');
                $this->MultiCell($this->colsWidth[1], $h, "Journal", 1, 'L', false, 0, '', '', true, 0, false, true, $h, 'M');
                $this->MultiCell($this->colsWidth[2], $h, $monthName, 1, 'L', false, 0, '', '', true, 0, false, true, $h, 'M');
                $this->MultiCell($this->colsWidth[3], $h, number_format($monthData['debit'], 2, ',', ' '), 1, 'R', false, 0, '', '', true, 0, false, true, $h, 'M');
                $this->MultiCell($this->colsWidth[4], $h, number_format($monthData['credit'], 2, ',', ' '), 1, 'R', false, 1, '', '', true, 0, false, true, $h, 'M');
            }

            $grandTotalDebit += $journalData['total_debit'];
            $grandTotalCredit += $journalData['total_credit'];

            $this->displayJournalSubtotal($journalCode);
        }

        // Total général
        $this->Ln(10);
        $this->SetFont('helvetica', 'B', 10);
        $this->SetFillColor(180, 180, 180);
        $w = $this->colsWidth[0] + $this->colsWidth[1] + $this->colsWidth[2];
        $this->Cell($w, 6, 'TOTAL GÉNÉRAL', 1, 0, 'L', true);
        $this->Cell($this->colsWidth[3], 6, number_format($grandTotalDebit, 2, ',', ' '), 1, 0, 'R', true);
        $this->Cell($this->colsWidth[4], 6, number_format($grandTotalCredit, 2, ',', ' '), 1, 0, 'R', true);
    }

    /**
     * Formate le nom du mois
     */
    private function formatMonthName($monthKey)
    {
        $months = [
            '01' => 'Janvier',
            '02' => 'Février',
            '03' => 'Mars',
            '04' => 'Avril',
            '05' => 'Mai',
            '06' => 'Juin',
            '07' => 'Juillet',
            '08' => 'Août',
            '09' => 'Septembre',
            '10' => 'Octobre',
            '11' => 'Novembre',
            '12' => 'Décembre'
        ];

        list($year, $month) = explode('-', $monthKey);
        return $months[$month] . ' ' . $year;
    }

    /**
     * Affiche le sous-total d'un journal
     */
    private function displayJournalSubtotal($journalCode)
    {
        $this->SetFont('helvetica', 'B', 7);
        $this->SetFillColor(240, 240, 240);
        $w = $this->colsWidth[0] + $this->colsWidth[1] + $this->colsWidth[2];
        $this->Cell($w, 6, 'TOTAL JOURNAL ' . $journalCode, 1, 0, 'L', true);
        $this->Cell($this->colsWidth[3], 6, number_format($this->journalData[$journalCode]['total_debit'], 2, ',', ' '), 1, 0, 'R', true);
        $this->Cell($this->colsWidth[4], 6, number_format($this->journalData[$journalCode]['total_credit'], 2, ',', ' '), 1, 0, 'R', true);
        $this->SetFont('helvetica', '', 6.5);
        $this->Ln(3);
    }

    /**
     * Footer personnalisé
     */
    public function Footer()
    {
        $this->SetY(-15);
        $this->SetFont('helvetica', '', 8);
        $this->Cell(0, 10, 'Page ' . $this->getAliasNumPage() . '/' . $this->getAliasNbPages(), 0, 0, 'C');
    }
}
