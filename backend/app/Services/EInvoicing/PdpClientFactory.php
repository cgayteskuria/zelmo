<?php

namespace App\Services\EInvoicing;

use App\Models\EInvoicingConfigModel;
use App\Services\EInvoicing\Adapters\GenericPdpAdapter;

/**
 * Résout l'adaptateur PA à utiliser selon la configuration stockée.
 * Ajouter un nouveau PA = ajouter une entrée dans le match + créer l'adaptateur.
 */
class PdpClientFactory
{
    public static function make(EInvoicingConfigModel $config): PdpClientInterface
    {
        if (empty($config->eic_api_url) || empty($config->eic_client_id) || empty($config->eic_client_secret)) {
            throw new \RuntimeException(
                'Le PA/PDP n\'est pas configuré. Veuillez renseigner l\'URL de l\'API, le Client ID et le Client Secret dans les paramètres de facturation électronique.'
            );
        }

        return new GenericPdpAdapter($config);
    }

    /**
     * Retourne la configuration d'un profil pré-paramétré.
     */
    public static function getProfile(string $profileKey): ?array
    {
        return EInvoicingConfigModel::$PROFILES[$profileKey] ?? null;
    }
}
