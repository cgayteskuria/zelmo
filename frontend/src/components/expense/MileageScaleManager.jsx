import { useState, useEffect, useCallback } from "react";
import { Table, Button, Space, InputNumber, Select, Empty, Popconfirm, Modal, Form, Tag } from "antd";
import { message } from '../../utils/antdStatic';
import { PlusOutlined, CopyOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { mileageScaleApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";

const VEHICLE_TYPES = [
    { value: "car", label: "Voiture" },
    { value: "motorcycle", label: "Moto" },
    { value: "moped", label: "Cyclomoteur" },
];

const FISCAL_POWER_OPTIONS = [
    { value: "3", label: "3 CV" },
    { value: "4", label: "4 CV" },
    { value: "5", label: "5 CV" },
    { value: "6", label: "6 CV" },
    { value: "7+", label: "7 CV et plus" },
];

export default function MileageScaleManager() {
    const [scales, setScales] = useState([]);
    const [listLoading, setListLoading] = useState(false);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [availableYears, setAvailableYears] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingScaleId, setEditingScaleId] = useState(null);
    const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
    const [duplicateTargetYear, setDuplicateTargetYear] = useState(null);
    const [form] = Form.useForm();

    const loadScales = useCallback(async () => {
        setListLoading(true);
        try {
            const response = await mileageScaleApi.getByYear(selectedYear);
            setScales(response.data || []);
            setAvailableYears(response.data.available_years || [selectedYear]);
        } catch (error) {
            setScales([]);
        } finally {
            setListLoading(false);
        }
    }, [selectedYear]);

    useEffect(() => {
        loadScales();
    }, [loadScales]);

    const { submit, loading: saving } = useEntityForm({
        api: mileageScaleApi,
        entityId: editingScaleId,
        idField: 'id',
        form,
        open: modalOpen,
        onSuccess: () => {
            setModalOpen(false);
            loadScales();
        },
        messages: {
            create: 'Bareme cree',
            update: 'Bareme mis a jour',
            saveError: 'Erreur lors de la sauvegarde',
        },
    });

    const handleAdd = () => {
        setEditingScaleId(null);
        form.resetFields();
        form.setFieldsValue({
            msc_year: selectedYear,
            msc_vehicle_type: "car",
            msc_fiscal_power: "5",
            msc_min_distance: 0,
            msc_max_distance: null,
            msc_coefficient: 0,
            msc_constant: 0,
        });
        setModalOpen(true);
    };

    const handleEdit = (scale) => {
        setEditingScaleId(scale.id);
        setModalOpen(true);
    };

    const handleFormSubmit = async (values) => {
        await submit(values);
    };

    const handleDelete = async (scale) => {
        try {
            await mileageScaleApi.delete(scale.id);
            message.success("Ligne supprimee");
            loadScales();
        } catch (error) {
            message.error(error.data?.message || "Erreur lors de la suppression");
        }
    };

    const handleDuplicate = async () => {
        if (!duplicateTargetYear) {
            message.error("Selectionnez une annee cible");
            return;
        }
        try {
            await mileageScaleApi.duplicate({
                source_year: selectedYear,
                target_year: duplicateTargetYear,
            });
            message.success(`Bareme ${selectedYear} duplique vers ${duplicateTargetYear}`);
            setDuplicateModalOpen(false);
            setSelectedYear(duplicateTargetYear);
        } catch (error) {
            message.error(error.data?.message || "Erreur lors de la duplication");
        }
    };

    const formatDistance = (min, max) => {
        if (max === null || max === undefined) {
            return `> ${min.toLocaleString()} km`;
        }
        return `${min.toLocaleString()} - ${max.toLocaleString()} km`;
    };

    const columns = [
        {
            title: "Type",
            dataIndex: "msc_vehicle_type",
            key: "msc_vehicle_type",
            width: 120,
            render: (v) => VEHICLE_TYPES.find(t => t.value === v)?.label || v,
        },
        {
            title: "CV fiscal",
            dataIndex: "msc_fiscal_power",
            key: "msc_fiscal_power",
            width: 100,
            align: "center",
            render: (v) => <Tag>{v} CV</Tag>,
        },
        {
            title: "Tranche distance",
            key: "distance",
            width: 180,
            render: (_, record) => formatDistance(record.msc_min_distance, record.msc_max_distance),
        },
        {
            title: "Coefficient (d x)",
            dataIndex: "msc_coefficient",
            key: "msc_coefficient",
            width: 140,
            align: "right",
            render: (v) => parseFloat(v).toFixed(4),
        },
        {
            title: "Constante (+)",
            dataIndex: "msc_constant",
            key: "msc_constant",
            width: 120,
            align: "right",
            render: (v) => `${parseFloat(v).toFixed(2)} €`,
        },
        {
            title: "Actions",
            key: "actions",
            width: 100,
            align: "center",
            render: (_, record) => (
                <Space size="small">
                    <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    />
                    <Popconfirm
                        title="Supprimer cette ligne ?"
                        onConfirm={() => handleDelete(record)}
                        okText="Supprimer"
                        cancelText="Annuler"
                        okButtonProps={{ danger: true }}
                    >
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const yearOptions = [];
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 1; y <= currentYear + 1; y++) {
        yearOptions.push({ value: y, label: String(y) });
    }
    // Merge with available years
    const allYears = new Set([...yearOptions.map(y => y.value), ...availableYears]);
    const yearSelectOptions = Array.from(allYears)
        .sort((a, b) => b - a)
        .map(y => ({ value: y, label: String(y) }));

    return (
        <div>
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Space>
                    <span style={{ fontWeight: 500 }}>Annee :</span>
                    <Select
                        value={selectedYear}
                        onChange={setSelectedYear}
                        options={yearSelectOptions}
                        style={{ width: 100 }}
                    />
                </Space>
                <Space>
                    <Button
                        icon={<CopyOutlined />}
                        onClick={() => {
                            setDuplicateTargetYear(selectedYear + 1);
                            setDuplicateModalOpen(true);
                        }}
                        disabled={scales.length === 0}
                    >
                        Dupliquer
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAdd}
                    >
                        Ajouter
                    </Button>
                </Space>
            </div>

            <Table
                rowKey="id"
                columns={columns}
                dataSource={scales}
                loading={listLoading}
                pagination={false}
                size="small"
                locale={{
                    emptyText: (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={`Aucun bareme pour ${selectedYear}`}
                        />
                    ),
                }}
            />

            {/* Modal ajout/modification */}
            <Modal
                title={editingScaleId ? "Modifier le bareme" : "Ajouter au bareme"}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={() => form.submit()}
                confirmLoading={saving}
                okText={editingScaleId ? "Enregistrer" : "Creer"}
                cancelText="Annuler"
                destroyOnHidden
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFormSubmit}
                    style={{ marginTop: 16 }}
                >
                    <Form.Item name="id" hidden>
                        <InputNumber />
                    </Form.Item>

                    <Space style={{ width: "100%" }} size="large">
                        <Form.Item
                            name="msc_year"
                            label="Annee"
                            rules={[{ required: true }]}
                        >
                            <InputNumber style={{ width: 100 }} />
                        </Form.Item>

                        <Form.Item
                            name="msc_vehicle_type"
                            label="Type vehicule"
                            rules={[{ required: true }]}
                        >
                            <Select options={VEHICLE_TYPES} style={{ width: 150 }} />
                        </Form.Item>

                        <Form.Item
                            name="msc_fiscal_power"
                            label="CV fiscal"
                            rules={[{ required: true }]}
                        >
                            <Select options={FISCAL_POWER_OPTIONS} style={{ width: 120 }} />
                        </Form.Item>
                    </Space>

                    <Space style={{ width: "100%" }} size="large">
                        <Form.Item
                            name="msc_min_distance"
                            label="Distance min (km)"
                            rules={[{ required: true }]}
                        >
                            <InputNumber style={{ width: 140 }} min={0} />
                        </Form.Item>

                        <Form.Item
                            name="msc_max_distance"
                            label="Distance max (km)"
                            extra="Vide = illimite"
                        >
                            <InputNumber style={{ width: 140 }} min={0} />
                        </Form.Item>
                    </Space>

                    <Space style={{ width: "100%" }} size="large">
                        <Form.Item
                            name="msc_coefficient"
                            label="Coefficient"
                            rules={[{ required: true }]}
                            extra="d x coefficient"
                        >
                            <InputNumber style={{ width: 140 }} step={0.001} precision={4} min={0} />
                        </Form.Item>

                        <Form.Item
                            name="msc_constant"
                            label="Constante"
                            extra="+ constante"
                        >
                            <InputNumber style={{ width: 140 }} step={1} precision={2} suffix="€" />
                        </Form.Item>
                    </Space>
                </Form>
            </Modal>

            {/* Modal duplication */}
            <Modal
                title="Dupliquer le bareme"
                open={duplicateModalOpen}
                onCancel={() => setDuplicateModalOpen(false)}
                onOk={handleDuplicate}
                okText="Dupliquer"
                cancelText="Annuler"
            >
                <p>Dupliquer le bareme {selectedYear} vers :</p>
                <Select
                    value={duplicateTargetYear}
                    onChange={setDuplicateTargetYear}
                    options={yearSelectOptions.filter(y => y.value !== selectedYear)}
                    style={{ width: 120 }}
                />
            </Modal>
        </div>
    );
}
