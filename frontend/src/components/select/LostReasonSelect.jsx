import { useMemo, useCallback } from "react";
import { opportunitiesApi } from "../../services/apiProspect";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";
import { Select } from "antd";

export default function LostReasonSelect({
    filters = {},
    value,
    initialData = null,
    loadInitially = false,
    onChange,
    ...props
}) {
    const initialOptions = useMemo(() => {
        if (!initialData) return [];
        return [{ value: initialData.plr_id, label: initialData.plr_label }];
    }, [initialData]);

    const mapOption = useCallback((item) => ({
        value: item.id,
        label: item.label,
    }), []);

    const { selectProps } = useServerSearchSelect({
        apiFn: (params) => opportunitiesApi.lostReasonOptions(params),
        mapOption,
        placeholder: "Sélectionner une raison",
        filters,
        loadInitially,
        initialOptions,
    });

    return <Select value={value} onChange={onChange} {...selectProps} {...props} allowClear />;
}
