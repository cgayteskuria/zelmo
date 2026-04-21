import { useEffect, useState, useMemo } from "react";
import { Drawer, Form, Input, Button, Row, Col, Popconfirm, Tabs, Spin, Table, Card, Space } from "antd";
import { message } from '../../utils/antdStatic';
import { DeleteOutlined, SaveOutlined, PlusOutlined, DisconnectOutlined, LinkOutlined } from "@ant-design/icons";
import { devicesApi } from "../../services/api";
import PartnerSelect from "../../components/select/PartnerSelect"
import ContactSelect from "../../components/select/ContactSelect";
import { useEntityForm } from "../../hooks/useEntityForm";

/**
 * Composant Device
 * Formulaire d'édition dans un Drawer avec onglets Fiche et Contacts
 */
export default function Device({ deviceId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();
    const [contacts, setContacts] = useState([]);
    const [loadingContacts, setLoadingContacts] = useState(false);
    const [showContactSelector, setShowContactSelector] = useState(false);

    const pageLabel = Form.useWatch('dev_hostname', form);

    // Hook pour sélection partenaire
    const partnerId = Form.useWatch('fk_ptr_id', form);
    // Hook pour sélection contact - exclure les contacts déjà liés
    const excludedContactIds = useMemo(() =>
        contacts.map(c => c.fk_ctc_id),
        [contacts]
    );


    /**
     * Charge les contacts associés au device
     */
    useEffect(() => {
        if (deviceId && open) {
            loadContacts();
        }
    }, [deviceId, open]);

    const loadContacts = async () => {
        if (!deviceId) return;

        setLoadingContacts(true);
        try {
            const response = await devicesApi.getContacts(deviceId);
            if (response?.data) {
                setContacts(response.data);
            }
        } catch (error) {
            console.error("Erreur lors du chargement des contacts:", error);
            message.error("Impossible de charger les contacts");
        } finally {
            setLoadingContacts(false);
        }
    };

    /**
     * Fonctions CRUD
     */
    const { submit, remove, loading, entity } = useEntityForm({
        api: devicesApi,
        entityId: deviceId,
        idField: 'dev_id',
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
                dev_id: undefined,
                dev_hostname: `${values.dev_hostname}-copy`,
            };

            const result = await submit(duplicatedValues, { closeDrawer: false });
            form.setFieldsValue(result.data);
            message.success("Device dupliqué avec succès");
        } catch (error) {
            console.error(error);
            message.error("Erreur lors de la duplication");
        }
    };

    /**
     * Délier un contact du device
     */
    const handleUnlinkContact = async (ctdId) => {
        try {
            await devicesApi.unlinkContact(deviceId, ctdId);
            message.success("Contact délié avec succès");
            loadContacts();
        } catch (error) {
            console.error(error);
            message.error("Erreur lors du déliage du contact");
        }
    };

    /**
     * Lier un contact au device
     */
    const handleLinkContact = async () => {
        const contactId = form.getFieldValue('selected_contact');

        if (!contactId) {
            message.warning("Veuillez sélectionner un contact");
            return;
        }

        try {
            await devicesApi.linkContact(deviceId, contactId);
            message.success("Contact lié avec succès");
            form.setFieldsValue({ selected_contact: null });
            setShowContactSelector(false);
            loadContacts();
        } catch (error) {
            console.error(error);
            message.error("Erreur lors du liage du contact");
        }
    };

    /**
     * Colonnes du tableau des contacts
     */
    const contactColumns = [
        {
            title: 'Prénom',
            dataIndex: 'ctc_firstname',
            key: 'ctc_firstname',
            flexgrow: 1,
        },
        {
            title: 'Nom',
            dataIndex: 'ctc_lastname',
            key: 'ctc_lastname',
            flexgrow: 1,
        },
        {
            title: 'Email',
            dataIndex: 'ctc_email',
            key: 'ctc_email',
            flexgrow: 1,
        },
        {
            title: '',
            key: 'actions',
            width: 80,
            align: 'center',
            render: (_, record) => (
                <Popconfirm
                    title="Délier ce contact"
                    description="Êtes-vous sûr de vouloir délier ce contact ?"
                    onConfirm={() => handleUnlinkContact(record.ctd_id)}
                    okText="Oui"
                    cancelText="Non"
                >
                    <Button
                        type="text"
                        danger
                        icon={<DisconnectOutlined />}
                        size="small"
                    />
                </Popconfirm>
            ),
        },
    ];

    /**
     * Construction des onglets
     */
    const tabItems = useMemo(() => {
        const items = [
            {
                key: 'fiche',
                label: 'Fiche',
                children: (
                    <div className="box">
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="fk_ptr_id"
                                    label="Tiers"
                                    rules={[{ required: true, message: "Tiers requis" }]}
                                >
                                    <PartnerSelect
                                        loadInitially={!deviceId ? true : false}
                                        initialData={entity?.partner}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item
                                    name="dev_hostname"
                                    label="Hostname"
                                >
                                    <Input placeholder="Hostname" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="dev_localisation"
                                    label="Localisation"
                                >
                                    <Input placeholder="Localisation" />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item
                                    name="dev_lastloggedinuser"
                                    label="Last Logged User"
                                >
                                    <Input placeholder="Dernier utilisateur" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="dev_os"
                                    label="Os"
                                >
                                    <Input placeholder="Système d'exploitation" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                )
            }
        ];

        // Onglet Contacts (uniquement pour device existant)
        if (deviceId) {
            items.push({
                key: 'contacts',
                label: 'Contacts',
                children: (
                    <Spin spinning={loadingContacts}>
                        <div>
                            {/* Section pour lier un nouveau contact */}
                            {showContactSelector ? (
                                <Card size="small" style={{ marginBottom: 16 }}>
                                    <Space orientation="vertical" style={{ width: '100%' }}>
                                        <Form.Item
                                            name="selected_contact"
                                            label="Sélectionner un contact"
                                            style={{ marginBottom: 8 }}
                                        >
                                            <ContactSelect
                                                filters={{ excludeIds: excludedContactIds, ptrId: partnerId }}
                                                loadInitially={true}
                                            />
                                        </Form.Item>
                                        <Space>
                                            <Button
                                                type="primary"
                                                icon={<LinkOutlined />}
                                                onClick={handleLinkContact}
                                            >
                                                Lier
                                            </Button>
                                            <Button onClick={() => {
                                                setShowContactSelector(false);
                                                form.setFieldsValue({ selected_contact: null });
                                            }}>
                                                Annuler
                                            </Button>
                                        </Space>
                                    </Space>
                                </Card>
                            ) : (
                                <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
                                    <Col span={24}>
                                        <Button
                                            icon={<PlusOutlined />}
                                            onClick={() => setShowContactSelector(true)}
                                        >
                                            Associer un utilisateur
                                        </Button>
                                    </Col>
                                </Row>
                            )}

                            {/* Tableau des contacts */}
                            <Table
                                columns={contactColumns}
                                dataSource={contacts}
                                rowKey="ctd_id"
                                pagination={false}
                                size="middle"
                                bordered
                                loading={loadingContacts}
                                scroll={{ x: 'max-content' }}
                                locale={{
                                    emptyText: 'Aucun utilisateur associé'
                                }}
                            />
                        </div>
                    </Spin>
                )
            });
        }

        return items;
    }, [deviceId, contacts, loadingContacts, showContactSelector, PartnerSelect, ContactSelect]);

    /**
     * Fermeture du drawer
     */
    const handleClose = () => {
        form.resetFields();
        setContacts([]);
        setShowContactSelector(false);
        form.setFieldsValue({ selected_contact: null });
        if (onClose) {
            onClose();
        }
    };

    return (
        <Drawer
            title={pageLabel ? `Édition - ${pageLabel}` : "Nouveau device"}
            placement="right"
            onClose={handleClose}
            open={open}
            size={drawerSize}
            destroyOnHidden
            forceRender
        >
            <Spin spinning={loading} tip="Chargement...">
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFormSubmit}
                >
                    <Form.Item name="dev_id" hidden>
                        <Input />
                    </Form.Item>

                    <Tabs
                        defaultActiveKey="fiche"
                        items={tabItems}
                    />

                    <div className="form-actions-container">
                        {deviceId && (
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
                                    title="Supprimer ce device"
                                    description="Êtes-vous sûr de vouloir supprimer ce device ?"
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
                        <Button type="primary" htmlType="submit" icon={<SaveOutlined />}
                            onClick={() => form.submit()}>
                            Enregistrer
                        </Button>
                    </div>
                </Form>
            </Spin>
        </Drawer>
    );
}