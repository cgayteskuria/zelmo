<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Classe de base abstraite pour toutes les lignes de documents
 * (SaleOrderLine, PurchaseOrderLine, InvoiceLine, ContractLine)
 *
 * Cette classe fournit les fonctionnalités communes à toutes les lignes :
 * - Calcul automatique du total HT de la ligne
 * - Mise à jour des sous-totaux
 * - Synchronisation du taux de TVA depuis AccountTaxModel
 * - Hooks de sauvegarde/suppression pour recalculer les totaux du document parent
 *
 * Les classes enfants doivent implémenter les méthodes abstraites pour définir
 * le mapping des champs spécifiques à chaque type de ligne.
 */
abstract class  BizDocumentLineModel extends BaseModel
{
    // Constantes de type de ligne (communes à tous les types de lignes)
    const LINE_TYPE_NORMAL = 0;      // Ligne normale avec calculs
    const LINE_TYPE_SEPARATOR = 1;   // Ligne de séparation (titre)
    const LINE_TYPE_SUBTOTAL = 2;    // Ligne de sous-total

    /**
     * Retourne le mapping des champs de la ligne
     *
     * Les clés sont des noms logiques génériques, les valeurs sont les noms réels des colonnes
     *
     * @return array Exemple:
     * [
     *     'id' => 'orl_id',
     *     'parent_fk' => 'fk_ord_id',
     *     'product_id' => 'fk_prt_id',
     *     'tax_id' => 'fk_tax_id',
     *     'qty' => 'orl_qty',
     *     'price_unit_ht' => 'orl_priceunitht',
     *     'discount' => 'orl_discount',
     *     'total_ht' => 'orl_mtht',
     *     'tax_rate' => 'orl_tax_rate',
     *     'line_type' => 'orl_type',
     *     'order' => 'orl_order',
     *     'prt_lib' => 'orl_prtlib',
     *     'prt_desc' => 'orl_prtdesc',
     *     'prt_type' => 'orl_prttype',
     *     'note' => 'orl_note',
     *     'is_subscription' => 'orl_is_subscription', // Optionnel
     * ]
     */
    abstract protected function getFieldMapping(): array;

    /**
     * Retourne le nom de la relation pour accéder au document parent
     *
     * @return string Exemple: 'saleOrder', 'purchaseOrder', 'invoice', 'contract'
     */
    abstract protected function getParentRelationship(): string;

    /**
     * Retourne le nom de la clé étrangère du document parent
     *
     * @return string Exemple: 'fk_ord_id', 'fk_por_id', 'fk_inv_id', 'fk_con_id'
     */
    abstract protected function getParentForeignKey(): string;

    /**
     * Calcule le total HT de la ligne
     *
     * Formule : totalHT = (qty * priceUnitHt) - (discount% * totalHT)
     *
     * Cette méthode :
     * - Ne fait rien pour les lignes de type SEPARATOR ou SUBTOTAL
     * - Calcule le montant avant remise
     * - Applique la remise en pourcentage
     * - Arrondit le résultat à 3 décimales
     * - Met à jour le champ total_ht de la ligne
     *
     * @return void
     */
    public function calculateTotalHT(): void
    {
        
        $fieldMap = $this->getFieldMapping();

        // Ne pas calculer pour les lignes de titre ou sous-total
        $lineType = $this->{$fieldMap['line_type']} ?? null;
        if ($lineType == self::LINE_TYPE_SEPARATOR || $lineType == self::LINE_TYPE_SUBTOTAL) {
            return;
        }

        $qty = $this->{$fieldMap['qty']} ?? 0;
        $priceUnitHt = $this->{$fieldMap['price_unit_ht']} ?? 0;
        $discount = $this->{$fieldMap['discount']} ?? 0;

        // Calcul du montant avant remise
        $totalBeforeDiscount = $qty * $priceUnitHt;

        // Calcul du montant de la remise
        $discountAmount = ($discount / 100) * $totalBeforeDiscount;

        // Calcul du total HT
        $total = $totalBeforeDiscount - $discountAmount;

        // Mise à jour du champ total HT
        $this->{$fieldMap['total_ht']} = round($total, 3);
    }

    /**
     * Recalcule les sous-totaux pour toutes les lignes du document
     *
     * Cette méthode :
     * - Parcourt toutes les lignes du document dans l'ordre
     * - Réinitialise le sous-total à chaque ligne SEPARATOR
     * - Cumule les montants HT des lignes normales
     * - Met à jour les lignes SUBTOTAL avec le cumul
     *
     * Logique :
     * - Ligne NORMAL : cumul += montantHT
     * - Ligne SEPARATOR : cumul = 0 (réinitialisation)
     * - Ligne SUBTOTAL : affiche le cumul et réinitialise
     *
     * @return void
     */
    public function updateSubTotal(): void
    {
       
        $fieldMap = $this->getFieldMapping();
        $foreignKey = $this->getParentForeignKey();

        // Vérifier que la ligne a un parent
        if (!$this->{$foreignKey}) {
            return;
        }

        try {
            // Récupérer toutes les lignes du document ordonnées
            $lines = self::where($foreignKey, $this->{$foreignKey})
                ->orderBy($fieldMap['order'])
                ->get([$fieldMap['id'], $fieldMap['line_type'], $fieldMap['total_ht']]);

            $subTotal = 0;
            $updateValues = [];

            foreach ($lines as $line) {
                $lineType = $line->{$fieldMap['line_type']} ?? null;

                if ($lineType == self::LINE_TYPE_SEPARATOR) {
                    // Ligne de séparation : on réinitialise le sous-total
                    $subTotal = 0;
                } elseif ($lineType == self::LINE_TYPE_SUBTOTAL) {                    
                    // Ligne de sous-total : on enregistre le sous-total et on réinitialise
                    $subTotalRounded = round($subTotal, 3);
                    $updateValues[] = [
                        'id' => $line->{$fieldMap['id']},
                        'total_ht' => $subTotalRounded
                    ];
                    $subTotal = 0;
                } else {
                    // Ligne normale : on cumule
                    $subTotal += $line->{$fieldMap['total_ht']} ?? 0;
                }
            }

            // Mettre à jour les lignes de sous-total
            if (!empty($updateValues)) {
             
                foreach ($updateValues as $update) {
                    self::where($fieldMap['id'], $update['id'])
                        ->update([$fieldMap['total_ht'] => $update['total_ht']]);
                }
            }
        } catch (\Exception $e) {
            throw new \Exception("updateSubTotal : " . $e->getMessage());
        }
    }

    /**
     * Relations communes à toutes les lignes
     */

    /**
     * Relation avec le produit
     *
     * @return BelongsTo
     */
    public function product(): BelongsTo
    {
        $fieldMap = $this->getFieldMapping();
        return $this->belongsTo(ProductModel::class, $fieldMap['product_id'], 'prt_id');
    }

    /**
     * Relation avec la taxe (TVA)
     *
     * @return BelongsTo
     */
    public function tax(): BelongsTo
    {
        $fieldMap = $this->getFieldMapping();
        return $this->belongsTo(AccountTaxModel::class, $fieldMap['tax_id'], 'tax_id');
    }

    /**
     * Relation avec l'utilisateur auteur de la ligne
     *
     * @return BelongsTo
     */
    public function author(): BelongsTo
    {
        $fieldMap = $this->getFieldMapping();

        // Vérifier si le champ existe dans le mapping
        if (!isset($fieldMap['author_id'])) {
            return $this->belongsTo(UserModel::class, 'non_existent_field', 'usr_id');
        }

        return $this->belongsTo(UserModel::class, $fieldMap['author_id'], 'usr_id');
    }

    /**
     * Relation avec l'utilisateur ayant fait la dernière modification
     *
     * @return BelongsTo
     */
    public function updater(): BelongsTo
    {
        $fieldMap = $this->getFieldMapping();

        // Vérifier si le champ existe dans le mapping
        if (!isset($fieldMap['updater_id'])) {
            return $this->belongsTo(UserModel::class, 'non_existent_field', 'usr_id');
        }

        return $this->belongsTo(UserModel::class, $fieldMap['updater_id'], 'usr_id');
    }

    /**
     * Méthodes utilitaires
     */

    /**
     * Vérifie si la ligne est une ligne normale (avec calculs)
     *
     * @return bool
     */
    public function isNormalLine(): bool
    {
        $fieldMap = $this->getFieldMapping();
        $lineType = $this->{$fieldMap['line_type']} ?? null;

        return $lineType === self::LINE_TYPE_NORMAL || $lineType === null;
    }

    /**
     * Vérifie si la ligne est une ligne de séparation (titre)
     *
     * @return bool
     */
    public function isSeparatorLine(): bool
    {
        $fieldMap = $this->getFieldMapping();
        $lineType = $this->{$fieldMap['line_type']} ?? null;

        return $lineType === self::LINE_TYPE_SEPARATOR;
    }

    /**
     * Vérifie si la ligne est une ligne de sous-total
     *
     * @return bool
     */
    public function isSubtotalLine(): bool
    {
        $fieldMap = $this->getFieldMapping();
        $lineType = $this->{$fieldMap['line_type']} ?? null;

        return $lineType === self::LINE_TYPE_SUBTOTAL;
    }

    /**
     * Obtenir le libellé de la ligne
     *
     * @return string
     */
    public function getLabel(): string
    {
        $fieldMap = $this->getFieldMapping();
        return $this->{$fieldMap['prt_lib']} ?? '';
    }

    /**
     * Retourne le type de document TRL à utiliser pour le calcul du taux effectif.
     *
     * Valeurs possibles dans account_tax_repartition_line_trl.trl_document_type :
     *   'out_invoice'  — facture client normale
     *   'out_refund'   — avoir client
     *   'in_invoice'   — facture fournisseur normale
     *   'in_refund'    — avoir fournisseur
     *
     * Chaque sous-classe (SaleOrderLine, PurchaseOrderLine, ContractLine, InvoiceLine)
     * doit implémenter cette méthode en fonction du sens du document.
     *
     * @return string 'out_invoice'|'out_refund'|'in_invoice'|'in_refund'
     */
    abstract protected function getTrlDocumentType(): string;

    /**
     * Boot du modèle - Hooks automatiques
     *
     * Ces hooks permettent de :
     * - Calculer automatiquement le total HT avant la sauvegarde
     * - Synchroniser le taux de TVA depuis AccountTaxModel
     * - Recalculer les sous-totaux après la sauvegarde
     * - Recalculer les totaux du document parent
     */
    protected static function boot()
    {
        parent::boot();

        // Hook AVANT la sauvegarde (create ou update)
        static::saving(function ($line) {
            $fieldMap = $line->getFieldMapping();

            // 1. Calculer le total HT de la ligne
            $line->calculateTotalHT();

          
            // 2. Mettre à jour le taux de taxe si fk_tax_id a changé
            if ($line->isDirty($fieldMap['tax_id'])) {
               
                if ($line->{$fieldMap['tax_id']}) {
                    $tax = AccountTaxModel::find($line->{$fieldMap['tax_id']});
                    
                    if ($tax) {
                        // Taux effectif = tax_rate × sum(trl_factor_percent) / 100
                        // Permet de gérer la TVA intracommunautaire / autoliquidée
                        // (deux lignes TRL +100% et −100% → taux net = 0%)
                        $docType = $line->getTrlDocumentType(); // 'invoice' ou 'refund'
                        $trlLines = AccountTaxRepartitionLineModel::where('fk_tax_id', $tax->tax_id)
                            ->where('trl_document_type', $docType)
                            ->where('trl_repartition_type', 'tax')
                            ->get(['trl_factor_percent']);

                        if ($trlLines->isEmpty()) {
                            // Taxe à 0% : aucune ventilation requise
                            if ((float) $tax->tax_rate === 0.0) {
                                $line->{$fieldMap['tax_rate']} = 0;
                            } else {
                                throw new \InvalidArgumentException(
                                    "Taxe #{$tax->tax_id} ({$tax->tax_name}) : aucune ligne de ventilation (TRL) "
                                    . "de type '{$docType}' configurée. Veuillez configurer les lignes de répartition."
                                );
                            }
                        } else {
                            // Somme de tous les trl_factor_percent (ex: +100% et −100% → 0 pour autoliquidation)
                            $netFactor = (float) $trlLines->sum('trl_factor_percent');
                            $line->{$fieldMap['tax_rate']} = round($tax->tax_rate * $netFactor / 100, 4);
                        }
                    }
                } else {
                    $line->{$fieldMap['tax_rate']} = 0;
                }
            }
        });

        // Hook APRÈS la sauvegarde (create ou update)
        static::saved(function ($line) {
            $fieldMap = $line->getFieldMapping();

            // Définir les champs à surveiller pour déclencher les recalculs
            $watchedFields = [
                $fieldMap['qty'],
                $fieldMap['price_unit_ht'],
                $fieldMap['discount'],
                $fieldMap['total_ht'],
                $fieldMap['tax_rate'],
                $fieldMap['line_type'],
                $fieldMap['order']
            ];

            // Ajouter is_subscription s'il existe
            if (isset($fieldMap['is_subscription'])) {
                $watchedFields[] = $fieldMap['is_subscription'];
            }

            // Vérifier si un des champs surveillés a changé
            $hasChanged = $line->wasRecentlyCreated || $line->wasChanged($watchedFields);

            if ($hasChanged) {
                // 1. Recalculer les sous-totaux
                $line->updateSubTotal();

                // 2. Recalculer les totaux du document parent
                $parentRelationship = $line->getParentRelationship();
                $parent = $line->{$parentRelationship};

                if ($parent) {
                    $parent->recalculateTotals();
                }
            }
        });

        // Hook APRÈS la suppression
        static::deleted(function ($line) {
            // 1. Recalculer les sous-totaux
            $line->updateSubTotal();

            // 2. Recalculer les totaux du document parent
            $parentRelationship = $line->getParentRelationship();
            $parent = $line->{$parentRelationship};

            if ($parent) {
                $parent->recalculateTotals();
            }
        });
    }
}

