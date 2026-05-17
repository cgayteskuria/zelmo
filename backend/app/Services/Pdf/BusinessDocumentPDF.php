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
    private $headerPageLineY = [];
    private $topYFrameFirstPage = 75;
    private $topYFrameOtherPage = 30;

    private $lineColor;
    private $bottomTotalY;
    private $bankInfoEndY;

    const BOTTOM_FRAMES_LAST_PAGE = 218;
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
                $this->addSubscriptionClause();
                $this->addTotals();
                $this->addPaymentHistory();
                $this->addSignature();
            } else {
                $this->addSubscriptionClause();
            }

            $this->addPageNumbers();

            return $this;
        } catch (\Exception $e) {
            throw new \Exception("Erreur lors de la génération du PDF : " . $e->getMessage());
        }
    }

    /**
     * Écrit le nombre total de pages dans l'en-tête de chaque page.
     * L'alias TCPDF ne fonctionne pas avec les polices TrueTypeUnicode (UTF-16BE),
     * on revient donc sur chaque page après génération complète.
     */
    private function addPageNumbers(): void
    {
        $totalPages = $this->getNumPages();
        $currentPage = $this->getPage();
        for ($i = 1; $i <= $totalPages; $i++) {
            $this->setPage($i);
            $this->SetFont('dejavusans', '', 10);
            $y = $this->headerPageLineY[$i] ?? null;
            $this->MultiCell(57, 4, "Page : {$i} / {$totalPages}", '', 'R', false, 1, 150, $y, '', '', false);
        }
        $this->setPage($currentPage);
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
        $this->headerPageLineY[$this->getPage()] = $this->GetY();
    }

    /**
     * Génère les informations principales du document (date, client, etc.)
     */
    private function generateInvoiceInfo()
    {
        $documentHeader = $this->documentData["document"]["header"];

        $line_height = 4;
        $label_with = 35;
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
            "salequotation" => "Validité",
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

            if (!empty($documentHeader["commitment"])) {
                $this->MultiCell($label_with, $line_height, "Engagement", '', 'L', false, 0, '', '', true);
                $this->MultiCell($field_with, $line_height, ' : ' . $documentHeader["commitment"], '', 'L', false, 1, '', '', true);
            }
            if (!empty($documentHeader["renew"])) {
                $this->MultiCell($label_with, $line_height, "Reconduction", '', 'L', false, 0, '', '', true);
                $this->MultiCell($field_with, $line_height, ' : ' . $documentHeader["renew"], '', 'L', false, 1, '', '', true);
            }
            if (!empty($documentHeader["notice"])) {
                $this->MultiCell($label_with, $line_height, "Préavis", '', 'L', false, 0, '', '', true);
                $this->MultiCell($field_with, $line_height, ' : ' . $documentHeader["notice"], '', 'L', false, 1, '', '', true);
            }
            if (!empty($documentHeader["invoicing"])) {
                $this->MultiCell($label_with, $line_height, "Périodicité", '', 'L', false, 0, '', '', true);
                $this->MultiCell($field_with, $line_height, ' : ' . $documentHeader["invoicing"], '', 'L', false, 1, '', '', true);
            }
        }

        // Cadre adaptatif : grandit si les champs d'abonnement sont présents
        $boxHeight = max(33, $this->GetY() - 39 + 3);
        // Repousser le début du tableau si le cadre empiète dessus
        if (39 + $boxHeight + 2 > $this->topYFrameFirstPage) {
            $this->topYFrameFirstPage = 39 + $boxHeight + 2;
        }
        $this->SetLineStyle(array('width' => 0.1, 'cap' => 'butt', 'join' => 'miter', 'dash' => 0, 'color' => $this->lineColor));
        $this->RoundedRect(10, 39, 90, $boxHeight, 2.50, '1000');

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
        $valign = 'T';

        // Déterminer la dernière colonne active
        $colsKeys = array_keys($this->colsW);
        $lastActiveCol = $colsKeys[count($colsKeys) - 2]; // Avant-dernier = dernier avant "sumColsW"

        $totalLines = count($documentLines);
        // Si le dernier item est un sous-total (type 2), l'item avant lui doit aussi
        // utiliser la limite de la dernière page pour rester groupé avec son sous-total.
        $lastLineType = $totalLines > 0 ? $documentLines[$totalLines - 1]['type'] : 0;

        foreach ($documentLines as $idx => $line) {
            $curPage = $this->getPage();
            $isLastItem = ($idx === $totalLines - 1)
                || ($lastLineType == 2 && $idx === $totalLines - 2);

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
            $heightInfo = $this->calculateCellHeight($html, $colsW["desc"], $defaultStringHeight, $curPage, $isLastItem);
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

                    $qty = !empty($line["qty"]) ? number_format((float)$line["qty"], 2, ',', ' ') : "";
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

        }

        $this->SetAutoPageBreak(false);
        $this->totals["totaltax"] = $totaltax;
        $this->setCellHeightRatio(1.2);
    }

    /**
     * Calcule la hauteur d'une cellule et gère les sauts de page
     */
    private function calculateCellHeight($html, $colWidth, $defaultHeight, $curPage, $isLastItem = true)
    {
        $pageHeight = $this->getPageHeight();

        // Premier test AVEC AutoPageBreak (limite OTHERS) pour détecter si le contenu
        // déborde naturellement sur une nouvelle page, indépendamment de l'état global.
        $this->startTransaction();
        $this->SetAutoPageBreak(true, $pageHeight - self::BOTTOM_FRAMES_OTHERS_PAGES);
        $this->MultiCell($colWidth, $defaultHeight, $html, 1, 'L', false, 1, '', '', true, 0, true, true);
        $nextPageTest = $this->getPage();
        $this->rollbackTransaction(true);

        // Si le contenu déborde la limite OTHERS, ou s'il reste d'autres items après :
        // la page courante ne sera pas la dernière → utiliser OTHERS (275).
        // Sinon c'est le dernier item et il tient → utiliser LAST_PAGE (218).
        $pageLimit = ($nextPageTest > $curPage || !$isLastItem)
            ? self::BOTTOM_FRAMES_OTHERS_PAGES
            : self::BOTTOM_FRAMES_LAST_PAGE;

        $marginBottom = $pageHeight - $pageLimit;
        $this->SetAutoPageBreak(true, $marginBottom);

        // Second test avec la limite correcte : calcul de la hauteur réelle
        $this->startTransaction();
        $startY = $this->GetY();
        $this->MultiCell($colWidth, $defaultHeight, $html, 1, 'L', false, 1, '', '', true, 0, true, true);
        $endY = $this->GetY();
        $stringHeight = $endY - $startY;
        $nextPage = $this->getPage();
        $this->rollbackTransaction(true);

        return [
            'stringHeight' => $stringHeight,
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
            if ($i < $numPages) {
                $this->addSignatureParaph();
            }
        }
    }

    /**
     * Ajoute le paraphe (image de signature) en bas de chaque page intermédiaire
     */
    private function addSignatureParaph(): void
    {
        $documentHeader = $this->documentData["document"]["header"];
        if (empty($documentHeader["validation_data"])) {
            return;
        }

        $validationData = json_decode($documentHeader["validation_data"], true);
        if (empty($validationData['signature_image'])) {
            return;
        }

        $imgData = base64_decode(preg_replace('#^data:image/\w+;base64,#i', '', $validationData['signature_image']));
        $tmpPath = sys_get_temp_dir() . '/sig_paraph_' . uniqid() . '.png';
        file_put_contents($tmpPath, $imgData);

        if (file_exists($tmpPath) && filesize($tmpPath) > 0) {
            $x = $this->getPageWidth() - $this->getMargins()['right'] - 38;
            $y = self::BOTTOM_FRAMES_OTHERS_PAGES - 11;
            $this->Image($tmpPath, $x, $y, 35, 9, 'PNG');
        }

        @unlink($tmpPath);
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
     * Ajoute la clause légale de reconduction tacite pour les abonnements.
     * S'affiche uniquement si le document contient des lignes d'abonnement.
     */
    private function addSubscriptionClause(): void
    {
        $documentHeader = $this->documentData["document"]["header"];

        if (empty($documentHeader["has_subscription"])) {
            return;
        }

        $this->SetAutoPageBreak(false);
        $this->setPage($this->getNumPages());

        $posX      = $this->getMargins()["left"];
        $width     = 95;
        $lh        = 3.0;
        $lineStyle = ['width' => 0.3, 'cap' => 'butt', 'join' => 'miter', 'dash' => 0, 'color' => [80, 80, 80]];

        $commitment = $documentHeader["commitment"] ?? '';
        $renew      = $documentHeader["renew"]      ?? '';
        $notice     = $documentHeader["notice"]     ?? '';
        $invoicing  = $documentHeader["invoicing"]  ?? '';

        // Position dynamique : s'appuie sur la fin des coordonnées bancaires
        $startY = isset($this->bankInfoEndY) ? $this->bankInfoEndY + 2 : self::BOTTOM_FRAMES_LAST_PAGE + 34;

        // Titre
        $this->SetFont('dejavusans', 'B', 7);
        $this->setCellPaddings(1, 1, 1, 1);
        $this->setCellMargins(0, 0, 0, 0);
        $this->SetFillColorArray([235, 235, 235]);
        $this->MultiCell($width, 5, 'CONDITIONS D\'ABONNEMENT', 0, 'L', true, 1, $posX, $startY, true);

        // Grille 2 colonnes : champ gauche | champ droit
        $this->SetFont('dejavusans', '', 6.5);
        $this->SetFillColor(255, 255, 255);
        $half = $width / 2;

        $rows = [
            ['Engagement initial', $commitment],
            ['Reconduction automatique', $renew],
            ['Préavis de résiliation', $notice],
            ['Périodicité de facturation', $invoicing],
        ];

        foreach ($rows as [$label, $value]) {
            if (empty($value)) {
                continue;
            }
            $this->setCellPaddings(1, 0.3, 1, 0.3);
            $this->MultiCell($half, $lh, $label . ' :', 0, 'L', false, 0, $posX);
            $this->SetFont('dejavusans', 'B', 6.5);
            $this->MultiCell($half, $lh, $value, 0, 'L', false, 1);
            $this->SetFont('dejavusans', '', 6.5);
        }

        // Texte légal
        $renewLabel  = $renew  ?: 'une durée équivalente';
        $noticeLabel = $notice ?: 'un préavis contractuel';
        $legalText = "Conformément à l'article L.215-3 du Code de la consommation, le présent abonnement sera "
            . "reconduit tacitement à l'issue de la période d'engagement pour une durée de {$renewLabel}. "
            . "Pour s'y opposer, le Client devra notifier sa résiliation par lettre recommandée avec accusé de réception "
            . "au moins {$noticeLabel} avant la date d'échéance de la période en cours.";

        $this->SetFont('dejavusans', 'I', 5.5);
        $this->setCellPaddings(1, 0.5, 1, 0.5);
        $this->MultiCell($width, $lh - 0.3, $legalText, 0, 'J', false, 1, $posX);

        $endY = $this->GetY();

        // Encadré autour de tout le bloc
        $this->SetLineStyle($lineStyle);
        $this->RoundedRect($posX, $startY, $width, $endY - $startY, 1.5, '1111');
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
            $this->bankInfoEndY = self::BOTTOM_FRAMES_LAST_PAGE + 11;
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

        $this->bankInfoEndY = $this->GetY();
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
            $checkPath     = public_path("images/check_vert_100x55.png");
            $validationData = json_decode($documentHeader["validation_data"], true);
            $serverTime    = date("d/m/Y H:i", strtotime($validationData["serverTime"]));
            $name          = $validationData["name"];
            $ip            = $validationData["ip"];

            $posY        = $this->bottomTotalY + 2;
            $posX        = 114 + 10;
            $line_height = 4;

            if (file_exists($checkPath)) {
                $this->Image($checkPath, $posX + 10, $posY, 12, 12, 'PNG');
            }

            // Embarquer l'image du paraphe dessiné si présente
            if (!empty($validationData['signature_image'])) {
                $imgData  = base64_decode(preg_replace('#^data:image/\w+;base64,#i', '', $validationData['signature_image']));
                $tmpPath  = sys_get_temp_dir() . '/sig_' . uniqid() . '.png';
                file_put_contents($tmpPath, $imgData);
                if (file_exists($tmpPath) && filesize($tmpPath) > 0) {
                    $this->Image($tmpPath, $posX + 25, $posY + 1, 40, 14, 'PNG');
                }
                @unlink($tmpPath);
            }

            $this->SetY($posY + 15);
            $this->SetX($posX);

            $this->SetFont('dejavusans', '', 8);
            $this->setCellPaddings(0, 0, 0, 0);
            $this->setCellMargins(0, 0, 0, 0);
            $this->SetLineStyle(array('width' => 0.1, 'cap' => 'butt', 'join' => 'miter', 'dash' => 0, 'color' => array(102, 102, 102)));
            $this->MultiCell(0, $line_height, "Signé numériquement : $name ", 0, 'L', false, 1, $posX);
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
