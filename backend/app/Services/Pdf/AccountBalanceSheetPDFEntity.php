<?php

namespace App\Services\Pdf;


class AccountBalanceSheetPDFEntity extends \TCPDF
{
    private $documentData;
    private $filters;
    private $balanceSheetData;
    private $companyName;
    private $headerHeight;
    private $totalGeneral;
    private $tableColsW;
    private $tableBottom;

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

        // Initialiser TCPDF avec l'orientation paysage, unité mm, format A4
        parent::__construct('L', 'mm', 'A4', true, 'UTF-8', false);

        $this->documentData = $documentData;
        $this->filters = $documentData['filters'] ?? [];

        // Configuration de base du document
        $this->companyName = $documentData['company']['name'] ?? 'Company';

        $this->SetCreator($this->companyName);
        $this->SetAuthor($this->companyName);
        $this->SetTitle("Bilan Synthétique");
        $this->SetSubject("Bilan Synthétique");

        // Marges (gauche, haut, droite)
        $this->SetMargins(8, 25, 8);
        $this->SetAutoPageBreak(true, 25);
        $this->SetFont('dejavusans', '', 8);

        // Générer le PDF
        $this->generate();
    }

    /**
     * Génère le PDF complet
     */
    private function generate()
    {
        // Préparer les données du bilan
        $this->prepareBalanceSheetData();

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
        $usableWidth = $this->getPageWidth() - $this->lMargin - $this->rMargin;
        $this->MultiCell($usableWidth / 3, 0, "Dossier : " . $this->companyName, '', 'L', false, 0);
        $this->MultiCell($usableWidth / 3, 0, "BILAN SYNTHETIQUE", '', 'C', false, 0);
        $this->MultiCell($usableWidth / 3, 0, "Le " . date('d/m/Y'), '', 'R', false, 1);

        $this->SetLineStyle(array('width' => 0.1, 'cap' => 'butt', 'join' => 'miter', 'dash' => 0, 'color' => array(102, 102, 102)));
        $this->Ln(5);

        $startDate = isset($this->filters["start_date"]) ? date('d/m/Y', strtotime($this->filters["start_date"])) : '';
        $endDate = isset($this->filters["end_date"]) ? date('d/m/Y', strtotime($this->filters["end_date"])) : '';
        $periodText = 'Edition du ' . $startDate . ' au ' . $endDate;
        $this->MultiCell(0, 0, $periodText, '', 'L', false, 1);

        $this->Ln(5);
        $this->headerHeight = $this->GetY();
    }

    /**
     * Prépare les données du bilan à partir des données reçues
     */
    private function prepareBalanceSheetData()
    {
        
        $this->balanceSheetData = $this->documentData['bilan_data'] ?? [];      
   
    }

    /**
     * Génère le PDF du bilan
     */
    public function generatePDF()
    {
        $this->AddPage();
        $this->SetY($this->headerHeight);

        // En-têtes principales
        $this->SetFont('dejavusans', 'B', 9);
        $this->SetFillColor(240, 240, 240);
        $this->SetLineStyle(array('width' => 0.1, 'cap' => 'butt', 'join' => 'miter', 'dash' => 0, 'color' => array(168, 168, 168)));

        // Largeurs
        $lw_value = 24;
        $this->tableColsW = [
            "col1" => 70,
            "col2" => $lw_value,
            "col3" => $lw_value,
            "col4" => $lw_value,
            "col5" => $lw_value,
            "col6" => 71,
            "col7" => $lw_value,
            "col8" => $lw_value,
        ];

        // Première ligne : titres regroupés
        $h = 9;
        $this->MultiCell($this->tableColsW["col1"], 7 + $h, 'ACTIF', 1, 'C', true, 0, '', '', true, 0, false, true, 7 + $h, 'M');
        $this->MultiCell($lw_value * 3, 7, 'Exercice n', 1, 'C', true, 0, '', '', true, 0, false, true, 7, 'M');
        $this->MultiCell($lw_value, 7, 'n-1', 1, 'C', true, 0, '', '', true, 0, false, true, 7, 'M');
        $this->MultiCell($this->tableColsW["col6"], 7 + $h, 'PASSIF', 1, 'C', true, 0, '', '', true, 0, false, true, 7 + $h, 'M');
        $this->MultiCell($lw_value, 7 + $h, 'Exercice n ' . chr(10) . ' net', 1, 'C', true, 0, '', '', true, 0, false, true, 7 + $h, 'M');
        $this->MultiCell($lw_value, 7 + $h, 'Exercice n-1 net', 1, 'C', true, 0, '', '', true, 0, false, true, 7 + $h, 'M');

        // Deuxième ligne : sous-titres
        $this->SetY($this->headerHeight + 7);
        $this->MultiCell($this->tableColsW["col1"], $h, '', 0, 'C', false, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->tableColsW["col2"], $h, 'Brut', 1, 'C', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->tableColsW["col3"], $h, 'Amort. et prov.', 1, 'C', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->tableColsW["col4"], $h, 'Net', 1, 'C', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->tableColsW["col5"], $h, 'Net', 1, 'C', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->tableColsW["col6"], $h, '', 0, 'C', false, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->tableColsW["col7"], $h, '', 0, 'C', false, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->tableColsW["col8"], $h, '', 0, 'C', false, 1, '', '', true, 0, false, true, $h, 'M');

        $this->headerHeight = $this->GetY();

        // Contenu ACTIF et PASSIF
        $this->generateActifSection();
        $this->generatePassifSection();

        // Totaux généraux
        $this->generateTotauxGeneraux();
        $this->addFrame();
    }

    /**
     * Génère la section ACTIF
     */
    private function generateActifSection()
    {
        $this->Ln(5);

        $h = 5;
        $actifData = $this->balanceSheetData['actif'] ?? [];

        $total1 = $this->renderSection($actifData['actif_immobilise'] ?? []);

        // Total I
        $this->Ln(3);
        $this->SetFont('dejavusans', 'B', 10);
        $this->Cell($this->tableColsW["col1"], $h, 'TOTAL I', 0, 0, 'L');
        $this->Cell($this->tableColsW["col2"], $h, $this->formatNumber($total1["totalBrut"]), 0, 0, 'R');
        $this->Cell($this->tableColsW["col3"], $h, $this->formatNumber($total1["totalAmort"]), 0, 0, 'R');
        $this->Cell($this->tableColsW["col4"], $h, $this->formatNumber($total1["totalNet"]), 0, 0, 'R');
        $this->Cell($this->tableColsW["col5"], $h, $this->formatNumber($total1["totalNetN1"]), 0, 1, 'R');
        $this->Ln(5);

        // Actif circulant
        $this->SetFont('dejavusans', '', 10);
        $s2_1 = $this->renderSection($actifData['actif_circulant'] ?? []);
        $this->Ln(5);
        $s2_2 = $this->renderSection($actifData['creances'] ?? []);
        $s2_3 = $this->renderSection($actifData['valeur_mobilieres'] ?? []);
        $s2_4 = $this->renderSection($actifData['disponibilites'] ?? []);
        $s2_5 = $this->renderSection($actifData['caisse'] ?? []);

        $total2 = $this->addArray($s2_1, $s2_2, $s2_3, $s2_4, $s2_5);

        // Total II
        $this->Ln(3);
        $this->SetFont('dejavusans', 'B', 10);
        $this->Cell($this->tableColsW["col1"], $h, 'TOTAL II', 0, 0, 'L');
        $this->Cell($this->tableColsW["col2"], $h, $this->formatNumber($total2["totalBrut"]), 0, 0, 'R');
        $this->Cell($this->tableColsW["col3"], $h, $this->formatNumber($total2["totalAmort"]), 0, 0, 'R');
        $this->Cell($this->tableColsW["col4"], $h, $this->formatNumber($total2["totalNet"]), 0, 0, 'R');
        $this->Cell($this->tableColsW["col5"], $h, $this->formatNumber($total2["totalNetN1"]), 0, 1, 'R');
        $this->Ln(5);

        $total3 = $this->renderSection($actifData['charges_constatees_avance'] ?? []);

        $this->totalGeneral["actif"] = $this->addArray($total1, $total2, $total3);

        $this->tableBottom = $this->GetY();
    }

    /**
     * Génère la section PASSIF
     */
    private function generatePassifSection()
    {
        $setX = $this->getMargins()["left"] + $this->tableColsW["col1"] + $this->tableColsW["col2"] + $this->tableColsW["col3"] + $this->tableColsW["col4"] + $this->tableColsW["col5"];

        $this->setY($this->headerHeight);
        $this->Ln(5);

        $h = 5;
        $passifData = $this->balanceSheetData['passif'] ?? [];

        $s1_1 = $this->renderPassifSection($passifData['capitaux_propres'] ?? []);
        $s1_2 = $this->renderPassifSection($passifData['report_nouveau'] ?? []);
        $s1_3 = $this->renderPassifSection($passifData['resultat'] ?? []);
        $s1_4 = $this->renderPassifSection($passifData['provision'] ?? []);

        $total1 = $this->addArray($s1_1, $s1_2, $s1_3, $s1_4);

        // Total I
        $this->Ln(3);
        $this->SetFont('dejavusans', 'B', 10);
        $this->setX($setX);
        $this->MultiCell($this->tableColsW["col6"], $h, 'TOTAL I', 0, 'L', false, 0);
        $this->MultiCell($this->tableColsW["col7"], $h, $this->formatNumber($total1["totalNet"]), 0, 'R', false, 0);
        $this->MultiCell($this->tableColsW["col8"], $h, $this->formatNumber($total1["totalNetN1"]), 0, 'R', false, 1);
        $this->Ln(5);

        $total2 = $this->renderPassifSection($passifData['provision_risque'] ?? []);
        $total3 = $this->renderPassifSection($passifData['dettes'] ?? []);

        // Total III
        $this->Ln(3);
        $this->SetFont('dejavusans', 'B', 10);
        $this->setX($setX);
        $this->MultiCell($this->tableColsW["col6"], $h, 'TOTAL III', 0, 'L', false, 0);
        $this->MultiCell($this->tableColsW["col7"], $h, $this->formatNumber($total3["totalNet"]), 0, 'R', false, 0);
        $this->MultiCell($this->tableColsW["col8"], $h, $this->formatNumber($total3["totalNetN1"]), 0, 'R', false, 1);
        $this->Ln(5);

        $total4 = $this->renderPassifSection($passifData['produit_avance'] ?? []);

        $this->totalGeneral["passif"] = $this->addArray($total1, $total2, $total3, $total4);
        $this->tableBottom = $this->GetY() > $this->tableBottom ? $this->GetY() : $this->tableBottom;
    }

    /**
     * Affiche une section de l'actif
     */
    public function renderSection($data)
    {
        $h = 5;
        $this->SetFont('dejavusans', '', 10);

        $totalBrut = 0;
        $totalAmort = 0;
        $totalNet = 0;
        $totalNetN1 = 0;

        if (isset($data["content"])) {
            if (isset($data['label'])) {
                $this->Cell($this->tableColsW["col1"], $h, $data['label'], 0, 0, 'L');
                $this->Cell(49, $h, '', 0, 1, 'L');
            }

            foreach ($data["content"] as $item) {
                $label = isset($item['label']) ? '   - ' . $item['label'] : '   - ';

                $brutValue = isset($item['brut_amount']) ? $item['brut_amount'] : 0;
                $amortValue = isset($item['amort_amount']) ? $item['amort_amount'] : 0;
                $netValue = isset($item['net_amount']) ? $item['net_amount'] : 0;
                $netN1Value = isset($item['net_amount_N1']) ? $item['net_amount_N1'] : 0;

                $totalBrut += $brutValue;
                $totalAmort += $amortValue;
                $totalNet += $netValue;
                $totalNetN1 += $netN1Value;

                $this->MultiCell($this->tableColsW["col1"], $h, $label, 0, 'L', false, 0);
                $this->MultiCell($this->tableColsW["col2"], $h, $this->formatNumber($brutValue), 0, 'R', false, 0);
                $this->MultiCell($this->tableColsW["col3"], $h, $this->formatNumber($amortValue), 0, 'R', false, 0);
                $this->MultiCell($this->tableColsW["col4"], $h, $this->formatNumber($netValue), 0, 'R', false, 0);
                $this->MultiCell($this->tableColsW["col5"], $h, $this->formatNumber($netN1Value), 0, 'R', false, 1);
            }
        } else {
            $label = $data['label'] ?? '';

            $brutValue = isset($data['brut_amount']) ? $data['brut_amount'] : 0;
            $amortValue = isset($data['amort_amount']) ? $data['amort_amount'] : 0;
            $netValue = isset($data['net_amount']) ? $data['net_amount'] : 0;
            $netN1Value = isset($data['net_amount_N1']) ? $data['net_amount_N1'] : 0;

            $totalBrut += $brutValue;
            $totalAmort += $amortValue;
            $totalNet += $netValue;
            $totalNetN1 += $netN1Value;

            $this->MultiCell($this->tableColsW["col1"], $h, $label, 0, 'L', false, 0);
            $this->MultiCell($this->tableColsW["col2"], $h, $this->formatNumber($brutValue), 0, 'R', false, 0);
            $this->MultiCell($this->tableColsW["col3"], $h, $this->formatNumber($amortValue), 0, 'R', false, 0);
            $this->MultiCell($this->tableColsW["col4"], $h, $this->formatNumber($netValue), 0, 'R', false, 0);
            $this->MultiCell($this->tableColsW["col5"], $h, $this->formatNumber($netN1Value), 0, 'R', false, 1);
        }

        return [
            'totalBrut' => $totalBrut,
            'totalAmort' => $totalAmort,
            'totalNet' => $totalNet,
            'totalNetN1' => $totalNetN1,
        ];
    }

    /**
     * Affiche une section du passif
     */
    public function renderPassifSection($data)
    {
        $h = 5;
        $this->SetFont('dejavusans', '', 10);
        $setX = $this->getMargins()["left"] + $this->tableColsW["col1"] + $this->tableColsW["col2"] + $this->tableColsW["col3"] + $this->tableColsW["col4"] + $this->tableColsW["col5"];

        $totalNet = 0;
        $totalNetN1 = 0;

        if (isset($data["content"])) {
            if (isset($data['label'])) {
                $this->setX($setX);
                $this->MultiCell($this->tableColsW["col1"], $h, $data['label'], 0, 'L', false, 1);
            }

            foreach ($data["content"] as $item) {
                $label = isset($item['label']) ? '   - ' . $item['label'] : '   - ';
                $netValue = isset($item['net_amount']) ? $item['net_amount'] : 0;
                $netN1Value = isset($item['net_amount_N1']) ? $item['net_amount_N1'] : 0;

                $totalNet += $netValue;
                $totalNetN1 += $netN1Value;

                $this->setX($setX);
                $this->MultiCell($this->tableColsW["col6"], $h, $label, 0, 'L', false, 0);
                $this->MultiCell($this->tableColsW["col7"], $h, $this->formatNumber($netValue), 0, 'R', false, 0);
                $this->MultiCell($this->tableColsW["col8"], $h, $this->formatNumber($netN1Value), 0, 'R', false, 1);
            }
        } else {
            $label = $data['label'] ?? '';

            $netValue = isset($data['net_amount']) ? $data['net_amount'] : 0;
            $netN1Value = isset($data['net_amount_N1']) ? $data['net_amount_N1'] : 0;
            $totalNet += $netValue;
            $totalNetN1 += $netN1Value;

            $this->setX($setX);
            $this->MultiCell($this->tableColsW["col6"], $h, $label, 0, 'L', false, 0);
            $this->MultiCell($this->tableColsW["col7"], $h, $this->formatNumber($netValue), 0, 'R', false, 0);
            $this->MultiCell($this->tableColsW["col8"], $h, $this->formatNumber($netN1Value), 0, 'R', false, 1);
        }

        return [
            'totalNet' => $totalNet,
            'totalNetN1' => $totalNetN1,
        ];
    }

    /**
     * Additionne plusieurs tableaux
     */
    private function addArray(array ...$arrays): array
    {
        $result = [];

        foreach ($arrays as $array) {
            foreach ($array as $key => $value) {
                if (!isset($result[$key])) {
                    $result[$key] = 0;
                }
                $result[$key] += $value;
            }
        }

        return $result;
    }

    /**
     * Génère les totaux généraux
     */
    private function generateTotauxGeneraux()
    {
        $this->SetFont('dejavusans', 'B', 10);
        $this->SetFillColor(220, 220, 220);
        $h = 8;
        $this->setX($this->getMargins()["left"]);
        $this->setY($this->tableBottom);
        $this->Ln(5);

        // Total ACTIF
        $totalActif = $this->totalGeneral["actif"];
        $this->MultiCell($this->tableColsW["col1"], $h, 'TOTAL GENERAL (I+II+III)', 'B', 'L', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->tableColsW["col2"], $h, $this->formatNumber($totalActif["totalBrut"]), 'B', 'R', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->tableColsW["col3"], $h, $this->formatNumber($totalActif["totalAmort"]), 'B', 'R', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->tableColsW["col4"], $h, $this->formatNumber($totalActif["totalNet"]), 'B', 'R', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->tableColsW["col5"], $h, $this->formatNumber($totalActif["totalNetN1"]), 'B', 'R', true, 0, '', '', true, 0, false, true, $h, 'M');

        // Total PASSIF
        $totalPassif = $this->totalGeneral["passif"];
        $this->MultiCell($this->tableColsW["col6"], $h, 'TOTAL GENERAL (I+II+III+IV)', 'B', 'L', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->tableColsW["col7"], $h, $this->formatNumber($totalPassif["totalNet"]), 'B', 'R', true, 0, '', '', true, 0, false, true, $h, 'M');
        $this->MultiCell($this->tableColsW["col8"], $h, $this->formatNumber($totalPassif["totalNetN1"]), 'B', 'R', true, 1, '', '', true, 0, false, true, $h, 'M');
        $this->tableBottom = $this->getY();
    }

    /**
     * Ajoute le cadre du tableau
     */
    function addFrame()
    {
        $x = $this->getMargins()["left"];
        $this->SetLineStyle(array('width' => 0.1, 'cap' => 'butt', 'join' => 'miter', 'dash' => 0, 'color' => array(168, 168, 168)));
        $topY = $this->headerHeight;
        $bottomY = $this->tableBottom;

        foreach ($this->tableColsW as $colW) {
            $this->Line($x, $topY, $x, $bottomY);
            $x += $colW;
        }
        $this->Line($x, $topY, $x, $bottomY);
    }

    /**
     * Formate un nombre
     */
    function formatNumber($val)
    {
        return is_numeric($val) && $val != 0 ? number_format($val, 0, ',', ' ') : '';
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
