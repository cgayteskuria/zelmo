import { Table, Button, Space, Tag, Tooltip, Popconfirm, Empty } from "antd";
import { EditOutlined, DeleteOutlined, PlusOutlined, EyeOutlined, SwapOutlined, CarOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { formatCurrency } from "../../utils/formatters";

export default function MileageExpensesList({
    expenses = [],
    loading = false,
    disabled = false,
    onAdd,
    onEdit,
    onDelete,
}) {
  
    const columns = [
        {
            title: "Date",
            dataIndex: "mex_date",
            key: "mex_date",
            width: 110,
            render: (value) => dayjs(value).format("DD/MM/YYYY"),
            sorter: (a, b) => dayjs(a.mex_date).unix() - dayjs(b.mex_date).unix(),
        },
        {
            title: "Trajet",
            key: "trajet",
            ellipsis: true,
            render: (_, record) => (
                <Space size={4}>
                    <span>{record.mex_departure}</span>
                    <span style={{ color: "#999" }}>&rarr;</span>
                    <span>{record.mex_destination}</span>
                    {record.mex_is_round_trip && (
                        <Tooltip title="Aller-retour">
                            <SwapOutlined style={{ color: "#1890ff", fontSize: 12 }} />
                        </Tooltip>
                    )}
                </Space>
            ),
        },
        {
            title: "Distance",
            dataIndex: "mex_distance_km",
            key: "mex_distance_km",
            width: 110,
            align: "right",
            render: (value, record) => {
                const effective = record.mex_is_round_trip ? value * 2 : value;
                return (
                    <span>
                        {effective} km
                        {record.mex_is_round_trip && (
                            <span style={{ color: "#999", fontSize: 11 }}> (A/R)</span>
                        )}
                    </span>
                );
            },
            sorter: (a, b) => {
                const distA = a.mex_is_round_trip ? a.mex_distance_km * 2 : a.mex_distance_km;
                const distB = b.mex_is_round_trip ? b.mex_distance_km * 2 : b.mex_distance_km;
                return distA - distB;
            },
        },
        {
            title: "Vehicule",
            key: "vehicle",
            width: 250,
            render: (_, record) => {
                if (!record.vehicle) return "-";
                return (
                    <Space size={4}>
                        <CarOutlined />
                        <span>{record.vehicle.vhc_name}</span>
                        <Tag style={{ marginLeft: 2 }}>{record.mex_fiscal_power} CV</Tag>
                    </Space>
                );
            },
        },
        {
            title: "Montant",
            dataIndex: "mex_calculated_amount",
            key: "mex_calculated_amount",
            width: 120,
            align: "right",
            render: (value) => formatCurrency(value),
            sorter: (a, b) => a.mex_calculated_amount - b.mex_calculated_amount,
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
                            title="Supprimer ce frais kilometrique ?"
                            description="Cette action est irreversible"
                            onConfirm={() => onDelete?.(record)}
                            okText="Supprimer"
                            cancelText="Annuler"
                            okButtonProps={{ danger: true }}
                        >
                            <Tooltip title="Supprimer">
                                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                            </Tooltip>
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div>
            {!disabled && (
                <div style={{ marginBottom: 16 }}>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={onAdd}
                    >
                        Ajouter un frais kilometrique
                    </Button>
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
                            description="Aucun frais kilometrique"
                        />
                    ),
                }}
                summary={(pageData) => {
                    if (pageData.length === 0) return null;

                    let totalDistance = 0;
                    let totalAmount = 0;

                    pageData.forEach((expense) => {
                        const dist = expense.mex_is_round_trip
                            ? expense.mex_distance_km * 2
                            : expense.mex_distance_km;
                        totalDistance += parseFloat(dist) || 0;
                        totalAmount += parseFloat(expense.mex_calculated_amount) || 0;
                    });

                    return (
                        <Table.Summary fixed>
                            <Table.Summary.Row>
                                <Table.Summary.Cell index={0} colSpan={2}>
                                    <strong>Total ({pageData.length} frais km)</strong>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={1} align="right">
                                    <strong>{Math.round(totalDistance)} km</strong>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={2} />
                                <Table.Summary.Cell index={3} align="right">
                                    <strong>{formatCurrency(totalAmount)}</strong>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={4} />
                            </Table.Summary.Row>
                        </Table.Summary>
                    );
                }}
            />
        </div>
    );
}
