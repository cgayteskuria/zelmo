import { useState, useEffect } from 'react';
import { message } from './antdStatic';
/**
 * Fonction générique pour générer et télécharger un PDF depuis une API
 *
 * @param {Function} printApiFunction - Fonction API qui génère le PDF (ex: saleOrdersGenericApi.printPdf)
 * @param {number|string} documentId - ID du document à imprimer
 * @param {string} errorMessage - Message d'erreur personnalisé (optionnel)
 * @returns {Promise<void>}
 */
export const handleBizPrint = async (printApiFunction, documentId, errorMessage = "Veuillez enregistrer le document avant de l'imprimer") => {
    if (!documentId) {
        message.error(errorMessage);
        return;
    }

    try {
        message.loading({ content: "Génération du PDF en cours...", key: "pdfGeneration" });

        const response = await printApiFunction(documentId);

        if (!response.success) {
            throw new Error("Échec de la génération du PDF");
        }
        const { pdf, fileName } = response.data;

        // Validation du base64
        if (!pdf || typeof pdf !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(pdf)) {
            throw new Error("Format PDF invalide");
        }

        // Validation du nom de fichier
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        if (!sanitizedFileName.endsWith('.pdf')) {
            throw new Error("Extension de fichier invalide");
        }

        // Décoder le base64 en blob
        const byteCharacters = atob(pdf);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);

        // Validation du magic number PDF
        const pdfMagicNumber = byteArray.slice(0, 4);
        const isPDF = pdfMagicNumber[0] === 0x25 && // %
            pdfMagicNumber[1] === 0x50 && // P
            pdfMagicNumber[2] === 0x44 && // D
            pdfMagicNumber[3] === 0x46;   // F

        if (!isPDF) {
            throw new Error("Le fichier n'est pas un PDF valide");
        }

        const blob = new Blob([byteArray], { type: "application/pdf" });

        // Créer un lien de téléchargement
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = sanitizedFileName;
        // Ajouter rel="noopener noreferrer" si ouverture dans nouvel onglet
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();

        // Cleanup immédiat
        setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        }, 100);

        message.success({ content: "PDF généré avec succès", key: "pdfGeneration" });

    } catch (error) {
        console.error("Erreur lors de la génération du PDF:", error);
        message.error({ content: error.message || "Erreur lors de la génération du PDF", key: "pdfGeneration" });
    }
};
