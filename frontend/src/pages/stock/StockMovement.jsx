import { useState } from "react";
import { Drawer, Form, Input, Button, Row, Col, Select, Popconfirm, InputNumber, DatePicker, Space, Spin, Alert } from "antd";
import { message } from '../../utils/antdStatic';
import { DeleteOutlined, SaveOutlined, ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";
import { stockMovementsApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";
import CanAccess from "../../components/common/CanAccess";
import ProductSelect from "../../components/select/ProductSelect";
import WarehouseSelect from "../../components/select/WarehouseSelect";
import dayjs from 'dayjs';

const { TextArea } = Input;

/**
 * Composant StockMovement
 * Formulaire d'édition/création d'un mouvement de stock dans un Drawer
 */
export default function StockMovement({ movementId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();
    const [isManual, setIsManual] = useState(true);

    const pageLabel = Form.useWatch('stm_label', form);

    const { submit, remove, loading } = useEntityForm({
        api: stockMovementsApi,
        entityId: movementId,
        idField: 'stm_id',
        form,
        open,
        transformDataForForm: (data) => {
            // Vérifier si le mouvement est manuel
            setIsManual(data.stm_origin_doc_type === 'manual' || !data.stm_origin_doc_type);

            return {
                ...data,
                stm_date: data.stm_date ? dayjs(data.stm_date) : dayjs(),
            };
        },
        onSuccess: ({ action, data }) => {
            onSubmit?.({ action, data });
            onClose?.();
        },
        onDelete: ({ id }) => {
            onSubmit?.({ action: 'delete', id });
            onClose?.();
        },
    });

    const handleFormSubmit = async (values) => {
        const submitData = {
            ...values,
            stm_date: values.stm_date ? values.stm_date.format('YYYY-MM-DD HH:mm:ss') : null,
        };
        await submit(submitData);
    };

    const handleDelete = async () => {
        await remove();
    };

    const drawerActions = (
        <Space style={{ width: "100%", display: "flex", paddingRight: "15px", justifyContent: "flex-end" }}>
            {movementId && isManual && (
                <CanAccess permission="stocks.delete">
                    <Popconfirm
                        title="Êtes-vous sûr de vouloir supprimer ce mouvement ?"
                        description="Cette action est irréversible et affectera le stock."
                        onConfirm={handleDelete}
                        okText="Supprimer"
                        cancelText="Annuler"
                        okButtonProps={{ danger: true }}
                    >
                        <Button
                            danger
                            icon={<DeleteOutlined />}
                            loading={loading}
                        >
                            Supprimer
                        </Button>
                    </Popconfirm>
                </CanAccess>
            )}

            <Button onClick={onClose}>
                Annuler
            </Button>

            {isManual && (
                <CanAccess permission={movementId ? "stocks.edit" : "stocks.create"}>
                    <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        onClick={() => form.submit()}
                        loading={loading}
                    >
                        {movementId ? "Enregistrer" : "Créer"}
                    </Button>
                </CanAccess>
            )}
        </Space>
    );

    return (
        <Drawer
            title={movementId ? `Mouvement: ${pageLabel || ""}` : "Nouveau mouvement de stock"}
            open={open}
            onClose={onClose}
            size={drawerSize}
            footer={drawerActions}
            destroyOnHidden
        >
            <Spin spinning={loading} tip="Chargement...">
                {movementId && !isManual && (
                    <Alert
                        title="Mouvement automatique"
                        description="Ce mouvement a été généré automatiquement (BL, réception, etc.) et ne peut pas être modifié."
                        type="warning"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                )}

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFormSubmit}
                    autoComplete="off"
                    disabled={!isManual && movementId}
                    initialValues={{
                        stm_direction: 1,
                        stm_date: dayjs(),
                        stm_label: "Correction de stock",
                    }}
                >
                    <Form.Item name="stm_id" hidden>
                        <Input />
                    </Form.Item>

                    <div className="box">
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    name="fk_prt_id"
                                    label="Produit"
                                    rules={[{ required: true, message: "Le produit est obligatoire" }]}
                                >
                                    <ProductSelect
                                        filters={{ prt_type: 'conso', is_stockable: 1 }}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="fk_whs_id"
                                    label="Entrepôt"
                                    rules={[{ required: true, message: "L'entrepôt est obligatoire" }]}
                                >
                                    <WarehouseSelect
                                        selectDefault={true}
                                        onDefaultSelected={(id) => {
                                            if (!movementId) {
                                                form.setFieldValue('fk_whs_id', id);
                                            }
                                        }}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col span={8}>
                                <Form.Item
                                    name="stm_direction"
                                    label="Type de mouvement"
                                    rules={[{ required: true, message: "Le type est obligatoire" }]}
                                >
                                    <Select
                                        options={[
                                            {
                                                value: 1,
                                                label: (
                                                    <span>
                                                        <ArrowUpOutlined style={{ color: 'green', marginRight: 8 }} />
                                                        Entrée (+)
                                                    </span>
                                                )
                                            },
                                            {
                                                value: -1,
                                                label: (
                                                    <span>
                                                        <ArrowDownOutlined style={{ color: 'red', marginRight: 8 }} />
                                                        Sortie (-)
                                                    </span>
                                                )
                                            },
                                        ]}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="stm_qty"
                                    label="Quantité"
                                    rules={[
                                        { required: true, message: "La quantité est obligatoire" },
                                        { type: 'number', min: 0.01, message: "La quantité doit être supérieure à 0" }
                                    ]}
                                >
                                    <InputNumber
                                        style={{ width: '100%' }}
                                        min={0.01}
                                        step={1}
                                        decimalSeparator=","
                                        precision={2}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="stm_date"
                                    label="Date du mouvement"
                                >
                                    <DatePicker
                                        style={{ width: '100%' }}
                                        format="DD/MM/YYYY HH:mm"
                                        showTime={{ format: 'HH:mm' }}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col span={24}>
                                <Form.Item
                                    name="stm_label"
                                    label="Libellé du mouvement"
                                    rules={[{ required: true, message: "Le libellé est obligatoire" }]}
                                >
                                    <Input placeholder="Ex: Correction inventaire, Réception marchandise..." />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    <div className="box" style={{ marginTop: 16 }}>
                        <Row gutter={16}>
                            <Col span={8}>
                                <Form.Item
                                    name="stm_ref"
                                    label="Référence (optionnel)"
                                >
                                    <Input placeholder="Référence interne" maxLength={50} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="stm_unit_price"
                                    label="Prix unitaire (optionnel)"
                                >
                                    <InputNumber
                                        style={{ width: '100%' }}
                                        min={0}
                                        step={0.01}
                                        decimalSeparator=","
                                        precision={2}
                                        addonAfter="€"
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="stm_lot_number"
                                    label="N° de lot (optionnel)"
                                >
                                    <Input placeholder="Numéro de lot" maxLength={100} />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col span={24}>
                                <Form.Item
                                    name="stm_notes"
                                    label="Notes (optionnel)"
                                >
                                    <TextArea rows={3} placeholder="Notes ou commentaires..." />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                </Form>
            </Spin>
        </Drawer>
    );
}
