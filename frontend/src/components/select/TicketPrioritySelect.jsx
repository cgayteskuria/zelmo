import { useMemo, useCallback } from "react";
import { ticketsApi } from "../../services/api";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";
import { Select } from "antd";

export default function TicketPrioritySelect({
    filters = {},
    value,
    initialData = null,
    loadInitially = false,
    onChange,
    selectDefault,
    onDefaultSelected = null,
    ...props
}) {
    const initialOptions = useMemo(() => {
        if (!initialData) return [];
        return [{
            value: initialData.tkp_id,
            label: initialData.tkp_label,
        }];
    }, [initialData]);

    const mapOption = useCallback((item) => ({
        value: item.id,
        label: item.label,
        default: item.default,
    }), []);

    const { selectProps } = useServerSearchSelect({
        apiFn: (params) => ticketsApi.priorityOptions(params),
        mapOption,
        placeholder: "Sélectionner une priorité",
        filters,
        loadInitially,
        initialOptions,
        selectDefault,
        onDefaultSelected,
    });

    return <Select value={value} onChange={onChange} {...selectProps} {...props} />;
}
