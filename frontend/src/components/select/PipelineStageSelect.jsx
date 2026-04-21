import { useMemo, useCallback } from "react";
import { opportunitiesApi } from "../../services/apiProspect";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";
import { Select, Tag } from "antd";

export default function PipelineStageSelect({
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
            value: initialData.pps_id,
            label: initialData.pps_label,
            color: initialData.pps_color,
        }];
    }, [initialData]);

    const mapOption = useCallback((item) => ({
        value: item.id,
        label: item.label,
        color: item.color,
        probability: item.probability,
    }), []);

    const { selectProps } = useServerSearchSelect({
        apiFn: (params) => opportunitiesApi.stageOptions(params),
        mapOption,
        placeholder: "Sélectionner une étape",
        filters,
        loadInitially,
        initialOptions,
    });

    return (
        <Select
            value={value}
            onChange={onChange}
            {...selectProps}
            {...props}
            optionRender={(option) => (
                <Tag color={option.data.color}>{option.label}</Tag>
            )}
        />
    );
}
