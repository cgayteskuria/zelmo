import { useState, useMemo, useCallback, useEffect, lazy, Suspense, useRef } from "react";
import { Drawer, Form, Input, Button, Row, Col, Switch, App, Popconfirm, Tabs, Spin, Space, Divider, Table, Tag, Tooltip, Card } from "antd";
import { DeleteOutlined, SaveOutlined, PlusOutlined, LinkedinOutlined, LinkOutlined } from "@ant-design/icons";
import { partnersApi, contactsApi, checkAccountAuxiliaryApi, checkLinkedRecordsApi } from "../../services/api";
import { opportunitiesApi } from "../../services/apiProspect";
import AccountSelect from "../../components/select/AccountSelect";
import PaymentModeSelect from "../../components/select/PaymentModeSelect";
import PaymentConditionSelect from "../../components/select/PaymentConditionSelect";
import SellerSelect from "../../components/select/SellerSelect";
import { useEntityForm } from "../../hooks/useEntityForm";
import { formatCurrency } from "../../utils/formatters";
import CanAccess from "../../components/common/CanAccess";
import ContactSelect from "../../components/select/ContactSelect";
import Contact from "./Contact";
import Opportunity from "./Opportunity";
import ActivityTimeline from "../../components/crm/ActivityTimeline";

// Import lazy des composants FilesTab, BankTab et LinkedObjectsTab
const FilesTab = lazy(() => import('../../components/bizdocument/FilesTab'));
const BankTab = lazy(() => import('../../components/bizdocument/BankTab'));
const LinkedObjectsTab = lazy(() => import('../../components/bizdocument/LinkedObjectsTab'));

// Composant de chargement pour les onglets
const TabLoader = () => (
    <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px'
    }}>
        <Spin size="large" tip="Chargement..." spinning={true}>
            <div style={{ minHeight: '200px' }} />
        </Spin>
    </div>
);

/**
 * Composant Partner
 * Formulaire d'édition d'un partenaire dans un Drawer
 */
export default function Partner({ partnerId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();
    const { message } = App.useApp();
    const [activeTab, setActiveTab] = useState('general');

    const pageLabel = Form.useWatch('ptr_name', form);
    const partnerName= Form.useWatch('ptr_name', form);

    const isCustomer = Form.useWatch('ptr_is_customer', form);
    const isSupplier = Form.useWatch('ptr_is_supplier', form);
    const isProspect = Form.useWatch('ptr_is_prospect', form);

    const accountAuxiliaryCustomer = Form.useWatch('ptr_account_auxiliary_customer', form);
    const accountAuxiliarySupplier = Form.useWatch('ptr_account_auxiliary_supplier', form);
    const linkedinUrl = Form.useWatch('ptr_linkedin_url', form);
    const pappersUrl = Form.useWatch('ptr_pappers_url', form);

    const [auxiliaryCustomerError, setAuxiliaryCustomerError] = useState(null);
    const [auxiliarySupplierError, setAuxiliarySupplierError] = useState(null);
    const [customerUseBillingAddress, setCustomerUseBillingAddress] = useState(true);
    const [supplierUseBillingAddress, setSupplierUseBillingAddress] = useState(true);
    const [documentsCount, setDocumentsCount] = useState(undefined);
    const [contacts, setContacts] = useState([]);
    const [loadingContacts, setLoadingContacts] = useState(false);

    // Contact drawer
    const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
    const [selectedContactId, setSelectedContactId] = useState(null);

    // Liaison d'un contact existant
    const [linkContactOpen, setLinkContactOpen] = useState(false);
    const [linkContactId, setLinkContactId] = useState(null);
    const [linkingContact, setLinkingContact] = useState(false);

    // Opportunity drawer
    const [oppDrawerOpen, setOppDrawerOpen] = useState(false);
    const [selectedOppId, setSelectedOppId] = useState(null);

    // Opportunities list
    const [opportunities, setOpportunities] = useState([]);
    const [loadingOpportunities, setLoadingOpportunities] = useState(false);

    const onDataLoadedCallback = useCallback((data) => {
        setDocumentsCount(data.documents_count ?? 0);
        setCustomerUseBillingAddress(!data.ptr_customer_delivery_address);
        setSupplierUseBillingAddress(!data.ptr_supplier_delivery_address);
    }, []);

    /**
     * Fonctions CRUD
     */
    const { submit, remove, loading, entity } = useEntityForm({
        api: partnersApi,
        entityId: partnerId,
        idField: 'ptr_id',
        form,
        open,
        onDataLoaded: onDataLoadedCallback,
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
                ptr_id: undefined,
                ptr_name: `${values.dev_hostname}-copy`,
            };

            const result = await submit(duplicatedValues, { closeDrawer: false });
            form.setFieldsValue(result.data);
            message.success("Tiers dupliqué avec succès");
        } catch (error) {
            console.error(error);
            message.error("Erreur lors de la duplication");
        }
    };

    /**
     * Charge les contacts liés au partenaire
     */
    const loadContacts = useCallback(async () => {
        if (!partnerId) return;
        setLoadingContacts(true);
        try {
            const response = await partnersApi.getContacts(partnerId);
            if (response?.data) {
                setContacts(response.data);
            }
        } catch (error) {
            console.error("Erreur lors du chargement des contacts:", error);
        } finally {
            setLoadingContacts(false);
        }
    }, [partnerId]);

    /**
     * Lie un contact existant au partenaire
     */
    const handleLinkContact = useCallback(async () => {
        if (!linkContactId || !partnerId) return;
        setLinkingContact(true);
        try {
            await contactsApi.attachPartner(linkContactId, partnerId);
            setLinkContactOpen(false);
            setLinkContactId(null);
            await loadContacts();
        } catch (error) {
            console.error("Erreur lors de la liaison du contact:", error);
        } finally {
            setLinkingContact(false);
        }
    }, [linkContactId, partnerId, loadContacts]);

    /**
     * Charge les opportunités liées au partenaire
     */
    const loadOpportunities = useCallback(async () => {
        if (!partnerId) return;
        setLoadingOpportunities(true);
        try {
            const response = await opportunitiesApi.byPartner(partnerId);
            if (response?.data) {
                setOpportunities(response.data);
            }
        } catch (error) {
            console.error("Erreur lors du chargement des opportunités:", error);
        } finally {
            setLoadingOpportunities(false);
        }
    }, [partnerId]);

    useEffect(() => {
        if (partnerId && open) {
            loadContacts();
            if (isProspect) {
                loadOpportunities();
            }
        }
    }, [partnerId, open, loadContacts, isProspect, loadOpportunities]);

    /**
     * Gestion des erreurs de validation : bascule sur l'onglet contenant le champ en erreur
     */
    const onFinishFailed = ({ errorFields }) => {
        if (errorFields.length > 0) {
            const firstErrorField = errorFields[0].name[0];

            if (['ptr_name', 'ptr_address', 'ptr_zip', 'ptr_city', 'ptr_phone', 'ptr_email', 'ptr_is_active', 'ptr_is_prospect', 'ptr_is_customer', 'ptr_is_supplier'].includes(firstErrorField)) {
                setActiveTab('general');
            } else if (['fk_pam_id_customer', 'fk_dur_id_payment_condition_customer', 'fk_acc_id_customer', 'ptr_account_auxiliary_customer', 'fk_usr_id_seller', 'ptr_customer_note'].includes(firstErrorField)) {
                setActiveTab('customer');
            } else if (['fk_pam_id_supplier', 'fk_dur_id_payment_condition_supplier', 'fk_acc_id_supplier', 'ptr_account_auxiliary_supplier'].includes(firstErrorField)) {
                setActiveTab('supplier');
            }

            message.error("Veuillez remplir tous les champs obligatoires");
        }
    };

    /**
     * Colonnes du tableau des contacts
     */
    const contactColumns = [
        {
            title: 'Nom',
            key: 'fullname',
            render: (_, record) => [record.ctc_firstname, record.ctc_lastname].filter(Boolean).join(' ') || '-',
        },
        {
            title: 'Fonction',
            dataIndex: 'ctc_job_title',
            key: 'ctc_job_title',
            render: (text) => text || '-',
        },
        {
            title: 'Email',
            dataIndex: 'ctc_email',
            key: 'ctc_email',
            render: (text) => text ? <a href={`mailto:${text}`}>{text}</a> : '-',
        },
        {
            title: 'Téléphone',
            dataIndex: 'ctc_phone',
            key: 'ctc_phone',
            render: (text) => text || '-',
        },
        {
            title: 'Mobile',
            dataIndex: 'ctc_mobile',
            key: 'ctc_mobile',
            render: (text) => text || '-',
        },
    ];

    /**
     * Colonnes du tableau des opportunités (onglet Prospect)
     */
    const opportunityColumns = [
        {
            title: 'Titre',
            dataIndex: 'opp_label',
            key: 'opp_label',
        },
        {
            title: 'Étape',
            dataIndex: 'pps_label',
            key: 'pps_label',
            render: (text, record) => <Tag color={record.pps_color}>{text}</Tag>,
        },
        {
            title: 'Montant',
            dataIndex: 'opp_amount',
            key: 'opp_amount',
            render: (v) => v ? formatCurrency(v) : '-',
            align: 'right',
        },
        {
            title: 'Probabilité',
            dataIndex: 'opp_probability',
            key: 'opp_probability',
            render: (v) => v != null ? `${v}%` : '-',
            align: 'right',
        },
        {
            title: 'Pondéré',
            dataIndex: 'opp_weighted_amount',
            key: 'opp_weighted_amount',
            render: (v) => v ? formatCurrency(v) : '-',
            align: 'right',
        },
    ];

    /**
     * Vérifier si un compte auxiliaire existe déjà
     */
    const checkAuxiliaryAccount = useCallback(async (accountType, value) => {
        if (!value || value.length === 0) {
            if (accountType === 'customer') {
                setAuxiliaryCustomerError(null);
            } else {
                setAuxiliarySupplierError(null);
            }
            return;
        }

        try {
            const response = await checkAccountAuxiliaryApi(accountType, value, partnerId, false);

            if (response.exists && !response.available) {
                const errorMsg = `Ce compte auxiliaire est déjà utilisé par ${response.existing_partner.name}`;
                if (accountType === 'customer') {
                    setAuxiliaryCustomerError(errorMsg);
                } else {
                    setAuxiliarySupplierError(errorMsg);
                }
            } else {
                if (accountType === 'customer') {
                    setAuxiliaryCustomerError(null);
                } else {
                    setAuxiliarySupplierError(null);
                }
            }
        } catch (error) {
            console.error("Erreur lors de la vérification du compte auxiliaire:", error);
        }
    }, [accountAuxiliaryCustomer, accountAuxiliarySupplier]);

    /**
     * Gérer le changement du switch Client
     * Vérifie s'il y a des enregistrements liés avant de désactiver
     */
    const handleCustomerSwitchChange = async (checked) => {
        // Si on active le switch, pas de vérification nécessaire
        if (checked) {
            return;
        }

        // Si on désactive et qu'il n'y a pas de partnerId, on peut désactiver
        if (!partnerId) {
            return;
        }

        // Vérifier s'il y a des enregistrements liés
        try {
            const response = await checkLinkedRecordsApi(partnerId, 'customer');

            if (response.has_linked_records) {
                message.error(
                    `Impossible de désactiver le statut Client. Ce tiers a ${response.count} enregistrement(s) lié(s) (commandes, factures, contrats).`
                );
                // Remettre le switch à true
                form.setFieldsValue({ ptr_is_customer: true });
            }
        } catch (error) {
            console.error("Erreur lors de la vérification:", error);
            message.error("Erreur lors de la vérification des enregistrements liés");
            // En cas d'erreur, on empêche le changement par précaution
            form.setFieldsValue({ ptr_is_customer: true });
        }
    };

    /**
     * Gérer le changement du switch Fournisseur
     * Vérifie s'il y a des enregistrements liés avant de désactiver
     */
    const handleSupplierSwitchChange = async (checked) => {
        // Si on active le switch, pas de vérification nécessaire
        if (checked) {
            return;
        }

        // Si on désactive et qu'il n'y a pas de partnerId, on peut désactiver
        if (!partnerId) {
            return;
        }

        // Vérifier s'il y a des enregistrements liés
        try {
            const response = await checkLinkedRecordsApi(partnerId, 'supplier');

            if (response.has_linked_records) {
                message.error(
                    `Impossible de désactiver le statut Fournisseur. Ce partenaire a ${response.count} enregistrement(s) lié(s) (commandes d'achat, factures, contrats).`
                );
                // Remettre le switch à true
                form.setFieldsValue({ ptr_is_supplier: true });
            }
        } catch (error) {
            console.error("Erreur lors de la vérification:", error);
            message.error("Erreur lors de la vérification des enregistrements liés");
            // En cas d'erreur, on empêche le changement par précaution
            form.setFieldsValue({ ptr_is_supplier: true });
        }
    };

    /**
     * Fermeture du drawer
     */
    const handleClose = () => {
        form.resetFields();
        setAuxiliaryCustomerError(null);
        setAuxiliarySupplierError(null);
        if (onClose) {
            onClose();
        }
    };

    // Construire les onglets conditionnels
    const tabItems = useMemo(() => {
        const items = [
            {
                key: 'general',
                label: 'Général',
                children: (
                    <><div className="box">
                        <Row gutter={[16, 8]}>
                            <Col span={4}>
                                <Form.Item name="ptr_is_active" label="Actif" valuePropName="checked" initialValue={true}>
                                    <Switch />
                                </Form.Item>
                            </Col>
                            <Col span={4}>

                                <Tooltip title={
                                    (entity?.opportunities_count > 0 || entity?.prospect_activities_count > 0)
                                        ? `Impossible de désactiver : ${[
                                            entity?.opportunities_count > 0 ? `${entity.opportunities_count} opportunité(s)` : null,
                                            entity?.prospect_activities_count > 0 ? `${entity.prospect_activities_count} activité(s)` : null,
                                        ].filter(Boolean).join(' et ')} lié(s)`
                                        : undefined
                                }>
                                    <div> {/* ← le span reçoit le Tooltip, pas le Switch directement */}
                                        <Form.Item name="ptr_is_prospect" label="Prospect" valuePropName="checked" initialValue={false}>
                                            <Switch
                                                disabled={entity?.opportunities_count > 0 || entity?.prospect_activities_count > 0}
                                            /* onChange={(checked) => {
                                                 if (!checked && (entity?.opportunities_count > 0 || entity?.prospect_activities_count > 0)) {
                                                     form.setFieldsValue({ ptr_is_prospect: true });
                                                 }
                                             }}*/
                                            />
                                        </Form.Item>
                                    </div>
                                </Tooltip>

                            </Col>
                            <Col span={4}>
                                <Form.Item name="ptr_is_customer" label="Client" valuePropName="checked" initialValue={false}>
                                    <Switch onChange={handleCustomerSwitchChange} />
                                </Form.Item>
                            </Col>
                            <Col span={4}>
                                <Form.Item name="ptr_is_supplier" label="Fournisseur" valuePropName="checked" initialValue={false}>
                                    <Switch onChange={handleSupplierSwitchChange} />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item name="ptr_name" label="Nom" rules={[{ required: true, message: "Le nom est requis" }]}                                                              >
                                    <Input placeholder="Nom du partenaire" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item name="ptr_address" label="Adresse" >
                                    <Input placeholder="Adresse" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={[16, 8]}>
                            <Col span={8}>
                                <Form.Item name="ptr_zip" label="Code Postal">
                                    <Input placeholder="Code postal" />
                                </Form.Item>
                            </Col>
                            <Col span={16}>
                                <Form.Item name="ptr_city" label="Ville" >
                                    <Input placeholder="Ville" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item name="ptr_phone" label="Téléphone" >
                                    <Input placeholder="Téléphone" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="ptr_email" label="Email" rules={[{ type: 'email', message: "Email invalide" }]}                                >
                                    <Input placeholder="Email" />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item name="ptr_effectif" label="Effectif">
                                    <Input placeholder="Effectif" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="ptr_activity" label="Activité">
                                    <Input placeholder="Activité / secteur" />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item name="ptr_linkedin_url" label="LinkedIn">
                                    <Input
                                        placeholder="https://linkedin.com/company/..."
                                        prefix={<LinkedinOutlined />}
                                        suffix={linkedinUrl ? <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}><LinkOutlined /></a> : null}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="ptr_pappers_url" label="Pappers">
                                    <Input
                                        placeholder="https://www.pappers.fr/entreprise/..."
                                        suffix={pappersUrl ? <a href={pappersUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}><LinkOutlined /></a> : null}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                    </>
                )
            }
        ];
        // Ajouter l'onglet Prospect si ptr_is_prospect est vrai et partnerId existe
        if (isProspect && partnerId) {
            items.push({
                key: 'prospect',
                label: `Prospect${opportunities.length > 0 ? ` (${opportunities.length})` : ''}`,
                children: (
                    <>
                        <div className="box">
                            <Row gutter={[16, 8]}>
                                <Col span={24}>
                                    <Form.Item name="ptr_prospect_description" label="Description prospect">
                                        <Input.TextArea rows={3} placeholder="Description / notes de prospection" />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </div>
                        <div className="box" style={{ marginTop: 15 }}>
                            <Divider titlePlacement="left" style={{ fontWeight: "600", marginTop: 0 }}>
                                Opportunités
                            </Divider>
                            <Row gutter={[16, 8]} style={{ marginBottom: 8 }} >
                                <Col span={24}>
                                    <CanAccess permission="opportunities.create">
                                        <Button
                                            type="secondary"
                                            icon={<PlusOutlined />}
                                            onClick={() => {
                                                setSelectedOppId(null);
                                                setOppDrawerOpen(true);
                                            }}
                                        >
                                            Ajouter une opportunité
                                        </Button>
                                    </CanAccess>
                                </Col>
                            </Row>
                            <Spin spinning={loadingOpportunities}>
                                <Table
                                    columns={opportunityColumns}
                                    dataSource={opportunities}
                                    rowKey="opp_id"
                                    pagination={false}
                                    size="small"
                                    bordered
                                    locale={{ emptyText: 'Aucune opportunité' }}
                                    onRow={(record) => ({
                                        onClick: () => {
                                            setSelectedOppId(record.opp_id);
                                            setOppDrawerOpen(true);
                                        },
                                        style: { cursor: 'pointer' },
                                    })}
                                />
                            </Spin>
                        </div>
                        <div className="box" style={{ marginTop: 15 }}>
                            <Divider titlePlacement="left" style={{ fontWeight: "600", marginTop: 0 }}>
                                Activités
                            </Divider>
                            <ActivityTimeline partnerId={partnerId} partnerInitialData={{ ptr_id: partnerId, ptr_name: partnerName }} />
                        </div>
                    </>
                )
            });
        }
        // Ajouter l'onglet Customer si ptr_is_customer est vrai
        if (isCustomer) {
            items.push({
                key: 'customer',
                label: 'Client',
                forceRender: true,
                children: (
                    <><div className="box">
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item
                                    name="fk_pam_id_customer"
                                    label="Mode de paiement client"
                                >
                                    <PaymentModeSelect
                                        initialData={entity?.customer_payment_mode}

                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="fk_dur_id_payment_condition_customer"
                                    label="Condition de règlement"
                                >
                                    <PaymentConditionSelect
                                        initialData={entity?.customer_payment_condition}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Divider titlePlacement="left" style={{ fontWeight: "600", marginTop: "0px" }}>
                            Comptabilité
                        </Divider>
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item
                                    name="fk_acc_id_customer"
                                    label="Compte comptable"
                                    rules={[{ required: true, message: "Compte comptable requis" }]}
                                >
                                    <AccountSelect
                                        filters={{ type: ['asset_receivable'], isActive: true }}
                                        loadInitially={!partnerId ? true : false}
                                        initialData={entity?.customer_account}
                                        accountSelectConfig={{
                                            form: form,                      // L'instance du formulaire
                                            fieldName: "fk_acc_id_customer", // Le champ à remplir après création
                                            sourceFieldName: "ptr_name"  // Le champ où piocher l'info pour créer
                                        }}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="ptr_account_auxiliary_customer"
                                    label="Compte Auxiliaire"
                                    validateStatus={auxiliaryCustomerError ? "error" : ""}
                                    help={auxiliaryCustomerError}
                                >
                                    <Input
                                        placeholder="Compte auxiliaire"
                                        maxLength={8}
                                        onBlur={(e) => checkAuxiliaryAccount('customer', e.target.value)}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item
                                    name="fk_usr_id_seller"
                                    label="Commercial"
                                >
                                    <SellerSelect
                                        initialData={entity?.seller}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="ptr_customer_note"
                                    label="Note"
                                >
                                    <Input.TextArea
                                        rows={4}
                                        placeholder="Notes concernant le client"
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Divider titlePlacement="left" style={{ fontWeight: "600", marginTop: "0px" }}>
                            Adresse de livraison par défaut
                        </Divider>
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <Switch
                                        size="small"
                                        checked={customerUseBillingAddress}
                                        onChange={(checked) => {
                                            setCustomerUseBillingAddress(checked);
                                            if (checked) form.setFieldValue('ptr_customer_delivery_address', null);
                                        }}
                                    />
                                    <span style={{ fontSize: 13 }}>Utiliser l'adresse de facturation</span>
                                </div>
                                {!customerUseBillingAddress && (
                                    <Form.Item name="ptr_customer_delivery_address" style={{ marginBottom: 0 }}>
                                        <Input.TextArea rows={4} placeholder="Adresse de livraison par défaut pour ce client" />
                                    </Form.Item>
                                )}
                            </Col>
                        </Row>
                    </div>
                    </>
                )
            });
        }

        // Ajouter l'onglet Supplier si ptr_is_supplier est vrai
        if (isSupplier) {
            items.push({
                key: 'supplier',
                label: 'Fournisseur',
                forceRender: true,
                children: (
                    <>
                        <div className="box">
                            <Row gutter={[16, 8]}>
                                <Col span={12}>
                                    <Form.Item
                                        name="fk_pam_id_supplier"
                                        label="Mode de paiement fournisseur"
                                    >
                                        <PaymentModeSelect
                                            initialData={entity?.supplier_payment_mode}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        name="fk_dur_id_payment_condition_supplier"
                                        label="Condition de règlement"
                                    >
                                        <PaymentConditionSelect
                                            initialData={entity?.supplier_payment_condition}
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Divider titlePlacement="left" style={{ fontWeight: "600", marginTop: "0px" }}>
                                Comptabilité
                            </Divider>

                            <Row gutter={[16, 8]}>
                                <Col span={12}>
                                    <Form.Item
                                        name="fk_acc_id_supplier"
                                        label="Compte comptable"
                                        rules={[{ required: true, message: "Compte comptable requis" }]}
                                    >
                                        <AccountSelect
                                            filters={{ type: ['liability_payable'],isActive: true}}
                                            loadInitially={!partnerId ? true : false}
                                            initialData={entity?.supplier_account}
                                            accountSelectConfig={{
                                                form: form,                      // L'instance du formulaire
                                                fieldName: "fk_acc_id_supplier", // Le champ à remplir après création
                                                sourceFieldName: "ptr_name"  // Le champ où piocher l'info pour créer
                                            }}

                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        name="ptr_account_auxiliary_supplier"
                                        label="Compte Auxiliaire"
                                        validateStatus={auxiliarySupplierError ? "error" : ""}
                                        help={auxiliarySupplierError}
                                    >
                                        <Input
                                            placeholder="Compte auxiliaire"
                                            maxLength={8}
                                            onBlur={(e) => checkAuxiliaryAccount('supplier', e.target.value)}
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Divider titlePlacement="left" style={{ fontWeight: "600", marginTop: "0px" }}>
                                Adresse de livraison par défaut
                            </Divider>
                            <Row gutter={[16, 8]}>
                                <Col span={24}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <Switch
                                            size="small"
                                            checked={supplierUseBillingAddress}
                                            onChange={(checked) => {
                                                setSupplierUseBillingAddress(checked);
                                                if (checked) form.setFieldValue('ptr_supplier_delivery_address', null);
                                            }}
                                        />
                                        <span style={{ fontSize: 13 }}>Utiliser l'adresse de facturation</span>
                                    </div>
                                    {!supplierUseBillingAddress && (
                                        <Form.Item name="ptr_supplier_delivery_address" style={{ marginBottom: 0 }}>
                                            <Input.TextArea rows={4} placeholder="Adresse de livraison par défaut pour ce fournisseur" />
                                        </Form.Item>
                                    )}
                                </Col>
                            </Row>
                        </div>
                    </>
                )
            });
        }

        // Ajouter l'onglet Bank si ptr_is_customer OU ptr_is_supplier est vrai
        if (isCustomer || isSupplier) {
            items.push({
                key: 'bank',
                label: 'Banques',
                children: (
                    <Suspense fallback={<TabLoader />}>
                        <BankTab
                            entityType="partner"
                            entityId={partnerId}
                            permission="partners.edit"
                        />
                    </Suspense>
                )
            });
        }



        // Ajouter l'onglet Contacts si partnerId existe
        if (partnerId) {
            items.push({
                key: 'contacts',
                label: `Contacts${contacts.length > 0 ? ` (${contacts.length})` : ''}`,
                children: (
                    <Spin spinning={loadingContacts}>
                        <Row gutter={[16, 8]} style={{ marginBottom: 8 }}>
                            <Col span={24}>
                                <Space wrap>
                                    <CanAccess permission="contacts.create">
                                        <Button
                                            icon={<PlusOutlined />}
                                            onClick={() => {
                                                setSelectedContactId(null);
                                                setContactDrawerOpen(true);
                                            }}
                                        >
                                            Nouveau contact
                                        </Button>
                                    </CanAccess>
                                    <CanAccess permission="contacts.edit">
                                        <Button
                                            icon={<LinkOutlined />}
                                            onClick={() => {
                                                setLinkContactOpen(v => !v);
                                                setLinkContactId(null);
                                            }}
                                        >
                                            Lier un contact existant
                                        </Button>
                                    </CanAccess>
                                </Space>
                            </Col>
                            {linkContactOpen && (
                                <Col span={24}>
                                    <Card size="small" style={{ background: '#fafafa' }}>
                                        <Space>
                                            <ContactSelect
                                                style={{ width: 320 }}
                                                filters={{ excludeIds: contacts.map(c => c.id) }}
                                                value={linkContactId}
                                                onChange={setLinkContactId}
                                                placeholder="Rechercher un contact..."
                                            />
                                            <Button
                                                type="primary"
                                                icon={<LinkOutlined />}
                                                onClick={handleLinkContact}
                                                disabled={!linkContactId}
                                                loading={linkingContact}
                                            >
                                                Lier
                                            </Button>
                                            <Button onClick={() => {
                                                setLinkContactOpen(false);
                                                setLinkContactId(null);
                                            }}>
                                                Annuler
                                            </Button>
                                        </Space>
                                    </Card>
                                </Col>
                            )}
                        </Row>
                        <Table
                            columns={contactColumns}
                            dataSource={contacts}
                            rowKey="id"
                            pagination={false}
                            size="small"
                            bordered
                            locale={{ emptyText: 'Aucun contact associé' }}
                            onRow={(record) => ({
                                onClick: () => {
                                    setSelectedContactId(record.id);
                                    setContactDrawerOpen(true);
                                },
                                style: { cursor: 'pointer' },
                            })}
                        />
                    </Spin>
                )
            });
        }

        // Ajouter l'onglet Objets Liés si partnerId existe
        if (partnerId) {
            items.push({
                key: 'linked-objects',
                label: 'Objets Liés',
                children: (
                    <Suspense fallback={<TabLoader />}>
                        <LinkedObjectsTab
                            module="partners"
                            recordId={partnerId}
                            apiFunction={partnersApi.getLinkedObjects}
                        />
                    </Suspense>
                )
            });
        }

        // Ajouter l'onglet Documents si partnerId existe
        if (partnerId) {
            items.push({
                key: 'files',
                label: `Documents${documentsCount !== undefined ? ` (${documentsCount})` : ''}`,
                children: (
                    <Suspense fallback={<TabLoader />}>
                        <FilesTab
                            module="partners"
                            recordId={partnerId}
                            getDocumentsApi={partnersApi.getDocuments}
                            uploadDocumentsApi={partnersApi.uploadDocuments}
                            onCountChange={setDocumentsCount}
                        />
                    </Suspense>
                )
            });
        }

        return items;
    }, [isCustomer, isSupplier, isProspect, auxiliaryCustomerError, auxiliarySupplierError, checkAuxiliaryAccount, customerUseBillingAddress, supplierUseBillingAddress, PaymentModeSelect, PaymentConditionSelect, SellerSelect, form, partnerId, documentsCount, contacts, loadingContacts, contactColumns, opportunities, loadingOpportunities, opportunityColumns]);


    /**
     * Actions du drawer (footer)
     */
    const drawerActions = (

        <Space style={{ width: "100%", display: "flex", paddingRight: "15px", justifyContent: "flex-end" }}>
            {partnerId && (
                <>
                    <CanAccess permission="partners.create">
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
                    <CanAccess permission="partners.delete">
                        <Popconfirm
                            title="Supprimer ce partenaire"
                            description="Êtes-vous sûr de vouloir supprimer ce partenaire ?"
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
            <CanAccess permission={partnerId ? "partners.edit" : "partners.create"}>
                <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={() => form.submit()}
                    loading={loading}
                >
                    {partnerId ? "Enregistrer" : "Créer"}
                </Button>
            </CanAccess>
        </Space>
    );

    return (
        <>
            <Drawer
                title={pageLabel ? `Édition - ${pageLabel}` : "Nouveau"}
                placement="right"
                onClose={handleClose}
                open={open}
                size={drawerSize}
                footer={drawerActions}
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
                        <Form.Item name="ptr_id" hidden>
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

            {/* Drawer Contact */}
            <Contact
                contactId={selectedContactId}
                open={contactDrawerOpen}
                onClose={() => setContactDrawerOpen(false)}
                initialValues={partnerId ? { fk_ptr_id: partnerId } : {}}
                onSubmit={() => {
                    setContactDrawerOpen(false);
                    loadContacts();
                }}
            />

            {/* Drawer Opportunité */}
            <Opportunity
                opportunityId={selectedOppId}
                open={oppDrawerOpen}
                onClose={() => setOppDrawerOpen(false)}
                defaultValues={partnerId ? { fk_ptr_id: partnerId } : {}}
                onSubmit={() => {
                    setOppDrawerOpen(false);
                    loadOpportunities();
                }}
            />

        </>
    );
}
