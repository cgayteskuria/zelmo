import { useMemo, useCallback } from "react";
import { productsApi } from "../../services/api";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";
import { Select } from "antd";

/**
 * ProductSelect - Sélecteur de produits avec recherche serveur
 *
 * @param {Object} filters - Filtres (is_active, category, etc.)
 * @param {Object} initialData - Données initiales {prt_id, prt_label, prt_reference}
 * @param {Function} onChange - Callback de changement de valeur
 * @param {any} value - Valeur sélectionnée
 * @param {Object} props - Autres props passées au Select
 */
export default function ProductSelect({
    filters = {},
    loadInitially = false,
    initialData = null,
   // onChange,
    value,
    ...props
}) {
    // Préparer l'option initiale
    const initialOptions = useMemo(() => {
        if (!initialData || !initialData.prt_id) return null;
        return [{
            value: initialData.prt_id,
            label: initialData.prt_label,
            reference: initialData.prt_reference,
        }];
    }, [initialData]);


    // Rendu personnalisé des options
    const renderOption = useCallback((option) => (
        <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 500 }}>{option.label}</span>
            {option.reference && (
                <span style={{ fontSize: 12, color: "#888" }}>
                    Réf: {option.reference}
                    {option.price !== undefined && ` - ${option.price} €`}
                </span>
            )}
        </div>
    ), []);

    // API function stable
    const apiFn = useCallback((params) => productsApi.options(params), []);

    const { selectProps } = useServerSearchSelect({
        apiFn,      
        placeholder: "Rechercher un produit...",
        filters,
        loadInitially,
        initialOptions,
        renderOption,
        initialLimit: 50,
    });

    return (
        <Select
            value={value ? { value, label: initialOptions?.label } : undefined}
            //onChange={onChange}          
            {...selectProps}
            {...props}
        />
    );
};
