import { useMemo } from "react";
import { Select } from "antd";
import { accountJournalsApi } from "../../services/api";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";

export default function AccountJournalSelect({
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
        return [{ value: initialData.ajl_id, label: initialData.ajl_label }];
    }, [initialData]);

    const { selectProps, defaultValue } = useServerSearchSelect({
        apiFn: (params) => accountJournalsApi.options(params),
        filters,
        loadInitially,
        initialOptions,
        selectDefault,
        onDefaultSelected,
    });

    return (
        <Select
            placeholder="Sélectionner un journal"
            {...selectProps}
            value={value !== undefined ? value : defaultValue}
            onChange={onChange}
            {...props}
        />
    );
}
