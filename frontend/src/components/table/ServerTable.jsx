import { forwardRef, useImperativeHandle } from 'react';
import { Table, Button } from 'antd';
import { ClearOutlined, SearchOutlined } from '@ant-design/icons';
import useServerTable from '../../hooks/useServerTable';

/**
 * Composant Table avec tri, filtre et pagination côté serveur.
 * Wrapper autour de Ant Design Table + useServerTable hook.
 * Les grid settings sont gérés par le backend (chargement/sauvegarde dans la réponse index).
 *
 * @param {function} fetchFn - Fonction de fetch (params) => Promise<{ data, total, gridSettings }>
 * @param {Array} columns - Définitions des colonnes (voir useServerTable pour le format)
 * @param {object} defaultSort - Tri par défaut { field, order }
 * @param {number} defaultPageSize - Taille de page par défaut
 * @param {function} onRowClick - Callback au clic sur une ligne
 * @param {string} rowKey - Clé d'identification des lignes (défaut: "id")
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
    ...restProps
}, ref) => {
    const { tableProps, reload, resetFilters, updateFilters, filtersActive, filters } = useServerTable({
        fetchFn,
        columns,
        defaultSort,
        defaultPageSize,
        onRowClick,
        onFiltersRestored,
    });

    useImperativeHandle(ref, () => ({
        reload,
        resetFilters,
        updateFilters,
        getData: () => tableProps.dataSource || [],
    }));

    // Logique par défaut pour l'effet "Zèbre"
    const defaultRowClassName = (record, index) =>
        index % 2 === 0 ? 'table-row-light' : 'table-row-striped';

    return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            {filtersActive && (() => {
                const activeFilters = Object.entries(filters || {})
                    .filter(([_, value]) => value !== null && value !== '' && value !== undefined)
                    .map(([key, _]) => {
                        const cleanKey = key.replace(/_gte$|_lte$/, '');
                        const column = columns.find(col => col.key === cleanKey);
                        return column?.title || cleanKey;
                    })
                    .filter((value, index, self) => self.indexOf(value) === index);

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

            />
        </div>
    );
});

ServerTable.displayName = 'ServerTable';
export default ServerTable;
