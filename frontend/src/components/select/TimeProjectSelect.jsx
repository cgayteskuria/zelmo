import { useMemo, forwardRef, useImperativeHandle } from "react";
import { Select } from "antd";
import { timeProjectsApi } from "../../services/api";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";

const TimeProjectSelect = forwardRef(({
    filters = {},
    value,
    initialData = null,
    loadInitially = false,
    onChange,
    ...props
}, ref) => {

    const initialOptions = useMemo(() => {
        if (!initialData) return [];
        return [{
            value: initialData.tpr_id,
            label: initialData.tpr_lib,
            color: initialData.tpr_color,
        }];
    }, [initialData]);

    const { selectProps, reload, defaultValue } = useServerSearchSelect({
        apiFn: (params) => timeProjectsApi.options(params),
        filters,
        loadInitially,
        initialOptions,
        mapOption: (item) => ({
            value: item.id,
            label: item.label,
            color: item.tpr_color,
            hourlyRate: item.tpr_hourly_rate,
        }),
    });

    useImperativeHandle(ref, () => ({ reload }));

    return (
        <Select
            placeholder="Sélectionner un projet"
            optionRender={(opt) => (
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {opt.data.color && (
                        <span style={{
                            display: "inline-block",
                            width: 10, height: 10,
                            borderRadius: "50%",
                            background: opt.data.color,
                            flexShrink: 0,
                        }} />
                    )}
                    {opt.label}
                </span>
            )}
            {...selectProps}
            value={value !== undefined ? value : defaultValue}
            onChange={onChange}
            {...props}
        />
    );
});

export default TimeProjectSelect;
