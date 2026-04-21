import { useMemo, useCallback } from "react";
import { rolesApi } from "../../services/api";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";
import { Select } from "antd";

export default function RoleSelect({
    filters = {},
    value,
    initialData = null,
    loadInitially = false,
    selectDefault = false,
    onDefaultSelected = null,
    onChange,
    ...props
}) {
    const initialOptions = useMemo(() => {
        if (!initialData) return [];
        const items = Array.isArray(initialData) ? initialData : [initialData];
        return items
            .filter(item => item != null && item.id != null) // ← filtrer les nulls
            .map(item => ({
                value: item.id,
                label: item.name,
            }));
    }, [initialData]);

    const apiFn = useCallback((params) => {
        return rolesApi.options(params);
    }, []);

    const mapOption = useCallback((item) => ({
        value: item.id,
        label: item.label,
        default: item.is_default,
    }), []);

    const { selectProps, defaultValue } = useServerSearchSelect({
        apiFn,
        mapOption,
        filters,
        loadInitially,
        initialOptions,
        selectDefault,
        onDefaultSelected,
    });

    return (
        <Select
            placeholder="Sélectionner les rôles"
            {...selectProps}
            value={value !== undefined ? value : defaultValue}
            onChange={onChange}
            {...props}
        />
    );
}