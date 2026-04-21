import { useMemo, useCallback } from "react";
import { usersApi } from "../../services/api";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";
import { Select } from "antd";

export default function UserSelect({
    filters = {},
    value,
    initialData = null,
    loadInitially = false,
    selectDefault = false,
    onDefaultSelected = null,
    onChange,
    ...props
}) {
    const initialOptions = useMemo(() => {
        if (!initialData) return [];

        return [{
            value: initialData.usr_id,
            label: [initialData?.usr_firstname, initialData?.usr_lastname, initialData?.label]
                .filter(Boolean)
                .join(' '),
        }];
    }, [initialData]);

    const mapOption = useCallback((item) => ({
        value: item.id,
        label: item.label,
    }), []);

    const { selectProps, defaultValue } = useServerSearchSelect({
        apiFn: (params) => usersApi.options(params),
        mapOption,
        placeholder: "Sélectionner un salarié",
        filters,
        loadInitially,
        initialOptions,
        selectDefault,
        onDefaultSelected,
    });

    return (
        <Select
            value={value !== undefined ? value : defaultValue}
            onChange={onChange}
            {...selectProps}
            {...props}
        />
    );
}
