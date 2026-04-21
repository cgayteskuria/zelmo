import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Divider, Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";

/**
 * Debounce stable (ne recrée jamais le timer)
 */
function useDebouncedCallback(callback, delay) {
    const timer = useRef();

    return useCallback((...args) => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            callback(...args);
        }, delay);
    }, [callback, delay]);
}

/**
 * useServerSearchSelect
 *
 * Hook React pour créer un <Select> avec recherche serveur, options injectables, et support d'option par défaut.
 *
 * Fonctionnalités :
 * - Recherche côté serveur avec debounce et annulation des requêtes en cours.
 * - Injection d'une ou plusieurs options initiales (`initialOptions`) pour pré-remplir le select.
 * - Affichage d’un bouton "Ajouter" en bas du menu avec callback `onAdd`.
 * - Sélection automatique d’une option par défaut si `selectDefault = true`.
 * - Expose `injectOption` pour ajouter dynamiquement des options (ex: après création via drawer).
 *
 * @param {Function} apiFn - Fonction asynchrone pour récupérer les options depuis le serveur. Doit retourner { data: Array }.
 * @param {Function} [mapOption] - Fonction pour transformer chaque item de l’API en option { value, label }.
 * @param {Object} [filters={}] - Filtres supplémentaires à envoyer à l’API.
 * @param {number} [debounceMs=300] - Délai de debounce pour la recherche utilisateur.
 * @param {number} [initialLimit=50] - Nombre maximum d’éléments à récupérer si aucune recherche n’est effectuée.
 * @param {boolean} [showAddButton=false] - Affiche le bouton "Ajouter" dans le menu du Select.
 * @param {string} [addButtonLabel="Ajouter"] - Label du bouton "Ajouter".
 * @param {Function} [onAdd] - Callback exécuté au clic sur le bouton "Ajouter".
 * @param {boolean} [loadInitially=false] - Charge les options depuis l’API au montage du composant si true.
 * @param {Object|Array} [initialOptions=null] - Option(s) initiales à injecter directement dans le Select.
 * @param {boolean} [selectDefault=false] - Active la sélection automatique d’une option par défaut.
 * @param {Function} [onDefaultSelected=null] - Callback appelé avec la valeur de l’option par défaut sélectionnée.
 *
 * @returns {Object} - { 
 *   selectProps: props à passer au <Select> (options, loading, onSearch, popupRender...), 
 *   reload: fonction pour recharger les options depuis l’API,
 *   injectOption: fonction pour ajouter dynamiquement une option,
 *   defaultValue: valeur sélectionnée par défaut si selectDefault = true 
 * }
 */
export function useServerSearchSelect({
    apiFn,
    mapOption = (item) => ({
        value: item.id,
        label: item.label,
    }),
    filters = {},
    debounceMs = 300,
    initialLimit = 50,
    showAddButton = false,
    addButtonLabel = "Ajouter",
    onAdd,
    loadInitially = false,
    initialOptions = null,
    selectDefault = false,
    onDefaultSelected = null,
    onOptionsLoaded = null,
}) {
    const [options, setOptions] = useState([]);

    const [loading, setLoading] = useState(false);
    const [defaultValue, setDefaultValue] = useState(null);
    const abortRef = useRef(null);


    useEffect(() => {
        if (initialOptions) {
            const opts = Array.isArray(initialOptions)
                ? initialOptions
                : [initialOptions];
            setOptions(opts);
        }
    }, [initialOptions]);

    const cacheRef = useRef(new Map());

    /**
     * Load options (avec cancel)
     */
    const loadOptions = useCallback(async (search = "") => {
        
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);

        try {
            const params = search ? { search, ...filters } : { limit: initialLimit, ...filters };
            const response = await apiFn(params, { signal: controller.signal });

            const mappedOptions = (response?.data ?? []).map(mapOption);

            setOptions(mappedOptions);
            onOptionsLoaded?.(mappedOptions);

            // Sélection automatique de la valeur par défaut si demandé
            if (selectDefault && mappedOptions.length > 0 && defaultValue === null) {
               
                const defOpt = mappedOptions.find(o => o.default === 1 || o.default === true) || mappedOptions[0];
                if (defOpt) {
                    setDefaultValue(defOpt.value);
                    onDefaultSelected?.(defOpt.value);
                }
            }

        } catch (err) {
            if (err.name !== "AbortError") {
                console.error("Select search error:", err);
            }
        } finally {
            setLoading(false);
        }
    }, [apiFn, filters, mapOption, initialLimit]);

    /**
     * Chargement initial OPTIONNEL
     */
    useEffect(() => {
        if (loadInitially) {
            loadOptions("");
        }
    }, [loadInitially]);

    /**
     * Debounce recherche
     */
    const debouncedSearch = useDebouncedCallback(loadOptions, debounceMs);

    /**
     * Chargement initial à l'ouverture
     */
    const handleDropdownOpen = useCallback((open) => {
        // ✅ Charger aussi si options contient uniquement les initialOptions
        const hasOnlyInitial = initialOptions &&
            options.length === (Array.isArray(initialOptions) ? initialOptions.length : 1);

        if (open && (options.length === 0 || hasOnlyInitial)) {
            loadOptions("");
        }
    }, [loadOptions, options.length, initialOptions]);

    /**
     * Recherche utilisateur
     */
    const handleSearch = useCallback((value) => {
        if (!value) {
            loadOptions("");
            return;
        }

        debouncedSearch(value);
    }, [debouncedSearch, loadOptions]);




    const popupRender = useCallback((menu) => {
        if (!showAddButton) return menu;

        return (
            <>
                {menu}

                <Divider style={{ margin: "8px 0" }} />

                <Button
                    type="text"
                    icon={<PlusOutlined />}
                    style={{ width: "100%", textAlign: "left" }}
                    onMouseDown={(e) => {
                        // empêche le Select de perdre le focus
                        e.preventDefault();
                    }}
                    onClick={onAdd}
                >
                    {addButtonLabel}
                </Button>
            </>
        );
    }, [showAddButton, addButtonLabel, onAdd]);

    const injectOption = useCallback((option) => {
        setOptions((prev) => {
            const exists = prev.some(o => o.value === option.value);
            if (exists) return prev;

            return [option, ...prev];
        });
    }, []);

    /**
 * Cleanup
 */
    useEffect(() => {
        return () => abortRef.current?.abort();
    }, []);
    /**
     *  Props STABLES
     */
    const selectProps = useMemo(() => ({
        showSearch: true,
        filterOption: false, // serveur only
        onSearch: handleSearch,
        onOpenChange: handleDropdownOpen,
        options,
        loading,
        notFoundContent: loading ? "Chargement..." : "Aucun résultat",
        popupRender,
        defaultValue, // permet au Select d’utiliser la valeur par défaut si nécessaire
    }), [handleSearch, handleDropdownOpen, options, loading, popupRender, defaultValue]);

    return {
        selectProps,
        reload: loadOptions,
        injectOption,
        defaultValue,
    };
}
