import { useRef, useEffect } from 'react';
import { Input, InputNumber, DatePicker, Button, Space, Checkbox } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

/**
 * Filtre texte pour les colonnes de type texte.
 * Affiche un champ Input avec boutons OK/Reset.
 */
export function TextFilterDropdown({ columnKey, filters, onFilterChange, confirm, clearFilters }) {
    const inputRef = useRef(null);
    const value = filters[columnKey] || '';

    useEffect(() => {
        // Focus automatique à l'ouverture
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    const handleReset = () => {
        onFilterChange(columnKey, '');
        clearFilters();
    };

    return (
        <div style={{ padding: 8 }}>
            <Input
                ref={inputRef}
                placeholder="Filtrer..."
                value={value}
                onChange={(e) => onFilterChange(columnKey, e.target.value)}
                onPressEnter={confirm}
                style={{ marginBottom: 8, display: 'block' }}                
            />
            <Space>
                <Button
                    type="primary"
                    icon={<SearchOutlined />}
                    size="small"
                    onClick={confirm}
                >
                    OK
                </Button>
                <Button size="small" onClick={handleReset}>
                    Reset
                </Button>
            </Space>
        </div>
    );
}

/**
 * Filtre date avec plage (Du... / Au...) via DatePicker.
 * Utilise les suffixes _gte et _lte pour les paramètres backend.
 */
export function DateFilterDropdown({ columnKey, filters, onFilterChange, confirm, clearFilters }) {
    const gteKey = `${columnKey}_gte`;
    const lteKey = `${columnKey}_lte`;

    const handleReset = () => {
        onFilterChange(gteKey, '');
        onFilterChange(lteKey, '');
        clearFilters();
    };

    return (
        <div style={{ padding: 8 }}>
            <div style={{ marginBottom: 8 }}>
                <DatePicker
                    placeholder="Du..."
                    value={filters[gteKey] ? dayjs(filters[gteKey]) : null}
                    onChange={(date) => onFilterChange(gteKey, date ? date.format('YYYY-MM-DD') : '')}
                    style={{ width: '100%', marginBottom: 4 }}
                    format="DD/MM/YYYY"
                />
                <DatePicker
                    placeholder="Au..."
                    value={filters[lteKey] ? dayjs(filters[lteKey]) : null}
                    onChange={(date) => onFilterChange(lteKey, date ? date.format('YYYY-MM-DD') : '')}
                    style={{ width: '100%' }}
                    format="DD/MM/YYYY"
                />
            </div>
            <Space>
                <Button
                    type="primary"
                    icon={<SearchOutlined />}
                    size="small"
                    onClick={confirm}
                >
                    OK
                </Button>
                <Button size="small" onClick={handleReset}>
                    Reset
                </Button>
            </Space>
        </div>
    );
}

/**
 * Filtre numérique avec plage (Min / Max) via InputNumber.
 * Utilise les suffixes _gte et _lte pour les paramètres backend.
 */
export function NumericFilterDropdown({ columnKey, filters, onFilterChange, confirm, clearFilters }) {
    const gteKey = `${columnKey}_gte`;
    const lteKey = `${columnKey}_lte`;

    const handleReset = () => {
        onFilterChange(gteKey, '');
        onFilterChange(lteKey, '');
        clearFilters();
    };

    return (
        <div style={{ padding: 8 }}>
            <InputNumber
                placeholder="Min"
                value={filters[gteKey] || null}
                onChange={(val) => onFilterChange(gteKey, val ?? '')}
                onPressEnter={confirm}
                style={{ width: '100%', marginBottom: 4 }}
            />
            <InputNumber
                placeholder="Max"
                value={filters[lteKey] || null}
                onChange={(val) => onFilterChange(lteKey, val ?? '')}
                onPressEnter={confirm}
                style={{ width: '100%', marginBottom: 8 }}
            />
            <Space>
                <Button
                    type="primary"
                    icon={<SearchOutlined />}
                    size="small"
                    onClick={confirm}
                >
                    OK
                </Button>
                <Button size="small" onClick={handleReset}>
                    Reset
                </Button>
            </Space>
        </div>
    );
}

/**
 * Filtre à choix multiples via Checkbox.Group.
 * Envoie un tableau de valeurs sélectionnées.
 *
 * @param {Array} options - [{ value, label }] les options disponibles
 */
export function SelectFilterDropdown({ columnKey, filters, onFilterChange, confirm, clearFilters, options }) {
    const value = Array.isArray(filters[columnKey]) ? filters[columnKey] : [];

    const handleReset = () => {
        onFilterChange(columnKey, []);
        clearFilters();
    };

    return (
        <div style={{ padding: 8, minWidth: 180 }}>
            <Checkbox.Group
                value={value}
                onChange={(checkedValues) => onFilterChange(columnKey, checkedValues)}
                style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}
            >
                {options.map(opt => (
                    <Checkbox key={String(opt.value)} value={opt.value}>
                        {opt.label}
                    </Checkbox>
                ))}
            </Checkbox.Group>
            <Space>
                <Button
                    type="primary"
                    icon={<SearchOutlined />}
                    size="small"
                    onClick={confirm}
                >
                    OK
                </Button>
                <Button size="small" onClick={handleReset}>
                    Reset
                </Button>
            </Space>
        </div>
    );
}
