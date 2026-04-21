import { useEffect, useState, useMemo } from "react";
import { Drawer, Form, Input, Button, Row, Col, Switch, Popconfirm, Tabs, Spin, Table, Card, Space } from "antd";
import { message } from '../../utils/antdStatic';
import { DeleteOutlined, SaveOutlined, PlusOutlined, DisconnectOutlined, LinkOutlined, LinkedinOutlined } from "@ant-design/icons";
import { contactsApi } from "../../services/api";
import PartnerSelect from "../../components/select/PartnerSelect"
import DeviceSelect from "../../components/select/DeviceSelect";
import { useEntityForm } from "../../hooks/useEntityForm";
import CanAccess from "../../components/common/CanAccess";
/**
 * Composant Contact
 * Formulaire d'édition dans un Drawer avec onglets Compte et Devices
 */
export default function Contact({ contactId, open, onClose, onSubmit, initialValues = {} }) {
    const [form] = Form.useForm();
    const [activeTab, setActiveTab] = useState('general');
    const [devices, setDevices] = useState([]);
    const [loadingDevices, setLoadingDevices] = useState(false);
    const [showDeviceSelector, setShowDeviceSelector] = useState(false);

    const pageLabel = Form.useWatch('ctc_email', form);

    // Hook pour sélection partenaires (multiple)
    const partnerIds = Form.useWatch('partner_ids', form);
    const partnerId = partnerIds?.[0]; // premier partenaire (pour filtrer les DeviceSelect)
    const linkedinUrl = Form.useWatch('ctc_linkedin_url', form);

    // Hook pour sélection device - exclure les devices déjà liés
    const excludedDeviceIds = useMemo(() =>
        devices.map(d => d.fk_dev_id),
        [devices]
    );

    // Appliquer les valeurs initiales pour un nouveau contact
    useEffect(() => {
        if (open && !contactId && initialValues && Object.keys(initialValues).length > 0) {
            // Convertit fk_ptr_id éventuel en partner_ids (tableau)
            const values = { ...initialValues };
            if (values.fk_ptr_id && !values.partner_ids) {
                values.partner_ids = [values.fk_ptr_id];
                delete values.fk_ptr_id;
            }
            form.setFieldsValue(values);
        }
    }, [open, contactId, initialValues, form]);

    /**
     * Charge les devices associés au contact
     */
    useEffect(() => {
        if (contactId && open) {
            loadDevices();
        }
    }, [contactId, open]);

    const loadDevices = async () => {
        if (!contactId) return;

        setLoadingDevices(true);
        try {
            const response = await contactsApi.getDevices(contactId);
            if (response?.data) {
                setDevices(response.data);
            }
        } catch (error) {
            console.error("Erreur lors du chargement des devices:", error);
            message.error("Impossible de charger les devices");
        } finally {
            setLoadingDevices(false);
        }
    };

    /**
     * Fonctions CRUD
     */
    const { submit, remove, loading, entity } = useEntityForm({
        api: contactsApi,
        entityId: contactId,
        idField: 'ctc_id',
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

    const onFinishFailed = ({ errorFields }) => {
        if (errorFields.length > 0) {
            const firstErrorField = errorFields[0].name[0];

            if (['partner_ids', 'ctc_firstname', 'ctc_lastname', 'ctc_email', 'ctc_phone', 'ctc_mobile', 'ctc_job_title', 'ctc_receive_invoice', 'ctc_receive_saleorder'].includes(firstErrorField)) {
                setActiveTab('general');
            }

            message.error("Veuillez remplir tous les champs obligatoires");
        }
    };

    const handleDelete = async () => {
        await remove();
    };

    const handleDuplicate = async () => {
        try {
            const values = form.getFieldsValue();
            const duplicatedValues = {
                ...values,
                ctc_id: undefined,
                ctc_email: `${values.ctc_email}-copy`,
            };

            const result = await submit(duplicatedValues, { closeDrawer: false });
            form.setFieldsValue(result.data);
            message.success("Contact dupliqué avec succès");
        } catch (error) {
            console.error(error);
            message.error("Erreur lors de la duplication");
        }
    };

    /**
     * Délier un device du contact
     */
    const handleUnlinkDevice = async (ctdId) => {
        try {
            await contactsApi.unlinkDevice(contactId, ctdId);
            message.success("Device délié avec succès");
            loadDevices();
        } catch (error) {
            console.error(error);
            message.error("Erreur lors du déliage du device");
        }
    };

    /**
     * Lier un device au contact
     */
    const handleLinkDevice = async () => {
        const deviceId = form.getFieldValue('selected_device');

        if (!deviceId) {
            message.warning("Veuillez sélectionner un device");
            return;
        }

        try {
            await contactsApi.linkDevice(contactId, deviceId);
            message.success("Device lié avec succès");
            form.setFieldsValue({ selected_device: null });
            setShowDeviceSelector(false);
            loadDevices();
        } catch (error) {
            console.error(error);
            message.error("Erreur lors du liage du device");
        }
    };

    /**
     * Colonnes du tableau des devices
     */
    const deviceColumns = [
        {
            title: 'Hostname',
            dataIndex: 'dev_hostname',
            key: 'dev_hostname',
            flexgrow: 1,
            render: (text, record) => (
                record.dev_dattowebremoteurl ?
                    <a href={record.dev_dattowebremoteurl} target="_blank" rel="noopener noreferrer">
                        {text}
                    </a> : text
            ),
        },
        {
            title: 'Dernier utilisateur',
            dataIndex: 'dev_lastloggedinuser',
            key: 'dev_lastloggedinuser',
            flexgrow: 1,
        },
        {
            title: 'Système',
            dataIndex: 'dev_os',
            key: 'dev_os',
            flexgrow: 1,
        },
        {
            title: 'Dernière vue',
            dataIndex: 'dev_lastseen',
            key: 'dev_lastseen',
            flexgrow: 1,
            render: (date) => date ? new Date(date).toLocaleString('fr-FR') : '-',
        },
        {
            title: '',
            key: 'actions',
            width: 80,
            align: 'center',
            render: (_, record) => (
                <Popconfirm
                    title="Délier ce device"
                    description="Êtes-vous sûr de vouloir délier ce device ?"
                    onConfirm={() => handleUnlinkDevice(record.ctd_id)}
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
                key: 'general',
                label: 'Compte',
                children: (
                    <div className="box">
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="partner_ids"
                                    label="Tiers"
                                    rules={[{ required: true, message: "Au moins un tiers est requis" }]}
                                >
                                    <PartnerSelect
                                        loadInitially
                                        mode="multiple"
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item
                                    name="ctc_firstname"
                                    label="Prénom"
                                >
                                    <Input placeholder="Prénom" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="ctc_lastname"
                                    label="Nom"
                                >
                                    <Input placeholder="Nom" />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item
                                    name="ctc_job_title"
                                    label="Fonction"
                                >
                                    <Input placeholder="Fonction" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="ctc_email"
                                    label="Email"
                                    rules={[
                                        { required: true, message: "Email requis" },
                                        { type: 'email', message: "Email invalide" }
                                    ]}
                                >
                                    <Input placeholder="email@exemple.com" />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item
                                    name="ctc_phone"
                                    label="Téléphone"
                                >
                                    <Input placeholder="Téléphone" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="ctc_mobile"
                                    label="Mobile"
                                >
                                    <Input placeholder="Mobile" />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item name="ctc_linkedin_url" label="LinkedIn">
                                    <Input
                                        placeholder="https://linkedin.com/in/..."
                                        prefix={<LinkedinOutlined />}
                                        suffix={linkedinUrl ? <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}><LinkOutlined /></a> : null}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]}>
                            <Col span={6}>
                                <Form.Item
                                    name="ctc_is_active"
                                    label="Actif"
                                    valuePropName="checked"
                                    initialValue={true}
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item
                                    name="ctc_receive_invoice"
                                    label="Reçoit les factures"
                                    valuePropName="checked"
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                            <Col span={10}>
                                <Form.Item
                                    name="ctc_receive_saleorder"
                                    label="Reçoit les devis/bons de commande"
                                    valuePropName="checked"
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                )
            }
        ];

        // Onglet Devices (uniquement pour contact existant)
        if (contactId) {
            items.push({
                key: 'devices',
                label: 'Devices',
                children: (
                    <Spin spinning={loadingDevices}>
                        <div>
                            {/* Section pour lier un nouveau device */}
                            {showDeviceSelector ? (
                                <Card size="small" style={{ marginBottom: 16 }}>
                                    <Space orientation="vertical" style={{ width: '100%' }}>
                                        <Form.Item
                                            name="selected_device"
                                            label="Sélectionner un device"
                                            style={{ marginBottom: 8 }}
                                        >
                                            <DeviceSelect
                                                filters={{ excludeIds: excludedDeviceIds, ptrId: partnerId, }}
                                                loadInitially={true}
                                            />
                                        </Form.Item>
                                        <Space>
                                            <Button
                                                type="primary"
                                                icon={<LinkOutlined />}
                                                onClick={handleLinkDevice}
                                            >
                                                Lier
                                            </Button>
                                            <Button onClick={() => {
                                                setShowDeviceSelector(false);
                                                form.setFieldsValue({ selected_device: null });
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
                                            onClick={() => setShowDeviceSelector(true)}
                                        >
                                            Lier un device
                                        </Button>
                                    </Col>
                                </Row>
                            )}

                            {/* Tableau des devices */}
                            <Table
                                columns={deviceColumns}
                                dataSource={devices}
                                rowKey="ctd_id"
                                pagination={false}
                                size="middle"
                                bordered
                                loading={loadingDevices}
                                scroll={{ x: 'max-content' }}
                                locale={{
                                    emptyText: 'Aucun device associé'
                                }}
                            />
                        </div>
                    </Spin>
                )
            });
        }

        return items;
    }, [contactId, devices, loadingDevices, showDeviceSelector, PartnerSelect, DeviceSelect]);

    /**
     * Fermeture du drawer
     */
    const handleClose = () => {
        form.resetFields();
        setDevices([]);
        setShowDeviceSelector(false);
        form.setFieldsValue({ selected_device: null });
        if (onClose) {
            onClose();
        }
    };


    /**
        * Actions du drawer (footer)
        */
    const drawerActions = (

        <Space style={{ width: "100%", display: "flex", paddingRight: "15px", justifyContent: "flex-end" }}>
            {contactId && (
                <>
                    <CanAccess permission="contacts.create">
                        <Button
                            type="secondary"
                            style={{ marginRight: 30 }}
                            icon={<PlusOutlined />}
                            onClick={handleDuplicate}
                        >
                            Dupliquer
                        </Button>
                    </CanAccess>
                    <div style={{ flex: 1 }}></div>
                    <CanAccess permission="contacts.delete">
                        <Popconfirm
                            title="Supprimer ce contact"
                            description="Êtes-vous sûr de vouloir supprimer ce contact ?"
                            onConfirm={handleDelete}
                            okText="Oui"
                            cancelText="Non"
                        >
                            <Button
                                danger
                                icon={<DeleteOutlined />}
                            >
                                Supprimer
                            </Button>
                        </Popconfirm>
                    </CanAccess>
                </>
            )}

            <Button onClick={handleClose}>Annuler</Button>
            <CanAccess permission={contactId ? "contacts.edit" : "contacts.create"}>
                <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={() => form.submit()}
                    loading={loading}
                >
                    {contactId ? "Enregistrer" : "Créer"}
                </Button>
            </CanAccess>
        </Space>
    );

    return (
        <Drawer
            title={pageLabel ? `Édition - ${pageLabel}` : "Nouveau contact"}
            placement="right"
            onClose={handleClose}
            footer={drawerActions}
            open={open}
            size={"large"}
            destroyOnHidden
            forceRender
        >
            <Spin spinning={loading} tip="Chargement...">
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFormSubmit}
                    onFinishFailed={onFinishFailed}
                    scrollToFirstError={{
                        behavior: 'smooth',
                        block: 'center'
                    }}
                >
                    <Form.Item name="ctc_id" hidden>
                        <Input />
                    </Form.Item>

                    <Tabs
                        activeKey={activeTab}
                        onChange={setActiveTab}
                        items={tabItems}
                    />
                </Form>
            </Spin>
        </Drawer>
    );
}