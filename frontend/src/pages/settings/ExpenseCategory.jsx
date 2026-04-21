import { Drawer, Form, Input, Button, Row, Col, Popconfirm, Spin, Space, Switch, InputNumber, ColorPicker, Select } from "antd";
import { DeleteOutlined, SaveOutlined } from "@ant-design/icons";
import { expenseCategoriesApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";
import CanAccess from "../../components/common/CanAccess";
import AccountSelect from "../../components/select/AccountSelect";

const { TextArea } = Input;

/**
 * Composant ExpenseCategory
 * Formulaire d'edition dans un Drawer
 */
export default function ExpenseCategory({ expenseCategoryId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();

    const pageName = Form.useWatch("exc_name", form);

    const { submit, remove, loading, entity } = useEntityForm({
        api: expenseCategoriesApi,
        entityId: expenseCategoryId,
        idField: "exc_id",
        form,
        open,

        transformData: (data) => {
            // Transformer la couleur si necessaire
            if (data.exc_color && typeof data.exc_color === "string") {
                return data;
            }
            return data;
        },

        onSuccess: ({ action, data }, closeDrawer = true) => {
            onSubmit?.({ action, data });
            if (closeDrawer) onClose?.();
        },

        onDelete: ({ id }) => {
            onSubmit?.({ action: "delete", id });
            onClose?.();
        }
    });

    const handleFormSubmit = async (values) => {
        // Transformer la couleur ColorPicker en string
      
        const data = { ...values };
        if (data.exc_color && typeof data.exc_color === "object") {
            data.exc_color = data.exc_color.toHexString();
        }

        await submit(data);
        form.resetFields();
    };

    const handleDelete = async () => {
        await remove();
    };

    const handleClose = () => {
        form.resetFields();
        if (onClose) {
            onClose();
        }
    };

    const drawerActions = (
        <Space
            style={{
                width: "100%",
                display: "flex",
                paddingRight: "15px",
                justifyContent: "flex-end"
            }}
        >
            {expenseCategoryId && (
                <>
                    <div style={{ flex: 1 }}></div>
                    <CanAccess permission="settings.expenses.delete">
                        <Popconfirm
                            title="Supprimer cette categorie"
                            description="Etes-vous sur de vouloir supprimer cette categorie ?"
                            onConfirm={handleDelete}
                            okText="Oui"
                            cancelText="Non"
                        >
                            <Button danger icon={<DeleteOutlined />}>
                                Supprimer
                            </Button>
                        </Popconfirm>
                    </CanAccess>
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
        </Space>
    );

    return (
        <Drawer
            title={
                pageName
                    ? `Edition - ${pageName}`
                    : "Nouvelle categorie de depenses"
            }
            placement="right"
            onClose={handleClose}
            open={open}
            size={drawerSize}
            footer={drawerActions}
            forceRender
        >
            <Spin spinning={loading} tip="Chargement...">
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFormSubmit}
                    initialValues={{
                        exc_is_active: true,
                        exc_requires_receipt: true
                    }}
                >
                    <Form.Item name="exc_id" hidden>
                        <Input />
                    </Form.Item>

                    <div className="box" style={{ marginBottom: 24 }}>
                        <Row gutter={[16, 8]}>
                            <Col span={16}>
                                <Form.Item
                                    name="exc_name"
                                    label="Nom"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Le nom est requis"
                                        }
                                    ]}
                                >
                                    <Input placeholder="Ex: Transport, Repas, Hebergement..." />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="exc_code"
                                    label="Code"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Le code est requis"
                                        }
                                    ]}
                                >
                                    <Input placeholder="Ex: TRANSP, REPAS..." />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item name="exc_description" label="Description">
                                    <TextArea
                                        rows={3}
                                        placeholder="Description de la categorie (optionnel)"
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={[16, 8]}>
                            <Col span={8}>
                                <Form.Item name="exc_icon" label="Icone">
                                    <Input placeholder="Ex: car, plane, utensils..." />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name="exc_color" label="Couleur">
                                    <ColorPicker format="hex" />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name="exc_max_amount" label="Montant maximum">
                                    <InputNumber
                                        min={0}
                                        precision={2}
                                        style={{ width: "100%" }}
                                        placeholder="Illimite"
                                        addonAfter="EUR"
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={[16, 8]}>
                            <Col span={8}>
                                <Form.Item
                                    name="exc_type"
                                    label="Type de dépense"
                                    rules={[{ required: true, message: "Le type est requis" }]}
                                    initialValue="conso"
                                >
                                    <Select
                                        options={[
                                            { value: 'conso',   label: 'Consommation / Bien' },
                                            { value: 'service', label: 'Service / Prestation' },
                                        ]}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="exc_is_active"
                                    label="Categorie active"
                                    valuePropName="checked"
                                >
                                    <Switch checkedChildren="Oui" unCheckedChildren="Non" />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="exc_requires_receipt"
                                    label="Justificatif requis"
                                    valuePropName="checked"
                                    tooltip="Si active, un justificatif sera obligatoire pour les depenses de cette categorie"
                                >
                                    <Switch checkedChildren="Oui" unCheckedChildren="Non" />
                                </Form.Item>
                            </Col>

                            <Col span={24}>
                                <Form.Item
                                    name="fk_acc_id"
                                    label="Compte comptable"
                                    rules={[{ required: true, message: "Le compte comptable est requis" }]}
                                >
                                    <AccountSelect
                                        filters={{ type: ['expense', 'expense_direct_cost'],isActive: true }}
                                        loadInitially={!expenseCategoryId ? true : false}
                                        initialData={entity?.account}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                </Form>
            </Spin>
        </Drawer>
    );
}
