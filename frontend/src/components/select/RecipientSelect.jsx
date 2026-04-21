import { useState, useCallback, useMemo } from "react";
import { Select, Tag, Spin, App } from "antd";
import { contactsApi } from "../../services/api";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Fonction debounce simple pour éviter la dépendance lodash
function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

/**
 * RecipientSelect - Sélecteur de destinataires email avec recherche de contacts
 *
 * Permet de :
 * - Afficher les 50 premiers contacts à l'ouverture
 * - Rechercher/filtrer des contacts par nom/email
 * - Saisir manuellement des adresses email (uniquement valides)
 *
 * @param {Array} value - Liste des emails sélectionnés
 * @param {Function} onChange - Callback appelé avec la nouvelle liste d'emails
 * @param {string} placeholder - Placeholder du champ
 * @param {boolean} disabled - Désactiver le champ
 * @param {Object} style - Styles CSS
 */
export default function RecipientSelect({
    value = [],
    onChange,
    placeholder = "Saisir ou rechercher des contacts...",
    disabled = false,
    style = {},
    ...props
}) {
    const { message } = App.useApp();
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const [initialLoaded, setInitialLoaded] = useState(false);

    // Valider si une chaîne est un email valide
    const isValidEmail = useCallback((email) => EMAIL_REGEX.test(email), []);

    // Charger les contacts (initiaux ou filtrés)
    const loadContacts = useCallback(async (search = "") => {
        setLoading(true);
        try {
            // Si pas de recherche, charger les 50 premiers contacts
            const params = search ? { search } : { limit: 50 };
            const response = await contactsApi.options(params);
            const contacts = response?.data || [];

            // Transformer les contacts en options
            const contactOptions = contacts.map((contact) => ({
                value: contact.email,
                label: contact.label,
                name: contact.name,
                email: contact.email,
            }));

            setOptions(contactOptions);
        } catch (error) {
            console.error("Erreur chargement contacts:", error);
            setOptions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Recherche avec debounce
    const debouncedSearch = useMemo(
        () => debounce((search) => loadContacts(search), 300),
        [loadContacts]
    );

    // Charger les contacts initiaux à l'ouverture du dropdown
    const handleOpenChange = useCallback(
        (open) => {
            if (open && !initialLoaded) {
                loadContacts("");
                setInitialLoaded(true);
            }
        },
        [initialLoaded, loadContacts]
    );

    // Gérer le changement de recherche
    const handleSearch = useCallback(
        (search) => {
            setSearchValue(search);
            if (search.length >= 2) {
                debouncedSearch(search);
            } else if (search.length === 0) {
                // Recharger la liste initiale si on efface la recherche
                loadContacts("");
            }
        },
        [debouncedSearch, loadContacts]
    );

    // Gérer la sélection/désélection - empêcher les emails invalides
    const handleChange = useCallback(
        (newValues) => {
            // Filtrer et nettoyer les valeurs
            const cleanedValues = [];
            let hasInvalid = false;

            newValues.forEach((v) => {
                const trimmed = v.trim();
                if (trimmed.length === 0) return;

                if (isValidEmail(trimmed)) {
                    cleanedValues.push(trimmed);
                } else {
                    hasInvalid = true;
                }
            });

            if (hasInvalid) {
                message.warning("Format d'adresse email invalide");
            }

            onChange?.(cleanedValues);
            setSearchValue("");
        },
        [onChange, isValidEmail, message]
    );

    // Tag personnalisé (tous les tags sont valides car on bloque les invalides)
    const tagRender = useCallback(
        ({ value: tagValue, closable, onClose }) => (
            <Tag
                color="blue"
                closable={closable}
                onClose={onClose}
                style={{ marginInlineEnd: 4 }}
            >
                {tagValue}
            </Tag>
        ),
        []
    );

    // Rendu personnalisé des options
    const optionRender = useCallback((option) => (
        <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 500 }}>{option.data.name}</span>
            <span style={{ fontSize: 12, color: "#888" }}>{option.data.email}</span>
        </div>
    ), []);

    // Fusionner les options de recherche avec les valeurs actuelles
    const mergedOptions = useMemo(() => {
        // Ajouter les valeurs actuelles comme options si elles ne sont pas dans les résultats
        const currentValueOptions = value
            .filter((v) => !options.some((opt) => opt.value === v))
            .map((v) => ({
                value: v,
                label: v,
                email: v,
                name: "",
            }));

        return [...options, ...currentValueOptions];
    }, [options, value]);

    // Contenu affiché quand aucune option n'est trouvée
    const notFoundContent = useMemo(() => {
        if (loading) return <Spin size="small" />;
        if (options.length === 0) {
            return <span style={{ color: "#999" }}>Aucun contact trouvé</span>;
        }
        return null;
    }, [loading, options.length]);

    return (
        <Select
            mode="tags"
            value={value}
            onChange={handleChange}
            showSearch={{
                filterOption: false,
                onSearch: handleSearch,
                searchValue: searchValue
            }}
            onOpenChange={handleOpenChange}
            // searchValue={searchValue}
            placeholder={placeholder}
            disabled={disabled}
            style={{ width: "100%", ...style }}
            tagRender={tagRender}
            optionRender={optionRender}
            options={mergedOptions}
            tokenSeparators={[",", ";"]}
            // filterOption={false}
            notFoundContent={notFoundContent}
            allowClear
            {...props}
        />
    );
}
