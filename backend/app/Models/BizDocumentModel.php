<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Traits\HasSequenceNumber;
use App\Models\AccountTaxModel;
use App\Models\AccountTaxRepartitionLineModel;

/**
 * Classe de base abstraite pour tous les documents (SaleOrder, PurchaseOrder, Invoice, Contract)
 *
 * Cette classe fournit les fonctionnalités communes à tous les documents :
 * - Recalcul automatique des totaux (HT, TVA, TTC)
 * - Relations communes (author, updater, partner, payment modes, etc.)
 * - Gestion du séquençage des numéros
 *
 * Les classes enfants doivent implémenter les méthodes abstraites pour définir
 * le mapping des champs spécifiques à chaque type de document.
 */
abstract class BizDocumentModel extends BaseModel
{
    use HasSequenceNumber;

    /**
     * Retourne le mapping des champs du document
     *
     * Les clés sont des noms logiques génériques, les valeurs sont les noms réels des colonnes
     *
     * @return array Exemple:
     * [
     *     'id' => 'ord_id',
     *     'number' => 'ord_number',
     *     'date' => 'ord_date',
     *     'status' => 'ord_status',
     *     'total_ht' => 'ord_totalht',
     *     'total_tax' => 'ord_totaltax',
     *     'total_ttc' => 'ord_totalttc',
     *     'partner_id' => 'fk_ptr_id',
     *     'author_id' => 'fk_usr_id_author',
     *     'updater_id' => 'fk_usr_id_updater',
     *     // Champs de ligne pour recalculateTotals
     *     'line_type' => 'orl_type',
     *     'line_total_ht' => 'orl_mtht',
     *     'line_tax' => 'orl_tax_rate',
     *     'line_is_subscription' => 'orl_is_subscription',
     * ]
     */
    abstract protected function getFieldMapping(): array;

    /**
     * Retourne le nom de la relation pour accéder aux lignes du document
     *
     * @return string Exemple: 'lines'
     */
    abstract protected function getLinesRelationship(): string;

    /**
     * Retourne le module pour le séquençage des numéros
     *
     * @return string Exemple: 'saleorder', 'purchaseorder', 'invoice', 'contract'
     */
    abstract protected function getSequenceModule(): string;

    /**
     * Retourne le type de document TRL à utiliser pour le recalcul des totaux TVA.
     *
     * Valeurs possibles : 'out_invoice' | 'out_refund' | 'in_invoice' | 'in_refund'
     *
     * Utilisé par recalculateTotals() pour interroger account_tax_repartition_line_trl
     * et calculer le taux effectif net de chaque taxe (après application de trl_factor_percent).
     *
     * @return string
     */
    abstract protected function getTrlDocumentType(): string;

    /**
     * Retourne le dernier numéro de séquence utilisé
     * Implémentation requise par le trait HasSequenceNumber
     *
     * @return string
     */
    abstract protected static function getLastSequenceNumber(): string;

    /**
     * Recalcule tous les totaux du document (HT, TVA, TTC, abonnement, ponctuel)
     *
     * Cette méthode :
     * - Récupère toutes les lignes normales (type 0 ou NULL)
     * - Calcule le total HT en sommant les montants HT des lignes
     * - Calcule la TVA pour chaque ligne (montantHT * tauxTVA / 100)
     * - Sépare les totaux abonnement et ponctuel si applicable
     * - Met à jour les champs totaux du document
     *
     * Utilise updateQuietly() pour éviter de déclencher les événements de sauvegarde
     * et les hooks (évite les boucles infinies).
     *
     * @return void
     */
    public function recalculateTotals(): void
    {
        $fieldMap   = $this->getFieldMapping();
        $docType    = $this->getTrlDocumentType();

        // ── 1. Charger les lignes normales ────────────────────────────────────
        $query = $this->{$this->getLinesRelationship()}();

        if (isset($fieldMap['line_type'])) {
            $query->where(function ($q) use ($fieldMap) {
                $q->whereNull($fieldMap['line_type'])
                    ->orWhere($fieldMap['line_type'], 0);
            });
        }

        $selectFields = [$fieldMap['line_total_ht'], $fieldMap['line_tax_id']];
        if (!empty($fieldMap['line_is_subscription'])) {
            $selectFields[] = $fieldMap['line_is_subscription'];
        }

        $lines = $query->get($selectFields);

        // ── 2. Pré-charger taux nominaux + facteurs TRL (2 requêtes, évite N+1) ──
        $taxIds = $lines->pluck($fieldMap['line_tax_id'])->filter()->unique()->values()->all();

        $taxRates   = [];   // tax_id → taux nominal (ex: 20.00)
        $trlFactors = [];   // tax_id → sum(trl_factor_percent) pour ce docType

        if (!empty($taxIds)) {
            AccountTaxModel::whereIn('tax_id', $taxIds)
                ->get(['tax_id', 'tax_rate'])
                ->each(function ($t) use (&$taxRates) {
                    $taxRates[(int) $t->tax_id] = (float) $t->tax_rate;
                });

            AccountTaxRepartitionLineModel::whereIn('fk_tax_id', $taxIds)
                ->where('trl_document_type', $docType)
                ->where('trl_repartition_type', 'tax')
                ->get(['fk_tax_id', 'trl_factor_percent'])
                ->groupBy('fk_tax_id')
                ->each(function ($group, $taxId) use (&$trlFactors) {
                    $trlFactors[(int) $taxId] = (float) $group->sum('trl_factor_percent');
                });
        }

        // Taux effectif net : tax_rate × sum(trl_factor_percent) / 100
        // Ex: TVA 20% normale   → 20 × 100 / 100 = 20%
        // Ex: TVA autoliquidée  → 20 × (100-100) / 100 = 0%
        // Ex: TVA 0% sans TRL   → 0% (trlFactors non défini → 0)
        $effectiveRates = [];
        foreach ($taxIds as $taxId) {
            $taxId   = (int) $taxId;
            $nominal = $taxRates[$taxId] ?? 0.0;
            $factor  = $trlFactors[$taxId] ?? 0.0;
            $effectiveRates[$taxId] = $nominal * $factor / 100;
        }

        // ── 3. Calculer les totaux ────────────────────────────────────────────
        $totalHT    = 0.0;
        $totalTVA   = 0.0;
        $totalHTSub = 0.0;
        $totalHTComm = 0.0;

        foreach ($lines as $line) {
            $montantHT    = (float) ($line->{$fieldMap['line_total_ht']} ?? 0);
            $taxId        = (int) ($line->{$fieldMap['line_tax_id']} ?? 0);
            $tauxEffectif = $effectiveRates[$taxId] ?? 0.0;

            $totalHT  += $montantHT;
            $totalTVA += $montantHT * $tauxEffectif / 100;

            if (!empty($fieldMap['line_is_subscription'])) {
                if ($line->{$fieldMap['line_is_subscription']} ?? false) {
                    $totalHTSub += $montantHT;
                } else {
                    $totalHTComm += $montantHT;
                }
            }
        }

        // ── 4. Mettre à jour le document ─────────────────────────────────────
        $updateData = [
            $fieldMap['total_ht']  => round($totalHT, 3),
            $fieldMap['total_tax'] => round($totalTVA, 3),
            $fieldMap['total_ttc'] => round($totalHT + $totalTVA, 3),
        ];

        if (isset($fieldMap['total_ht_sub'])) {
            $updateData[$fieldMap['total_ht_sub']] = round($totalHTSub, 2);
        }
        if (isset($fieldMap['total_ht_comm'])) {
            $updateData[$fieldMap['total_ht_comm']] = round($totalHTComm, 2);
        }

        $this->updateQuietly($updateData);
    }

    /**
     * Relations communes à tous les documents
     */

    /**
     * Relation avec l'utilisateur auteur du document
     *
     * @return BelongsTo
     */
    public function author(): BelongsTo
    {
        $fieldMap = $this->getFieldMapping();
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
        return $this->belongsTo(UserModel::class, $fieldMap['updater_id'], 'usr_id');
    }

    /**
     * Relation avec le partenaire (client ou fournisseur)
     *
     * @return BelongsTo
     */
    public function partner(): BelongsTo
    {
        $fieldMap = $this->getFieldMapping();
        return $this->belongsTo(PartnerModel::class, $fieldMap['partner_id'], 'ptr_id');
    }

    /**
     * Relation avec le mode de paiement
     *
     * @return BelongsTo
     */
    public function paymentMode(): BelongsTo
    {
        $fieldMap = $this->getFieldMapping();

        // Vérifier si le champ existe dans le mapping
        if (!isset($fieldMap['payment_mode_id'])) {
            // Retourner une relation vide si le champ n'existe pas
            return $this->belongsTo(PaymentModeModel::class, 'non_existent_field', 'pam_id');
        }

        return $this->belongsTo(PaymentModeModel::class, $fieldMap['payment_mode_id'], 'pam_id');
    }

    /**
     * Relation avec la condition de paiement
     *
     * @return BelongsTo
     */
    public function paymentCondition(): BelongsTo
    {
        $fieldMap = $this->getFieldMapping();

        // Vérifier si le champ existe dans le mapping
        if (!isset($fieldMap['payment_condition_id'])) {
            return $this->belongsTo(DurationsModel::class, 'non_existent_field', 'dur_id');
        }

        return $this->belongsTo(DurationsModel::class, $fieldMap['payment_condition_id'], 'dur_id');
    }

    /**
     * Relation avec la position fiscale (tax position)
     *
     * @return BelongsTo
     */
    public function taxPosition(): BelongsTo
    {
        $fieldMap = $this->getFieldMapping();

        // Vérifier si le champ existe dans le mapping
        if (!isset($fieldMap['tax_position_id'])) {
            return $this->belongsTo(AccountTaxPositionModel::class, 'non_existent_field', 'tap_id');
        }

        return $this->belongsTo(AccountTaxPositionModel::class, $fieldMap['tax_position_id'], 'tap_id');
    }

    /**
     * Méthodes utilitaires
     */

    /**
     * Vérifie si le document est en brouillon
     *
     * @return bool
     */
    public function isDraft(): bool
    {
        $fieldMap = $this->getFieldMapping();
        $status = $this->{$fieldMap['status']} ?? null;

        return $status === 0 || $status === null;
    }

    /**
     * Vérifie si le document est en cours d'édition
     *
     * @return bool
     */
    public function isBeingEdited(): bool
    {
        $fieldMap = $this->getFieldMapping();

        if (!isset($fieldMap['being_edited'])) {
            return false;
        }

        return $this->{$fieldMap['being_edited']} ?? false;
    }

    /**
     * Vérifie si le document peut être modifié
     *
     * @return bool
     */
    public function canBeEdited(): bool
    {
        return $this->isDraft() || $this->isBeingEdited();
    }

    /**
     * Obtenir le nombre total de lignes du document
     *
     * @return int
     */
    public function getLinesCount(): int
    {
        $linesRelation = $this->getLinesRelationship();
        return $this->{$linesRelation}()->count();
    }

    /**
     * Obtenir le nombre de lignes normales (type 0 ou NULL)
     *
     * @return int
     */
    public function getNormalLinesCount(): int
    {
        $fieldMap = $this->getFieldMapping();
        $linesRelation = $this->getLinesRelationship();

        if (!isset($fieldMap['line_type'])) {
            return $this->getLinesCount();
        }

        return $this->{$linesRelation}()
            ->where(function ($q) use ($fieldMap) {
                $q->whereNull($fieldMap['line_type'])
                    ->orWhere($fieldMap['line_type'], 0);
            })
            ->count();
    }
}

