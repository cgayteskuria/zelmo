import { useMemo, useCallback } from "react";
import { opportunitiesApi } from "../../services/apiProspect";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";
import { Select } from "antd";

export default function OpportunitySelect({
    filters = {},
    value,
    initialData = null,
    loadInitially = false,
    onChange,
    onSelect,
    ...props
}) {
    const initialOptions = useMemo(() => {
        if (!initialData) return [];
        return [{
            value: initialData.opp_id,
            label: initialData.opp_label,
            fk_ptr_id: initialData.fk_ptr_id,
            ptr_name: initialData.ptr_name,
        }];
    }, [initialData]);

    const mapOption = useCallback((item) => ({
        value: item.id,
        label: item.label,
        fk_ptr_id: item.fk_ptr_id,
        ptr_name: item.ptr_name,
    }), []);

    const { selectProps } = useServerSearchSelect({
        apiFn: (params) => opportunitiesApi.opportunityOptions(params),
        mapOption,
        placeholder: "Sélectionner une opportunité",
        filters,
        loadInitially,
        initialOptions,
    });

    const handleChange = (val, option) => {
        onChange?.(val);
        onSelect?.(val, option);
    };

    return (
        <Select
            value={value}
            onChange={handleChange}
            {...selectProps}
            {...props}
            allowClear
            optionRender={(option) => (
                <div>
                    <div>{option.label}</div>
                    {option.data.ptr_name && (
                        <div style={{ fontSize: 12, color: '#999' }}>{option.data.ptr_name}</div>
                    )}
                </div>
            )}
        />
    );
}
