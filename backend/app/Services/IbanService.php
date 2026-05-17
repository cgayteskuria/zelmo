<?php

namespace App\Services;

class IbanService
{
    private static array $ibanLengths = [
        'AD' => 24, 'AE' => 23, 'AL' => 28, 'AT' => 20, 'AZ' => 28,
        'BA' => 20, 'BE' => 16, 'BG' => 22, 'BH' => 22, 'BR' => 29,
        'BY' => 28, 'CH' => 21, 'CR' => 22, 'CY' => 28, 'CZ' => 24,
        'DE' => 22, 'DK' => 18, 'DO' => 28, 'EE' => 20, 'EG' => 29,
        'ES' => 24, 'FI' => 18, 'FO' => 18, 'FR' => 27, 'GB' => 22,
        'GE' => 22, 'GI' => 23, 'GL' => 18, 'GR' => 27, 'GT' => 28,
        'HR' => 21, 'HU' => 28, 'IE' => 22, 'IL' => 23, 'IS' => 26,
        'IT' => 27, 'JO' => 30, 'KW' => 30, 'KZ' => 20, 'LB' => 28,
        'LC' => 32, 'LI' => 21, 'LT' => 20, 'LU' => 20, 'LV' => 21,
        'MC' => 27, 'MD' => 24, 'ME' => 22, 'MK' => 19, 'MR' => 27,
        'MT' => 31, 'MU' => 30, 'NL' => 18, 'NO' => 15, 'PK' => 24,
        'PL' => 28, 'PS' => 29, 'PT' => 25, 'QA' => 29, 'RO' => 24,
        'RS' => 22, 'SA' => 24, 'SE' => 24, 'SI' => 19, 'SK' => 24,
        'SM' => 27, 'TN' => 24, 'TR' => 26, 'UA' => 29, 'VA' => 22,
        'VG' => 24, 'XK' => 20,
    ];

    /**
     * Normalise un IBAN (supprime espaces, met en majuscules).
     */
    public static function normalize(string $iban): string
    {
        return strtoupper(str_replace(' ', '', $iban));
    }

    /**
     * Valide un IBAN : format + longueur + checksum modulo 97.
     * Retourne null si valide, ou un message d'erreur.
     */
    public static function validate(string $iban): ?string
    {
        $iban = self::normalize($iban);

        if (strlen($iban) < 15) {
            return 'IBAN trop court';
        }

        $countryCode = substr($iban, 0, 2);

        if (!isset(self::$ibanLengths[$countryCode])) {
            return 'Code pays invalide';
        }

        if (strlen($iban) !== self::$ibanLengths[$countryCode]) {
            return 'Longueur IBAN incorrecte pour ce pays';
        }

        if (!self::validateChecksum($iban)) {
            return 'Clé de contrôle IBAN invalide';
        }

        return null;
    }

    /**
     * Extrait les composants BBAN selon le pays (France implémentée).
     */
    public static function extractBbanComponents(string $iban): array
    {
        $iban        = self::normalize($iban);
        $countryCode = substr($iban, 0, 2);
        $components  = [];

        if ($countryCode === 'FR') {
            $bban = substr($iban, 4);
            $components['bank_code']  = substr($bban, 0, 5);
            $components['sort_code']  = substr($bban, 5, 5);
            $components['account_nbr'] = substr($bban, 10, 11);
            $components['bban_key']   = substr($bban, 21, 2);
        }

        return $components;
    }

    /**
     * Formate un IBAN en groupes de 4 caractères.
     */
    public static function format(string $iban): string
    {
        return implode(' ', str_split(self::normalize($iban), 4));
    }

    private static function validateChecksum(string $iban): bool
    {
        $rearranged = substr($iban, 4) . substr($iban, 0, 4);
        $numeric    = '';

        for ($i = 0; $i < strlen($rearranged); $i++) {
            $char = $rearranged[$i];
            $numeric .= ctype_alpha($char) ? (ord($char) - ord('A') + 10) : $char;
        }

        return bcmod($numeric, '97') === '1';
    }
}
