import { useState, useEffect, useCallback } from "react";
import { Table, Button, Space, Tag, Switch, Popconfirm, Modal, Form, Input, Select, Upload, App, Empty, Tooltip } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, CarOutlined, StarFilled, UploadOutlined, FileOutlined, EyeOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { createVehiclesApi, documentsApi } from "../../services/api";

const VEHICLE_TYPES = [
    { value: "car", label: "Voiture" },
    { value: "motorcycle", label: "Moto" },
    { value: "moped", label: "Cyclomoteur" },
];

const FISCAL_POWER_OPTIONS = [
    { value: 3, label: "3 CV" },
    { value: 4, label: "4 CV" },
    { value: 5, label: "5 CV" },
    { value: 6, label: "6 CV" },
    { value: 7, label: "7 CV et plus" },
];

const TYPES_REQUIRING_REGISTRATION = ["car", "motorcycle"];

export default function VehiclesTab({ userId }) {
    const { message } = App.useApp();
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState(null);
    const [saving, setSaving] = useState(false);
    const [registrationFile, setRegistrationFile] = useState(null);
    const [form] = Form.useForm();

    const vehicleType = Form.useWatch("vhc_type", form);
    const isRegistrationRequired = TYPES_REQUIRING_REGISTRATION.includes(vehicleType);

    const vehiclesApi = userId ? createVehiclesApi(userId) : null;

    const loadVehicles = useCallback(async () => {
        if (!vehiclesApi) return;
        setLoading(true);
        try {
            const response = await vehiclesApi.list();
            setVehicles(response.data || []);
        } catch (error) {
            message.error("Erreur lors du chargement des vehicules");
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        if (userId) {
            loadVehicles();
        }
    }, [userId, loadVehicles]);

    const handleAdd = () => {
        setEditingVehicle(null);
        setRegistrationFile(null);
        form.resetFields();
        form.setFieldsValue({
            vhc_type: "car",
            vhc_is_active: true,
            vhc_is_default: false,
            vhc_fiscal_power: 5,
        });
        setModalOpen(true);
    };

    const handleEdit = (vehicle) => {
        setEditingVehicle(vehicle);
        setRegistrationFile(null);
        form.setFieldsValue({
            vhc_name: vehicle.vhc_name,
            vhc_registration: vehicle.vhc_registration,
            vhc_fiscal_power: vehicle.vhc_fiscal_power,
            vhc_type: vehicle.vhc_type,
            vhc_is_active: vehicle.vhc_is_active,
            vhc_is_default: vehicle.vhc_is_default,
        });
        setModalOpen(true);
    };

    const handleDelete = async (vehicle) => {
        try {
            await vehiclesApi.delete(vehicle.id);
            message.success("Vehicule supprime");
            loadVehicles();
        } catch (error) {
            message.error(error.data?.message || "Erreur lors de la suppression");
        }
    };

    const handleSave = async (values) => {
        const type = values.vhc_type;
        const isNew = !editingVehicle;

        // Validation carte grise obligatoire pour voiture/moto
        if (TYPES_REQUIRING_REGISTRATION.includes(type)) {
            if (isNew && !registrationFile) {
                message.error("La carte grise est obligatoire pour les voitures et motos");
                return;
            }
            if (!isNew && !editingVehicle.registration_document && !registrationFile) {
                message.error("La carte grise est obligatoire pour les voitures et motos");
                return;
            }
        }

        setSaving(true);
        try {
            if (isNew) {
                // Creation avec FormData pour inclure le fichier
                const formData = new FormData();
                Object.keys(values).forEach((key) => {
                    if (values[key] !== null && values[key] !== undefined) {
                        formData.append(key, typeof values[key] === "boolean" ? (values[key] ? "1" : "0") : values[key]);
                    }
                });
                if (registrationFile) {
                    formData.append("registration_card", registrationFile);
                }
                await vehiclesApi.create(formData);
                message.success("Vehicule cree");
            } else {
                await vehiclesApi.update(editingVehicle.id, values);
                // Upload carte grise si un nouveau fichier a ete selectionne
                if (registrationFile) {
                    await vehiclesApi.uploadRegistration(editingVehicle.id, registrationFile);
                }
                message.success("Vehicule mis a jour");
            }
            setModalOpen(false);
            loadVehicles();
        } catch (error) {
            message.error(error.data?.message || "Erreur lors de la sauvegarde");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRegistration = async (vehicle) => {
        try {
            await vehiclesApi.deleteRegistration(vehicle.id);
            message.success("Carte grise supprimee");
            loadVehicles();
        } catch (error) {
            message.error(error.data?.message || "Erreur lors de la suppression");
        }
    };

    const handleDownloadRegistration = async (vehicle) => {
        const doc = vehicle.registration_document;
        if (!doc) return;
        try {
            const response = await documentsApi.download(doc.id);
            const url = window.URL.createObjectURL(response);
            const link = document.createElement("a");
            link.href = url;
            link.download = doc.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => window.URL.revokeObjectURL(url), 60000);
        } catch (error) {
            message.error("Erreur lors du telechargement");
        }
    };

    const columns = [
        {
            title: "Nom",
            dataIndex: "vhc_name",
            key: "vhc_name",
            render: (name, record) => (
                <Space>
                    <CarOutlined />
                    {name}
                    {record.vhc_is_default && <StarFilled style={{ color: "#faad14" }} />}
                </Space>
            ),
        },
        {
            title: "Immatriculation",
            dataIndex: "vhc_registration",
            key: "vhc_registration",
            render: (v) => v || "-",
        },
        {
            title: "CV fiscal",
            dataIndex: "vhc_fiscal_power",
            key: "vhc_fiscal_power",
            width: 90,
            align: "center",
            render: (v) => <Tag>{v} CV</Tag>,
        },
        {
            title: "Type",
            dataIndex: "vhc_type",
            key: "vhc_type",
            width: 120,
            render: (v) => VEHICLE_TYPES.find(t => t.value === v)?.label || v,
        },
        {
            title: "Carte grise",
            key: "registration_document",
            width: 120,
            align: "center",
            render: (_, record) => {
                if (record.registration_document) {
                    return (
                        <Tooltip title={record.registration_document.fileName}>
                            <Tag color="green" icon={<FileOutlined />} style={{ cursor: "pointer" }} onClick={() => handleDownloadRegistration(record)}>
                                Oui
                            </Tag>
                        </Tooltip>
                    );
                }
                if (TYPES_REQUIRING_REGISTRATION.includes(record.vhc_type)) {
                    return <Tag color="red">Manquante</Tag>;
                }
                return <Tag>-</Tag>;
            },
        },
        {
            title: "Actif",
            dataIndex: "vhc_is_active",
            key: "vhc_is_active",
            width: 70,
            align: "center",
            render: (v) => <Tag color={v ? "green" : "default"}>{v ? "Oui" : "Non"}</Tag>,
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
                        title="Supprimer ce vehicule ?"
                        description="Cette action est irreversible"
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

    // Carte grise existante pour le vehicule en edition
    const existingDoc = editingVehicle?.registration_document;
    const hasRegistration = existingDoc || registrationFile;

    return (
        <>
            <div style={{ marginBottom: 16 }}>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAdd}
                >
                    Ajouter un vehicule
                </Button>
            </div>

            <Table
                rowKey="id"
                columns={columns}
                dataSource={vehicles}
                loading={loading}
                pagination={false}
                size="small"
                locale={{
                    emptyText: (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="Aucun vehicule"
                        />
                    ),
                }}
            />

            <Modal
                title={editingVehicle ? "Modifier le vehicule" : "Ajouter un vehicule"}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={() => form.submit()}
                confirmLoading={saving}
                okText={editingVehicle ? "Enregistrer" : "Creer"}
                cancelText="Annuler"
                destroyOnHidden
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSave}
                    style={{ marginTop: 16 }}
                >
                    <Form.Item
                        name="vhc_name"
                        label="Nom du vehicule"
                        rules={[{ required: true, message: "Le nom est obligatoire" }]}
                    >
                        <Input placeholder="Ex: Renault Clio" />
                    </Form.Item>

                    <Form.Item
                        name="vhc_registration"
                        label="Immatriculation"
                    >
                        <Input placeholder="Ex: AB-123-CD" />
                    </Form.Item>

                    <Space style={{ width: "100%" }} size="large">
                        <Form.Item
                            name="vhc_fiscal_power"
                            label="Puissance fiscale"
                            rules={[{ required: true, message: "La puissance fiscale est obligatoire" }]}
                        >
                            <Select
                                options={FISCAL_POWER_OPTIONS}
                                style={{ width: 150 }}
                            />
                        </Form.Item>

                        <Form.Item
                            name="vhc_type"
                            label="Type de vehicule"
                            rules={[{ required: true, message: "Le type est obligatoire" }]}
                        >
                            <Select
                                options={VEHICLE_TYPES}
                                style={{ width: 150 }}
                            />
                        </Form.Item>
                    </Space>

                    <Space size="large">
                        <Form.Item
                            name="vhc_is_active"
                            label="Actif"
                            valuePropName="checked"
                        >
                            <Switch />
                        </Form.Item>

                        <Form.Item
                            name="vhc_is_default"
                            label="Vehicule par defaut"
                            valuePropName="checked"
                        >
                            <Switch />
                        </Form.Item>
                    </Space>

                    {/* Carte grise */}
                    <Form.Item
                        label={
                            <span>
                                Carte grise
                                {isRegistrationRequired && <span style={{ color: "#ff4d4f", marginLeft: 4 }}>*</span>}
                            </span>
                        }
                        help={isRegistrationRequired && !hasRegistration ? "Obligatoire pour les voitures et motos" : undefined}
                        validateStatus={isRegistrationRequired && !hasRegistration ? "warning" : undefined}
                    >
                        {existingDoc && !registrationFile && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                <FileOutlined />
                                <span style={{ flex: 1 }}>{existingDoc.fileName}</span>
                                <Tooltip title="Voir">
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<EyeOutlined />}
                                        onClick={() => handleDownloadRegistration(editingVehicle)}
                                    />
                                </Tooltip>
                                <Popconfirm
                                    title="Supprimer la carte grise ?"
                                    onConfirm={() => handleDeleteRegistration(editingVehicle)}
                                    okText="Supprimer"
                                    cancelText="Annuler"
                                    okButtonProps={{ danger: true }}
                                >
                                    <Tooltip title="Supprimer">
                                        <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                                    </Tooltip>
                                </Popconfirm>
                            </div>
                        )}
                        {registrationFile && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                <FileOutlined />
                                <span style={{ flex: 1 }}>{registrationFile.name}</span>
                                <Tooltip title="Retirer">
                                    <Button
                                        type="text"
                                        size="small"
                                        danger
                                        icon={<CloseCircleOutlined />}
                                        onClick={() => setRegistrationFile(null)}
                                    />
                                </Tooltip>
                            </div>
                        )}
                        {!registrationFile && (
                            <Upload
                                accept=".jpg,.jpeg,.png,.pdf"
                                maxCount={1}
                                showUploadList={false}
                                beforeUpload={(file) => {
                                    if (file.size > 5 * 1024 * 1024) {
                                        message.error("Le fichier ne doit pas depasser 5 Mo");
                                        return Upload.LIST_IGNORE;
                                    }
                                    setRegistrationFile(file);
                                    return false;
                                }}
                            >
                                <Button icon={<UploadOutlined />}>
                                    {existingDoc ? "Remplacer la carte grise" : "Uploader la carte grise"}
                                </Button>
                            </Upload>
                        )}
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
}
