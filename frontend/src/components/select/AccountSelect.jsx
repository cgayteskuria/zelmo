import { useState, useMemo, useCallback } from "react";
import { accountsApi } from "../../services/api";
import { Select, Button } from "antd";
import { message } from '../../utils/antdStatic';
import { PlusOutlined } from "@ant-design/icons";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";

export default function AccountSelect({
    filters = {},
    value,
    initialData = null,
    accountSelectConfig = {},
    loadInitially = true,
    onChange,
    onOptionsLoaded,
    ...props
}) {
    const [autoAccountLoading, setAutoAccountLoading] = useState(false);
    const { form, fieldName, sourceFieldName } = accountSelectConfig;

    const initialOptions = useMemo(() => {
        if (!initialData) return [];
        return [{
            value: initialData.acc_id,
            label: `${initialData.acc_code} - ${initialData.acc_label}`,
        }];
    }, [initialData]);

    const mapOption = useCallback((item) => ({
        value: item.id,
        label: `${item.code} - ${item.label}`,
        code:  item.code,
        type:  item.type,
    }), []);

    const { selectProps, reload, defaultValue, injectOption } = useServerSearchSelect({
        apiFn: (params) => accountsApi.options(params),
        mapOption,
        filters,
        loadInitially,
        initialOptions,
        onOptionsLoaded,
    });

    const handleAutoCreateAccount = async () => {
        if (!form || !fieldName || !sourceFieldName) {
            message.error("Configuration manquante pour la création automatique.");
            return;
        }
        const currentValue = form.getFieldValue(sourceFieldName);
        if (!currentValue) {
            message.error("La valeur du champ est requise pour créer le compte.");
            return;
        }
        try {
            setAutoAccountLoading(true);
            const accountResponse = await accountsApi.autoCreateAccount(currentValue, filters?.code);
            const { id, code, label } = accountResponse.account;
            injectOption({ value: id, label: `${code} - ${label}`, code, type: null });
            form.setFieldsValue({ [fieldName]: id });
            message.success(`Compte ${code} créé avec succès`);
        } catch (error) {
            console.error(error);
            const data = error.data;
            if (data?.errors) {
                const msgs = Object.values(data.errors).flat();
                message.error(msgs.join(' — '));
            } else if (error.message) {
                message.error(error.message);
            } else {
                message.error('Erreur lors de la création du compte');
            }
        } finally {
            setAutoAccountLoading(false);
        }
    };

    const customPopupRender = sourceFieldName ? (menu) => (
        <>
            {menu}
            <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={handleAutoCreateAccount}
                    loading={autoAccountLoading}
                    block
                >
                    Créer automatiquement
                </Button>
            </div>
        </>
    ) : undefined;

    return (
        <Select
            placeholder="Sélectionner un compte"
            allowClear
            {...selectProps}
            popupRender={customPopupRender || selectProps.popupRender}
            value={value !== undefined ? value : defaultValue}
            onChange={onChange}
            {...props}
        />
    );
}
