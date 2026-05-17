import { useMemo, forwardRef, useImperativeHandle, useCallback, useState } from "react";
import { Select, Divider, Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { partnersApi } from "../../services/api";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";

const PartnerSelect = forwardRef(({
    filters = {},
    value,
    initialData = null,
    loadInitially = false,
    onChange,
    showAddButton = false,
    newPartnerDefaults = {},
    ...props
}, ref) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [hasResults, setHasResults] = useState(true);
    const [addLoading, setAddLoading] = useState(false);
    // Options créées inline — survivent aux rechargements serveur
    const [stickyOptions, setStickyOptions] = useState([]);

    const initialOptions = useMemo(() => {
        if (!initialData) return [];
        return [{ value: initialData.ptr_id, label: initialData.ptr_name }];
    }, [initialData]);

    const onOptionsLoaded = useCallback((options) => {
        setHasResults(options.length > 0);
    }, []);

    const { selectProps, reload, injectOption, defaultValue } = useServerSearchSelect({
        apiFn: (params) => partnersApi.options(params),
        filters,
        loadInitially,
        initialOptions,
        onOptionsLoaded,
    });

    // Fusionne les options collantes avec les options serveur (dédupliquées)
    const mergedOptions = useMemo(() => {
        const all = [...stickyOptions, ...(selectProps.options || [])];
        const seen = new Set();
        return all.filter(o => {
            if (seen.has(o.value)) return false;
            seen.add(o.value);
            return true;
        });
    }, [stickyOptions, selectProps.options]);

    const handleSearch = useCallback((val) => {
        setSearchTerm(val || "");
        if (!val) setHasResults(true);
        selectProps.onSearch?.(val);
    }, [selectProps.onSearch]);

    const handleAddPartner = useCallback(async () => {
        if (!searchTerm) return;
        setAddLoading(true);
        try {
            const res = await partnersApi.create({
                ptr_name: searchTerm,
                ptr_is_active: 1,
                ...newPartnerDefaults,
            });
            const created = res.data?.data;
            if (created?.ptr_id) {
                const newOpt = { value: created.ptr_id, label: created.ptr_name };
                setStickyOptions(prev => {
                    const exists = prev.some(o => o.value === created.ptr_id);
                    return exists ? prev : [newOpt, ...prev];
                });
                if (props.mode === 'multiple') {
                    const currentValue = Array.isArray(value) ? value : [];
                    onChange?.([...currentValue, created.ptr_id]);
                } else {
                    onChange?.(created.ptr_id);
                }
                setSearchTerm("");
                setHasResults(true);
            }
        } catch {
            // erreurs gérées par l'intercepteur Axios
        } finally {
            setAddLoading(false);
        }
    }, [searchTerm, newPartnerDefaults, onChange, props.mode, value]);

    const customPopupRender = useCallback((menu) => {
        if (!showAddButton || !searchTerm || hasResults) return menu;

        return (
            <>
                {menu}
                <Divider style={{ margin: "4px 0" }} />
                <Button
                    type="text"
                    icon={<PlusOutlined />}
                    style={{ width: "100%", textAlign: "left" }}
                    loading={addLoading}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleAddPartner}
                >
                    Ajouter «{searchTerm}»
                </Button>
            </>
        );
    }, [showAddButton, searchTerm, hasResults, addLoading, handleAddPartner]);

    useImperativeHandle(ref, () => ({ reload, injectOption }));

    return (
        <Select
            placeholder="Sélectionner un tiers"
            {...selectProps}
            options={mergedOptions}
            onSearch={handleSearch}
            value={value !== undefined ? value : defaultValue}
            onChange={onChange}
            popupRender={customPopupRender}
            {...props}
        />
    );
});

export default PartnerSelect;
