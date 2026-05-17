import { useMemo, useCallback } from "react";
import { Select } from "antd";
import { messageEmailAccountsApi } from "../../services/api";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";

export default function MessageEmailAccountSelect({
    filters = {},
    value,
    initialData = null,
    loadInitially = true,
    selectDefault,
    onDefaultSelected = null,
    onOptionsLoaded = null,
    onChange,
    ...props
}) {
    const initialOptions = useMemo(() => {
        if (!initialData) return [];
        return [{ value: initialData.eml_id, label: initialData.eml_label }];
    }, [initialData]);

    // Lors de l'auto-sélection du compte par défaut, on notifie aussi onChange
    // pour que l'état parent (ex: emailAccountId dans EmailDialog) soit bien mis à jour.
    const handleDefaultSelected = useCallback((val) => {
        onChange?.(val);
        onDefaultSelected?.(val);
    }, [onChange, onDefaultSelected]);

    const { selectProps } = useServerSearchSelect({
        apiFn: (params) => messageEmailAccountsApi.options(params),
        filters,
        loadInitially,
        initialOptions,
        selectDefault,
        onDefaultSelected: handleDefaultSelected,
        onOptionsLoaded,
    });

    // On exclut defaultValue du spread : le composant est entièrement contrôlé par value.
    // handleDefaultSelected appelle onChange pour synchroniser l'état parent dès l'auto-sélection.
    const { defaultValue: _ignored, ...restSelectProps } = selectProps;

    return (
        <Select
            placeholder="Sélectionner un compte"
            {...restSelectProps}
            value={value}
            onChange={onChange}
            {...props}
        />
    );
}
