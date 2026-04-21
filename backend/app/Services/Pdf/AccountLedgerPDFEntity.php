<?php

namespace App\Services\Pdf;


class AccountLedgerPDFEntity extends \TCPDF
{
    private $documentData;
    private $filters;
    private $grandLivreData;
    private $accountSubtotals;
    private $classSubtotals;
    private $grandTotal;
    private $companyName;
    private $headerHeight;

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
        $this->grandLivreData = [];
        $this->accountSubtotals = [];
        $this->classSubtotals = [];
        $this->grandTotal = [
            'debit' => 0,
            'credit' => 0
        ];

        // Configuration de base du document
        $this->companyName = $documentData['company']['name'] ?? 'Company';

        $this->SetCreator($this->companyName);
        $this->SetAuthor($this->companyName);
        $this->SetTitle("Grand Livre");
        $this->SetSubject("Grand Livre");

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
        // Préparer les données du Grand Livre
        $this->prepareGrandLivreData();

        // Générer le PDF
        $this->generatePDF();
    }

    /**
     * Header personnalisé pour la première page
     */
    public function Header()
    {
        $this->Ln(5);
        $this->SetFont('helvetica', '', 10);
        $this->MultiCell(63, 0, "Dossier : " . $this->companyName, '', 'L', false, 0);
        $this->MultiCell(64, 0, "GRAND LIVRE", '', 'C', false, 0);
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
            if (!empty($this->filters['account_from_code'])) {
                $filterText .= 'Du compte : ' . $this->filters['account_from_code'] . ' ';
            }
            if (!empty($this->filters['account_to_code'])) {
                $filterText .= 'au compte : ' . $this->filters['account_to_code'] . ' ';
            }
            if (!empty($filterText)) {
                $this->MultiCell(0, 0, $filterText, '', 'L', false, 1);
            }
            $this->Ln(5);
        }

        // Utilisation de MultiCell pour les titres avec retour à la ligne
        $h = 10;
        $this->SetFillColor(200, 200, 200);
        $this->SetFont('helvetica', '', 7);
        $this->MultiCell(12, $h, "N°\nMvt", 1, 'C', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell(12, $h, "Journal", 1, 'C', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell(15, $h, "Date", 1, 'C', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell(20, $h, "N°\nPièce", 1, 'C', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell(60, $h, "Libellé de\nl'écriture", 1, 'C', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell(20, $h, "Montant\nDébit", 1, 'C', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell(20, $h, "Montant\nCrédit", 1, 'C', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell(10, $h, "Lett.", 1, 'C', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell(20, $h, "Solde\nCumulé", 1, 'C', true, 1, '', '', true, 0, false, true, $h, 'M');

        $this->SetFont('helvetica', '', 7);
        $this->headerHeight = $this->getPage() == 1 ? $this->GetY() : $this->GetY() - 5;
    }

    /**
     * Prépare les données du Grand Livre à partir des données reçues
     */
    private function prepareGrandLivreData()
    {
        $grandLivreDataRaw = $this->documentData['grand_livre_data'] ?? [];
        
        $this->accountSubtotals = $grandLivreDataRaw["accountSubtotals"];
        $this->classSubtotals = $grandLivreDataRaw["classSubtotals"];
        $this->grandLivreData = $grandLivreDataRaw["grandLivreData"];
        $this->grandTotal = $grandLivreDataRaw["grandTotal"];
    }

    /**
     * Génère le PDF du Grand Livre
     */
    public function generatePDF()
    {
        $this->AddPage();
        $this->SetY($this->headerHeight);

        // Parcours des données par compte
        ksort($this->grandLivreData);
        $currentClass = null;

        foreach ($this->grandLivreData as $accountCode => $accountData) {
            $accountClass = $this->getAccountClass($accountCode);

            // Affichage du titre de classe si changement
            if ($currentClass !== $accountClass) {
                if ($currentClass !== null) {
                    $this->displayClassSubtotal($currentClass);
                    $this->Ln(5);
                }
                $currentClass = $accountClass;
            }

            $this->displayAccountData($accountCode, $accountData);
        }

        // Dernier sous-total de classe
        if ($currentClass !== null) {
            $this->displayClassSubtotal($currentClass);
        }

        // Total général
        $this->Ln(5);
        $this->SetFont('helvetica', 'B', 10);
        $this->SetFillColor(180, 180, 180);
        $this->Cell(119, 8, 'TOTAL GÉNÉRAL', 1, 0, 'R', true);
        $this->Cell(20, 8, number_format($this->grandTotal['debit'], 2, ',', ' '), 1, 0, 'R', true);
        $this->Cell(20, 8, number_format($this->grandTotal['credit'], 2, ',', ' '), 1, 0, 'R', true);
        $this->Cell(30, 8, '', 1, 1, 'C', true);
    }

    /**
     * Détermine la classe comptable à partir du code compte
     */
    private function getAccountClass($accountCode)
    {
        return substr($accountCode, 0, 1);
    }

    /**
     * Affiche le sous-total d'un compte
     */
    private function displayAccountSubtotal($accountCode, $solde_cumule)
    {
        $this->SetFont('helvetica', 'B', 7);
        $this->SetFillColor(240, 240, 240);
        $this->Cell(119, 6, 'Sous-total Compte ' . $accountCode, 1, 0, 'R', true);
        $this->Cell(20, 6, number_format($this->accountSubtotals[$accountCode]['debit'], 2, ',', ' '), 1, 0, 'R', true);
        $this->Cell(20, 6, number_format($this->accountSubtotals[$accountCode]['credit'], 2, ',', ' '), 1, 0, 'R', true);
        $this->Cell(10, 6, '', 1, 0, 'C', true);
        $this->Cell(20, 6, number_format($solde_cumule, 2, ',', ' '), 1, 1, 'R', true);
        $this->SetFont('helvetica', '', 6.5);
        $this->Ln(3);
    }

    /**
     * Affiche le sous-total d'une classe
     */
    private function displayClassSubtotal($classCode)
    {
        $this->SetFont('helvetica', 'B', 7);
        $this->SetFillColor(180, 180, 180);
        $soldeClasse = $this->classSubtotals[$classCode]['debit'] - $this->classSubtotals[$classCode]['credit'];

        $this->Cell(119, 8, 'Sous-total Classe ' . $classCode, 1, 0, 'R', true);
        $this->Cell(20, 8, number_format($this->classSubtotals[$classCode]['debit'], 2, ',', ' '), 1, 0, 'R', true);
        $this->Cell(20, 8, number_format($this->classSubtotals[$classCode]['credit'], 2, ',', ' '), 1, 0, 'R', true);
        $this->Cell(10, 8, '', 1, 0, 'C', true);
        $this->Cell(20, 8, number_format($soldeClasse, 2, ',', ' '), 1, 1, 'R', true);
        $this->SetFont('helvetica', '', 6.5);
    }

    /**
     * Affiche les données d'un compte
     */
    private function displayAccountData($accountCode, $accountData)
    {
        // Titre du compte
        $this->SetFont('helvetica', 'B', 9);
        $this->SetFillColor(220, 220, 220);
        $accountTitle = "Compte " . $accountCode . " - " . $accountData['account_label'];
        $this->Cell(189, 8, $accountTitle, 1, 1, 'L', true);
        $this->SetFont('helvetica', '', 6.5);

        $solde_cumule = 0;

        // Lignes d'écriture du compte
        foreach ($accountData['lines'] as $entry) {
            $debit = (float)($entry['aml_debit'] ?? 0);
            $credit = (float)($entry['aml_credit'] ?? 0);

            $solde_cumule += ($debit - $credit);

            $this->Cell(12, 5, $entry['amo_id'] ?? '', 1, 0, 'C');
            $this->Cell(12, 5, $entry['ajl_code'] ?? '', 1, 0, 'C');
            $this->Cell(15, 5, isset($entry['aml_date']) ? date('d/m/Y', strtotime($entry['aml_date'])) : '', 1, 0, 'C');
            $this->Cell(20, 5, isset($entry['amo_ref']) ? substr($entry['amo_ref'], 0, 12) : '', 1, 0, 'L');
            $this->Cell(60, 5, isset($entry['aml_label_entry']) ? substr($entry['aml_label_entry'], 0, 32) : '', 1, 0, 'L');
            $this->Cell(20, 5, $debit > 0 ? number_format($debit, 2, ',', ' ') : '', 1, 0, 'R');
            $this->Cell(20, 5, $credit > 0 ? number_format($credit, 2, ',', ' ') : '', 1, 0, 'R');
            $this->Cell(10, 5, $entry['aml_lettering_code'] ?? '', 1, 0, 'C');
            $this->Cell(20, 5, number_format($solde_cumule, 2, ',', ' '), 1, 1, 'R');
        }

        // Sous-total du compte
        $this->displayAccountSubtotal($accountCode, $solde_cumule);
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
