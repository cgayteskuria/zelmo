import { useEffect, useState, useMemo, useCallback, lazy, Suspense } from "react";
import { Form, Input, InputNumber, Button, Row, Col, DatePicker, App, Popconfirm, Tabs, Space, Spin } from "antd";
import { DeleteOutlined, SaveOutlined, CopyOutlined, ArrowLeftOutlined, PrinterOutlined, LockOutlined, UnlockOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useListNavigation } from "../../hooks/useListNavigation";
import dayjs from "dayjs";
import PageContainer from "../../components/common/PageContainer";
import { chargesGenericApi, chargeTypesApi } from "../../services/api";
import ChargeTypeSelect from "../../components/select/ChargeTypeSelect";
import PaymentModeSelect from "../../components/select/PaymentModeSelect";
import { useEntityForm } from "../../hooks/useEntityForm";
import { formatStatus, formatPaymentStatus, CHARGE_STATUS, PAYMENTS_TAB_CONFIG, PAYMENT_DIALOG_CONFIG } from "../../configs/ChargeConfig";
import { handleBizPrint } from "../../utils/BizDocumentUtils.js";
import { createDateValidator } from '../../utils/writingPeriod';

// Import lazy des composants lourds
const FilesTab = lazy(() => import('../../components/bizdocument/FilesTab'));
const PaymentsTab = lazy(() => import('../../components/bizdocument/PaymentsTab'));

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

const { TextArea } = Input;

/**
 * Composant Charge
 * Page d'édition d'une charge (salaire, impôt, etc.)
 */
export default function Charge() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const { message } = App.useApp();

    const { hasNav, hasPrev, hasNext, goToPrev, goToNext, position } = useListNavigation();

    const chargeId = id === 'new' ? null : parseInt(id, 10);

    const [showDeleteBtn, setShowDeleteBtn] = useState(false);
    const [formDisabled, setFormDisabled] = useState(true);
    const [cheStatus, setCheStatus] = useState(0);
    const [chePaymentProgress, setChePaymentProgress] = useState(0);
    const [documentsCount, setDocumentsCount] = useState(undefined);

    const [pageLabel, setPageLabel] = useState();

    // Surveiller les changements du type de charge pour charger le mode de paiement par défaut
    const chargeTypeId = Form.useWatch('fk_cht_id', form);

    // Mémoriser les callbacks pour éviter les re-renders inutiles
    const transformData = useCallback((data) => ({
        ...data,
        che_date: data.che_date ? dayjs(data.che_date) : null,
    }), []);

    const onSuccessCallback = useCallback(({ action, data }) => {
        // Comportement normal : rediriger lors de la création/suppression vers la liste    
        if (action === 'delete') {
            navigate('/charges');
        }
        // Lors d'une mise à jour, rester sur la page
    }, [navigate]);

    const onDeleteCallback = useCallback(({ id }) => {
        navigate('/charges');
    }, [navigate]);

    const onDataLoadedCallback = useCallback((data) => {
        if (data.che_number) {
            setPageLabel(data.che_number);
        }
        setDocumentsCount(data.documents_count ?? 0);
        setCheStatus(data.che_status);
        setChePaymentProgress(data.che_payment_progress || 0);
    }, []);

    // Charger le mode de paiement par défaut depuis le type de charge
    useEffect(() => {
        const currentPaymentMode = form.getFieldValue('fk_pam_id');

        // Ne charger que si un type de charge est sélectionné et qu'il n'y a pas déjà un mode de paiement
        if (chargeTypeId && !currentPaymentMode && !chargeId) {
            const loadPaymentMode = async () => {
                try {
                    const response = await chargeTypesApi.options();
                    const chargeType = response.data.find(ct => ct.id === chargeTypeId);
                    if (chargeType && chargeType.fk_pam_id) {
                        form.setFieldValue('fk_pam_id', chargeType.fk_pam_id);
                    }
                } catch (error) {
                    console.error('Erreur lors du chargement du mode de paiement:', error);
                }
            };
            loadPaymentMode();
        }
    }, [chargeTypeId, chargeId, form]);

    /**
     * Instance du formulaire CRUD
     */
    const { submit, remove, loading, loadError, entity } = useEntityForm({
        api: chargesGenericApi,
        entityId: chargeId,
        idField: 'che_id',
        form,
        open: true,
        transformData,
        onSuccess: onSuccessCallback,
        onDelete: onDeleteCallback,
        onDataLoaded: onDataLoadedCallback,
    });

    // Fonction helper pour formater les dates des valeurs du formulaire
    const formatFormDates = useCallback((values) => ({
        ...values,
        che_date: values.che_date ? values.che_date.format('YYYY-MM-DD') : null,
    }), []);

    const handleFormSubmit = useCallback(async (values) => {
        const formattedValues = formatFormDates(values);
        await submit(formattedValues);
        navigate('/charges');
    }, [formatFormDates, submit]);

    const handleChangeStatus = useCallback(async (status) => {
        try {
            // Valider le formulaire avant de soumettre
            await form.validateFields();
            const currentValues = form.getFieldsValue();
            const formattedValues = formatFormDates({
                ...currentValues,
                che_status: status,
            });
            await submit(formattedValues);
            setCheStatus(status);
        } catch (error) {
            console.error('Erreur de validation:', error);
            message.error('Veuillez corriger les erreurs du formulaire avant de continuer');
        }
    }, [form, formatFormDates, submit]);

    const handleDelete = useCallback(async () => {
        await remove();
    }, [remove]);

    const handleDuplicate = useCallback(async () => {
        try {
            const result = await chargesGenericApi.duplicate(chargeId);
            message.success("Charge dupliquée avec succès");
            navigate(`/charges/${result.data.che_id}`);
        } catch (error) {
            console.error(error);
            message.error("Erreur lors de la duplication");
        }
    }, [chargeId, navigate]);

    // Gérer les erreurs de chargement (ID inexistant ou non autorisé)
    useEffect(() => {
        if (loadError && chargeId) {
            message.error("La charge demandée n'existe pas ou vous n'avez pas les droits pour y accéder");
            navigate('/charges');
        }
    }, [loadError, chargeId, navigate]);

    // Gérer l'activation/désactivation du formulaire selon che_status
    useEffect(() => {
        if (cheStatus === CHARGE_STATUS.DRAFT) {
            // Brouillon : formulaire actif
            setFormDisabled(false);
        } else {
            // Finalisé ou Comptabilisé : formulaire inactif par défaut
            setFormDisabled(true);
        }
    }, [cheStatus]);

    // Gérer l'affichage du bouton Supprimer
    useEffect(() => {
        if (chePaymentProgress === 0 && cheStatus !== CHARGE_STATUS.ACCOUNTED) {
            setShowDeleteBtn(true);
        } else {
            setShowDeleteBtn(false);
        }
    }, [chePaymentProgress, cheStatus]);

    // Fonctions handlers pour les boutons
    const handlePrint = useCallback(async () => {
        await handleBizPrint(
            chargesGenericApi.printPdf,
            chargeId,
            "Veuillez enregistrer la charge avant de l'imprimer"
        );
    }, [chargeId]);

    // Recharger les données de la charge
    const reloadChargeData = useCallback(async () => {
        if (!chargeId) return;

        try {
            const response = await chargesGenericApi.get(chargeId);
            const data = response.data;

            // Mettre à jour le statut de paiement
            setChePaymentProgress(data.che_payment_progress || 0);
            setCheStatus(data.che_status);

        } catch (error) {
            console.error("Erreur lors du rechargement de la charge:", error);
            message.error("Erreur lors du rechargement des données");
        }
    }, [chargeId]);

    // Fonction pour déterminer les boutons d'action à afficher
    const statusActionButtons = useMemo(() => {
        const buttons = [];

        if (cheStatus === CHARGE_STATUS.DRAFT) {
            buttons.push({
                key: 'finalize',
                label: "Finaliser",
                icon: <LockOutlined />,
                onClick: () => handleChangeStatus(CHARGE_STATUS.FINALIZED),
                type: 'primary'
            });
        } else if (cheStatus === CHARGE_STATUS.FINALIZED && chePaymentProgress === 0) {
            buttons.push({
                key: 'modify',
                label: "Modifier",
                icon: <UnlockOutlined />,
                onClick: () => handleChangeStatus(CHARGE_STATUS.DRAFT),
                type: 'primary'
            });
        }

        return buttons;
    }, [cheStatus, chePaymentProgress, handleChangeStatus]);

    /**
     * Construire les onglets
     */
    const tabItems = useMemo(() => {
        const items = [
            {
                key: 'fiche',
                label: 'Détails',
                children: (
                    <>
                        {/* Section 1: Informations principales */}
                        <Row gutter={[0, 8]}>
                            <Col span={18} className="box"
                                style={{
                                    backgroundColor: "var(--layout-body-bg)",
                                    paddingLeft: '16px',
                                    paddingRight: '16px',
                                }}>
                                <Row gutter={[16, 8]}>
                                    <Col span={6}>
                                        <Form.Item
                                            name="che_date"
                                            label="Date"
                                            rules={[
                                                { required: true, message: "Date requise" },
                                                { validator: createDateValidator() }
                                            ]}
                                        >
                                            <DatePicker
                                                format="DD/MM/YYYY"
                                                style={{ width: '100%' }}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={18}>
                                        <Form.Item
                                            name="che_label"
                                            label="Libellé"
                                            rules={[{ required: true, message: "Libellé requis" }]}
                                        >
                                            <Input placeholder="Description de la charge" />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={[16, 8]}>
                                    <Col span={12}>
                                        <Form.Item
                                            name="fk_cht_id"
                                            label="Type de charge"
                                            rules={[{ required: true, message: "Type de charge requis" }]}
                                        >
                                            <ChargeTypeSelect
                                                loadInitially={!chargeId ? true : false}
                                                initialData={entity?.type}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={6}>
                                        <Form.Item
                                            name="fk_pam_id"
                                            label="Mode de règlement"
                                            rules={[{ required: true, message: "Mode de règlement requis" }]}
                                        >
                                            <PaymentModeSelect
                                                loadInitially={!chargeId ? true : false}
                                                initialData={entity?.payment_mode}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={6}>
                                        <Form.Item
                                            name="che_totalttc"
                                            label="Montant"
                                            rules={[{ required: true, message: "Montant requis" }]}
                                        >
                                            <InputNumber
                                                style={{ width: '100%' }}
                                                min={0}
                                                step={0.01}
                                                precision={2}
                                                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                                                parser={value => value.replace(/\s/g, '')}
                                                placeholder="0.00"
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={[16, 8]}>
                                    <Col span={24}>
                                        <Form.Item name="che_note" label="Note interne">
                                            <TextArea
                                                rows={4}
                                                placeholder="Notes internes"
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </Col>
                            <Col span={6} style={{ paddingLeft: '8px', paddingRight: '8px' }}>
                                <Row gutter={8}>
                                    {statusActionButtons.map((btn) => (
                                        <Col span={24} key={btn.key}>
                                            <Button
                                                type={btn.type}
                                                size="default"
                                                disabled={false}
                                                icon={btn.icon}
                                                onClick={btn.onClick}
                                                style={{ width: '100%', margin: "4px" }}
                                                danger={btn.danger}
                                                color={btn.color}
                                            >
                                                {btn.label}
                                            </Button>
                                        </Col>
                                    ))}
                                </Row>
                                <Row gutter={8}>
                                    {!formDisabled && (
                                        <Col span={24}>
                                            <Button
                                                color="green"
                                                variant="solid"
                                                size="default"
                                                icon={<SaveOutlined />}
                                                onClick={() => form.submit()}
                                                style={{ width: '100%', margin: "4px" }}
                                            >
                                                Enregistrer
                                            </Button>
                                        </Col>
                                    )}
                                </Row>
                                {chargeId && (
                                    <Row gutter={8}>
                                        <Col span={showDeleteBtn ? 12 : 24}>
                                            <Button
                                                type="secondary"
                                                size="default"
                                                icon={<CopyOutlined />}
                                                onClick={handleDuplicate}
                                                style={{ width: '100%', margin: "4px" }}
                                                disabled={false}
                                            >
                                                Dupliquer
                                            </Button>
                                        </Col>
                                        {showDeleteBtn && (
                                            <Col span={12}>
                                                <Popconfirm
                                                    title="Êtes-vous sûr de vouloir supprimer cette charge ?"
                                                    description="Cette action est irréversible."
                                                    onConfirm={handleDelete}
                                                    okText="Oui, supprimer"
                                                    cancelText="Annuler"
                                                    okButtonProps={{ danger: true, disabled: false }}
                                                    cancelButtonProps={{ disabled: false }}
                                                >
                                                    <Button
                                                        size="default"
                                                        disabled={false}
                                                        danger
                                                        icon={<DeleteOutlined />}
                                                        style={{ width: '100%', margin: "4px" }}
                                                    >
                                                        Supprimer
                                                    </Button>
                                                </Popconfirm>
                                            </Col>
                                        )}
                                    </Row>
                                )}
                            </Col>
                        </Row>
                    </>
                )
            }
        ];

        // Ajouter l'onglet "Règlement" uniquement si che_id existe
        if (chargeId) {
            items.push({
                key: 'payments',
                label: 'Règlement',
                children: (
                    <Suspense fallback={<TabLoader />}>
                        <PaymentsTab
                            parentId={chargeId}
                            parentStatus={cheStatus}
                            parentPaymentProgress={chePaymentProgress}
                            parentData={{
                                usageInfo: { isUsed: false, usedBy: [] },
                            }}
                            config={PAYMENTS_TAB_CONFIG}
                            dialogConfig={PAYMENT_DIALOG_CONFIG}
                            onPaymentChange={reloadChargeData}
                        />
                    </Suspense>
                )
            });
        }

        // Ajouter l'onglet "Documents" uniquement si che_id existe
        if (chargeId) {
            items.push({
                key: 'files',
                label: `Documents${documentsCount !== undefined ? ` (${documentsCount})` : ''}`,
                children: (
                    <Suspense fallback={<TabLoader />}>
                        <FilesTab
                            module="charges"
                            recordId={chargeId}
                            getDocumentsApi={chargesGenericApi.getDocuments}
                            uploadDocumentsApi={chargesGenericApi.uploadDocuments}
                            onCountChange={setDocumentsCount}
                        />
                    </Suspense>
                )
            });
        }

        return items;
    }, [chargeId, statusActionButtons, formDisabled, showDeleteBtn, handlePrint, handleDuplicate, handleDelete, cheStatus, chePaymentProgress, reloadChargeData]);

    const handleBack = useCallback(() => {
        navigate('/charges');
    }, [navigate]);

    return (
        <PageContainer
            title={
                <Space>
                    {pageLabel ? `Charge - ${pageLabel}` : "Nouvelle charge"}
                </Space>
            }
            headerStyle={{
                center: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                        <Space>
                            {formatStatus(cheStatus)}
                            {formatPaymentStatus(chePaymentProgress)}
                        </Space>
                    </div>
                )
            }}
            actions={
                <Space>
                    {hasNav && (
                        <>
                            <Button icon={<LeftOutlined />} onClick={goToPrev} disabled={!hasPrev} title="Précédent" />
                            <span style={{ fontSize: 12, color: '#888' }}>{position}</span>
                            <Button icon={<RightOutlined />} onClick={goToNext} disabled={!hasNext} title="Suivant" />
                        </>
                    )}
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={handleBack}
                    >
                        Retour
                    </Button>
                </Space>
            }
        >
            <Spin spinning={loading} tip="Chargement...">
                <div
                    style={{
                        background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)",
                        borderRadius: "8px",
                        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
                    }}
                >
                    <Form
                        disabled={formDisabled}
                        component={false}
                        form={form}
                        layout="vertical"
                        onFinish={handleFormSubmit}
                        initialValues={{
                            che_status: 0,
                            che_date: dayjs(),
                        }}
                    >
                        <Form.Item name="che_id" hidden>
                            <Input />
                        </Form.Item>
                        <Form.Item name="che_status" hidden>
                            <Input />
                        </Form.Item>
                        <Tabs
                            items={tabItems}
                            styles={{
                                content: { padding: 8 },
                            }}
                        />
                    </Form>
                </div>
            </Spin>
        </PageContainer>
    );
}
