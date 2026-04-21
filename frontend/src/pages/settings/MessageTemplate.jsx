import { useState, useEffect, useCallback } from "react";
import { Drawer, Form, Input, Button, Row, Col, Popconfirm, Spin, Space, Select, Collapse } from "antd";
import { message } from '../../utils/antdStatic';
import { DeleteOutlined, SaveOutlined } from "@ant-design/icons";
import { messageTemplatesApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";
import RichTextEditor from "../../components/common/RichTextEditor";
import CanAccess from "../../components/common/CanAccess";

/**
 * Composant MessageTemplate
 * Formulaire d'édition dans un Drawer avec éditeur riche
 */
export default function MessageTemplate({ messageTemplateId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();

    const pageLabel = Form.useWatch("emt_label", form);

    /**
     * Catégories disponibles
     */
    const categories = [
        { value: "ticket_reply", label: "Ticket réponse prédéfini" },
        { value: "system",       label: "Système" }
    ];

    /**
     * On instancie les fonctions CRUD
     */
    const { submit, remove, loading } = useEntityForm({
        api: messageTemplatesApi,
        entityId: messageTemplateId,
        idField: "emt_id",
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
            {messageTemplateId && (
                <>
                    <div style={{ flex: 1 }}></div>
                    <CanAccess permission="settings.messagetemplate.delete">
                        <Popconfirm
                            title="Supprimer ce modèle"
                            description="Êtes-vous sûr de vouloir supprimer ce modèle de message ?"
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
                pageLabel ? `Édition - ${pageLabel}` : "Nouveau modèle de message"
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
                    <Form.Item name="emt_id" hidden>
                        <Input />
                    </Form.Item>

                    {/* Section: Informations générales */}
                    <div className="box" style={{ marginBottom: 24 }}>
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item
                                    name="emt_label"
                                    label="Nom"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Le nom est requis"
                                        }
                                    ]}
                                >
                                    <Input placeholder="Nom du modèle" />
                                </Form.Item>
                            </Col>

                            <Col span={12}>
                                <Form.Item
                                    name="emt_category"
                                    label="Catégorie"
                                    rules={[
                                        {
                                            required: true,
                                            message: "La catégorie est requise"
                                        }
                                    ]}
                                >
                                    <Select
                                        placeholder="Sélectionner une catégorie"
                                        options={categories}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="emt_subject"
                                    label="Sujet"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Le sujet est requis"
                                        }
                                    ]}
                                >
                                    <Input placeholder="Sujet du message" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    {/* Section: Contenu */}
                    <div className="box" style={{ marginBottom: 24 }}>
                        <h3
                            style={{
                                marginBottom: 16,
                                fontWeight: "bold",
                                fontSize: "16px"
                            }}
                        >
                            Contenu du message
                        </h3>
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="emt_body"
                                    label=""
                                    rules={[
                                        {
                                            required: true,
                                            message: "Le contenu est requis"
                                        }
                                    ]}
                                    getValueFromEvent={(content) => content}
                                >
                                    <RichTextEditor
                                        height={350}
                                        placeholder="Saisir le contenu du message..."
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    {/* Aide pour les variables */}
                    <Collapse
                        size="small"
                        style={{ marginTop: 24 }}
                        items={[
                            {
                                key: "vars",
                                label: <span style={{ fontWeight: 600 }}>Variables disponibles</span>,
                                children: (
                                    <div style={{ fontSize: 12, lineHeight: "2em" }}>
                                        {[
                                            {
                                                label: "Ticket",
                                                vars: ["ticket.id","ticket.ref","ticket.label","ticket.opened_at","ticket.opened_by","ticket.assigned_to"],
                                            },
                                            {
                                                label: "Ticket — dernier message",
                                                vars: ["last_message.date","last_message.body"],
                                            },
                                            {
                                                label: "Utilisateur",
                                                vars: ["user.firstname","user.lastname","user.fullname","user.email","user.phone","user.mobile","user.job_title"],
                                            },
                                            {
                                                label: "Entreprise",
                                                vars: ["company.name","company.address","company.zip","company.city","company.phone","company.email","company.tva_code","company.registration_code","company.legal_status","company.capital","company.rcs","company.url_site","company.mail_parser","company.logo"],
                                            },
                                            {
                                                label: "Client",
                                                vars: ["partner.id","partner.name","partner.email","partner.phone","partner.mobile","partner.address","partner.zip","partner.city","partner.country","partner.tva_code","partner.siret"],
                                            },
                                            {
                                                label: "Contact",
                                                vars: ["contact.id","contact.firstname","contact.lastname","contact.fullname","contact.email","contact.phone","contact.mobile","contact.jobtitle"],
                                            },
                                            {
                                                label: "Vendeur",
                                                vars: ["seller.id","seller.firstname","seller.lastname","seller.fullname","seller.email","seller.phone"],
                                            },
                                            {
                                                label: "Commande",
                                                vars: ["order.id","order.number","order.date","order.valid","order.total_ht","order.total_tax","order.total_ttc","order.note","order.ref"],
                                            },
                                            {
                                                label: "Facture",
                                                vars: ["invoice.id","invoice.number","invoice.date","invoice.duedate","invoice.total_ht","invoice.total_tax","invoice.total_ttc","invoice.amount_remaining","invoice.note","invoice.ref"],
                                            },
                                            {
                                                label: "Lignes (FOREACH)",
                                                vars: ["sub_lines.reference","sub_lines.description","sub_lines.quantity","sub_lines.unit_price","sub_lines.discount","sub_lines.total_ht","sub_lines.tax_rate"],
                                            },
                                        ].map(({ label, vars }) => (
                                            <div key={label} style={{ marginBottom: 10 }}>
                                                <div style={{ fontWeight: 600, marginBottom: 4, color: "#555" }}>{label}</div>
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                                    {vars.map((v) => (
                                                        <code
                                                            key={v}
                                                            style={{
                                                                background: "#e6f4ff",
                                                                border: "1px solid #91caff",
                                                                borderRadius: 3,
                                                                padding: "1px 5px",
                                                                fontSize: 11,
                                                                cursor: "pointer",
                                                                userSelect: "all",
                                                            }}
                                                            title="Cliquer pour copier"
                                                            onClick={() => navigator.clipboard?.writeText(`{${v}}`)}
                                                        >
                                                            {`{${v}}`}
                                                        </code>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ),
                            },
                        ]}
                    />
                </Form>
            </Spin>
        </Drawer>
    );
}
