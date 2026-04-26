import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { message } from '../utils/antdStatic';
import { SearchOutlined } from '@ant-design/icons';
import { TextFilterDropdown, DateFilterDropdown, NumericFilterDropdown, SelectFilterDropdown } from '../components/table/FilterDropdowns';

/**
 * Hook pour gérer une table Ant Design avec tri, filtre et pagination côté serveur.
 * Les grid settings sont chargés/sauvegardés par le backend directement dans la réponse API.
 *
 * @param {object} options
 * @param {function} options.fetchFn - Fonction de fetch (params) => Promise<{ data, total, gridSettings }>
 * @param {Array} options.columns - Définitions des colonnes
 * @param {object} options.defaultSort - Tri par défaut { field, order: "ASC"|"DESC" }
 * @param {number} options.defaultPageSize - Taille de page par défaut
 * @param {function} options.onRowClick - Callback au clic sur une ligne
 */
export default function useServerTable({
    fetchFn,
    columns,
    defaultSort = { field: 'id', order: 'DESC' },
    defaultPageSize = 50,
    onRowClick,
    onFiltersRestored,
}) {
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ current: 1, pageSize: defaultPageSize });
    const [sorter, setSorter] = useState(defaultSort);
    const [filters, setFilters] = useState({});
    const [initialized, setInitialized] = useState(false);

    // Ref pour éviter le double fetch après restauration des settings
    const skipNextFetchRef = useRef(false);

    // --- Chargement initial (sans params → backend restaure les settings) ---
    useEffect(() => {
        let cancelled = false;

        const initialLoad = async () => {
            if (!fetchFn) return;
            setLoading(true);
            try {
                // Appel sans paramètres → le backend charge les settings sauvegardés
                const response = await fetchFn({});
                if (cancelled) return;

                if (response) {
                    setData(response.data || []);
                    setTotal(response.total || 0);

                    // Restaurer le state depuis gridSettings retourné par le backend
                    const gs = response.gridSettings;
                    if (gs) {
                        if (gs.sort_by) {
                            setSorter({ field: gs.sort_by, order: gs.sort_order || 'DESC' });
                        }
                        if (gs.filters && typeof gs.filters === 'object') {
                            setFilters(gs.filters);
                            onFiltersRestored?.(gs.filters);
                        }
                        if (gs.page_size) {
                            setPagination(prev => ({ ...prev, pageSize: gs.page_size }));
                        }
                        // Empêcher le fetch déclenché par la mise à jour du state
                        skipNextFetchRef.current = true;
                    }
                }
            } catch (error) {
                if (!cancelled) {
                    message.error("Erreur lors du chargement des données");
                    console.error("Erreur:", error);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    setInitialized(true);
                }
            }
        };

        initialLoad();
        return () => { cancelled = true; };
    }, [fetchFn]);

    // --- Fetch des données (déclenché par changements de state après initialisation) ---
    const fetchData = useCallback(async () => {
        if (!fetchFn) return;

        setLoading(true);
        try {
            const params = {
                sort_by: sorter.field,
                sort_order: sorter.order,
                offset: (pagination.current - 1) * pagination.pageSize,
                limit: pagination.pageSize,
            };

            // Ajouter les filtres non-vides
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
            if (response) {
                setData(response.data || []);
                setTotal(response.total || 0);
            }
        } catch (error) {
            message.error("Erreur lors du chargement des données");
            console.error("Erreur:", error);
        } finally {
            setLoading(false);
        }
    }, [fetchFn, sorter, pagination, filters]);

    // Déclencher le fetch quand les paramètres changent (après initialisation)
    useEffect(() => {
        if (!initialized) return;

        // Skip si c'est la mise à jour de state post-initialisation
        if (skipNextFetchRef.current) {
            skipNextFetchRef.current = false;
            return;
        }

        fetchData();
    }, [initialized, fetchData]);

    // --- Handler pour le changement de table Ant ---
    const handleTableChange = useCallback((pag, _antFilters, antSorter) => {
        // Pagination
        const newPagination = {
            current: pag.current,
            pageSize: pag.pageSize,
        };

        // Si la pageSize change, revenir à la page 1
        if (pag.pageSize !== pagination.pageSize) {
            newPagination.current = 1;
        }

        // Tri
        if (antSorter && antSorter.field) {
            const newOrder = antSorter.order === 'ascend' ? 'ASC' : 'DESC';
            const sortChanged = antSorter.field !== sorter.field ||
                newOrder !== sorter.order;

            if (sortChanged) {
                setSorter({ field: antSorter.field, order: newOrder });
                newPagination.current = 1; // Reset page sur changement de tri
            }
        } else if (antSorter && !antSorter.order) {
            // Tri supprimé, revenir au tri par défaut
            setSorter(defaultSort);
            newPagination.current = 1;
        }

        setPagination(newPagination);
    }, [pagination.pageSize, sorter, defaultSort]);

    // --- Handler pour le changement de filtre ---
    const handleFilterChange = useCallback((key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    }, []);

    // Appliquer les filtres (appelé quand l'utilisateur clique OK dans le dropdown)
    const applyFilters = useCallback(() => {
        setPagination(prev => ({ ...prev, current: 1 }));
    }, []);

    // Reset tous les filtres
    const resetFilters = useCallback(() => {
        setFilters({});
        setPagination(prev => ({ ...prev, current: 1 }));
    }, []);

    // Mise à jour partielle des filtres (merge) + reset pagination
    const updateFilters = useCallback((partial) => {
        setFilters(prev => ({ ...prev, ...partial }));
        setPagination(prev => ({ ...prev, current: 1 }));
    }, []);

    // Des filtres sont-ils actifs ?
    const filtersActive = useMemo(() => {
        return Object.values(filters).some(v =>
            Array.isArray(v) ? v.length > 0 : (v !== null && v !== '' && v !== undefined)
        );
    }, [filters]);

    // --- Transformation des colonnes ---
    const antColumns = useMemo(() => {
        return columns.map(col => {
            const antCol = {
                key: col.key,
                dataIndex: col.key,
                title: col.title,
                align: col.align,
                ellipsis: col.ellipsis,
            };

            // Largeur
            if (col.width) {
                antCol.width = col.width;
            }

            // Fixed (pour la colonne action)
            if (col.fixed) {
                antCol.fixed = col.fixed;
            }

            // Tri
            if (col.sortable !== false && !col.fixed) {
                antCol.sorter = true;
                // État du tri actuel
                if (sorter.field === col.key) {
                    antCol.sortOrder = sorter.order === 'ASC' ? 'ascend' : 'descend';
                } else {
                    antCol.sortOrder = null;
                }
            }

            // Renderer personnalisé
            if (col.render) {
                antCol.render = col.render;
            }

            // Filtre dropdown selon le type
            if (col.filterType) {
                // Vérifier si un filtre est actif pour cette colonne
                let isFiltered = false;
                if (col.filterType === 'text') {
                    isFiltered = !!filters[col.key];
                } else if (col.filterType === 'select') {
                    isFiltered = Array.isArray(filters[col.key]) && filters[col.key].length > 0;
                } else {
                    isFiltered = !!filters[`${col.key}_gte`] || !!filters[`${col.key}_lte`];
                }

                antCol.filterIcon = () => (
                    <span style={{ position: 'relative', display: 'inline-block' }}>
                        <SearchOutlined style={{ color: isFiltered ? 'var(--color-active)' : 'var(--color-muted)' }} />
                        {isFiltered && (
                            <span style={{
                                position: 'absolute',
                                top: -4,
                                right: -4,
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: 'var(--color-active)',
                                border: '1.5px solid #ffffff',
                            }} />
                        )}
                    </span>
                );

                // Empêcher le filtrage client-side d'Ant
                antCol.onFilter = () => true;

                antCol.filterDropdown = ({ confirm, clearFilters: antClearFilters }) => {
                    const dropdownConfirm = () => {
                        applyFilters();
                        confirm({ closeDropdown: true });
                    };

                    const dropdownClear = () => {
                        antClearFilters();
                    };

                    if (col.filterType === 'text') {
                        return (
                            <TextFilterDropdown
                                columnKey={col.key}
                                filters={filters}
                                onFilterChange={handleFilterChange}
                                confirm={dropdownConfirm}
                                clearFilters={dropdownClear}
                            />
                        );
                    }

                    if (col.filterType === 'date') {
                        return (
                            <DateFilterDropdown
                                columnKey={col.key}
                                filters={filters}
                                onFilterChange={handleFilterChange}
                                confirm={dropdownConfirm}
                                clearFilters={dropdownClear}
                            />
                        );
                    }

                    if (col.filterType === 'numeric') {
                        return (
                            <NumericFilterDropdown
                                columnKey={col.key}
                                filters={filters}
                                onFilterChange={handleFilterChange}
                                confirm={dropdownConfirm}
                                clearFilters={dropdownClear}
                            />
                        );
                    }

                    if (col.filterType === 'select') {
                        return (
                            <SelectFilterDropdown
                                columnKey={col.key}
                                filters={filters}
                                onFilterChange={handleFilterChange}
                                confirm={dropdownConfirm}
                                clearFilters={dropdownClear}
                                options={col.filterOptions || []}
                            />
                        );
                    }

                    return null;
                };
            }

            return antCol;
        });
    }, [columns, sorter, filters, handleFilterChange, applyFilters]);

    // --- tableProps à passer à <Table> ---
    const tableProps = useMemo(() => ({
        columns: antColumns,
        dataSource: data,
        loading: loading,
        pagination: {
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: total,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} sur ${total}`,
            pageSizeOptions: ['25', '50', '100', '200'],
        },
        onChange: handleTableChange,
        rowKey: "id",
        scroll: { x: 'max-content' },
        size: "small",
        ...(onRowClick ? {
            onRow: (record) => ({
                onClick: () => onRowClick(record),
                style: { cursor: 'pointer' },
            }),
        } : {}),
    }), [antColumns, data, loading, pagination, total, handleTableChange, onRowClick]);

    return {
        tableProps,
        loading,
        reload: fetchData,
        resetFilters,
        updateFilters,
        filtersActive,
        filters,
        sorter,
    };
}
