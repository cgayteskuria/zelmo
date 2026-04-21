import { useMemo, useCallback } from "react";
import { Select } from "antd";
import { banksApi } from "../../services/api";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";

export default function BankSelect({
    filters = {},
    value,
    initialData = null,
    apiSource = null,
    loadInitially = true,
    selectDefault,
    onDefaultSelected = null,
    onChange,
    ...props
}) {
    const initialOptions = useMemo(() => {
        if (!initialData) return [];
        return [{ value: initialData.bts_id, label: initialData.bts_label }];
    }, [initialData]);

    const apiFn = useCallback((params) => {
        if (apiSource) return apiSource(params);
        return banksApi.options(params);
    }, [apiSource]);

    const { selectProps, defaultValue } = useServerSearchSelect({
        apiFn,
        filters,
        loadInitially,
        initialOptions,
        selectDefault,
        onDefaultSelected,
    });

    return (
        <Select
            placeholder="Sélectionner une banque"
            {...selectProps}
            value={value !== undefined ? value : defaultValue}
            onChange={onChange}
            {...props}
        />
    );
}
