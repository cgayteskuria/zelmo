<?php

namespace App\Services\Pdf;


class AccountBalancePDFEntity extends \TCPDF
{
    private $documentData;
    private $balanceData;
    private $classSubtotals;
    private $grandTotal;
    private $companyName;
    private $headerHeight;
    private $filters;

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
        $this->balanceData = [];
        $this->classSubtotals = [];
        $this->grandTotal = [
            'debit' => 0,
            'credit' => 0,
            'solde_debit' => 0,
            'solde_credit' => 0
        ];

        // Configuration de base du document
        $this->companyName = $documentData['company']['name'] ?? 'Company';

        $this->SetCreator($this->companyName);
        $this->SetAuthor($this->companyName);
        $this->SetTitle("Balance Comptable");
        $this->SetSubject("Balance Comptable");

        // Marges (gauche, haut, droite)
        $this->SetMargins(10, 25, 10);
        $this->SetAutoPageBreak(true, 25);
        $this->SetFont('dejavusans', '', 9);

        // Générer le PDF
        $this->generate();
    }

    /**
     * Génère le PDF complet
     */
    private function generate()
    {
        // Préparer les données de la balance
        $this->prepareBalanceData();

        // Générer le PDF
        $this->generatePDF();
    }

    /**
     * Header personnalisé
     */
    public function Header()
    {
        $this->Ln(5);
        $this->SetFont('dejavusans', '', 10);
        $this->MultiCell(63, 0, "Dossier : " . $this->companyName, '', 'L', false, 0);
        $this->MultiCell(64, 0, "BALANCE COMPTABLE", '', 'C', false, 0);
        $this->MultiCell(63, 0, "Le " . date('d/m/Y'), '', 'R', false, 1);

        $this->SetLineStyle(array('width' => 0.1, 'cap' => 'butt', 'join' => 'miter', 'dash' => 0, 'color' => array(102, 102, 102)));
        $this->Ln(5);

        if ($this->getPage() == 1) {
            $startDate = isset($this->filters["start_date"]) ? date('d/m/Y', strtotime($this->filters["start_date"])) : '';
            $endDate = isset($this->filters["end_date"]) ? date('d/m/Y', strtotime($this->filters["end_date"])) : '';
            $periodText = 'Période du ' . $startDate . ' au ' . $endDate;
            $this->MultiCell(0, 0, $periodText, '', 'L', false, 1);

            $this->SetFont('dejavusans', '', 10);
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

        // En-têtes des colonnes
        $this->SetFont('dejavusans', 'B', 9);
        $this->SetFillColor(200, 200, 200);
        $this->Cell(25, 8, 'N° Compte', 1, 0, 'C', true);
        $this->Cell(60, 8, 'Intitulé du compte', 1, 0, 'C', true);
        $this->Cell(25, 8, 'Cumul Débit', 1, 0, 'C', true);
        $this->Cell(25, 8, 'Cumul Crédit', 1, 0, 'C', true);
        $this->Cell(25, 8, 'Solde Débiteur', 1, 0, 'C', true);
        $this->Cell(25, 8, 'Solde Créditeur', 1, 1, 'C', true);
        $this->SetFont('dejavusans', '', 9);
        $this->headerHeight = $this->getPage() == 1 ? $this->GetY() : $this->GetY() - 5;
    }

    /**
     * Prépare les données de la balance à partir des données reçues
     */
    private function prepareBalanceData()
    {
        $balanceDataRaw = $this->documentData['balance_data'] ?? [];
        $this->balanceData = $balanceDataRaw["balanceData"];
        $this->classSubtotals = $balanceDataRaw["classSubtotals"];
        $this->grandTotal = $balanceDataRaw["grandTotal"];
    }

    /**
     * Génère le PDF de la balance
     */
    public function generatePDF()
    {
        $this->AddPage();
        $this->SetY($this->headerHeight);

        // Parcours des données par classe
        ksort($this->balanceData);

        foreach ($this->balanceData as $classCode => $accounts) {
            // Titre de la classe
            $this->SetFont('dejavusans', 'B', 10);
            $this->SetFillColor(220, 220, 220);
            $this->Cell(185, 8, 'CLASSE ' . $classCode, 1, 1, 'L', true);
            $this->SetFont('dejavusans', '', 8);

            // Comptes de la classe
            foreach ($accounts as $account) {
                $this->Cell(25, 5, $account['numero_compte'], 1, 0, 'L');
                $this->Cell(60, 5, substr($account['intitule_compte'], 0, 35), 1, 0, 'L');
                $this->Cell(25, 5, $account['cumul_debit'] > 0 ? number_format($account['cumul_debit'], 2, ',', ' ') : "", 1, 0, 'R');
                $this->Cell(25, 5, $account['cumul_credit'] > 0 ? number_format($account['cumul_credit'], 2, ',', ' ') : "", 1, 0, 'R');
                $this->Cell(25, 5, $account['solde_debit'] > 0 ? number_format($account['solde_debit'], 2, ',', ' ') : "", 1, 0, 'R');
                $this->Cell(25, 5, $account['solde_credit'] > 0 ? number_format($account['solde_credit'], 2, ',', ' ') : "", 1, 1, 'R');
            }

            // Sous-total de la classe
            $this->SetFont('dejavusans', 'B', 8);
            $this->SetFillColor(240, 240, 240);
            $this->Cell(85, 5, 'Sous-total Classe ' . $classCode, 1, 0, 'R', true);
            $this->Cell(25, 5, $this->classSubtotals[$classCode]['debit'] > 0 ? number_format($this->classSubtotals[$classCode]['debit'], 2, ',', ' ') : "", 1, 0, 'R', true);
            $this->Cell(25, 5, $this->classSubtotals[$classCode]['credit'] > 0 ? number_format($this->classSubtotals[$classCode]['credit'], 2, ',', ' ') : "", 1, 0, 'R', true);
            $this->Cell(25, 5, $this->classSubtotals[$classCode]['solde_debit'] > 0 ? number_format($this->classSubtotals[$classCode]['solde_debit'], 2, ',', ' ') : "", 1, 0, 'R', true);
            $this->Cell(25, 5, $this->classSubtotals[$classCode]['solde_credit'] > 0 ? number_format($this->classSubtotals[$classCode]['solde_credit'], 2, ',', ' ') : "", 1, 1, 'R', true);
            $this->SetFont('dejavusans', '', 8);
            $this->Ln(3);
        }

        // Total général
        $this->Ln(5);
        $this->SetFont('dejavusans', 'B', 10);
        $this->SetFillColor(180, 180, 180);
        $this->Cell(85, 8, 'TOTAL GÉNÉRAL', 1, 0, 'R', true);
        $this->Cell(25, 8, $this->grandTotal['debit'] > 0 ? number_format($this->grandTotal['debit'], 2, ',', ' ') : "", 1, 0, 'R', true);
        $this->Cell(25, 8, $this->grandTotal['credit'] > 0 ? number_format($this->grandTotal['credit'], 2, ',', ' ') : "", 1, 0, 'R', true);
        $this->Cell(25, 8, $this->grandTotal['solde_debit'] > 0 ? number_format($this->grandTotal['solde_debit'], 2, ',', ' ') : "", 1, 0, 'R', true);
        $this->Cell(25, 8, $this->grandTotal['solde_credit'] > 0 ? number_format($this->grandTotal['solde_credit'], 2, ',', ' ') : "", 1, 1, 'R', true);
    }

    /**
     * Footer personnalisé
     */
    public function Footer()
    {
        $this->SetY(-15);
        $this->SetFont('dejavusans', '', 8);
        $this->Cell(0, 10, 'Page ' . $this->getAliasNumPage() . '/' . $this->getAliasNbPages(), 0, 0, 'C');
    }
}
