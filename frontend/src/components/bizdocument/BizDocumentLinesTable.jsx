import React, { memo, useContext, createContext, useMemo, useState, useCallback, forwardRef, useImperativeHandle, lazy, Suspense } from 'react';
import { Table, Button, Tooltip, Popconfirm, Space, App, Spin } from 'antd';
import { EditOutlined, DeleteOutlined, HolderOutlined, PlusOutlined, CheckOutlined } from '@ant-design/icons';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatCurrency } from "../../utils/formatters";
import HtmlContent from '../common/HtmlContent';

const BizDocumentLineModal = lazy(() => import('./BizDocumentLineModal'));

// Context pour passer les listeners du drag handle
const DragHandleContext = createContext(null);

/**
 * Composant Row sortable pour le drag and drop
 */
const DraggableRow = memo(({ children, ...props }) => {
    const {
        attributes, listeners, setNodeRef, transform, transition, isDragging,
    } = useSortable({
        id: props['data-row-key'],
    });

    const style = {
        ...props.style,
        transform: CSS.Transform.toString(transform),
        transition,
        ...(isDragging ? { position: 'relative', zIndex: 9999 } : {}),
    };

    return (
        <DragHandleContext.Provider value={listeners}>
            <tr {...props} ref={setNodeRef} style={style} {...attributes}>
                {children}
            </tr>
        </DragHandleContext.Provider>
    );
});
DraggableRow.displayName = 'DraggableRow';

/**
 * Handle de drag & drop
 */
const DragHandle = memo(() => {
    const listeners = useContext(DragHandleContext);
    return (
        <HolderOutlined
            className="drag-handle"
            style={{ cursor: 'grab' }}
            {...listeners}
        />
    );
});
DragHandle.displayName = 'DragHandle';

/**
 * Composant générique de tableau de lignes de document
 * Gère en interne le modal d'édition/création de lignes et les opérations CRUD
 *
 * @param {Object} props
 * @param {Array} props.dataSource - Les lignes du document
 * @param {boolean} props.loading - État de chargement
 * @param {boolean} props.disabled - Si true, désactive le drag & drop et les actions
 * @param {number} props.documentId - ID du document parent
 * @param {Function} props.saveLineApi - Fonction API pour sauvegarder une ligne
 * @param {Function} props.deleteLineApi - Fonction API pour supprimer une ligne
 * @param {Function} props.updateLinesOrderApi - Fonction API pour mettre à jour l'ordre des lignes
 * @param {Function} props.onLinesChanged - Callback appelé après modification/suppression/réorganisation
 * @param {Object} props.config - Configuration complète du module (contient linesTableConfig et lineConfig)
 * @param {Function} props.onRequestDocumentCreation - Callback appelé pour demander la création du document parent si documentId est null
 */
const BizDocumentLinesTable = forwardRef(({
    dataSource = [],
    loading = false,
    disabled = true,
    documentId,
    saveLineApi,
    deleteLineApi,
    updateLinesOrderApi,
    onLinesChanged,
    config,
    onRequestDocumentCreation
}, ref) => {
    const { message } = App.useApp();

    // État pour le modal de ligne
    const [lineModalOpen, setLineModalOpen] = useState(false);
    const [lineModalData, setLineModalData] = useState(null);

    // Extraire columnsConfig depuis config
    const columnsConfig = config?.linesTableConfig?.columnsConfig || {};

    // Exposer des méthodes pour ouvrir le modal depuis le composant parent
    useImperativeHandle(ref, () => ({
        openAddModal: (lineType) => {
            setLineModalData({
                lineType: lineType,
                lineOrder: dataSource.length + 1
            });
            setLineModalOpen(true);
        }
    }));

    // Handlers pour les boutons d'ajout
    const handleAddLine = useCallback(async () => {
        // Si pas de documentId, demander la création du document parent
        if (!documentId) {
            if (onRequestDocumentCreation) {
                await onRequestDocumentCreation(0); // 0 = ligne normale
            } else {
                message.warning('Veuillez enregistrer le document avant d\'ajouter des lignes');
            }
            return;
        }

        setLineModalData({
            lineType: 0,
            lineOrder: dataSource.length + 1
        });
        setLineModalOpen(true);
    }, [documentId, dataSource.length, onRequestDocumentCreation]);

    const handleAddTitle = useCallback(async () => {
        // Si pas de documentId, demander la création du document parent
        if (!documentId) {
            if (onRequestDocumentCreation) {
                await onRequestDocumentCreation(1); // 1 = titre
            } else {
                message.warning('Veuillez enregistrer le document avant d\'ajouter des lignes');
            }
            return;
        }

        setLineModalData({
            lineType: 1,
            lineOrder: dataSource.length + 1
        });
        setLineModalOpen(true);
    }, [documentId, dataSource.length, onRequestDocumentCreation]);

    const handleAddSubtotal = useCallback(async () => {
        // Si pas de documentId, demander la création du document parent
        if (!documentId) {
            if (onRequestDocumentCreation) {
                await onRequestDocumentCreation(2); // 2 = sous-total
            } else {
                message.warning('Veuillez enregistrer le document avant d\'ajouter des lignes');
            }
            return;
        }

        setLineModalData({
            lineType: 2,
            lineOrder: dataSource.length + 1
        });
        setLineModalOpen(true);
    }, [documentId, dataSource.length, onRequestDocumentCreation]);

    // Handler pour éditer une ligne
    const handleEditLine = useCallback((row) => {
        setLineModalData(row);
        setLineModalOpen(true);
    }, []);

    // Handler pour sauvegarder une ligne
    const handleSaveLine = useCallback(async (lineData) => {
        if (!documentId) return;

        try {
            await saveLineApi(documentId, lineData);
            //message.success(lineData.lineId ? "Ligne modifiée" : "Ligne ajoutée");
            setLineModalOpen(false);
            setLineModalData(null);
            if (onLinesChanged) {
                await onLinesChanged();
            }
        } catch (error) {
            message.error('Erreur lors de la sauvegarde de la ligne');
            console.error('Erreur:', error);
            throw error;
        }
    }, [documentId, saveLineApi, onLinesChanged]);

    // Handler pour supprimer une ligne
    const handleDeleteLine = useCallback(async (row) => {
        if (!documentId) return;

        try {
            await deleteLineApi(documentId, row.lineId);
            message.success('Ligne supprimée avec succès');
            if (onLinesChanged) {
                await onLinesChanged();
            }
        } catch (error) {
            message.error('Erreur lors de la suppression de la ligne');
            console.error('Erreur:', error);
        }
    }, [documentId, deleteLineApi, onLinesChanged]);

    // Handler pour le drag & drop
    const handleDragEnd = useCallback(async (event) => {
        const { active, over } = event;

        if (!over || active.id === over.id) {
            return;
        }

        if (!documentId) return;

        // Optimistic update
        const oldIndex = dataSource.findIndex((item) => item.lineId === active.id);
        const newIndex = dataSource.findIndex((item) => item.lineId === over.id);

        const newItems = arrayMove(dataSource, oldIndex, newIndex);

        // Sauvegarder le nouvel ordre dans la base de données
        const lineIds = newItems.map(item => item.lineId);

        try {
            await updateLinesOrderApi(documentId, lineIds);
            message.success('Ordre des lignes modifié');
            if (onLinesChanged) {
                await onLinesChanged();
            }
        } catch (error) {
            message.error('Erreur lors de la sauvegarde de l\'ordre');
            console.error('Erreur:', error);
            // Recharger les lignes en cas d'erreur
            if (onLinesChanged) {
                await onLinesChanged();
            }
        }
    }, [documentId, dataSource, updateLinesOrderApi, onLinesChanged]);

    // Handler pour fermer le modal
    const handleCloseLineModal = useCallback(() => {
        setLineModalOpen(false);
        setLineModalData(null);
    }, []);

    // Configuration par défaut des colonnes
    const defaultColumnsConfig = {
        showMargin: false,
        showMarginPercent: false,
        showQtyReceived: false,
    };

    const finalConfig = { ...defaultColumnsConfig, ...columnsConfig };
    const hasSubscription = dataSource.some(item => item.isSubscription);

    // Construire les colonnes du tableau
    const columns = useMemo(() => {
        const cols = [];

        // Colonne drag handle
        cols.push({
            title: '',
            key: 'sort',
            width: 40,
            align: 'center',
            render: () => {
                if (disabled) return null;
                return <DragHandle />;
            }
        });

        // Colonne Produit/Service
        cols.push({
            title: 'Produit / Service',
            dataIndex: "prtLib",
            key: "prtLib",
            ellipsis: true,
            render: (_, record) => (
                <div
                    style={{
                        width: '45ch',
                        display: '-webkit-box',
                        WebkitLineClamp: 5,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: '1.5em',
                        maxHeight: '6.5em',
                        textOverflow: 'ellipsis',
                    }}
                >
                    <div style={{ fontWeight: '600' }}>{record["prtLib"]}</div>
                    {record['prtDesc'] && (
                        <HtmlContent
                            html={record['prtDesc']}
                            style={{ fontSize: '0.9em', color: '#666' }}
                        />
                    )}
                </div>
            )
        });

        // Colonne Quantité
        cols.push({
            title: 'Qté',
            dataIndex: "qty",
            key: "qty",
            width: 50,
            align: 'right',
            render: (value, record) => {
                if (record["lineType"] === 1 || record["lineType"] === 2) return null;
                return value || '0.00';
            }
        });

        if (finalConfig.showIsSubscription && hasSubscription) {
            cols.push({
                title: 'Abo.',
                dataIndex: "isSubscription",
                key: "isSubscription",
                width: 50,
                align: 'center',
                render: (value, record) => {
                    return value ? <CheckOutlined style={{ color: '#52c41a' }} /> : null;
                }
            });
        }

        // Colonne Quantité reçue (pour PurchaseOrder)
        if (finalConfig.showQtyReceived) {
            cols.push({
                title: 'Qté reçue',
                dataIndex: "qtyReceived",
                key: "qtyReceived",
                width: 80,
                align: 'right',
                render: (value, record) => {
                    if (record["lineType"] === 1 || record["lineType"] === 2) return null;
                    return value || '0.00';
                }
            });
        }

        // Colonne Prix unitaire HT
        cols.push({
            title: 'Prix Unit. HT',
            dataIndex: "priceUnitHt",
            key: "priceUnitHt",
            width: 110,
            align: 'right',
            render: (value, record) => {
                if (record["lineType"] === 1 || record["lineType"] === 2) return null;
                return formatCurrency(value);
            }
        });

        // Colonne discount
        cols.push({
            title: 'Rem %',
            dataIndex: "discount",
            key: "discount",
            width: 80,
            align: 'right',
            render: (value, record) => {
                if (record["lineType"] === 1 || record["lineType"] === 2) return null;
                return value || '0.00';
            }
        });

        // Colonne Total HT
        cols.push({
            title: 'Total HT',
            dataIndex: "totalHt",
            key: "totalHt",
            width: 110,
            align: 'right',
            render: (value, record) => {
                if (record["lineType"] === 1) return null;
                return formatCurrency(value);
            }
        });

        // Colonne TVA
        cols.push({
            title: 'TVA',
            dataIndex: "taxLabel",
            key: "taxLabel",
            width: 80,
            align: 'center',
            render: (value, record) => {
                if (record["lineType"] === 1 || record["lineType"] === 2) return null;
                return value;
            }
        });

        // Colonne Marge Total
        if (finalConfig.showMargin) {
            cols.push({
                title: 'Marge Total',
                dataIndex: "margeTotal",
                key: "margeTotal",
                width: 110,
                align: 'right',
                render: (value, record) => {
                    if (record["lineType"] === 1 || record["lineType"] === 2) return null;
                    return formatCurrency(value);
                }
            });
        }

        // Colonne Marge %
        if (finalConfig.showMarginPercent) {
            cols.push({
                title: 'Marge %',
                dataIndex: "margePerc",
                key: "margePerc",
                width: 80,
                align: 'right',
                render: (value, record) => {
                    if (record["lineType"] === 1 || record["lineType"] === 2) return null;
                    const color = value >= 40 ? '#52c41a' : value >= 20 ? '#faad14' : '#ff4d4f';
                    return <span style={{ color, fontWeight: 'bold' }}>{value ? `${value} %` : '0,00 %'}</span>;
                }
            });
        }

        // Colonne Actions
        cols.push({
            title: 'Action',
            key: 'action',
            width: 100,
            align: 'center',
            fixed: 'right',
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="Modifier">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => handleEditLine(record)}
                            size="small"
                        />
                    </Tooltip>
                    <Tooltip title="Supprimer">
                        <Popconfirm
                            title="Êtes-vous sûr de vouloir supprimer cette ligne ?"
                            onConfirm={() => handleDeleteLine(record)}
                            okText="Oui"
                            cancelText="Non"
                        >
                            <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                size="small"
                            />
                        </Popconfirm>
                    </Tooltip>
                </Space>
            )
        });

        return cols;
    }, [finalConfig, disabled, handleEditLine, handleDeleteLine]);

    // Déterminer la classe CSS selon le type de ligne
    const getRowClassName = (record) => {
        if (record["lineType"] === 1) return 'row-title';
        if (record["lineType"] === 2) return 'row-subtotal';
        return 'row-normal';
    };


    return (
        <>
            {/* Boutons d'ajout de lignes */}
            {!disabled && (
                <Space style={{ marginBottom: '16px', textAlign: "left", width: "100%" }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddLine} size="default">
                        Ajouter une ligne
                    </Button>
                    <Button type="secondary" icon={<PlusOutlined />} onClick={handleAddTitle} size="default">
                        Ajouter un titre
                    </Button>
                    <Button type="secondary" icon={<PlusOutlined />} onClick={handleAddSubtotal} size="default">
                        Ajouter un sous-total
                    </Button>
                </Space>
            )}

            {/* Tableau de lignes */}
            <div style={{ isolation: 'isolate' }}>
            <DndContext
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={dataSource.map(item => item["lineId"])}
                    strategy={verticalListSortingStrategy}
                >

                    <Table
                        columns={columns}
                        dataSource={dataSource}
                        rowKey={"lineId"}
                        loading={loading}
                        pagination={false}
                        size="small"
                        bordered
                        scroll={{ x: 'max-content' }}
                        components={{
                            body: {
                                row: DraggableRow,
                            },
                        }}
                        rowClassName={getRowClassName}
                    />
                </SortableContext>
            </DndContext>
            </div>

            {/* Modal d'édition/création de ligne */}
            {lineModalOpen && (
                < Suspense fallback={< Spin />}>
                    <BizDocumentLineModal
                        open={lineModalOpen}
                        onClose={handleCloseLineModal}
                        onSave={handleSaveLine}
                        lineData={lineModalData}
                        parentId={documentId}
                        config={config}
                    />
                </Suspense >
            )}
        </>
    );
});

BizDocumentLinesTable.displayName = 'BizDocumentLinesTable';

export default BizDocumentLinesTable;
