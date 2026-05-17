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

/**
 * Formatteur pour les dates avec heure (ex : 11/05/2026 14:30)
 */
export const formatDateTime = (value) => {
    if (!value) return "";
    return new Date(value).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
};
