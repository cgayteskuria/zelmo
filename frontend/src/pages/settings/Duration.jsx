import { Drawer, Form, Input, Button, Row, Col, Popconfirm, Spin, Space, Select, InputNumber } from "antd";
import { DeleteOutlined, SaveOutlined } from "@ant-design/icons";
import { durationsApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";
import CanAccess from "../../components/common/CanAccess";

/**
 * Mapping des types de durées pour les permissions
 */
const DURATION_TYPES_PERMISSIONS = {
    'commitment-durations': 'settings.contractconf',
    'notice-durations': 'settings.contractconf',
    'renew-durations': 'settings.contractconf',
    'invoicing-durations': 'settings.contractconf',
    'payment-conditions': 'settings.invoiceconf',
};

/**
 * Mapping des labels
 */
const DURATION_LABELS = {
    'commitment-durations': 'Durée d\'abonnement',
    'notice-durations': 'Durée de préavis',
    'renew-durations': 'Durée de renouvellement',
    'invoicing-durations': 'Fréquence de facturation',
    'payment-conditions': 'Condition de paiement',
};

/**
 * Composant Duration
 * Formulaire d'édition dans un Drawer
 */
export default function Duration({ durationId, durationType, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();

    const pageLabel = Form.useWatch("dur_label", form);
    const permission = DURATION_TYPES_PERMISSIONS[durationType] || 'settings';
    const typeLabel = DURATION_LABELS[durationType] || 'Durée';

    /**
     * Unités de temps disponibles
     */
    const timeUnits = [
        { value: 'day', label: 'Jour(s)' },
        { value: 'monthly', label: 'Mois' },
        { value: 'annually', label: 'Année(s)' }
    ];

    /**
     * Modes disponibles
     */
    const modes = [
        { value: '', label: 'Aucun' },
        { value: 'advance', label: 'À terme échu' },
        { value: 'arrears', label: 'À terme à échoir' }
    ];

    /**
     * On instancie les fonctions CRUD avec le type de durée
     */
    const { submit, remove, loading } = useEntityForm({
        api: {
            get: (id) => durationsApi.get(durationType, id),
            create: (data) => durationsApi.create(durationType, data),
            update: (id, data) => durationsApi.update(durationType, id, data),
            delete: (id) => durationsApi.delete(durationType, id)
        },
        entityId: durationId,
        idField: "dur_id",
        form,
        open,

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
        await submit(values);
        form.resetFields();
    };

    const handleDelete = async () => {
        await remove();
    };

    /**
     * Fermeture du drawer
     */
    const handleClose = () => {
        form.resetFields();
        if (onClose) {
            onClose();
        }
    };

    /**
     * Actions du drawer (footer)
     */
    const drawerActions = (
        <Space
            style={{
                width: "100%",
                display: "flex",
                paddingRight: "15px",
                justifyContent: "flex-end"
            }}
        >
            {durationId && (
                <>
                    <div style={{ flex: 1 }}></div>
                    <CanAccess permission={`${permission}.delete`}>
                        <Popconfirm
                            title={`Supprimer cette ${typeLabel.toLowerCase()}`}
                            description={`Êtes-vous sûr de vouloir supprimer cette ${typeLabel.toLowerCase()} ?`}
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
                pageLabel ? `Édition - ${pageLabel}` : `Nouvelle ${typeLabel.toLowerCase()}`
            }
            placement="right"
            onClose={handleClose}
            open={open}
            size={drawerSize}
            footer={drawerActions}
            forceRender
        >
            <Spin spinning={loading} tip="Chargement...">
                <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
                    <Form.Item name="dur_id" hidden>
                        <Input />
                    </Form.Item>

                    {/* Section: Informations générales */}
                    <div className="box" style={{ marginBottom: 24 }}>
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="dur_label"
                                    label="Libellé"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Le libellé est requis"
                                        }
                                    ]}
                                >
                                    <Input placeholder="Libellé de la durée" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item
                                    name="dur_value"
                                    label="Valeur"
                                    rules={[
                                        {
                                            required: true,
                                            message: "La valeur est requise"
                                        }
                                    ]}
                                >
                                    <InputNumber
                                        min={1}
                                        style={{ width: '100%' }}
                                        placeholder="1"
                                    />
                                </Form.Item>
                            </Col>

                            <Col span={12}>
                                <Form.Item
                                    name="dur_time_unit"
                                    label="Unité de temps"
                                    rules={[
                                        {
                                            required: true,
                                            message: "L'unité de temps est requise"
                                        }
                                    ]}
                                >
                                    <Select
                                        placeholder="Sélectionner une unité"
                                        options={timeUnits}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item
                                    name="dur_mode"
                                    label="Mode"
                                    initialValue=""
                                >
                                    <Select
                                        placeholder="Sélectionner un mode"
                                        options={modes}
                                    />
                                </Form.Item>
                            </Col>

                            <Col span={12}>
                                <Form.Item
                                    name="dur_order"
                                    label="Ordre d'affichage"
                                >
                                    <InputNumber
                                        min={0}
                                        style={{ width: '100%' }}
                                        placeholder="0"
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    {/* Section d'aide */}
                    <div
                        className="box"
                        style={{
                            marginTop: 24,
                            padding: 16,
                            backgroundColor: "#f0f0f0"
                        }}
                    >
                        <h4 style={{ marginBottom: 8, fontWeight: "bold" }}>
                            Information
                        </h4>
                        <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
                            <strong>Valeur :</strong> Nombre d'unités de temps<br />
                            <strong>Unité :</strong> Jour(s), Mois ou Année(s)<br />
                            <strong>Mode :</strong> Pour la facturation (à terme échu/à échoir)<br />
                            <strong>Ordre :</strong> Position dans la liste de sélection
                        </p>
                    </div>
                </Form>
            </Spin>
        </Drawer>
    );
}
