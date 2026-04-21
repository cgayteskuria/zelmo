import { useMemo, forwardRef, useImperativeHandle } from "react";
import { Select } from "antd";
import { partnersApi } from "../../services/api";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";

const PartnerSelect = forwardRef(({
    filters = {},
    value,
    initialData = null,
    loadInitially = false,
    onChange,
    ...props
}, ref) => {

    const initialOptions = useMemo(() => {
        if (!initialData) return [];
        return [{ value: initialData.ptr_id, label: initialData.ptr_name }];
    }, [initialData]);

    const { selectProps, reload, injectOption, defaultValue } = useServerSearchSelect({
        apiFn: (params) => partnersApi.options(params),
        filters,
        loadInitially,
        initialOptions,
    });

    useImperativeHandle(ref, () => ({ reload, injectOption }));

    return (
        <Select
            placeholder="Sélectionner un tiers"
            {...selectProps}
            value={value !== undefined ? value : defaultValue}
            onChange={onChange}
            {...props}
        />
    );
});

export default PartnerSelect;
