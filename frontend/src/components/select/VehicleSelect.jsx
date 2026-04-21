import { useMemo, useCallback } from "react";
import { myVehiclesApi, createVehiclesApi } from "../../services/api";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";
import { Select } from "antd";

export default function VehicleSelect({
    userId = null,
    filters = {},
    value,
    initialData = null,
    loadInitially = true,
    selectDefault = false,
    onDefaultSelected = null,
    onChange,
    ...props
}) {
    const initialOptions = useMemo(() => {
        if (!initialData) return [];
        return [{
            value: initialData.vhc_id || initialData.id,
            label: `${initialData.vhc_name} (${initialData.vhc_fiscal_power} CV)`,
        }];
    }, [initialData]);

    const apiFn = useCallback((params) => {
        if (userId) {
            return createVehiclesApi(userId).options(params);
        }
        return myVehiclesApi.options(params);
    }, [userId]);

    const mapOption = useCallback((item) => ({
        value: item.id,
        label: item.label,
        default: item.is_default,
    }), []);

    const { selectProps, defaultValue } = useServerSearchSelect({
        apiFn,
        mapOption,
        filters,
        loadInitially,
        initialOptions,
        selectDefault,
        onDefaultSelected,
    });

    return (
        <Select
            placeholder="Sélectionner un véhicule"
            {...selectProps}
            value={value !== undefined ? value : defaultValue}
            onChange={onChange}
            {...props}
        />
    );
}
