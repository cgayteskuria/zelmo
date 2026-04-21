import { useMemo, useCallback } from "react";
import { ticketsApi } from "../../services/api";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";
import { Select } from "antd";

export default function TicketSourceSelect({
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
        return [{
            value: initialData.tks_id,
            label: initialData.tks_label,
        }];
    }, [initialData]);

    const mapOption = useCallback((item) => ({
        value: item.id,
        label: item.label,
        default: item.default,
    }), []);

    const { selectProps } = useServerSearchSelect({
        apiFn: (params) => ticketsApi.sourceOptions(params),
        mapOption,
        placeholder: "Sélectionner une source",
        filters,
        loadInitially,
        initialOptions,
        selectDefault,
        onDefaultSelected,
    });

    return <Select value={value} onChange={onChange} {...selectProps} {...props} />;
}
