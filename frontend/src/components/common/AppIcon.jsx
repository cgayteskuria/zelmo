import React from 'react';

/**
 * Affiche l'icône d'une application.
 * - Si app_icon contient une extension (ex: "crm.png") → <img> depuis /app-icons/
 * - Sinon (emoji) → <span> textuel
 *
 * @param {string} icon   - Valeur de app_icon (filename ou emoji)
 * @param {number} size   - Taille d'affichage en px (default 40)
 * @param {string} alt    - Texte alternatif pour les images
 */
const AppIcon = ({ icon, size = 40, alt = '' }) => {
    if (!icon) return null;

    const isImage = icon.includes('.');

    if (isImage) {
        return (
            <img
                src={`/app-icons/${icon}`}
                alt={alt}
                width={size}
                height={size}
                style={{ objectFit: 'contain', display: 'block' }}
            />
        );
    }

    return (
        <span style={{ fontSize: size * 0.7, lineHeight: 1, display: 'block' }}>
            {icon}
        </span>
    );
};

export default AppIcon;
