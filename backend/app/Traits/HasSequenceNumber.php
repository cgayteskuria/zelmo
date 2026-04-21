<?php

namespace App\Traits;
use App\Models\SequenceModel;

trait HasSequenceNumber
{
    /**
     * Générateur de séquence basé sur un pattern
     * @param string $pattern Le pattern de numérotation (ex: "CO-{yy}{0000@1}")
     * @param string $lastRef La dernière référence utilisée
     * @return string Le nouveau numéro généré
     */
    protected static function sequenceGenerator(string $pattern, string $lastRef): string
    {
        $now = new \DateTime();
        $year = $now->format('y');
        $month = $now->format('m');

        // Initialiser les variables
        $lastYear = $year;
        $lastIncrement = 0;

        if (!empty($lastRef)) {
            // Extraire l'année et l'incrément de la dernière référence
            // Format attendu: 2 chiffres année + 4 chiffres incrément (ex: "240001")
            if (preg_match('/(\d{2})(\d{4})/', $lastRef, $matches)) {
                $lastYear = $matches[1];
                $lastIncrement = (int)$matches[2];
            }
        }

        // Réinitialiser ou incrémenter selon le changement d'année
        // Réinitialise à 1 seulement si changement d'année ET mois de janvier
        $newIncrement = ($year != $lastYear && $month === '01') ? 1 : $lastIncrement + 1;

        // Déterminer la longueur de l'incrément
        $incrementLength = 4; // Longueur par défaut
        if (preg_match('/\{(0+)@1\}/', $pattern, $matches)) {
            $incrementLength = strlen($matches[1]);
        }

        // Formater le nouvel incrément avec des zéros de remplissage
        $formattedIncrement = str_pad($newIncrement, $incrementLength, '0', STR_PAD_LEFT);

        // Remplacer les variables dans le pattern
        $result = str_replace('{yy}', $year, $pattern);
        $result = str_replace('{yyyy}', $now->format('Y'), $result);
        $result = str_replace('{mm}', $month, $result);
        $result = str_replace('{dd}', $now->format('d'), $result);

        // Remplacer le pattern d'incrément (ex: {0000@1})
        $result = preg_replace('/\{0+@1\}/', $formattedIncrement, $result);

        return $result;
    }

    /**
     * Génère un numéro de séquence à partir de la table sequence_seq
     * @param string $module Le nom du module (ex: 'saleorder', 'purchaseorder')
     * @param string $submodule Le sous-module optionnel
     * @param string|null $lastNumber Le dernier numéro utilisé (optionnel, sera récupéré automatiquement si null)
     * @return string Le nouveau numéro généré
     */
    protected static function generateSequenceNumber(string $module, string $submodule = '', ?string $lastNumber = null): string
    {
        try {
            // Récupérer le pattern de séquence
            $query = SequenceModel::from('sequence_seq')->where('seq_module', $module);

            if (!empty($submodule)) {
                $query->where('seq_submodule', $submodule);
            }

            $sequence = $query->first();

            if (!$sequence) {
                throw new \Exception("Pattern de séquence non trouvé pour le module: {$module}");
            }

            $pattern = $sequence->seq_pattern;          

            // Si lastNumber n'est pas fourni, le récupérer automatiquement
            if ($lastNumber === null) {
                $lastNumber = static::getLastSequenceNumber();
            }

            // Générer le nouveau numéro
            $newNumber = static::sequenceGenerator($pattern, $lastNumber);

            return $newNumber;
        } catch (\Exception $e) {
            throw new \Exception("Erreur lors de la génération du numéro de séquence: " . $e->getMessage());
        }
    }

    /**
     * Méthode abstraite à implémenter par chaque modèle
     * Doit retourner le dernier numéro de séquence utilisé
     * @return string
     */
    abstract protected static function getLastSequenceNumber(): string;
}
