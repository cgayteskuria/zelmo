import { useState, useCallback } from "react";
import { Table, Button, Space, Tag, Tooltip, Popconfirm, Empty, Upload } from "antd";
import { message } from '../../utils/antdStatic';
import { EditOutlined, DeleteOutlined, PaperClipOutlined, PlusOutlined, EyeOutlined, InboxOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { formatCurrency } from "../../utils/formatters";

const { Dragger } = Upload;

export default function ExpensesList({ expenses = [], loading = false, disabled = false, onAdd, onEdit, onDelete, onFileDrop, }) {
    const [isDragging, setIsDragging] = useState(false);

    // Gestion du drag & drop de fichier
    const handleDragEnter = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled && onFileDrop) {
            setIsDragging(true);
        }
    }, [disabled, onFileDrop]);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        // Vérifier qu'on quitte vraiment la zone (pas un enfant)
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setIsDragging(false);
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (disabled || !onFileDrop) return;

        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            const file = files[0];
            // Valider le type de fichier
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
            if (!allowedTypes.includes(file.type)) {
                message.error("Type de fichier non supporté. Utilisez JPG, PNG ou PDF.");
                return;
            }
            onFileDrop(file);
        }
    }, [disabled, onFileDrop]);
    const columns = [
        {
            title: "Date", dataIndex: "exp_date", key: "exp_date", width: 110, render: (value) => dayjs(value).format("DD/MM/YYYY"),
            sorter: (a, b) => dayjs(a.exp_date).unix() - dayjs(b.exp_date).unix(),
        },
        { title: "Commercant", dataIndex: "exp_merchant", key: "exp_merchant", ellipsis: true, },
        {
            title: "Categorie",
            dataIndex: "category",
            key: "category",
            width: 150,
            render: (category) => {
                if (!category) return "-";
                return (
                    <Tag color={category.exc_color || "default"}>
                        {category.exc_name}
                    </Tag>
                );
            },
        },
        {
            title: "Montant TTC", dataIndex: "exp_total_amount_ttc", key: "exp_total_amount_ttc", width: 140,
            align: "right",
            render: (value) => formatCurrency(value),
            sorter: (a, b) => a.exp_total_amount_ttc - b.exp_total_amount_ttc,
        },
        {
            title: "Justif.",
            dataIndex: "exp_receipt_path",
            key: "receipt",
            width: 70,
            align: "center",
            render: (value, record) => {
                if (!value) {
                    return <span style={{ color: "#ccc" }}>-</span>;
                }
                return (
                    <Tooltip title="Justificatif joint">
                        <PaperClipOutlined style={{ color: "#1890ff" }} />
                    </Tooltip>
                );
            },
        },
        {
            title: "Actions",
            key: "actions",
            width: 100,
            align: "center",
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title={disabled ? "Voir" : "Modifier"}>
                        <Button
                            type="text"
                            size="small"
                            icon={disabled ? <EyeOutlined /> : <EditOutlined />}
                            onClick={() => onEdit?.(record)}
                        />
                    </Tooltip>
                    {!disabled && (
                        <Popconfirm
                            title="Supprimer cette depense ?"
                            description="Cette action est irreversible"
                            onConfirm={() => onDelete?.(record)}
                            okText="Supprimer"
                            cancelText="Annuler"
                            okButtonProps={{ danger: true }}
                        >
                            <Tooltip title="Supprimer">
                                <Button
                                    type="text"
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                />
                            </Tooltip>
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={{ position: 'relative' }}
        >
            {/* Overlay de drag & drop */}
            {isDragging && !disabled && onFileDrop && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(24, 144, 255, 0.1)',
                        border: '2px dashed #1890ff',
                        borderRadius: 8,
                        zIndex: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                    }}
                >
                    <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
                    <p style={{ marginTop: 16, fontSize: 16, color: '#1890ff', fontWeight: 500 }}>
                        Déposez un justificatif pour créer une dépense
                    </p>
                </div>
            )}

            {!disabled && (
                <div style={{ marginBottom: 16 }}>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={onAdd}
                    >
                        Ajouter une depense
                    </Button>
                    {onFileDrop && (
                        <span style={{ marginLeft: 16, color: '#888', fontSize: 12 }}>
                            ou glissez-déposez un justificatif ici
                        </span>
                    )}
                </div>
            )}

            <Table
                rowKey="id"
                columns={columns}
                tableLayout="fixed"
                dataSource={expenses}
                loading={loading}
                pagination={false}
                size="middle"
                locale={{
                    emptyText: (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="Aucune depense"
                        >
                        </Empty>
                    ),
                }}
                summary={(pageData) => {
                    if (pageData.length === 0) return null;

                    let totalHT = 0;
                    let totalTVA = 0;
                    let totalTTC = 0;

                    pageData.forEach((expense) => {
                        totalHT += parseFloat(expense.exp_total_amount_ht) || 0;
                        totalTVA += parseFloat(expense.exp_total_tva) || 0;
                        totalTTC += parseFloat(expense.exp_total_amount_ttc) || 0;
                    });

                    return (
                        <Table.Summary fixed>
                            <Table.Summary.Row>
                                <Table.Summary.Cell index={0} colSpan={3}>
                                    <strong>Total ({pageData.length} depense{pageData.length > 1 ? "s" : ""})</strong>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={1} align="right">
                                    <strong>{formatCurrency(totalTTC)}</strong>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={2} colSpan={2} />
                            </Table.Summary.Row>
                        </Table.Summary>
                    );
                }}
            />
        </div>
    );
}
