<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Contrôleur de base abstrait pour tous les documents (SaleOrder, PurchaseOrder, Invoice, Contract)
 *
 * Cette classe fournit les fonctionnalités CRUD communes pour les lignes de documents :
 * - getLines() : Récupérer toutes les lignes d'un document
 * - saveLine() : Créer ou mettre à jour une ligne
 * - deleteLine() : Supprimer une ligne
 * - updateLinesOrder() : Réorganiser les lignes (drag & drop)
 * - duplicate() : Dupliquer un document avec toutes ses lignes
 * - getLinkedObjects() : Récupérer les objets liés au document
 *
 * Les classes enfants doivent implémenter les méthodes abstraites pour définir
 * les modèles, clés, et mappings spécifiques à chaque type de document.
 */
abstract class ApiBizDocumentController extends Controller
{
    /**
     * Retourne le nom de la classe du modèle de document
     *
     * @return string Exemple: SaleOrderModel::class, PurchaseOrderModel::class
     */
    abstract protected function getDocumentModel(): string;

    /**
     * Retourne le nom de la classe du modèle de ligne
     *
     * @return string Exemple: SaleOrderLineModel::class, PurchaseOrderLineModel::class
     */
    abstract protected function getLineModel(): string;

    /**
     * Retourne le nom de la clé primaire du document
     *
     * @return string Exemple: 'ord_id', 'por_id', 'inv_id', 'con_id'
     */
    abstract protected function getDocumentPrimaryKey(): string;

    /**
     * Retourne le nom de la clé primaire de la ligne
     *
     * @return string Exemple: 'orl_id', 'pol_id', 'inl_id', 'col_id'
     */
    abstract protected function getLinePrimaryKey(): string;

    /**
     * Retourne le nom de la clé étrangère vers le document parent
     *
     * @return string Exemple: 'fk_ord_id', 'fk_por_id', 'fk_inv_id', 'fk_con_id'
     */
    abstract protected function getLineForeignKey(): string;

    /**
     * Retourne le nom de la relation pour accéder aux lignes du document
     *
     * @return string Exemple: 'lines'
     */
    abstract protected function getLinesRelationshipName(): string;

    /**
     * Retourne le mapping des champs pour la conversion frontend <-> backend
     *
     * Structure du mapping :
     * - Clés : Noms des champs dans les requêtes API (frontend)
     * - Valeurs : Noms des colonnes en base de données (backend)
     *
     * @return array Exemple:
     * [
     *     // Document fields
     *     'id' => 'ord_id',
     *     'number' => 'ord_number',
     *     'date' => 'ord_date',
     *     'status' => 'ord_status',
     *
     *     // Line fields
     *     'lineId' => 'orl_id',
     *     'fk_parent_id' => 'fk_ord_id',
     *     'lineOrder' => 'orl_order',
     *     'lineType' => 'orl_type',
     *     'fk_prt_id' => 'fk_prt_id',
     *     'fk_tax_id' => 'fk_tax_id',
     *     'qty' => 'orl_qty',
     *     'priceUnitHt' => 'orl_priceunitht',
     *     'discount' => 'orl_discount',
     *     'totalHt' => 'orl_mtht',
     *     'purchasePriceUnitHt' => 'orl_purchasepriceunitht',
     *     'prtLib' => 'orl_prtlib',
     *     'prtDesc' => 'orl_prtdesc',
     *     'taxRate' => 'orl_tax_rate',
     *     'isSubscription' => 'orl_is_subscription',
     *     // ... autres champs
     * ]
     */
    abstract protected function getFieldMapping(): array;

    /**
     * Retourne le nom de la table des lignes (pour les requêtes SQL directes)
     *
     * @return string Exemple: 'sale_order_line_orl', 'purchase_order_line_pol'
     */
    protected function getLineTableName(): string
    {
        $lineModel = $this->getLineModel();
        return (new $lineModel)->getTable();
    }

    /**
     * Récupère toutes les lignes d'un document avec les informations associées
     *
     * Cette méthode effectue une requête SQL optimisée avec jointures sur :
     * - La table des taxes (account_tax_tax) pour récupérer le libellé et le taux
     * - La table des produits (product_prt) si nécessaire
     *
     * @param int $id ID du document
     * @return JsonResponse
     */
    public function getLines($id): JsonResponse
    {
        try {
            $lineTable = $this->getLineTableName();
            $fieldMap = $this->getFieldMapping();
            $lineForeignKey = $this->getLineForeignKey();
            $linePrimaryKey = $this->getLinePrimaryKey();

            // Construction de la requête avec mapping des champs
            $query = DB::table($lineTable . ' as line')
                ->leftJoin('account_tax_tax as tax', 'line.' . $fieldMap['fk_tax_id'], '=', 'tax.tax_id')
                ->select($this->buildLineSelectFields($fieldMap))
                ->where('line.' . $lineForeignKey, '=', $id)
                ->orderBy('line.' . $fieldMap['lineOrder'], 'ASC');

            $lines = $query->get();

            // Récupérer les totaux du document
            $documentModel = $this->getDocumentModel();
            $document = $documentModel::find($id);
            $totals = $this->buildDocumentTotals($document, $fieldMap);

            // Récupérer les marges si applicable
            $margins = $this->calculateMargins($id, $lineTable, $fieldMap);

            return response()->json([
                'data' => $lines,
                'total' => $lines->count(),
                'totals' => $totals,
                'margins' => $margins,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des lignes: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Construction des champs SELECT pour la requête getLines()
     *
     * @param array $fieldMap Mapping des champs
     * @return array Liste des champs à sélectionner
     */
    protected function buildLineSelectFields(array $fieldMap): array
    {
        $selectFields = [
            'line.' . $fieldMap['lineId'] . ' as lineId',
            'line.' . $fieldMap['lineOrder'] . ' as lineOrder',
            'line.' . $fieldMap['lineType'] . ' as lineType',
            'line.' . $fieldMap['fk_prt_id'] . ' as fk_prt_id',
            'line.' . $fieldMap['prtLib'] . ' as prtLib',
            'line.' . $fieldMap['prtDesc'] . ' as prtDesc',
            'line.' . $fieldMap['fk_tax_id'] . ' as fk_tax_id',
            'tax.tax_label as taxLabel',
            'tax.tax_rate as taxRate',
            'line.' . $fieldMap['qty'] . ' as qty',
            'line.' . $fieldMap['priceUnitHt'] . ' as priceUnitHt',
            'line.' . $fieldMap['discount'] . ' as discount',
            'line.' . $fieldMap['totalHt'] . ' as totalHt',
        ];

        // Ajouter les champs optionnels s'ils existent dans le mapping
        if (isset($fieldMap['purchasePriceUnitHt'])) {
            $selectFields[] = 'line.' . $fieldMap['purchasePriceUnitHt'] . ' as purchasePriceUnitHt';

            // Calcul de la marge si prix d'achat présent
            $selectFields[] = DB::raw('(line.' . $fieldMap['totalHt'] . ' - (line.' . $fieldMap['purchasePriceUnitHt'] . ' * line.' . $fieldMap['qty'] . ')) AS margeTotal');
            $selectFields[] = DB::raw('ROUND(
                ((line.' . $fieldMap['totalHt'] . ' - (line.' . $fieldMap['purchasePriceUnitHt'] . ' * line.' . $fieldMap['qty'] . '))
                / NULLIF((line.' . $fieldMap['purchasePriceUnitHt'] . ' * line.' . $fieldMap['qty'] . '), 0)) * 100,
                2
            ) AS margePerc');
        }

        if (isset($fieldMap['isSubscription'])) {
            $selectFields[] = 'line.' . $fieldMap['isSubscription'] . ' as isSubscription';
        }

        if (isset($fieldMap['prtType'])) {
            $selectFields[] = 'line.' . $fieldMap['prtType'] . ' as prtType';
        }

        return $selectFields;
    }

    /**
     * Construction de l'objet totals à partir du document
     *
     * @param mixed $document Instance du document
     * @param array $fieldMap Mapping des champs
     * @return object|null Totaux du document
     */
    protected function buildDocumentTotals($document, array $fieldMap): ?object
    {
        if (!$document) {
            return null;
        }

        $totals = new \stdClass();

        // Totaux standards
        $totals->totalht = $document->{$fieldMap['totalHt']} ?? 0;
        $totals->tax = $document->{$fieldMap['totalTax']} ?? 0;
        $totals->totalttc = $document->{$fieldMap['totalTtc']} ?? 0;

        // Totaux optionnels (abonnement/ponctuel)
        if (isset($fieldMap['totalHtSub'])) {
            $totals->totalhtsub = $document->{$fieldMap['totalHtSub']} ?? 0;
        }
        if (isset($fieldMap['totalHtComm'])) {
            $totals->totalhtcomm = $document->{$fieldMap['totalHtComm']} ?? 0;
        }

        // Indicateur d'abonnement
        if (isset($fieldMap['isSubscription'])) {
            $lineModel = $this->getLineModel();
            $lineForeignKey = $this->getLineForeignKey();
            $isSub = $lineModel::where($lineForeignKey, $document->{$fieldMap['id']})
                ->where($fieldMap['isSubscription'], 1)
                ->count();
            $totals->isSub = $isSub > 0 ? 1 : 0;
        }

        // Totaux de paiement (si applicable)
        if (isset($fieldMap['amountRemaining'])) {
            $totals->amountRemaining = $document->{$fieldMap['amountRemaining']} ?? 0;
            $totals->totalPaid = $totals->totalttc - $totals->amountRemaining;
        }

        return $totals;
    }

    /**
     * Calcule les marges par type de produit (produits vs services)
     *
     * @param int $id ID du document
     * @param string $lineTable Nom de la table des lignes
     * @param array $fieldMap Mapping des champs
     * @return object|null Marges calculées
     */
    protected function calculateMargins($id, string $lineTable, array $fieldMap): ?object
    {
        // Vérifier que les champs nécessaires existent
        if (!isset($fieldMap['purchasePriceUnitHt']) || !isset($fieldMap['prtType'])) {
            return null;
        }

        try {
            $lineForeignKey = $this->getLineForeignKey();

            $margins = DB::table($lineTable)
                ->select([
                    DB::raw('SUM(CASE WHEN ' . $fieldMap['prtType'] . ' = \'service\' THEN ' . $fieldMap['purchasePriceUnitHt'] . ' * ' . $fieldMap['qty'] . ' ELSE 0 END) AS servicePR'),
                    DB::raw('SUM(CASE WHEN ' . $fieldMap['prtType'] . ' = \'service\' THEN ' . $fieldMap['totalHt'] . ' ELSE 0 END) AS servicePV'),
                    DB::raw('SUM(CASE WHEN ' . $fieldMap['prtType'] . ' = \'conso\' OR ' . $fieldMap['prtType'] . ' IS NULL THEN ' . $fieldMap['purchasePriceUnitHt'] . ' * ' . $fieldMap['qty'] . ' ELSE 0 END) AS productPR'),
                    DB::raw('SUM(CASE WHEN ' . $fieldMap['prtType'] . ' = \'conso\' OR ' . $fieldMap['prtType'] . ' IS NULL THEN ' . $fieldMap['totalHt'] . ' ELSE 0 END) AS productPV')
                ])
                ->where($fieldMap['lineType'], '=', 0)
                ->where($lineForeignKey, '=', $id)
                ->first();

            return $margins;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Sauvegarde (création ou mise à jour) d'une ligne de document
     *
     * @param int $documentId ID du document parent
     * @param Request $request Requête contenant les données de la ligne
     * @return JsonResponse
     */
    public function saveLine($documentId, Request $request): JsonResponse
    {
        // Validation : produit obligatoire pour les lignes normales (lineType = 0)
        $lineType = (int) $request->input('lineType', 0);
        if ($lineType === 0) {
            $request->validate([
                'fk_prt_id' => 'required|exists:product_prt,prt_id',
            ], [
                'fk_prt_id.required' => 'Le produit est obligatoire.',
                'fk_prt_id.exists'   => 'Le produit sélectionné est invalide.',
            ]);
        }

        try {
            $lineModel = $this->getLineModel();
            $fieldMap = $this->getFieldMapping();

            $lineId = $request->input('lineId');

            // Construire les données de la ligne en utilisant le mapping
            $lineData = $this->mapRequestToLineData($request, $documentId, $fieldMap);

            if ($lineId) {
                // Mise à jour d'une ligne existante
                $line = $lineModel::findOrFail($lineId);
                $line->update($lineData);

                return response()->json([
                    'success' => true,
                    'message' => 'Ligne mise à jour avec succès',
                    'line_id' => $lineId,
                ]);
            } else {
                // Création d'une nouvelle ligne
                $line = $lineModel::create($lineData);

                return response()->json([
                    'success' => true,
                    'message' => 'Ligne ajoutée avec succès',
                    'line_id' => $line->{$this->getLinePrimaryKey()},
                ], 201);
            }
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la sauvegarde: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Mappe les données de la requête vers les champs de la ligne
     *
     * @param Request $request Requête contenant les données
     * @param int $documentId ID du document parent
     * @param array $fieldMap Mapping des champs
     * @return array Données mappées pour la ligne
     */
    protected function mapRequestToLineData(Request $request, int $documentId, array $fieldMap): array
    {
        $lineForeignKey = $this->getLineForeignKey();

        $lineData = [
            $lineForeignKey => $documentId,
            $fieldMap['lineType'] => $request->input('lineType', 0),
            $fieldMap['lineOrder'] => $request->input('lineOrder', 1),
            $fieldMap['fk_prt_id'] => $request->input('fk_prt_id'),
            $fieldMap['prtLib'] => $request->input('prtLib'),
            $fieldMap['prtDesc'] => $request->input('prtDesc'),
            $fieldMap['qty'] => $request->input('qty', 0),
            $fieldMap['priceUnitHt'] => $request->input('priceUnitHt', 0),
            $fieldMap['discount'] => $request->input('discount', 0),
            $fieldMap['fk_tax_id'] => $request->input('fk_tax_id'),
        ];

        // Ajouter les champs optionnels s'ils existent dans le mapping
        if (isset($fieldMap['purchasePriceUnitHt'])) {
            $lineData[$fieldMap['purchasePriceUnitHt']] = $request->input('purchasePriceUnitHt', 0);
        }

        if (isset($fieldMap['isSubscription'])) {
            $lineData[$fieldMap['isSubscription']] = $request->input('isSubscription', 0);
        }

        if (isset($fieldMap['prtType'])) {
            $lineData[$fieldMap['prtType']] = $request->input('prtType') ?: null;
        }

        return $lineData;
    }

    /**
     * Supprime une ligne de document
     *
     * @param int $documentId ID du document parent
     * @param int $lineId ID de la ligne à supprimer
     * @return JsonResponse
     */
    public function deleteLine($documentId, $lineId): JsonResponse
    {
        try {
            $lineModel = $this->getLineModel();
            $linePrimaryKey = $this->getLinePrimaryKey();
            $lineForeignKey = $this->getLineForeignKey();

            $line = $lineModel::where($linePrimaryKey, $lineId)
                ->where($lineForeignKey, $documentId)
                ->firstOrFail();

            $line->delete();

            return response()->json([
                'success' => true,
                'message' => 'Ligne supprimée avec succès',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la suppression: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Met à jour l'ordre des lignes (utilisé pour le drag & drop)
     *
     * @param int $documentId ID du document
     * @param Request $request Requête contenant le tableau des IDs de lignes dans le nouvel ordre
     * @return JsonResponse
     */
    public function updateLinesOrder($documentId, Request $request): JsonResponse
    {
        try {
            $lineModel = $this->getLineModel();
            $fieldMap = $this->getFieldMapping();
            $linePrimaryKey = $this->getLinePrimaryKey();
            $lineForeignKey = $this->getLineForeignKey();

            $lines = $request->input('lines'); // Tableau d'IDs dans le nouvel ordre

            foreach ($lines as $index => $lineId) {
                $line = $lineModel::where($linePrimaryKey, $lineId)
                    ->where($lineForeignKey, $documentId)
                    ->first();

                if (!$line) {
                    continue;
                }

                $line->{$fieldMap['lineOrder']} = $index + 1;
                $line->save(); // Déclenche les hooks (recalcul des sous-totaux)
            }

            return response()->json([
                'success' => true,
                'message' => 'Ordre des lignes mis à jour',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la mise à jour: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Duplique un document avec toutes ses lignes
     *
     * @param int $id ID du document à dupliquer
     * @return JsonResponse
     */
    public function duplicate($id): JsonResponse
    {
        try {
            DB::beginTransaction();

            $documentModel = $this->getDocumentModel();
            $linesRelationship = $this->getLinesRelationshipName();
            $fieldMap = $this->getFieldMapping();
            $documentPrimaryKey = $this->getDocumentPrimaryKey();
            $lineForeignKey = $this->getLineForeignKey();

            // Récupérer le document original avec ses lignes
            $originalDocument = $documentModel::with($linesRelationship)->findOrFail($id);

            // Créer une copie du document
            $newDocument = $originalDocument->replicate();

            // Réinitialiser les champs spécifiques
            $newDocument->{$fieldMap['number']} = null; // Sera généré automatiquement par le hook
            $newDocument->{$fieldMap['status']} = 0; // Statut brouillon
            $newDocument->{$fieldMap['date']} = now();

            // Réinitialiser les champs optionnels s'ils existent
            if (isset($fieldMap['beingEdited'])) {
                $newDocument->{$fieldMap['beingEdited']} = false;
            }
            if (isset($fieldMap['invoicingState'])) {
                $newDocument->{$fieldMap['invoicingState']} = 0;
            }
            if (isset($fieldMap['deliveryState'])) {
                $newDocument->{$fieldMap['deliveryState']} = 0;
            }

            // Sauvegarder le nouveau document
            $newDocument->save();

            // Dupliquer toutes les lignes
            foreach ($originalDocument->{$linesRelationship} as $originalLine) {
                $newLine = $originalLine->replicate();
                $newLine->{$lineForeignKey} = $newDocument->{$documentPrimaryKey};
                $newLine->save();
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Document dupliqué avec succès',
                'data' => [
                    'id' => $newDocument->{$documentPrimaryKey},
                    'number' => $newDocument->{$fieldMap['number']},
                ],
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la duplication: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Récupère les objets liés à un document
     *
     * Cette méthode est générique mais peut être surchargée dans les classes enfants
     * pour ajouter des objets liés spécifiques.
     *
     * @param int $documentId ID du document
     * @return JsonResponse
     */
    public function getLinkedObjects($documentId): JsonResponse
    {
        try {
            // Par défaut, retourne un tableau vide
            // Les classes enfants peuvent surcharger cette méthode
            // pour ajouter les objets liés spécifiques (factures, BL, etc.)

            return response()->json([
                'success' => true,
                'data' => [],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des objets liés: ' . $e->getMessage(),
            ], 500);
        }
    }
}

