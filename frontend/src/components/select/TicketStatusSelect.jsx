import { useMemo, useCallback } from "react";
import { ticketsApi } from "../../services/api";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";
import { Select } from "antd";

export default function TicketStatusSelect({
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
            value: initialData.tke_id,
            label: initialData.tke_label,
        }];
    }, [initialData]);

    const mapOption = useCallback((item) => ({
        value: item.id,
        label: item.label,
    }), []);

    const { selectProps } = useServerSearchSelect({
        apiFn: (params) => ticketsApi.statusOptions(params),
        mapOption,
        placeholder: "Sélectionner un statut",
        filters,
        loadInitially,
        initialOptions,
    });

    return <Select value={value} onChange={onChange} {...selectProps} {...props} />;
}
