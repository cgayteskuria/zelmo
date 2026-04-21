import { useMemo, useCallback } from "react";
import { ticketsApi } from "../../services/api";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";
import { Select } from "antd";

export default function TicketCategorySelect({
    filters = {},
    value,
    initialData = null,
    loadInitially = false,
    onChange,
    ...props
}) {
    const initialOptions = useMemo(() => {
        if (!initialData) return [];
        return [{
            value: initialData.tkc_id,
            label: initialData.tkc_label,
        }];
    }, [initialData]);

    const mapOption = useCallback((item) => ({
        value: item.id,
        label: item.label,
    }), []);

    const { selectProps } = useServerSearchSelect({
        apiFn: (params) => ticketsApi.categoryOptions(params),
        mapOption,
        placeholder: "Sélectionner une catégorie",
        filters,
        loadInitially,
        initialOptions,
    });

    return <Select value={value} onChange={onChange} {...selectProps} {...props} />;
}
