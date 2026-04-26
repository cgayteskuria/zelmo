<?php

namespace App\Services\EInvoicing;

/**
 * Contrat que tout adaptateur PA/PDP doit implémenter.
 * Permet de changer de PA sans modifier le code métier.
 */
interface PdpClientInterface
{
    /**
     * Envoie le fichier Facture-X (PDF/A-3) au PA via multipart upload.
     * Retourne ['invoiceId' => string] — identifiant unique Iopole de la facture.
     */
    public function sendInvoice(string $pdfBinary, string $filename): array;

    /**
     * Télécharge le binaire du fichier Facture-X (PDF/A-3) depuis le PA.
     */
    public function downloadFile(string $invoiceId): string;

    /**
     * Envoie un statut sur une facture reçue.
     * Codes Iopole : IN_HAND, APPROVED, PARTIALLY_APPROVED, DISPUTED,
     *                SUSPENDED, COMPLETED, REFUSED, PAYMENT_SENT, PAYMENT_RECEIVED
     */
    public function sendStatus(string $paInvoiceId, string $status, ?string $message = null): void;

    /**
     * Enregistre l'unité légale (SIREN) de l'entreprise chez le PA.
     */
    public function registerLegalUnit(array $entityData): array;

    /**
     * Enregistre l'établissement (SIRET) de l'entreprise chez le PA.
     */
    public function registerOffice(string $legalUnitId, array $officeData): array;

    /**
     * Revendique une entité déjà créée par le PA.
     */
    public function claimEntity(string $businessEntityId): array;

    /**
     * Enregistre l'identifiant électronique (routing) de l'entité.
     */
    public function registerIdentifier(string $identifierId): array;

    /**
     * Recherche un partenaire dans l'annuaire des PDP/PA français.
     */
    public function searchDirectory(string $query): array;

    /**
     * Vérifie si ce PA supporte une fonctionnalité optionnelle.
     */
    public function supportsFeature(string $feature): bool;

    /**
     * Teste la connexion au PA. Retourne un message de succès ou lance une exception.
     */
    public function testConnection(): string;
}
