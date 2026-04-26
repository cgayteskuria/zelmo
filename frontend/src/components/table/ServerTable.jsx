import { useState, forwardRef, useImperativeHandle } from 'react';
import { Table, Button, Tooltip } from 'antd';
import { ClearOutlined, SearchOutlined, FileTextOutlined } from '@ant-design/icons';
import { message } from '../../utils/antdStatic';
import useServerTable from '../../hooks/useServerTable';

/**
 * Composant Table avec tri, filtre et pagination côté serveur.
 *
 * @param {function} fetchFn       - (params) => Promise<{ data, total, gridSettings }>
 * @param {Array}    columns       - Définitions des colonnes
 * @param {object}   defaultSort   - { field, order }
 * @param {number}   defaultPageSize
 * @param {function} onRowClick    - Callback clic ligne
 * @param {string}   rowKey        - Clé d'identification (défaut: "id")
 * @param {boolean}  csv           - Active le bouton d'export CSV (défaut: false)
 * @param {string}   csvFilename   - Nom du fichier téléchargé (défaut: "export.csv")
 */
const ServerTable = forwardRef(({
    fetchFn,
    columns,
    defaultSort,
    defaultPageSize = 50,
    onRowClick,
    rowKey = "id",
    rowClassName,
    onFiltersRestored,
    csv = false,
    csvFilename = 'export.csv',
    ...restProps
}, ref) => {
    const { tableProps, reload, resetFilters, updateFilters, filtersActive, filters, sorter } = useServerTable({
        fetchFn,
        columns,
        defaultSort,
        defaultPageSize,
        onRowClick,
        onFiltersRestored,
    });

    const [csvLoading, setCsvLoading] = useState(false);

    useImperativeHandle(ref, () => ({
        reload,
        resetFilters,
        updateFilters,
        getData: () => tableProps.dataSource || [],
    }));

    const defaultRowClassName = (record, index) =>
        index % 2 === 0 ? 'table-row-light' : 'table-row-striped';

    const handleCsvExport = async () => {
        setCsvLoading(true);
        try {
            const params = {
                sort_by: sorter.field,
                sort_order: sorter.order,
                offset: 0,
                limit: 9999,
            };

            // Reprendre les filtres actifs (même logique que fetchData dans le hook)
            const activeFilters = {};
            Object.entries(filters).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    if (value.length > 0) activeFilters[key] = value;
                } else if (value !== null && value !== '' && value !== undefined) {
                    activeFilters[key] = value;
                }
            });
            if (Object.keys(activeFilters).length > 0) {
                params.filters = activeFilters;
            }

            const response = await fetchFn(params);
            const rows = response.data || [];

            // Colonnes exportables : titre string, clé présente, pas fixée à droite (action)
            const exportCols = columns.filter(col =>
                typeof col.title === 'string' && col.key && col.fixed !== 'right'
            );

            const headers = exportCols.map(col => col.title);

            const lines = rows.map(record =>
                exportCols.map(col => {
                    const raw = record[col.key];
                    if (col.render) {
                        const rendered = col.render(raw, record);
                        if (typeof rendered === 'string' || typeof rendered === 'number') {
                            return rendered;
                        }
                    }
                    return raw ?? '';
                })
            );

            const escape = (v) => {
                const s = String(v ?? '');
                return s.includes(';') || s.includes('"') || s.includes('\n')
                    ? '"' + s.replace(/"/g, '""') + '"'
                    : s;
            };

            const csvContent = '﻿' + [headers, ...lines]
                .map(row => row.map(escape).join(';'))
                .join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = csvFilename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch {
            message.error("Erreur lors de l'export CSV");
        } finally {
            setCsvLoading(false);
        }
    };

    return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            {filtersActive && (() => {
                const activeFilters = Object.entries(filters || {})
                    .filter(([_, value]) => value !== null && value !== '' && value !== undefined)
                    .map(([key]) => {
                        const cleanKey = key.replace(/_gte$|_lte$/, '');
                        const column = columns.find(col => col.key === cleanKey);
                        return column?.title || cleanKey;
                    })
                    .filter((v, i, self) => self.indexOf(v) === i);
                const count = activeFilters.length;
                return (
                    <div style={{
                        marginBottom: 12,
                        padding: '8px 16px',
                        backgroundColor: '#e8f0fe',
                        border: '1px solid #c5d8f8',
                        borderLeft: '4px solid var(--color-active)',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}>
                        <span style={{ color: 'var(--color-active)', fontSize: 13, fontWeight: 500 }}>
                            <SearchOutlined style={{ marginRight: 6 }} />
                            {count} filtre{count > 1 ? 's' : ''} actif{count > 1 ? 's' : ''} : {activeFilters.join(', ')}
                        </span>
                        <Button
                            size="small"
                            type="link"
                            icon={<ClearOutlined />}
                            onClick={resetFilters}
                            style={{ color: 'var(--color-active)' }}
                        >
                            Effacer
                        </Button>
                    </div>
                );
            })()}

            <Table
                {...tableProps}
                rowKey={rowKey}
                rowClassName={rowClassName || defaultRowClassName}
                {...restProps}
                pagination={{
                    ...tableProps.pagination,
                    showTotal: (total, range) => (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            {range[0]}-{range[1]} sur {total}
                            {csv && (
                                <Tooltip title="Exporter en CSV">
                                    <Button
                                        size="small"
                                        icon={<FileTextOutlined />}
                                        loading={csvLoading}
                                        onClick={handleCsvExport}
                                    />
                                </Tooltip>
                            )}
                        </span>
                    ),
                }}
            />
        </div>
    );
});

ServerTable.displayName = 'ServerTable';
export default ServerTable;
