import { useMemo, useCallback } from "react";
import { opportunitiesApi } from "../../services/apiProspect";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";
import { Select } from "antd";

export default function ProspectSourceSelect({
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
        return [{ value: initialData.pso_id, label: initialData.pso_label }];
    }, [initialData]);

    const mapOption = useCallback((item) => ({
        value: item.id,
        label: item.label,
    }), []);

    const { selectProps } = useServerSearchSelect({
        apiFn: (params) => opportunitiesApi.sourceOptions(params),
        mapOption,
        placeholder: "Sélectionner une source",
        filters,
        loadInitially,
        initialOptions,
        selectDefault,
        onDefaultSelected,
    });

    return <Select value={value} onChange={onChange} {...selectProps} {...props} allowClear />;
}
