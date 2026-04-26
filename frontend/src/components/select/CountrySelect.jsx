import { useState, useRef, useMemo, useCallback } from "react";
import { Select } from "antd";
import { countriesApi } from "../../services/api";

// Cache module-level partagé entre toutes les instances
let moduleCache = null;
let fetchPromise = null;

function toOption(c) {
    return { value: c.cty_code, label: `${c.cty_code} — ${c.cty_name}`, name: c.cty_name };
}

function fetchCountries() {
    if (moduleCache) return Promise.resolve(moduleCache);
    if (fetchPromise) return fetchPromise;
    fetchPromise = countriesApi.list()
        .then((res) => {
            moduleCache = res.data ?? [];
            return moduleCache;
        })
        .catch((err) => {
            fetchPromise = null; // permet de réessayer
            throw err;
        });
    return fetchPromise;
}

export default function CountrySelect({
    value,
    onChange,
    placeholder = "Sélectionnez un pays",
    initialData,
    ...props
}) {
    const [options, setOptions] = useState(() => moduleCache ? moduleCache.map(toOption) : []);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const loaded = useRef(!!moduleCache);

    const load = useCallback(() => {
        if (loaded.current) return;
        setLoading(true);
        setError(false);
        fetchCountries()
            .then((list) => {
                loaded.current = true;
                setOptions(list.map(toOption));
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, []);

    const handleDropdownVisibleChange = useCallback((open) => {
        if (open) load();
    }, [load]);

    // Option de secours pour afficher le libellé avant chargement
    const resolvedOptions = useMemo(() => {
        if (!initialData || loaded.current) return options;
        const code = typeof initialData === 'object' ? initialData.cty_code : initialData;
        if (!code) return options;
        const name = typeof initialData === 'object' ? (initialData.cty_name ?? code) : code;
        const seed = { value: code, label: `${code} — ${name}`, name };
        return [seed, ...options.filter((o) => o.value !== code)];
    }, [initialData, options, loaded.current]);

    return (
        <Select
            showSearch
            value={value}
            onChange={onChange}
            loading={loading}
            placeholder={error ? "Erreur de chargement" : placeholder}
            status={error ? "error" : undefined}
            optionFilterProp="label"
            filterOption={(input, option) => {
                const q = input.toLowerCase();
                return (
                    option.value.toLowerCase().includes(q) ||
                    (option.name ?? "").toLowerCase().includes(q)
                );
            }}
            options={resolvedOptions}
            onDropdownVisibleChange={handleDropdownVisibleChange}
            {...props}
        />
    );
}
