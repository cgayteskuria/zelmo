import { useMemo } from "react";
import { Select } from "antd";
import { warehousesApi } from "../../services/api";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";

export default function WarehouseSelect({
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
        return [{ value: initialData.whs_id, label: initialData.whs_label }];
    }, [initialData]);

    const { selectProps, defaultValue } = useServerSearchSelect({
        apiFn: (params) => warehousesApi.options(params),
        filters,
        loadInitially,
        initialOptions,
        selectDefault,
        onDefaultSelected,
    });

    return (
        <Select
            placeholder="Sélectionner un entrepôt"
            {...selectProps}
            value={value !== undefined ? value : defaultValue}
            onChange={onChange}
            {...props}
        />
    );
}
