import { useMemo } from "react";
import { Select } from "antd";
import { paymentModesApi } from "../../services/api";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";

export default function PaymentModeSelect({
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
        return [{ value: initialData.pam_id, label: initialData.pam_label }];
    }, [initialData]);

    const { selectProps, defaultValue } = useServerSearchSelect({
        apiFn: (params) => paymentModesApi.options(params),
        filters,
        loadInitially,
        initialOptions,
        selectDefault,
        onDefaultSelected,
    });

    return (
        <Select
            placeholder="Sélectionner un mode de paiement"
            {...selectProps}
            value={value !== undefined ? value : defaultValue}
            onChange={onChange}
            {...props}
        />
    );
}
