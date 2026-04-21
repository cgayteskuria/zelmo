import { useCallback } from "react";
import { Select, Tag } from "antd";
import { taxTagsApi } from "../../services/api";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";

/**
 * Sélecteur de tags TVA.
 * Passe mode="multiple" pour la sélection multi-tags.
 * En mode multiple, les tags sélectionnés affichent uniquement le ttg_code.
 */
export default function TaxTagSelect({ value, onChange, mode, ...props }) {
    const apiFn = useCallback((params) => taxTagsApi.options(params), []);

    const mapOption = useCallback((item) => ({
        value: item.id,
        label: `${item.ttg_code}`,
        ttg_code: item.ttg_code,
    }), []);

    const { selectProps } = useServerSearchSelect({
        apiFn,
        mapOption,
        loadInitially: true,
    });

    const { onSearch: _ignored, filterOption: _fo, ...restSelectProps } = selectProps;

    return (
        <Select
            placeholder="Tag TVA"
            allowClear
            showSearch
            mode={mode}
            filterOption={(input, option) =>
                option?.label?.toLowerCase().includes(input.toLowerCase())
            }
            tagRender={mode === 'multiple' ? ({ label, closable, onClose }) => (
                <Tag
                    closable={closable}
                    onClose={onClose}
                    style={{ fontSize: 11, margin: '1px 2px' }}
                >
                    {typeof label === 'string' ? label.split(' — ')[0] : label}
                </Tag>
            ) : undefined}
            {...restSelectProps}
            value={value}
            onChange={onChange}
            {...props}
        />
    );
}
