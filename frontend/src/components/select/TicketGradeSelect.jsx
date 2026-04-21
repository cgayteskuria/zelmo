import { useMemo, useCallback } from "react";
import { ticketsApi } from "../../services/api";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";
import { Select } from "antd";

export default function TicketGradeSelect({
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
            value: initialData.tkg_id,
            label: initialData.tkg_label,
        }];
    }, [initialData]);

    const mapOption = useCallback((item) => ({
        value: item.id,
        label: item.label,
    }), []);

    const { selectProps } = useServerSearchSelect({
        apiFn: (params) => ticketsApi.gradeOptions(params),
        mapOption,
        placeholder: "Sélectionner un type",
        filters,
        loadInitially,
        initialOptions,
    });

    return <Select value={value} onChange={onChange} {...selectProps} {...props} />;
}
