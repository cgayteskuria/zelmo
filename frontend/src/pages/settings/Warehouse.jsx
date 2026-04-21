import { useEffect, useMemo } from "react";
import { Drawer, Form, Input, Button, Row, Col, Popconfirm, Tabs, Spin, Select, Switch } from "antd";
import { message } from '../../utils/antdStatic';
import { DeleteOutlined, SaveOutlined, PlusOutlined } from "@ant-design/icons";
import { warehousesApi } from "../../services/api";
import WarehouseSelect from "../../components/select/WarehouseSelect";
import { useEntityForm } from "../../hooks/useEntityForm";

const { TextArea } = Input;

/**
 * Composant Warehouse
 * Formulaire d'édition dans un Drawer avec onglet Fiche
 */
export default function Warehouse({ warehouseId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();

    const pageLabel = Form.useWatch('whs_label', form);

    // Hook pour exclure l'entrepôt actuel de la sélection parent
    const excludedWarehouseIds = useMemo(() => 
        warehouseId ? [warehouseId] : [],
        [warehouseId]
    );

    /**
     * Fonctions CRUD
     */
    const { submit, remove, loading } = useEntityForm({
        api: warehousesApi,
        entityId: warehouseId,
        idField: 'whs_id',
        form,
        open,

        onSuccess: ({ action, data }, closeDrawer = true) => {
            onSubmit?.({ action, data });
            if (closeDrawer) onClose?.();
        },

        onDelete: ({ id }) => {
            onSubmit?.({ action: 'delete', id });
            onClose?.();
        },
    });

    const handleFormSubmit = async (values) => {
        await submit(values);
        form.resetFields();
    };

    const handleDelete = async () => {
        await remove();
    };

    const handleDuplicate = async () => {
        try {
            const values = form.getFieldsValue();
            const duplicatedValues = {
                ...values,
                whs_id: undefined,
                whs_code: `${values.whs_code}-COPY`,
                whs_label: `${values.whs_label} (copie)`,
                whs_is_default: false,
            };

            const result = await submit(duplicatedValues, { closeDrawer: false });
            form.setFieldsValue(result.data);
            message.success("Entrepôt dupliqué avec succès");
        } catch (error) {
            console.error(error);
            message.error("Erreur lors de la duplication");
        }
    };

    /**
     * Construction des onglets
     */
    const tabItems = useMemo(() => {
        return [
            {
                key: 'fiche',
                label: 'Informations',
                children: (
                    <div className="box">
                        {/* Ligne 1 : Code et Nom */}
                        <Row gutter={[16, 8]}>
                            <Col span={6}>
                                <Form.Item
                                    name="whs_code"
                                    label="Code"
                                    rules={[
                                        { required: true, message: "Code requis" },
                                        { max: 20, message: "Maximum 20 caractères" }
                                    ]}
                                >
                                    <Input placeholder="Code de l'entrepôt" />
                                </Form.Item>
                            </Col>
                            <Col span={18}>
                                <Form.Item
                                    name="whs_label"
                                    label="Nom"
                                    rules={[
                                        { required: true, message: "Nom requis" },
                                        { max: 100, message: "Maximum 100 caractères" }
                                    ]}
                                >
                                    <Input placeholder="Nom de l'entrepôt" />
                                </Form.Item>
                            </Col>
                        </Row>

                        {/* Ligne 2 : Type et Parent */}
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item
                                    name="whs_type"
                                    label="Type"
                                    initialValue={1}
                                >
                                    <Select placeholder="Sélectionner un type">
                                        <Select.Option value={1}>Entrepôt principal</Select.Option>
                                        <Select.Option value={2}>Zone</Select.Option>
                                        <Select.Option value={3}>Emplacement</Select.Option>
                                        <Select.Option value={4}>Virtuel</Select.Option>
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="fk_parent_whs_id"
                                    label="Entrepôt parent (optionnel)"
                                >
                                    <WarehouseSelect
                                        filters={{ excludeIds: excludedWarehouseIds }}
                                        allowClear
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        {/* Ligne 3 : Adresse */}
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="whs_address"
                                    label="Adresse"
                                    rules={[
                                        { max: 255, message: "Maximum 255 caractères" }
                                    ]}
                                >
                                    <Input placeholder="Adresse complète" />
                                </Form.Item>
                            </Col>
                        </Row>

                        {/* Ligne 4 : Ville, Code postal, Pays */}
                        <Row gutter={[16, 8]}>
                            <Col span={8}>
                                <Form.Item
                                    name="whs_city"
                                    label="Ville"
                                    rules={[
                                        { max: 100, message: "Maximum 100 caractères" }
                                    ]}
                                >
                                    <Input placeholder="Ville" />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="whs_zipcode"
                                    label="Code postal"
                                    rules={[
                                        { max: 20, message: "Maximum 20 caractères" }
                                    ]}
                                >
                                    <Input placeholder="Code postal" />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="whs_country"
                                    label="Pays"
                                    initialValue="France"
                                    rules={[
                                        { max: 50, message: "Maximum 50 caractères" }
                                    ]}
                                >
                                    <Input placeholder="Pays" />
                                </Form.Item>
                            </Col>
                        </Row>

                        {/* Ligne 5 : Statuts */}
                        <Row gutter={[16, 8]}>
                            <Col span={6}>
                                <Form.Item
                                    name="whs_is_active"
                                    label="Actif"
                                    valuePropName="checked"
                                    initialValue={true}
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item
                                    name="whs_is_default"
                                    label="Entrepôt par défaut"
                                    valuePropName="checked"
                                    initialValue={false}
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                )
            }
        ];
    }, [warehouseId, excludedWarehouseIds]);

    /**
     * Fermeture du drawer
     */
    const handleClose = () => {
        form.resetFields();
        if (onClose) {
            onClose();
        }
    };

    return (
        <Drawer
            title={pageLabel ? `Édition - ${pageLabel}` : "Nouvel entrepôt"}
            placement="right"
            onClose={handleClose}
            open={open}
            size={drawerSize}
            destroyOnClose
            forceRender
        >
            <Spin spinning={loading} tip="Chargement...">
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFormSubmit}
                >
                    <Form.Item name="whs_id" hidden>
                        <Input />
                    </Form.Item>

                    <Tabs
                        defaultActiveKey="fiche"
                        items={tabItems}
                    />

                    <div className="form-actions-container">
                        {warehouseId && (
                            <>
                                <Button
                                    type="secondary"
                                    style={{ marginLeft: 8 }}
                                    icon={<PlusOutlined />}
                                    onClick={handleDuplicate}
                                >
                                    Dupliquer
                                </Button>
                                <div style={{ flex: 1 }}></div>
                                <Popconfirm
                                    title="Supprimer cet entrepôt"
                                    description="Êtes-vous sûr de vouloir supprimer cet entrepôt ?"
                                    onConfirm={handleDelete}
                                    okText="Oui"
                                    cancelText="Non"
                                >
                                    <Button danger icon={<DeleteOutlined />}>
                                        Supprimer
                                    </Button>
                                </Popconfirm>
                            </>
                        )}

                        <Button onClick={handleClose}>Annuler</Button>
                        <Button 
                            type="primary" 
                            htmlType="submit" 
                            icon={<SaveOutlined />}
                            onClick={() => form.submit()}
                        >
                            Enregistrer
                        </Button>
                    </div>
                </Form>
            </Spin>
        </Drawer>
    );
}