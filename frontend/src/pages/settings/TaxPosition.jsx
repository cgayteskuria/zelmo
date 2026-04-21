import { useEffect, useState } from "react";
import { Drawer, Form, Input, Button, Row, Col, Popconfirm, Spin, Table, Space, Modal } from "antd";
import { message } from '../../utils/antdStatic';
import { DeleteOutlined, SaveOutlined, PlusOutlined, EditOutlined } from "@ant-design/icons";
import { taxPositionApi } from "../../services/api";
import AccountSelect from "../../components/select/AccountSelect";
import TaxSelect from "../../components/select/TaxSelect";
import { useEntityForm } from "../../hooks/useEntityForm";
import api from "../../services/api";

/**
 * Composant TaxPosition
 * Formulaire d'édition dans un Drawer avec tableau de correspondances de taxes
 */
export default function TaxPosition({ taxPositionId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();
    const [correspondenceForm] = Form.useForm();
    const [correspondences, setCorrespondences] = useState([]);
    const [loadingCorrespondences, setLoadingCorrespondences] = useState(false);
    const [correspondenceModalOpen, setCorrespondenceModalOpen] = useState(false);
    const [editingCorrespondence, setEditingCorrespondence] = useState(null);

    const pageLabel = Form.useWatch("tap_label", form);

    /**
     * Charge les correspondances de taxes pour une position fiscale existante
     */
    useEffect(() => {
        if (taxPositionId && open) {
            loadCorrespondences();
        }
    }, [taxPositionId, open]);

    const loadCorrespondences = async () => {
        if (!taxPositionId) return;

        setLoadingCorrespondences(true);
        try {
            const response = await api.get(
                `/tax-positions/${taxPositionId}/correspondences`
            );
            setCorrespondences(response.data || []);
        } catch (error) {
            console.error("Erreur lors du chargement des correspondances:", error);
            message.error("Impossible de charger les correspondances de taxes");
        } finally {
            setLoadingCorrespondences(false);
        }
    };

    /**
     * On instancie les fonctions CRUD
     */
    const { submit, remove, loading } = useEntityForm({
        api: taxPositionApi,
        entityId: taxPositionId,
        idField: "tap_id",
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
     * Ouvre le modal pour ajouter une nouvelle correspondance
     */
    const handleAddCorrespondence = () => {
        setEditingCorrespondence(null);
        correspondenceForm.resetFields();
        setCorrespondenceModalOpen(true);
    };

    /**
     * Ouvre le modal pour éditer une correspondance existante
     */
    const handleEditCorrespondence = (record) => {
        setEditingCorrespondence(record);
        correspondenceForm.setFieldsValue({
            fk_tax_id_source: record.fk_tax_id_source,
            fk_tax_id_target: record.fk_tax_id_target
        });
        setCorrespondenceModalOpen(true);
    };

    /**
     * Sauvegarde une correspondance (création ou mise à jour)
     */
    const handleSaveCorrespondence = async () => {
        try {
            const values = await correspondenceForm.validateFields();

            if (!taxPositionId) {
                message.error(
                    "Veuillez d'abord enregistrer la position fiscale avant d'ajouter des correspondances"
                );
                return;
            }

            if (editingCorrespondence) {
                // Mise à jour
                await api.put(
                    `/tax-positions/${taxPositionId}/correspondences/${editingCorrespondence.tac_id}`,
                    values
                );
                message.success("Correspondance mise à jour avec succès");
            } else {
                // Création
                await api.post(
                    `/tax-positions/${taxPositionId}/correspondences`,
                    values
                );
                message.success("Correspondance ajoutée avec succès");
            }

            setCorrespondenceModalOpen(false);
            correspondenceForm.resetFields();
            loadCorrespondences();
        } catch (error) {
            console.error(error);
            if (error.errorFields) {
                // Erreur de validation du formulaire
                return;
            }
            message.error("Erreur lors de la sauvegarde de la correspondance");
        }
    };

    /**
     * Supprime une correspondance
     */
    const handleDeleteCorrespondence = async (tacId) => {
        try {
            await api.delete(
                `/tax-positions/${taxPositionId}/correspondences/${tacId}`
            );
            message.success("Correspondance supprimée avec succès");
            loadCorrespondences();
        } catch (error) {
            console.error(error);
            message.error("Erreur lors de la suppression de la correspondance");
        }
    };

    /**
     * Configuration des colonnes du tableau de correspondances
     */
    const correspondenceColumns = [
        {
            title: "Taxe sur produit",
            dataIndex: "tax_source_label",
            key: "tax_source_label",
            width: "40%"
        },
        {
            title: "Taxe à appliquer",
            dataIndex: "tax_target_label",
            key: "tax_target_label",
            width: "40%"
        },
        {
            title: "Actions",
            key: "actions",
            width: "20%",
            render: (_, record) => (
                <Space>
                    <Button
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEditCorrespondence(record)}
                    >
                        Éditer
                    </Button>
                    <Popconfirm
                        title="Supprimer cette correspondance"
                        description="Êtes-vous sûr de vouloir supprimer cette correspondance ?"
                        onConfirm={() => handleDeleteCorrespondence(record.tac_id)}
                        okText="Oui"
                        cancelText="Non"
                    >
                        <Button type="link" danger icon={<DeleteOutlined />}>
                            Supprimer
                        </Button>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    /**
     * Fermeture du drawer
     */
    const handleClose = () => {
        form.resetFields();
        setCorrespondences([]);
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
            {taxPositionId && (
                <>
                    <div style={{ flex: 1 }}></div>
                    <Popconfirm
                        title="Supprimer cette position fiscale"
                        description="Êtes-vous sûr de vouloir supprimer cette position fiscale ?"
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
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                Enregistrer
            </Button>
        </Space>
    );

    return (
        <>
            <Drawer
                title={
                    pageLabel ? `Édition - ${pageLabel}` : "Nouvelle position fiscale"
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
                        <Form.Item name="tap_id" hidden>
                            <Input />
                        </Form.Item>


                        {/* Section: Informations générales */}
                        <div className="box" style={{ marginBottom: 24 }}>
                            <Row gutter={[16, 8]}>
                                <Col span={24}>
                                    <Form.Item
                                        name="tap_label"
                                        label="Libellé"
                                        rules={[
                                            {
                                                required: true,
                                                message: "Le libellé est requis"
                                            }
                                        ]}
                                    >
                                        <Input placeholder="Libellé de la position fiscale" />
                                    </Form.Item>
                                </Col>

                            </Row>
                        </div>
                       

                        {/* Section: Correspondances de taxes */}
                        {taxPositionId && (
                            <div className="box" style={{ marginBottom: 24 }}>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginBottom: 16
                                    }}
                                >
                                    <h3
                                        style={{
                                            margin: 0,
                                            fontWeight: "bold",
                                            fontSize: "16px"
                                        }}
                                    >
                                        Correspondances de taxes
                                    </h3>
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={handleAddCorrespondence}
                                    >
                                        Ajouter
                                    </Button>
                                </div>

                                <Spin spinning={loadingCorrespondences}>
                                    <Table
                                        columns={correspondenceColumns}
                                        dataSource={correspondences}
                                        rowKey="tac_id"
                                        pagination={false}
                                        size="middle"
                                        bordered
                                        locale={{
                                            emptyText:
                                                "Aucune correspondance de taxe définie"
                                        }}
                                    />
                                </Spin>
                            </div>
                        )}

                        {!taxPositionId && (
                            <div
                                className="box"
                                style={{
                                    marginBottom: 24,
                                    padding: 16,
                                    backgroundColor: "#f0f0f0"
                                }}
                            >
                                <p style={{ margin: 0, fontStyle: "italic" }}>
                                    Les correspondances de taxes seront disponibles après
                                    l'enregistrement de la position fiscale.
                                </p>
                            </div>
                        )}
                    </Form>
                </Spin>
            </Drawer>

            {/* Modal pour ajouter/éditer une correspondance */}
            <Modal
                title={
                    editingCorrespondence
                        ? "Éditer la correspondance"
                        : "Ajouter une correspondance"
                }
                open={correspondenceModalOpen}
                onOk={handleSaveCorrespondence}
                onCancel={() => {
                    setCorrespondenceModalOpen(false);
                    correspondenceForm.resetFields();
                }}
                okText="Enregistrer"
                cancelText="Annuler"
            >
                <Form form={correspondenceForm} layout="vertical">
                    <Form.Item
                        name="fk_tax_id_source"
                        label="Taxe sur produit"
                        rules={[
                            {
                                required: true,
                                message: "La taxe source est requise"
                            }
                        ]}
                    >
                        <TaxSelect />
                    </Form.Item>

                    <Form.Item
                        name="fk_tax_id_target"
                        label="Taxe à appliquer"
                        rules={[
                            {
                                required: true,
                                message: "La taxe cible est requise"
                            }
                        ]}
                    >
                        <TaxSelect />
                    </Form.Item>
                </Form>

            </Modal >
        </>
    );
}
