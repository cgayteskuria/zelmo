<?php

namespace App\Traits;

use App\Models\DocumentModel;
use App\Services\DocumentService;
use Illuminate\Support\Facades\Auth;

/**
 * Trait pour supprimer automatiquement les documents liés lors de la suppression du modèle parent
 *
 * Ce trait ajoute un hook 'deleting' qui supprime les fichiers physiques et les enregistrements DB
 * des documents liés AVANT que la cascade SQL ne s'exécute.
 *
 * Usage:
 * 1. Ajouter le trait au modèle parent
 * 2. Implémenter la méthode getDocumentForeignKey() pour retourner la clé étrangère
 *
 * Exemple:
 * ```php
 * class SaleOrderModel extends BizDocumentModel
 * {
 *     use DeletesRelatedDocuments;
 *
 *     protected static function getDocumentForeignKey(): string
 *     {
 *         return 'fk_ord_id';
 *     }
 * }
 * ```
 */
trait DeletesRelatedDocuments
{
    /**
     * Boot du trait - ajoute le hook deleting
     */
    protected static function bootDeletesRelatedDocuments()
    {
        static::deleting(function ($model) {
            $foreignKey = static::getDocumentForeignKey();

            if (!$foreignKey) {
                return;
            }

            $primaryKey = $model->getKeyName();
            $primaryValue = $model->$primaryKey;

            // Récupérer tous les documents liés
            $documents = DocumentModel::where($foreignKey, $primaryValue)->get();

            if ($documents->isEmpty()) {
                return;
            }

            // Injecter le service
            $documentService = app(DocumentService::class);

            // Déterminer l'utilisateur pour l'audit           
            $userId = Auth::user()?->usr_id
                   ?? $model->fk_usr_id_updater
                   ?? $model->fk_usr_id_author                   ;

            // Supprimer chaque document via le service
            foreach ($documents as $document) {
                try {
                    $documentService->deleteDocument($document, $userId);
                } catch (\Exception $e) {
                    // Log l'erreur mais ne bloque pas la suppression du parent
                    logger()->error('Failed to delete document during cascade', [
                        'document_id' => $document->doc_id,
                        'parent_model' => get_class($model),
                        'parent_id' => $primaryValue,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        });
    }

    /**
     * Retourne la clé étrangère pour les documents liés
     * À implémenter dans chaque modèle
     *
     * @return string La clé étrangère (ex: 'fk_ord_id', 'fk_inv_id', etc.)
     */
    abstract protected static function getDocumentForeignKey(): string;
}
