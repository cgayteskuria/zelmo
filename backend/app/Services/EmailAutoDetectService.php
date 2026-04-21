<?php

namespace App\Services;

class EmailAutoDetectService
{
    /**
     * Configurations prédéfinies des fournisseurs email populaires
     */
    private $providers = [
        'gmail.com' => [
            'imap_host' => 'imap.gmail.com',
            'imap_port' => 993,
            'smtp_host' => 'smtp.gmail.com',
            'smtp_port' => 587,
        ],
        'outlook.com' => [
            'imap_host' => 'outlook.office365.com',
            'imap_port' => 993,
            'smtp_host' => 'smtp.office365.com',
            'smtp_port' => 587,
        ],
        'hotmail.com' => [
            'imap_host' => 'outlook.office365.com',
            'imap_port' => 993,
            'smtp_host' => 'smtp.office365.com',
            'smtp_port' => 587,
        ],
        'yahoo.com' => [
            'imap_host' => 'imap.mail.yahoo.com',
            'imap_port' => 993,
            'smtp_host' => 'smtp.mail.yahoo.com',
            'smtp_port' => 587,
        ],
        'icloud.com' => [
            'imap_host' => 'imap.mail.me.com',
            'imap_port' => 993,
            'smtp_host' => 'smtp.mail.me.com',
            'smtp_port' => 587,
        ],
        'aol.com' => [
            'imap_host' => 'imap.aol.com',
            'imap_port' => 993,
            'smtp_host' => 'smtp.aol.com',
            'smtp_port' => 587,
        ],
    ];

    public function getProviderConfig(string $providerName): array
    {
        return $this->providers[$providerName];
    }
    /**
     * Détecte les serveurs IMAP/SMTP en fonction du domaine de l'email
     */
    public function detectServers(string $email): array
    {
        $domain = strtolower(substr(strrchr($email, "@"), 1));

        // Si c'est un fournisseur connu, utiliser les paramètres prédéfinis
        if (isset($this->providers[$domain])) {
            return $this->providers[$domain];
        }

        // Sinon, tenter la détection automatique via DNS
        return $this->detectViaDNS($domain);
    }

    /**
     * Détection via DNS (MX et SRV)
     */
    private function detectViaDNS(string $domain): array
    {
        $result = [
            'imap_host' => null,
            'imap_port' => 993, // port SSL par défaut
            'smtp_host' => null,
            'smtp_port' => 587, // port TLS par défaut
        ];

        // --- Détection SMTP via MX records ---
        $mxRecords = [];

        if (getmxrr($domain, $mxRecords)) {
            asort($mxRecords);
            $mxRecords = array_values($mxRecords);

            if (!empty($mxRecords)) {
                $firstMx = strtolower(preg_replace('/\.$/', '', $mxRecords[0])); // premier MX, sans point final

                // Extraire le domaine de fin du MX (ex: outlook.com)
                $mxParts = explode('.', $firstMx);
                $mxDomain = implode('.', array_slice($mxParts, -2)); // garde les deux derniers segments

                if (isset($this->providers[$mxDomain])) {
                    // Utiliser les paramètres prédéfinis du provider connu
                    return $this->providers[$mxDomain];
                }

                // Sinon, utiliser le MX pour SMTP
                $result['smtp_host'] = $firstMx;
            }
        } else {
            // fallback générique
            $result['smtp_host'] = "smtp.$domain";
        }

        // --- Détection IMAP via SRV records (si disponible) ---
        // Exemple pour IMAP sécurisé (_imap._tcp.domain)
        $srvRecords = dns_get_record("_imap._tcp." . $domain, DNS_SRV);
        if (!empty($srvRecords)) {
            // Prendre le serveur avec la priorité la plus faible
            usort($srvRecords, fn($a, $b) => $a['pri'] <=> $b['pri']);
            $result['imap_host'] = $srvRecords[0]['target'];
            $result['imap_port'] = $srvRecords[0]['port'];
        } else {
            // fallback générique
            $result['imap_host'] = "imap.$domain";
        }

        return $result;
    }
}
