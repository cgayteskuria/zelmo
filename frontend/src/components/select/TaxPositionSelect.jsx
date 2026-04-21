import { useMemo } from "react";
import { Select } from "antd";
import { taxPositionApi } from "../../services/api";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";

export default function TaxPositionSelect({
    filters = {},
    value,
    initialData = null,
    loadInitially = true,
    selectDefault,
    onDefaultSelected = null,
    onChange,
    ...props
}) {
    const initialOptions = useMemo(() => {
        if (!initialData) return [];
        return [{ value: initialData.tap_id, label: initialData.tap_label }];
    }, [initialData]);

    const { selectProps, defaultValue } = useServerSearchSelect({
        apiFn: (params) => taxPositionApi.options(params),
        filters,
        loadInitially,
        initialOptions,
        selectDefault,
        onDefaultSelected,
    });

    return (
        <Select
            placeholder="Sélectionner une position fiscale"
            {...selectProps}
            value={value !== undefined ? value : defaultValue}
            onChange={onChange}
            {...props}
        />
    );
}
