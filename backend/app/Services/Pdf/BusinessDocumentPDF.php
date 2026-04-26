<?php

namespace App\Services\Pdf;

use TCPDF;

/**
 * Classe réutilisable pour la génération de PDF de documents commerciaux
 * Compatible avec les devis, commandes, factures, bons de livraison, contrats, etc.
 */
class BusinessDocumentPDF extends TCPDF
{
    private $documentData;
    private $totals;
    private $colsW;

    private $bottomHeader;
    private $topYFrameFirstPage = 75;
    private $topYFrameOtherPage = 30;

    private $lineColor;
    private $bottomTotalY;

    const BOTTOM_FRAMES_LAST_PAGE = 233;
    const BOTTOM_FRAMES_OTHERS_PAGES = 275;

    const HEADER_TABLE_H = 8;

    const MARGIN_LEFT = 10;
    const MARGIN_TOP = 40;
    const MARGIN_RIGHT = 10;
    const MARGIN_FOOTER = 12;

    const COLOR_LIGHT_GRAY = array(248, 248, 248);
    const COLOR_GRAY = array(200, 200, 200);
    const COLOR_DARK_GRAY = array(102, 102, 102);

    /**
     * Constructeur
     *
     * @param array $documentData Structure de données du document
     * @throws \InvalidArgumentException
     */
    public function __construct($documentData)
    {
        // Valider les données essentielles
        if (empty($documentData) || !is_array($documentData)) {
            throw new \InvalidArgumentException("Les données du document sont invalides");
        }

        if (!isset($documentData["document"]["type"])) {
            throw new \InvalidArgumentException("Le type de document est manquant");
        }

        // Initialiser TCPDF avec l'orientation portrait, unité mm, format A4
        parent::__construct('P', 'mm', 'A4', true, 'UTF-8', false);

        $this->documentData = $documentData;
        $this->lineColor = array(168, 168, 168);

        // Configuration de base du document
        $creator = $documentData["document"]["creator"] ?? "Zelmo";
        $companyLabel = $documentData["company"]["info"]["cop_label"] ?? "Company";

        $this->SetCreator($companyLabel . ' - ' . $creator);
        $this->SetAuthor($companyLabel . ' - ' . $creator);
        $this->SetTitle($documentData["document"]["typeLabel"]);
        $this->SetSubject($documentData["document"]["typeLabel"]);

        // Marges
        $this->SetMargins(self::MARGIN_LEFT, self::MARGIN_TOP, self::MARGIN_RIGHT);
        $this->SetFooterMargin(self::MARGIN_FOOTER);
        $this->setPrintHeader(true);
        $this->setPrintFooter(true);

        // Désactiver le page break automatique (géré manuellement)
        $this->SetAutoPageBreak(false);

        $this->generate();
    }

    /**
     * Génère le document PDF complet
     *
     * @return self
     * @throws \Exception
     */
    private function generate()
    {
        try {
            $this->AddPage();

            $this->generateInvoiceInfo();
            $this->generateItems();
            $this->addFrames();
            $this->addLegalNotices();

            // Éléments financiers uniquement pour certains types de documents
            if (!in_array($this->documentData["document"]["type"], ['custdeliverynote', 'supplierdeliverynote'])) {
                $this->addPaymentInfo();
                $this->addTotals();
                $this->addPaymentHistory();
                $this->addSignature();
            }

            return $this;
        } catch (\Exception $e) {
            throw new \Exception("Erreur lors de la génération du PDF : " . $e->getMessage());
        }
    }

    /**
     * Génère l'en-tête du document sur chaque page
     */
    public function Header()
    {
        $this->setCellPaddings(0, 0, 0, 0);
        $documentHeader = $this->documentData["document"]["header"];
        $logoPath = $this->documentData["company"]["info"]["logo_printable"] ?? null;

        // Logo et nom de l'entreprise
        if ($logoPath && file_exists($logoPath)) {
            $imageH = $this->getPage() == 1 ? 20 : 15;
            $this->Image($logoPath, '', 5, '', $imageH, '', '', '', true, 300, '', false, false, 0);
        }

        $this->setFont('dejavusans', 'B', 12);
        $this->MultiCell(0, 0, "{$this->documentData["document"]["typeLabel"]} {$documentHeader["number"]}", '', 'R', false, 1, 120, '10', true);

        $this->SetFont('dejavusans', '', 10);
        $this->MultiCell(45, 4, "Page : " . $this->getPage() . " /", '', 'R', false, 0, 150, '', '', '', true);
        $this->MultiCell(12, 4, $this->getAliasNbPages(), '', 'R', false, 1, '', '', '', '', false);
        $this->bottomHeader = $this->GetY();
    }

    /**
     * Génère les informations principales du document (date, client, etc.)
     */
    private function generateInvoiceInfo()
    {
        $documentHeader = $this->documentData["document"]["header"];

        $line_height = 4;
        $label_with = 32;
        $field_with = 70;
        $front_size = 10;

        $validDate = isset($documentHeader["valid"]) && !empty($documentHeader["valid"]) && $documentHeader["valid"] != "0000-00-00"
            ? date("d/m/Y", strtotime($documentHeader["valid"]))
            : "";

        $defaultPtrFullAdress = $documentHeader["ptr_address"] . chr(10) . $documentHeader["ptr_zip"] . " " . $documentHeader["ptr_city"];
        $ptrFullAdress = isset($documentHeader["ptr_fulladdress"]) && !empty($documentHeader["ptr_fulladdress"])
            ? $documentHeader["ptr_fulladdress"]
            : $defaultPtrFullAdress;

        $labels = [
            "saleorder" => "Validité ",
            "salequotation" => "Validité du devis",
            "purchaseorder" => "Livraison estimée",
            "invoice" => "Echéance",
            "custcontract" => "Contrat",
        ];

        $this->SetTextColor(0, 0, 0);
        $this->setY(40);
        $this->SetFont('dejavusans', '', $front_size);
        $this->MultiCell($label_with, $line_height, 'Date', '', 'L', false, 0, '', '', true);
        $this->MultiCell($field_with, $line_height, ' : ' . date("d/m/Y", strtotime($documentHeader["date"])), '', 'L', false, 1, '', '', true);

        if (!in_array($this->documentData["document"]["type"], ['custdeliverynote', 'supplierdeliverynote'])) {
            $typeLabel = $labels[$this->documentData["document"]["type"]] ?? "Validité";
            $this->MultiCell($label_with, $line_height, $typeLabel, '', 'L', false, 0, '', '', true);
            $this->MultiCell($field_with, $line_height, ' : ' . $validDate, '', 'L', false, 1, '', '', true);

            $this->MultiCell($label_with, $line_height, 'Mode règlement', '', 'L', false, 0, '', '', true);
            $this->MultiCell($field_with, $line_height, ' : ' . ($documentHeader["payment_mode"] ?? ''), '', 'L', false, 1, '', '', true);

            $this->MultiCell($label_with, $line_height, 'Délais règlement', '', 'L', false, 0, '', '', true);
            $this->MultiCell($field_with, $line_height, ' : ' . ($documentHeader["payment_condition"] ?? ''), '', 'L', false, 1, '', '', true);

            if (!empty($documentHeader["ref"])) {
                $this->MultiCell($label_with, $line_height, 'Réf ', '', 'L', false, 0, '', '', true);
                $this->MultiCell($field_with, $line_height, ' : ' . $documentHeader["ref"], '', 'L', false, 1, '', '', true);
            }

            if (isset($documentHeader["commitment"]) && !empty($documentHeader["commitment"])) {
                $this->MultiCell($label_with, $line_height, "Votre engagement", '', 'L', false, 0, '', '', true);
                $this->MultiCell($field_with, $line_height, ' : ' . $documentHeader["commitment"], '', 'L', false, 1, '', '', true);
            }
        }

        $this->SetLineStyle(array('width' => 0.1, 'cap' => 'butt', 'join' => 'miter', 'dash' => 0, 'color' => $this->lineColor));
        $this->RoundedRect(10, 39, 90, 33, 2.50, '1000');

        $this->setXY(110, 40);
        $this->SetFont('dejavusans', 'B', $front_size + 1);
        $this->MultiCell(0, 0, $documentHeader["ptr_name"], '', 'L', false, 1, '', '', true);
        $this->setX(110);
        $this->SetFont('dejavusans', '', $front_size + 1);
        $this->MultiCell(0, 0, $ptrFullAdress, '', 'L', false, 1, '', '', true);
    }

    /**
     * Génère les lignes du document (produits/services)
     */
    private function generateItems()
    {
        $documentLines = $this->documentData["document"]["lines"];
        $colsW = ["desc" => 118, "tva" => 12, "qty" => 12, "priceunitht" => 24, "mtht" => 24];

        // Ajouter la colonne discount si nécessaire
        if (array_sum(array_column($documentLines, "discount")) > 0) {
            $rem = 16;
            $colsW["desc"] -= $rem;
            $colsW = [
                "desc" => $colsW["desc"],
                "tva" => $colsW["tva"],
                "qty" => $colsW["qty"],
                "priceunitht" => $colsW["priceunitht"],
                "rem" => $rem,
                "mtht" => $colsW["mtht"],
            ];
        }

        // Colonnes spécifiques pour les bons de livraison
        if (in_array($this->documentData["document"]["type"], ['custdeliverynote', 'supplierdeliverynote'])) {
            $hasRemaining = array_sum(array_column($documentLines, "qty_remaining")) > 0;
            if ($hasRemaining) {
                $colsW = ["desc" => 124, "qty_ordered" => 22, "qty" => 22, "qty_remaining" => 22];
            } else {
                $colsW = ["desc" => 146, "qty_ordered" => 22, "qty" => 22];
            }
        }

        $sumColsW = 0;
        foreach ($colsW as $key => $colW) {
            $sumColsW += $colW;
        }
        $colsW["sumColsW"] = $sumColsW;
        $this->colsW = $colsW;

        $totaltax = [];
        $this->setCellPaddings(1, 2, 1, 2);
        $this->setCellHeightRatio(1.2);

        $defaultStringHeight = 5;
        $separatorLine = false;

        $this->setY($this->topYFrameFirstPage + self::HEADER_TABLE_H);
        $addPage = false;
        $finalyAddPage = false;
        $valign = 'T';

        // Déterminer la dernière colonne active
        $colsKeys = array_keys($this->colsW);
        $lastActiveCol = $colsKeys[count($colsKeys) - 2]; // Avant-dernier = dernier avant "sumColsW"

        foreach ($documentLines as $line) {
            $curPage = $this->getPage();

            $html = $line["prtlib"];
            $html .= !empty($line["prtdesc"]) ? $line["prtdesc"] : "";

            // Ajouter les numéros de lot et série pour les bons de livraison
            if (in_array($this->documentData["document"]["type"], ['custdeliverynote', 'supplierdeliverynote'])) {
                $lotSerialInfo = [];
                if (!empty($line["lot_number"])) {
                    $lotSerialInfo[] = "N° Lot : " . $line["lot_number"];
                }
                if (!empty($line["serial_number"])) {
                    $lotSerialInfo[] = "N° Série : " . $line["serial_number"];
                }
                if (!empty($lotSerialInfo)) {
                    $html .= "<br><span style=\"font-size:8px;color:#666666;\">" . implode(" | ", $lotSerialInfo) . "</span>";
                }
            }

            // Calcul de la hauteur et gestion du page break
            $heightInfo = $this->calculateCellHeight($html, $colsW["desc"], $defaultStringHeight, $curPage);
            $finalyAddPage = $heightInfo['finalyAddPage'];
            $addPage = $heightInfo['addPage'];
            $endY = $heightInfo['endY'];
            $stringHeight = $heightInfo['stringHeight'];

            $this->setX($this->getMargins()["left"]);

            switch ($line["type"]) {
                case 1: // Titre
                    $this->setCellMargins(0, 0, 0, 1);
                    $this->SetFont('dejavusans', 'B', 9);
                    $this->SetFillColorArray(self::COLOR_GRAY);
                    $this->MultiCell(0, $stringHeight, $html, '', 'L', true, 1, '', '', true, 0, true, true, $stringHeight, $valign);
                    break;

                case 2: // Sous-total
                    $this->setCellMargins(0, 0, 0, 1);
                    $this->SetFont('dejavusans', 'B', 9);
                    $this->SetFillColorArray(self::COLOR_GRAY);
                    $this->MultiCell($colsW["sumColsW"] - $colsW["mtht"], $stringHeight, $html, '', 'L', true, 0, '', '', true, 0, true, true, $stringHeight, $valign);
                    $this->MultiCell($colsW["mtht"], $stringHeight, $this->formatCurrency($line["mtht"]), '', 'R', true, 1, '', '', true, 0, true, $stringHeight, $valign);
                    break;

                default: // Ligne normale
                    $this->setCellMargins(0, 0, 0, 1);
                    $this->SetFont('dejavusans', '', 9);

                    // Ligne de séparation
                    if ($separatorLine) {
                        $lineY = $this->GetY();
                        $separatorlineStyle = array('width' => 0.1, 'cap' => 'butt', 'join' => 'miter', 'dash' => 2, 'color' => array(102, 102, 102));
                        $this->Line($this->getMargins()["left"], $lineY, $colsW["sumColsW"] + $this->getMargins()["left"], $lineY, $separatorlineStyle);
                    }
                    $separatorLine = true;

                    $this->MultiCell($colsW["desc"], $stringHeight, $html, '', 'L', false, ($lastActiveCol === 'desc'), '', '', true, '', true, true, $stringHeight, $valign);

                    if (isset($this->colsW["tva"])) {
                        $tva = !empty($line["tax"]) ? $line["tax"] : 0;
                        $lineTva = $line["mtht"] * $tva / 100;
                        $totaltax[strval($tva)] = isset($totaltax[strval($tva)]) ? $totaltax[strval($tva)] + $lineTva : $lineTva;
                        $this->MultiCell($colsW["tva"], $stringHeight, $tva . " %", '', 'R', false, ($lastActiveCol === 'tva'), '', '', true, '', '', true, $stringHeight, $valign);
                    }

                    if (isset($this->colsW["qty_ordered"])) {
                        $qtyOrdered = !empty($line["qty_ordered"]) ? $line["qty_ordered"] : "";
                        $this->MultiCell($colsW["qty_ordered"], $stringHeight, $qtyOrdered, '', 'C', false, ($lastActiveCol === 'qty_ordered'), '', '', true, '', '', true, $stringHeight, $valign);
                    }

                    $qty = !empty($line["qty"]) ? $line["qty"] : "";
                    $this->MultiCell($colsW["qty"], $stringHeight, $qty, '', 'C', false, ($lastActiveCol === 'qty'), '', '', true, '', '', true, $stringHeight, $valign);

                    if (isset($this->colsW["qty_remaining"])) {
                        $qtyRemaining = isset($line["qty_remaining"]) && $line["qty_remaining"] > 0 ? $line["qty_remaining"] : "";
                        $this->MultiCell($colsW["qty_remaining"], $stringHeight, $qtyRemaining, '', 'C', false, ($lastActiveCol === 'qty_remaining'), '', '', true, '', '', true, $stringHeight, $valign);
                    }

                    if (isset($this->colsW["priceunitht"])) {
                        $this->MultiCell($colsW["priceunitht"], $stringHeight, $this->formatCurrency($line["priceunitht"]), '', 'R', false, ($lastActiveCol === 'priceunitht'), '', '', true, '', '', true, $stringHeight, $valign);
                    }

                    if (isset($this->colsW["rem"])) {
                        $rem = $line["discount"] == 100 ? "offert" : $this->formatCurrency($line["discount"]) . " %";
                        $this->MultiCell($colsW["rem"], $stringHeight, $rem, '', 'R', false, ($lastActiveCol === 'rem'), '', '', true, '', '', true, $stringHeight, $valign);
                    }

                    if (isset($this->colsW["mtht"])) {
                        $this->MultiCell($colsW["mtht"], $stringHeight, $this->formatCurrency($line["mtht"]), '', 'R', false, ($lastActiveCol === 'mtht'), '', '', true, '', '', true, $stringHeight, $valign);
                    }
                    break;
            }

            if ($addPage == true) {
                $this->AddPage();
                $this->setY($endY);
            }
        }

        if ($finalyAddPage == true) {
            $this->AddPage();
        }

        $this->totals["totaltax"] = $totaltax;
        $this->setCellHeightRatio(1.2);
    }

    /**
     * Calcule la hauteur d'une cellule et gère les sauts de page
     */
    private function calculateCellHeight($html, $colWidth, $defaultHeight, $curPage)
    {
        // Premier test sans AutoPageBreak
        $this->startTransaction();
        $startY = $this->GetY();
        $this->MultiCell($colWidth, $defaultHeight, $html, 1, 'L', false, 1, '', '', true, 0, true, true);
        $endY = $this->GetY();
        $nextPage = $this->getPage();
        $this->rollbackTransaction(true);

        // Déterminer la limite de page
        $pageLimit = ($nextPage > $curPage) ? self::BOTTOM_FRAMES_OTHERS_PAGES : self::BOTTOM_FRAMES_LAST_PAGE;
        $marginBottom = $this->getPageHeight() - $pageLimit;
        $this->SetAutoPageBreak(true, $marginBottom);

        // Second test avec AutoPageBreak
        $this->startTransaction();
        $startY = $this->GetY();
        $this->MultiCell($colWidth, $defaultHeight, $html, 1, 'L', false, 1, '', '', true, 0, true, true);
        $endY = $this->GetY();
        $stringHeight = $endY - $startY;
        $nextPage = $this->getPage();
        $this->rollbackTransaction(true);

        return [
            'stringHeight' => $stringHeight,
            'endY' => $endY,
            'addPage' => $nextPage > $curPage,
            'finalyAddPage' => $nextPage > $curPage
        ];
    }

    /**
     * Ajoute les cadres du tableau sur toutes les pages
     */
    function addFrames()
    {
        $numPages = $this->getNumPages();

        for ($i = 1; $i <= $numPages; $i++) {
            $this->setPage($i);
            $this->addFrame();
        }
    }

    /**
     * Ajoute le cadre du tableau sur une page
     */
    function addFrame()
    {
        $numPages = $this->getNumPages();
        $currentPage = $this->getPage();
        $topY = $currentPage == 1 ? $this->topYFrameFirstPage : $this->topYFrameOtherPage;
        $bottomY = $currentPage == $numPages ? self::BOTTOM_FRAMES_LAST_PAGE : self::BOTTOM_FRAMES_OTHERS_PAGES;

        $tableHeaderH = self::HEADER_TABLE_H;
        $lineStyle = array('width' => 0.1, 'cap' => 'butt', 'join' => 'miter', 'dash' => 0, 'color' => $this->lineColor);
        $this->SetLineStyle($lineStyle);
        $this->setY($topY);
        $this->SetFont('dejavusans', '', 10);
        $this->setCellMargins(0, 0, 0, 0);
        $this->SetFillColor(248, 248, 248);

        // En-tête du tableau
        $isDeliveryNote = in_array($this->documentData["document"]["type"], ['custdeliverynote', 'supplierdeliverynote']);

        $this->MultiCell($this->colsW["desc"], $tableHeaderH, 'Désignation ', '', 'C', true, 0, '', '', true, '', '', '', $tableHeaderH, 'M');
        if (isset($this->colsW["tva"])) {
            $this->MultiCell($this->colsW["tva"], $tableHeaderH, 'TVA', 'L', 'C', true, 0, '', '', true, '', '', '', $tableHeaderH, 'M');
        }
        if (isset($this->colsW["qty_ordered"])) {
            $this->MultiCell($this->colsW["qty_ordered"], $tableHeaderH, 'Qté Cdée', 'L', 'C', true, 0, '', '', true, '', '', '', $tableHeaderH, 'M');
        }
        $qtyLabel = $isDeliveryNote ? 'Qté Livrée' : 'Qté';
        $this->MultiCell($this->colsW["qty"], $tableHeaderH, $qtyLabel, 'L', 'C', true, 0, '', '', true, '', '', '', $tableHeaderH, 'M');
        if (isset($this->colsW["qty_remaining"])) {
            $this->MultiCell($this->colsW["qty_remaining"], $tableHeaderH, 'Reliquat', 'L', 'C', true, 0, '', '', true, '', '', '', $tableHeaderH, 'M');
        }
        if (isset($this->colsW["priceunitht"])) {
            $this->MultiCell($this->colsW["priceunitht"], $tableHeaderH, 'Px Unit H.T.', 'L', 'C', true, 0, '', '', true, '', '', '', $tableHeaderH, 'M');
        }
        if (isset($this->colsW["rem"]) && $this->colsW["rem"] > 0) {
            $this->MultiCell($this->colsW["rem"], $tableHeaderH, '% Rem.', 'L', 'C', true, 0, '', '', true, '', '', '', $tableHeaderH, 'M');
        }
        if (isset($this->colsW["mtht"])) {
            $this->MultiCell($this->colsW["mtht"], $tableHeaderH, 'Montant H.T.', 'L', 'C', true, 1, '', '', true, '', '', '', $tableHeaderH, 'M');
        }

        // Ligne horizontale bas de l'entête
        $x = $this->getMargins()["left"];
        $this->Line($x, $topY + $tableHeaderH, $x + $this->colsW["sumColsW"], $topY + $tableHeaderH, $lineStyle);

        // Lignes verticales
        $cols_array = array_values($this->colsW);
        $num_cols = count($cols_array) - 1;
        for ($i = 0; $i < $num_cols; $i++) {
            $colW = $cols_array[$i];
            $this->Line($x, $topY, $x, $bottomY, $lineStyle);
            $x += $colW;
        }

        // Cadre principal
        $this->RoundedRect($this->getMargins()["left"], $topY, $this->colsW["sumColsW"], $bottomY - $topY, 2.50, '1000');
    }

    /**
     * Ajoute les mentions légales
     */
    function addLegalNotices()
    {
        $this->SetAutoPageBreak(false);
        $this->setPage($this->getNumPages());
        $this->SetY(self::BOTTOM_FRAMES_LAST_PAGE + 0.5);

        $this->SetFont('dejavusans', '', 6);
        $this->setCellPaddings(0, 0, 0, 0);
        $this->setCellMargins(0, 0, 0, 0);
        $txt = $this->documentData["sale"]["conf"]["sco_sale_legal_notice"] ?? '';
        $this->writeHTMLCell(100, 0, '', '', $txt, 0, 1, false, true, 'L');
    }

    /**
     * Ajoute les informations de paiement (coordonnées bancaires)
     */
    private function addPaymentInfo()
    {
        $this->setPage($this->getNumPages());
        $this->SetY(self::BOTTOM_FRAMES_LAST_PAGE + 11);
        $bankInfo = $this->documentData["company"]["bank"] ?? [];

        if (empty($bankInfo)) {
            return;
        }

        $this->SetFont('dejavusans', 'B', 8);
        $this->setCellPaddings(0, 0, 0, 0);
        $this->Cell(0, 0, 'Nos coordonnées bancaires :', 0, 1, 'L');
        $this->SetLineStyle(array('width' => 0.1, 'cap' => 'butt', 'join' => 'miter', 'dash' => 0, 'color' => array(102, 102, 102)));

        $this->setCellPaddings(0, 0, 0, 1);
        $this->SetFont('dejavusans', '', 6);
        $this->MultiCell(16, 0, "Code banque", 'LR', 'C', true, 0);
        $this->MultiCell(16, 0, "Code guichet", 'R', 'C', false, 0);
        $this->MultiCell(24, 0, "Numéro de compte", 'R', 'C', false, 0);
        $this->MultiCell(10, 0, "Clé", 'R', 'C', false, 1);

        $this->SetFont('dejavusans', '', 8);
        $this->MultiCell(16, 0, $bankInfo['bts_bank_code'] ?? '', 'LR', 'C', true, 0);
        $this->MultiCell(16, 0, $bankInfo['bts_sort_code'] ?? '', 'R', 'C', false, 0);
        $this->MultiCell(24, 0, $bankInfo['bts_account_nbr'] ?? '', 'R', 'C', false, 0);
        $this->MultiCell(10, 0, $bankInfo['bts_bban_key'] ?? '', 'R', 'C', false, 1);

        $this->SetFont('dejavusans', '', 6);
        $this->setCellPaddings(0, 0, 0, 0);
        $this->MultiCell(62, 0, "Banque : " . ($bankInfo['bts_label'] ?? ''), '', 'L', false, 1);
        $this->MultiCell(62, 0, "IBAN : " . ($bankInfo['bts_iban'] ?? ''), '', 'L', false, 1);
        $this->MultiCell(62, 0, "BIC/SWIFT : " . ($bankInfo['bts_bic'] ?? ''), '', 'L', false, 1);
    }

    /**
     * Ajoute les totaux (HT, TVA, TTC, etc.)
     */
    private function addTotals()
    {
        $this->setPage($this->getNumPages());
        $colsW = $this->colsW;
        $documentHeader = $this->documentData["document"]["header"];
        $posY = self::BOTTOM_FRAMES_LAST_PAGE + 1;
        $posX = $colsW["desc"] + $this->getMargins()["left"];
        $label_with = $this->getPageWidth() - $posX - $this->getMargins()["right"] - $colsW["mtht"];
        $line_height = 7;

        $totalHT = !empty($documentHeader["totalht"]) ? $documentHeader["totalht"] : 0;
        $totalHTSub = isset($documentHeader["totalhtsub"]) && !empty($documentHeader["totalhtsub"]) ? $documentHeader["totalhtsub"] : 0;
        $totalHTComm = isset($documentHeader["totalhtcomm"]) && !empty($documentHeader["totalhtcomm"]) ? $documentHeader["totalhtcomm"] : 0;
        $totalTTC = !empty($documentHeader["totalttc"]) ? $documentHeader["totalttc"] : 0;
        $totalRemaining = !empty($documentHeader["amount_remaining"]) ? $documentHeader["amount_remaining"] : 0;

        $totalHTSub = $this->formatCurrency($totalHTSub);
        $totalHTComm = $this->formatCurrency($totalHTComm);
        $totalHT = $this->formatCurrency($totalHT);
        $totalTTC = $this->formatCurrency($totalTTC);
        $totalRemaining = $this->formatCurrency($totalRemaining);

        $this->SetY($posY);
        $this->SetX($posX);
        $this->SetFont('dejavusans', '', 10);
        $this->setCellPaddings(1, 2, 1, 2);

        $this->SetFillColorArray(self::COLOR_GRAY);
        if (isset($documentHeader["commitment"]) && !empty($documentHeader["commitment"])) {
            $this->MultiCell($label_with, $line_height, 'Total Abonnement HT', '', 'L', false, 0, $posX, '', true, '', '', '', $line_height, 'M');
            $this->MultiCell($colsW["mtht"], $line_height, $totalHTSub . " €", '', 'R', false, 1, '', '', true, '', '', '', $line_height, 'M');
            $this->MultiCell($label_with, $line_height, 'Total Mise en service HT', '', 'L', false, 0, $posX, '', true, '', '', '', $line_height, 'M');
            $this->MultiCell($colsW["mtht"], $line_height, $totalHTComm . " €", '', 'R', false, 1, '', '', true, '', '', '', $line_height, 'M');
            $this->MultiCell(0, 1, "", 'B', 'R', false, 1, $posX, '', true, '', '', '', 1, 'M');
        }

        $this->MultiCell($label_with, $line_height, 'Total HT', '', 'L', false, 0, $posX, '', true, '', '', '', $line_height, 'M');
        $this->MultiCell($colsW["mtht"], $line_height, $totalHT . " €", '', 'R', false, 1, '', '', true, '', '', '', $line_height, 'M');

        if (isset($this->totals["totaltax"]) && !empty($this->totals["totaltax"])) {
            $tax_array = $this->totals["totaltax"];
            foreach ($tax_array as $tx => $mt) {
                $tva = $this->formatCurrency($mt);
                $this->SetFillColorArray(self::COLOR_LIGHT_GRAY);
                $this->MultiCell($label_with, $line_height, "Total TVA $tx%", '', 'L', true, 0, $posX, '', true, '', '', '', $line_height, 'M');
                $this->MultiCell($colsW["mtht"], $line_height, $tva . " €", '', 'R', true, 1, '', '', true, '', '', '', $line_height, 'M');
            }
        }

        $this->SetFont('dejavusans', 'B', 11);
        $this->SetFillColorArray(array(223, 223, 223));
        $this->MultiCell($label_with, $line_height, 'Total TTC', '', 'L', true, 0, $posX, '', true, '', '', '', $line_height, 'M');
        $this->MultiCell($colsW["mtht"], $line_height, $totalTTC . " €", '', 'R', true, 1, '', '', true, '', '', '', $line_height, 'M');
        $y = $this->GetY();

        $this->SetLineStyle(array('width' => 0.1, 'cap' => 'butt', 'join' => 'miter', 'dash' => 0, 'color' => $this->lineColor));
        $this->RoundedRect($posX, self::BOTTOM_FRAMES_LAST_PAGE + 1, $this->getPageWidth() - $posX - $this->getMargins()["right"], $y - $posY, 2.50, '1000');

        if (in_array($this->documentData["document"]["type"], ["invoice", "custinvoice", "custrefund", "supplierinvoice", "supplierrefund"])) {
            $this->setCellMargins(0, 2, 0, 0);
            $this->SetFillColorArray(array(223, 223, 223));
            $this->MultiCell($label_with, $line_height, 'Reste à payer', '', 'L', true, 0, $posX, '', true, '', '', '', $line_height, 'M');
            $this->MultiCell(0, $line_height, $totalRemaining . " €", '', 'R', true, 1, '', '', true, '', '', '', $line_height, 'M');
        }

        $this->bottomTotalY = $this->GetY();
    }

    /**
     * Ajoute l'historique des paiements
     */
    private function addPaymentHistory()
    {
        $this->setPage($this->getNumPages());
        $posY = self::BOTTOM_FRAMES_LAST_PAGE + 36;
        $posX = $this->getMargins()["left"];
        $line_height = 4;

        if (!isset($this->documentData["document"]["payment"]) || count($this->documentData["document"]["payment"]) == 0) {
            return;
        }

        $this->SetY($posY);
        $this->SetX($posX);

        $this->SetFont('dejavusans', '', 8);
        $this->setCellPaddings(0, 0, 0, 0);
        $this->setCellMargins(0, 0, 0, 0);
        $this->SetLineStyle(array('width' => 0.1, 'cap' => 'butt', 'join' => 'miter', 'dash' => 0, 'color' => array(102, 102, 102)));
        $this->MultiCell(0, 5, 'Règlement déjà effectués :', 0, 'L', false, 1, $posX, $posY);

        $this->SetFont('dejavusans', 'B', 7);
        $this->MultiCell(20, $line_height, "Date", 'R', 'C', false, 0, $posX);
        $this->MultiCell(25, $line_height, "Montant", 'R', 'C', false, 0);
        $this->MultiCell(30, $line_height, "Mode", '', 'C', false, 1);

        $this->SetFont('dejavusans', '', 7);
        $this->setCellPaddings(1, 0, 1, 0);
        foreach ($this->documentData["document"]["payment"] as $payment) {
            $this->MultiCell(20, $line_height, date("d/m/Y", strtotime($payment['date'])), 'R', 'C', false, 0, $posX);
            $this->MultiCell(25, $line_height, $this->formatCurrency($payment['amount']), 'R', 'R', false, 0);
            $this->MultiCell(30, $line_height, $payment['mode'], '', 'L', false, 1);
        }
    }

    /**
     * Ajoute la signature numérique si présente
     */
    private function addSignature()
    {
        $this->setPage($this->getNumPages());
        $documentHeader = $this->documentData["document"]["header"];

        if (isset($documentHeader["validation_data"]) && !empty($documentHeader["validation_data"])) {
            $checkPath = public_path("images/check_vert_100x55.png");
            $valiationData = json_decode($documentHeader["validation_data"], true);
            $serverTime = date("d/m/Y H:i", strtotime($valiationData["serverTime"]));
            $name = $valiationData["name"];
            $ip = $valiationData["ip"];

            $posY = $this->bottomTotalY + 4;
            $posX = 114 + 10;
            $line_height = 4;

            if (file_exists($checkPath)) {
                $this->Image($checkPath, $posX + 10, $posY, 12, 12, 'PNG');
            }

            $this->SetY($posY);
            $this->SetX($posX);

            $this->SetFont('dejavusans', '', 8);
            $this->setCellPaddings(0, 0, 0, 0);
            $this->setCellMargins(0, 0, 0, 0);
            $this->SetLineStyle(array('width' => 0.1, 'cap' => 'butt', 'join' => 'miter', 'dash' => 0, 'color' => array(102, 102, 102)));
            $this->MultiCell(0, $line_height, "Signé numériquement : $name ", 0, 'L', false, 1, $posX, $posY);
            $this->MultiCell(0, $line_height, "Date : $serverTime", 0, 'L', false, 1, $posX);
            $this->MultiCell(0, $line_height, "IP : $ip", 0, 'L', false, 1, $posX);
        }
    }

    /**
     * Génère le pied de page avec les informations de l'entreprise
     */
    public function Footer()
    {
        $companyInfo = $this->documentData["company"]["info"];
        $this->setCellPaddings(0, 0, 0, 0);
        $this->SetFont('dejavusans', '', 8);

        $footerLine1 = "{$companyInfo["cop_label"]} - {$companyInfo["cop_address"]} {$companyInfo["cop_zip"]} {$companyInfo["cop_city"]} - Tél : {$companyInfo["cop_phone"]} ";
        $footerLine2 = "{$companyInfo["cop_legal_status"]} au capital de {$companyInfo["cop_capital"]} Euros - SIRET {$companyInfo["cop_registration_code"]} - APE : {$companyInfo["cop_naf_code"]} - RCS : {$companyInfo["cop_rcs"]} - TVA INTRA : {$companyInfo["cop_tva_code"]}";

        $this->MultiCell('', 0, $footerLine1 . "\n" . $footerLine2, '', 'C', false, 0, '', '', true, '', false, '', 0, 'M');
    }

    /**
     * Formate un montant en devise
     *
     * @param float $amount
     * @return string
     */
    private function formatCurrency($amount)
    {
        return number_format((float)$amount, 2, ',', ' ');
    }
}
