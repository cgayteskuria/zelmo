import { useMemo } from 'react';
import DOMPurify from 'dompurify';

/**
 * Composant pour afficher du contenu HTML de manière sécurisée
 * Utilise DOMPurify pour sanitiser le HTML et prévenir les attaques XSS
 *
 * @param {string} html - Le contenu HTML à afficher
 * @param {string} className - Classes CSS optionnelles
 * @param {object} style - Styles inline optionnels
 * @param {string} as - Élément HTML à utiliser (div, span, p, etc.) - défaut: div
 * @param {object} purifyOptions - Options de configuration DOMPurify
 */
export default function HtmlContent({
    html = '',
    className = '',
    style = {},
    as: Component = 'div',
    purifyOptions = {}
}) {
    // Configuration par défaut de DOMPurify
    const defaultOptions = {
        ALLOWED_TAGS: [
            'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li',
            'blockquote', 'pre', 'code',
            'a', 'img',
            'span', 'div'
        ],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'class', 'style'],
        ALLOW_DATA_ATTR: false,
        // Forcer target="_blank" à avoir rel="noopener noreferrer" pour la sécurité
        ADD_ATTR: ['target'],
    };

    // Sanitiser le HTML
    const sanitizedHtml = useMemo(() => {
        if (!html || typeof html !== 'string') return '';

        const options = { ...defaultOptions, ...purifyOptions };
        let clean = DOMPurify.sanitize(html, options);

        // Ajouter rel="noopener noreferrer" aux liens externes
        clean = clean.replace(
            /<a\s+([^>]*href="https?:\/\/[^"]*"[^>]*)>/gi,
            (match, attrs) => {
                if (!attrs.includes('rel=')) {
                    return `<a ${attrs} rel="noopener noreferrer">`;
                }
                return match;
            }
        );

        return clean;
    }, [html, purifyOptions]);

    // Si pas de contenu, ne rien afficher
    if (!sanitizedHtml) return null;

    return (
        <Component
            className={className}
            style={style}
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
    );
}
