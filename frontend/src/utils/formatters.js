/**
 * Formatteur pour les montants en euros
 */
export const formatCurrency = (value) => {
    if (!value) return "0,00 €";
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
    }).format(value);
};

/**
 * Formatteur pour les dates
 */
export const formatDate = (value) => {
    if (!value) return "";
    return new Date(value).toLocaleDateString('fr-FR');
};
