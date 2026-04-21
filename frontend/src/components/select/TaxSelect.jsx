import { useMemo } from "react";
import { taxsApi } from "../../services/api";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";
import { Select } from "antd";

export default function TaxSelect({
    filters = {},
    value,
    initialData = null,
    loadInitially = true,
    selectDefault,
    onDefaultSelected = null,
    ...props
}) {
    // Préparer les options initiales au bon format
    const initialOptions = useMemo(() => {
        // On vérifie strictement la présence de l'ID
        if (!initialData) return [];
        return [{
            value: initialData.tax_id,
            label: initialData.tax_label
        }];
    }, [initialData]);


    const { selectProps } = useServerSearchSelect({
        apiFn: (filters) => taxsApi.options(filters),
        placeholder: "Sélectionner une TVA...",
        filters,
        loadInitially,
        initialOptions,
        initialLimit: 50,
    });

    return (
        <Select
            value={value ? { value, label: initialOptions?.label } : undefined}
            // onChange={onChange}           
            {...selectProps}
            {...props}
        />
    );
};