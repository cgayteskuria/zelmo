import { useMemo } from "react";
import { Select } from "antd";
import { invoicingDurationsApi } from "../../services/api";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";

export default function InvoicingDurationSelect({
    filters = {},
    value,
    initialData = null,
    loadInitially = false,
    selectDefault,
    onDefaultSelected = null,
    onChange,
    ...props
}) {
    const initialOptions = useMemo(() => {
        if (!initialData) return [];
        return [{ value: initialData.dur_id, label: initialData.dur_label }];
    }, [initialData]);

    const { selectProps, defaultValue } = useServerSearchSelect({
        apiFn: (params) => invoicingDurationsApi.options(params),
        filters,
        loadInitially,
        initialOptions,
        selectDefault,
        onDefaultSelected,
    });

    return (
        <Select
            placeholder="Sélectionner une fréquence de facturation"
            {...selectProps}
            value={value !== undefined ? value : defaultValue}
            onChange={onChange}
            {...props}
        />
    );
}
