import { useEffect, useState, useMemo, useCallback, lazy, Suspense, useRef } from "react";
import { Form, Input, Button, Row, Col, DatePicker, Popconfirm, Tabs, Space, Spin, Checkbox, Divider } from "antd";
import { message } from '../../utils/antdStatic';
import { DeleteOutlined, SaveOutlined, CopyOutlined, ArrowLeftOutlined, MailOutlined, PrinterOutlined, LockOutlined, UnlockOutlined } from "@ant-design/icons";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import PageContainer from "../../components/common/PageContainer";
import { contractsGenericApi, partnersApi } from "../../services/api";
import { getUser } from "../../services/auth";
import CommitmentDurationSelect from "../../components/select/CommitmentDurationSelect.jsx";
import NoticeDurationSelect from "../../components/select/NoticeDurationSelect.jsx";
import RenewDurationSelect from "../../components/select/RenewDurationSelect.jsx";
import InvoicingDurationSelect from "../../components/select/InvoicingDurationSelect.jsx";
import ContactSelect from "../../components/select/ContactSelect";
import SellerSelect from "../../components/select/SellerSelect";
import PartnerSelect from "../../components/select/PartnerSelect";
import PaymentModeSelect from "../../components/select/PaymentModeSelect";
import PaymentConditionSelect from "../../components/select/PaymentConditionSelect";
import TaxPositionSelect from "../../components/select/TaxPositionSelect";
import { useEntityForm } from "../../hooks/useEntityForm";
import { formatStatus, CONTRACT_STATUS, CONTRACT_OPERATION, getModuleConfig } from "../../configs/ContractConfig";
import { handleBizPrint } from "../../utils/BizDocumentUtils.js";
import { createDateValidator } from '../../utils/writingPeriod';
import BizDocumentLinesTable from "../../components/bizdocument/BizDocumentLinesTable";
import BizDocumentMarginTable, { calculateMargins } from "../../components/bizdocument/BizDocumentMarginTable";
import BizDocumentTotalsCard from "../../components/bizdocument/BizDocumentTotalsCard";
import CanAccess from "../../components/common/CanAccess";
// Import lazy des composants lourds
const LinkedObjectsTab = lazy(() => import('../../components/bizdocument/LinkedObjectsTab'));
const FilesTab = lazy(() => import('../../components/bizdocument/FilesTab'));
const ContractTerminationModal = lazy(() => import('../../components/bizdocument/ContractTerminationModal'));
const EmailDialog = lazy(() => import('../../components/bizdocument/EmailDialog'));

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
 * Composant Contract
 * Page d'édition d'un contrat client/fournisseur
 */
export default function Contract() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [form] = Form.useForm();

    const contractId = id === 'new' ? null : parseInt(id, 10);
    const conOperationParam = searchParams.get('con_operation'); // Récupère con_operation de l'URL

    const [contractLines, setContractLines] = useState([]);
    const [loadingLines, setLoadingLines] = useState(false);
    const pendingLineTypeRef = useRef(null);
    const linesTableRef = useRef(null);

    const [showDeleteBtn, setShowDeleteBtn] = useState(false);
    const [formDisabled, setFormDisabled] = useState(true);
    const [conStatus, setConStatus] = useState(0);
    const [conBeingEdited, setConBeingEdited] = useState(false);
    const [conOperation, setConOperation] = useState(); // 1 = client, 2 = fournisseur
    const [terminateModalOpen, setTerminateModalOpen] = useState(false);
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const [emailAttachments, setEmailAttachments] = useState([]);

    const [documentsCount, setDocumentsCount] = useState(undefined);
    const [showMarginTable, setShowMarginTable] = useState(false);

    const [totals, setTotals] = useState({
        totalHT: 0,
        totalTVA: 0,
        totalTTC: 0,
        totalhtsub: 0,
        totalhtcomm: 0,
        isSub: 0
    });

    const [marginData, setMarginData] = useState([]);

    const fkPtrId = Form.useWatch('fk_ptr_id', form);
    const fkTapId = Form.useWatch('fk_tap_id', form);

    const conIsInvoicingMgmt = Form.useWatch('con_is_invoicing_mgmt', form) || false;
    const [pageLabel, setPageLabel] = useState();
    const [conTerminatedReason, setConTerminatedReason] = useState('');


    // Mémoriser les callbacks pour éviter les re-renders inutiles
    const transformData = useCallback((data) => ({
        ...data,
        con_date: data.con_date ? dayjs(data.con_date) : null,
        con_end_commitment: data.con_end_commitment ? dayjs(data.con_end_commitment) : null,
        con_next_invoice_date: data.con_next_invoice_date ? dayjs(data.con_next_invoice_date) : null,
        con_terminated_date: data.con_terminated_date ? dayjs(data.con_terminated_date) : null,
        con_is_invoicing_mgmt: data.con_is_invoicing_mgmt === 1 || data.con_is_invoicing_mgmt === true,
        con_is_bulk_invoicing: data.con_is_bulk_invoicing === 1 || data.con_is_bulk_invoicing === true,
    }), []);

    const onSuccessCallback = useCallback(({ action, data }) => {
        // Si c'est une création et qu'on a un type de ligne en attente
        if (action === 'create' && pendingLineTypeRef.current !== null && data?.id) {
            navigate(`${conOperation === CONTRACT_OPERATION.CUSTOMER_CONTRACT ? '/customercontracts' : '/suppliercontracts'}/${data.id}`, { replace: true });
            return;
        }

        // Comportement normal : rediriger lors de la création/suppression vers la liste
        if (action === 'create' || action === 'delete') {
            const currentPath = window.location.pathname;
            if (currentPath.includes('/customercontracts')) {
                navigate('/customercontracts');
            } else {
                navigate('/suppliercontracts');
            }
        }
    }, [navigate, conOperation]);

    const onDeleteCallback = useCallback(({ id }) => {
        const currentPath = window.location.pathname;
        if (currentPath.includes('/customercontracts')) {
            navigate('/customercontracts');
        } else {
            navigate('/suppliercontracts');
        }
    }, [navigate]);

    const onDataLoadedCallback = useCallback((data) => {
        if (data.con_number) {
            const label = data.partner?.ptr_name
                ? `${data.con_number} - ${data.partner.ptr_name}`
                : data.con_number;
            setPageLabel(label);
        }
       setDocumentsCount(data.documents_count ?? 0);
        setConStatus(data.con_status || 0);
        setConBeingEdited(Boolean(data.con_being_edited) ?? false);
        setConOperation(data.con_operation);
        setConTerminatedReason(data.con_terminated_reason || '');
    }, []);

    // Initialiser inv_operation depuis l'URL lors de la création
    useEffect(() => {
        if (!contractId && conOperationParam) {
            form.setFieldValue('con_operation', parseInt(conOperationParam, 10));
            setConOperation(parseInt(conOperationParam, 10));
        }
    }, [contractId, conOperationParam, form]);

    /**
     * Instance du formulaire CRUD
     */
    const { submit, remove, loading, loadError, entity } = useEntityForm({
        api: contractsGenericApi,
        entityId: contractId,
        idField: 'con_id',
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
        con_date: values.con_date ? values.con_date.format('YYYY-MM-DD') : null,
        con_end_commitment: values.con_end_commitment ? values.con_end_commitment.format('YYYY-MM-DD') : null,
        con_next_invoice_date: values.con_next_invoice_date ? values.con_next_invoice_date.format('YYYY-MM-DD') : null,
        con_terminated_date: values.con_terminated_date ? values.con_terminated_date.format('YYYY-MM-DD') : null,
        con_is_invoicing_mgmt: values.con_is_invoicing_mgmt ? 1 : 0,
        con_is_bulk_invoicing: values.con_is_bulk_invoicing ? 1 : 0,
    }), []);

    const handleFormSubmit = useCallback(async (values) => {
        const formattedValues = formatFormDates(values);
        await submit(formattedValues);
    }, [formatFormDates, submit]);

    // Handler appelé quand on veut ajouter une ligne mais que le document n'existe pas encore
    const handleRequestDocumentCreation = useCallback(async (lineType) => {
        try {
            await form.validateFields();
            const values = form.getFieldsValue();
            pendingLineTypeRef.current = lineType;
            const formattedValues = formatFormDates(values);
            await submit(formattedValues);
        } catch (error) {
            if (error.errorFields) {
                message.error('Veuillez remplir tous les champs obligatoires avant d\'ajouter des lignes');
            }
            pendingLineTypeRef.current = null;
        }
    }, [form, formatFormDates, submit]);

    // useEffect pour ouvrir le modal après la création du document et la navigation
    useEffect(() => {
        if (contractId && pendingLineTypeRef.current !== null && linesTableRef.current) {
            linesTableRef.current.openAddModal(pendingLineTypeRef.current);
            pendingLineTypeRef.current = null;
        }
    }, [contractId]);

    const handleChangeStatus = useCallback(async (status) => {
        try {
            if (status === 1 && contractLines.length === 0) {
                message.error('Vous devez ajouter au moins une ligne de contrat avant de finaliser');
                return;
            }

            await form.validateFields();
            const currentValues = form.getFieldsValue();
            const formattedValues = formatFormDates({
                ...currentValues,
                con_status: status,
            });
            await submit(formattedValues);
            setConStatus(status);
        } catch (error) {
            console.error('Erreur de validation:', error);
            message.error('Veuillez corriger les erreurs du formulaire avant de continuer');
        }
    }, [contractLines, form, formatFormDates, submit]);

    const handleChangeBeingEdited = useCallback(async (beingEdited) => {
        try {
            await form.validateFields();
            const currentValues = form.getFieldsValue();
            const formattedValues = formatFormDates({
                ...currentValues,
                con_being_edited: beingEdited,
            });
            await submit(formattedValues);
            setConBeingEdited(Boolean(beingEdited));
        } catch (error) {
            console.error('Erreur de validation:', error);
          //  message.error('Veuillez corriger les erreurs du formulaire avant de continuer');
        }
    }, [form, formatFormDates, submit]);

    const handleOpenTerminateModal = useCallback(async () => {
        try {
            // Charger les données de résiliation depuis l'API          

            setTerminateModalOpen(true);
        } catch (error) {
            console.error('Erreur lors du chargement des données de résiliation:', error);
            message.error('Erreur lors du chargement des données de résiliation' + error.message);
        }
    }, [contractId]);



    // Auto-remplir le commercial avec l'utilisateur connecté lors de la création
    useEffect(() => {
        if (!contractId) {
            const currentUser = getUser();
            if (currentUser && currentUser.id) {
                form.setFieldValue('fk_usr_id_seller', currentUser.id);
            }
            // Définir la date du jour par défaut
            form.setFieldValue('con_date', dayjs());
        }
    }, [contractId, form]);


    // Initialiser le tableau de marge
    useEffect(() => {
        if (conOperation) {
            //Affiche le tableau de marge
            setShowMarginTable(getModuleConfig(conOperation).features.showMarginTable)
        }
    }, [conOperation]);


    // Gérer les erreurs de chargement (ID inexistant ou non autorisé)
    useEffect(() => {
        if (loadError && contractId) {
            const currentPath = window.location.pathname;
            message.error("Le contrat demandé n'existe pas ou vous n'avez pas les droits pour y accéder");
            if (currentPath.includes('/customercontracts')) {
                navigate('/customercontracts');
            } else {
                navigate('/suppliercontracts');
            }
        }
    }, [loadError, contractId, navigate]);


    // Calculer automatiquement la date de fin d'engagement quand con_date ou fk_dur_id_commitment change
    const calculateEndCommitment = async (date, commitmentId) => {
        if (!date || !commitmentId) return;

        try {
            const response = await contractsGenericApi.calculateEndCommitmentDate(
                commitmentId,
                date.format('YYYY-MM-DD')
            );
            if (response.data?.nextDate) {
                form.setFieldValue('con_end_commitment', dayjs(response.data.nextDate));
            }
        } catch (error) {
            console.error('Erreur lors du calcul de la date de fin d\'engagement:', error);
        }
    };


    // Calculer automatiquement la prochaine date de facturation quand fk_dur_id_invoicing change
    const calculateNextInvoiceDate = async (conDate, fkDurIdInvoicing) => {
        if (!conDate || !fkDurIdInvoicing) return;

        try {
            // Vérifier s'il y a déjà des factures liées (à implémenter côté backend)                
            const response = await contractsGenericApi.calculateNextInvoiceDate(
                contractId,
                fkDurIdInvoicing,
                conDate.format('YYYY-MM-DD')
            );
            if (response.data?.nextDate) {
                form.setFieldValue('con_next_invoice_date', dayjs(response.data.nextDate));
            }
        } catch (error) {
            console.error('Erreur lors du calcul de la prochaine date de facturation:', error);
        }
    };


    const handleDelete = useCallback(async () => {
        await remove();
    }, [remove]);

    const handleDuplicate = useCallback(async () => {
        try {
            const result = await contractsGenericApi.duplicate(contractId);
            message.success("Contrat dupliqué avec succès");
            window.location.href = `${getBasePath()}/${result.data.id}`; 
            //navigate(`${conOperation === CONTRACT_OPERATION.CUSTOMER_CONTRACT ? '/customercontracts' : '/suppliercontracts'}/${result.data.con_id}`);
        } catch (error) {
            console.error(error);
            message.error("Erreur lors de la duplication");
        }
    }, [contractId, navigate, conOperation]);

    // Fonction pour récupérer les lignes
    const fetchContractLines = useCallback(async () => {
        if (!contractId) {
            setContractLines([]);
            setTotals({ totalHT: 0, totalTVA: 0, totalTTC: 0, totalhtsub: 0, totalhtcomm: 0, isSub: 0 });
            setMarginData([]);
            return;
        }

        setLoadingLines(true);
        try {
            const response = await contractsGenericApi.getLines(contractId);
            setContractLines(response.data || []);

            if (response.totals) {
                setTotals({
                    totalHT: response.totals.totalht || 0,
                    totalTVA: response.totals.tax || 0,
                    totalTTC: response.totals.totalttc || 0,
                    totalhtsub: response.totals.totalhtsub || 0,
                    totalhtcomm: response.totals.totalhtcomm || 0,
                    isSub: response.totals.isSub || 0,
                });
            }

            if (response.margins) {
                setMarginData(calculateMargins(response.margins));
            }
        } catch (error) {
            console.error("Erreur lors du chargement des lignes:", error);
            message.error("Erreur lors du chargement des lignes");
            setContractLines([]);
        } finally {
            setLoadingLines(false);
        }
    }, [contractId]);

    // Charger les lignes au montage et quand contractId change
    useEffect(() => {
        fetchContractLines();
    }, [fetchContractLines]);

    // Gérer l'activation/désactivation du formulaire selon con_status et conBeingEdited
    useEffect(() => {
        if (conStatus === CONTRACT_STATUS.DRAFT) {
            setFormDisabled(false);
        } else if (conStatus === CONTRACT_STATUS.ACTIVE && conBeingEdited === true) {
            setFormDisabled(false);
        } else {
            setFormDisabled(true);
        }
    }, [conStatus, conBeingEdited]);

    // Gérer l'affichage du bouton Supprimer
    useEffect(() => {
        // Permettre la suppression uniquement en brouillon ou actif sans factures liées
        if (conStatus === CONTRACT_STATUS.DRAFT) {
            setShowDeleteBtn(true);
        } else {
            setShowDeleteBtn(false);
        }
    }, [conStatus]);

    // Remplir automatiquement les champs lors du changement de client
    const handlePartnerOnChange = async (partnerId) => {
        if (!partnerId) return;

        // Réinitialiser le contact quand le client change
        form.setFieldValue('fk_ctc_id', null);

        try {
            const response = await partnersApi.get(partnerId);
            const partnerData = response.data;
            const moduleConfig = getModuleConfig(conOperation);

            if (partnerData.ptr_address) {
                form.setFieldValue('con_ptr_address', partnerData.ptr_address);
            }
            if (partnerData[moduleConfig.field.pam]) {
                form.setFieldValue('fk_pam_id', partnerData[moduleConfig.field.pam]);
            }
            if (partnerData[moduleConfig.field.paymentCondition]) {
                form.setFieldValue('fk_dur_id_payment_condition', partnerData[moduleConfig.field.paymentCondition]);
            }
            if (conOperation === CONTRACT_OPERATION.SUPPLIER_CONTRACT && partnerData.fk_tap_id) {
                form.setFieldValue('fk_tap_id', partnerData.fk_tap_id);
            }
        } catch (error) {
            console.error("Erreur lors du chargement des données du partenaire :", error);
            message.error("Impossible de charger les informations du partenaire.");
        }
    };

    // Fonctions handlers pour les boutons
    const handleSend = useCallback(async () => {
        if (!contractId) {
            message.error("Veuillez enregistrer le contrat avant de l'envoyer");
            return;
        }

        try {
            message.loading({ content: "Préparation de l'email...", key: "emailPrep" });

            // Générer le PDF
            const response = await contractsGenericApi.printPdf(contractId);
            if (!response.success) {
                throw new Error("Échec de la génération du PDF");
            }

            const { pdf, fileName } = response.data;

            // Convertir base64 en File
            const byteCharacters = atob(pdf);
            const byteArray = new Uint8Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteArray[i] = byteCharacters.charCodeAt(i);
            }
            const pdfBlob = new Blob([byteArray], { type: 'application/pdf' });
            const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

            // Stocker le PDF comme pièce jointe
            setEmailAttachments([{
                name: fileName,
                file: pdfFile,
                size: pdfFile.size,
                uid: `pdf-${Date.now()}`,
            }]);

            message.destroy("emailPrep");
            setEmailDialogOpen(true);

        } catch (error) {
            console.error("Erreur lors de la préparation de l'email:", error);
            message.error({
                content: error.message || "Erreur lors de la préparation de l'email",
                key: "emailPrep",
            });
        }
    }, [contractId]);

    const handlePrint = useCallback(async () => {
        await handleBizPrint(
            contractsGenericApi.printPdf,
            contractId,
            "Veuillez enregistrer le contrat avant de l'imprimer"
        );
    }, [contractId]);


    // Fonction pour déterminer les boutons d'action à afficher
    const statusActionButtons = useMemo(() => {
        const buttons = [];

        if (conStatus === CONTRACT_STATUS.DRAFT) {
            buttons.push({
                key: 'finalize',
                label: "Activer le contrat",
                icon: <LockOutlined />,
                onClick: () => handleChangeStatus(CONTRACT_STATUS.ACTIVE),
                type: 'primary'
            });
        } else if (conStatus === CONTRACT_STATUS.ACTIVE && conBeingEdited === true) {
            buttons.push({
                key: 'validate',
                label: "Valider les modifications",
                icon: <LockOutlined />,
                onClick: () => handleChangeBeingEdited(false),
                type: 'primary'
            });
        } else if (conStatus === CONTRACT_STATUS.ACTIVE && conBeingEdited === false) {
            buttons.push({
                key: 'modify',
                label: "Rouvrir le contrat",
                icon: <UnlockOutlined />,
                onClick: () => handleChangeBeingEdited(true),
                type: 'primary'
            });
        }

        return buttons;
    }, [conStatus, conBeingEdited, handleChangeStatus, handleChangeBeingEdited]);

    // Configuration dynamique basée sur inv_operation
    const dynamicConfig = useMemo(() => {
        // Utiliser invOperation depuis le state ou depuis le param URL pour les nouvelles factures
        return {
            ...getModuleConfig(conOperation),
            lineConfig: {
                fkTapId: fkTapId, // Ajouter la position fiscale à la config pour la passer en paramettre à la modal
            },
        };
    }, [conOperation, fkTapId]);

    /**
     * Construire les onglets
     */
    const tabItems = useMemo(() => {
        const items = [
            {
                key: 'fiche',
                label: 'Contenu',
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

                                {/* Ligne 1 */}
                                <Row gutter={[16, 8]}>
                                    <Col span={12}>
                                        <Form.Item
                                            name="con_label"
                                            label="Libellé"
                                            rules={[{ required: true, message: "Libellé requis" }]}
                                        >
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col span={6}>
                                        <Form.Item
                                            name="con_date"
                                            label="Date"
                                            rules={[
                                                { required: true, message: "Date requise" },
                                                { validator: createDateValidator() }
                                            ]}
                                        >
                                            <DatePicker
                                                format="DD/MM/YYYY"
                                                style={{ width: '100%' }}
                                                onChange={(date) => {
                                                    const commitmentId = form.getFieldValue('fk_dur_id_commitment');
                                                    calculateEndCommitment(date, commitmentId);
                                                    const fkDurIdInvoicing = form.getFieldValue('fk_dur_id_invoicing');
                                                    calculateNextInvoiceDate(date, fkDurIdInvoicing)
                                                }} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={6}>
                                        <Form.Item name="con_externalreference" label="Réf externe">
                                            <Input />
                                        </Form.Item>
                                    </Col>

                                </Row>
                                <Row gutter={[16, 8]}>
                                    <Col span={6}>
                                        <Form.Item
                                            name="fk_dur_id_commitment"
                                            label="Engagement"
                                            rules={[{ required: true, message: "Engagement requis" }]}
                                        >
                                            <CommitmentDurationSelect
                                                loadInitially={!contractId ? true : false}
                                                initialData={entity?.commitment_duration}
                                                onChange={(durIdCommitment) => {
                                                    const date = form.getFieldValue('con_date');
                                                    calculateEndCommitment(date, durIdCommitment);
                                                }} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={6}>
                                        <Form.Item
                                            name="fk_dur_id_notice"
                                            label="Préavis"
                                            rules={[{ required: true, message: "Préavis requis" }]}
                                        >
                                            <NoticeDurationSelect
                                                loadInitially={!contractId ? true : false}
                                                initialData={entity?.notice_duration}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={6}>
                                        <Form.Item
                                            name="fk_dur_id_renew"
                                            label="Reconduction"
                                            rules={[{ required: true, message: "Reconduction requise" }]}
                                        >
                                            <RenewDurationSelect
                                                loadInitially={!contractId ? true : false}
                                                initialData={entity?.renew_duration}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={6}>
                                        <Form.Item name="con_end_commitment" label="Fin d'engagement">
                                            <DatePicker
                                                format="DD/MM/YYYY"
                                                style={{ width: '100%' }}
                                                disabled
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                {/* Ligne 2 */}
                                <Row gutter={[16, 8]}>
                                    <Col span={6}>
                                        <Form.Item
                                            name="fk_ptr_id"
                                            label="Tiers"
                                            rules={[{ required: true, message: "Tiers requis" }]}
                                        >
                                            <PartnerSelect
                                                loadInitially={!contractId ? true : false}
                                                initialData={entity?.partner}
                                                filters={{
                                                    is_active: 1,
                                                    ...(conOperation === CONTRACT_OPERATION.CUSTOMER_CONTRACT
                                                        ? { OR: { is_prospect: 1, is_customer: 1 } }
                                                        : { is_supplier: 1 })
                                                }}
                                                onChange={handlePartnerOnChange}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={6}>
                                        <Form.Item name="fk_ctc_id" label="Contact Client">
                                            <ContactSelect
                                                key={`ctc-${fkPtrId}`}
                                                initialData={entity?.contact}
                                                filters={{
                                                    is_active: 1,
                                                    ptrId: fkPtrId
                                                }}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={6}>
                                        <Form.Item
                                            name="fk_usr_id_seller"
                                            label="Commercial"
                                            rules={[{ required: true, message: "Commercial requis" }]}
                                        >
                                            <SellerSelect
                                                loadInitially={!contractId ? true : false}
                                                initialData={entity?.seller}
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>


                                {/* Section facturation (visible si con_is_invoicing_mgmt) */}
                                <Row gutter={[16, 8]}>
                                    <Col span={6}>
                                        <Form.Item name="con_ptr_address" label="Adresse">
                                            <TextArea rows={2} />
                                        </Form.Item>

                                        {conOperation === CONTRACT_OPERATION.SUPPLIER_CONTRACT && (
                                            <Form.Item name="fk_tap_id" label="Position fiscale">
                                                <TaxPositionSelect
                                                    loadInitially={!contractId ? true : false}
                                                    initialData={entity?.tax_position}
                                                />
                                            </Form.Item>
                                        )}
                                    </Col>


                                    <Col offset={6} span={12}>
                                        <Form.Item name="con_note" label="Note">
                                            <TextArea rows={2} />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Divider titlePlacement="left">
                                    Facturation
                                </Divider>
                                <Row gutter={[16, 8]}>
                                    <Col span={6}>
                                        <Form.Item
                                            name="con_is_invoicing_mgmt"
                                            valuePropName="checked"
                                            style={{ marginBottom: 0 }}
                                        >
                                            <Checkbox disabled={conStatus !== CONTRACT_STATUS.DRAFT}>
                                                Facturation
                                            </Checkbox>
                                        </Form.Item>
                                    </Col>
                                    <Col span={6}>
                                        {conIsInvoicingMgmt && (
                                            <Form.Item
                                                name="con_is_bulk_invoicing"
                                                valuePropName="checked"
                                                style={{ marginBottom: 0 }}
                                            >
                                                <Checkbox>Facturation groupée</Checkbox>
                                            </Form.Item>
                                        )}
                                    </Col>
                                </Row>
                                {/* Ligne supplémentaire */}
                                {conIsInvoicingMgmt && (
                                    <Row gutter={[16, 8]}>
                                        <Col span={6}>
                                            <Form.Item
                                                name="fk_dur_id_invoicing"
                                                label="Fréquence de facturation"
                                                rules={[{ required: conIsInvoicingMgmt, message: "Fréquence requise" }]}
                                            >
                                                <InvoicingDurationSelect
                                                    loadInitially={!contractId ? true : false}
                                                    initialData={entity?.invoicing_duration}
                                                    onChange={(durIdInvoicing) => {
                                                        const date = form.getFieldValue('con_date');
                                                        calculateNextInvoiceDate(date, durIdInvoicing);
                                                    }}
                                                />
                                            </Form.Item></Col>
                                        <Col span={6}>
                                            <Form.Item
                                                name="fk_dur_id_payment_condition"
                                                label="Condition de règlement"
                                                rules={[{ required: conIsInvoicingMgmt, message: "Condition requise" }]}
                                            >
                                                <PaymentConditionSelect

                                                    loadInitially={!contractId ? true : false}
                                                    initialData={entity?.payment_condition}
                                                />
                                            </Form.Item>

                                        </Col>
                                        <Col span={6}>
                                            <Form.Item
                                                name="fk_pam_id"
                                                label="Mode de règlement"
                                                rules={[{ required: conIsInvoicingMgmt, message: "Mode requis" }]}
                                            >
                                                <PaymentModeSelect
                                                    loadInitially={!contractId ? true : false}
                                                    initialData={entity?.payment_mode}
                                                />
                                            </Form.Item>
                                        </Col>

                                        <Col span={6}>
                                            {conIsInvoicingMgmt && (
                                                <Form.Item name="con_next_invoice_date" label="Prochaine facture">
                                                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                                                </Form.Item>
                                            )}
                                        </Col>
                                    </Row>
                                )}


                                {/* Si contrat résilié, afficher les champs de résiliation */}
                                {(conStatus === CONTRACT_STATUS.TERMINATED || conStatus === CONTRACT_STATUS.TERMINATING) && (
                                    <Row gutter={[16, 8]}>
                                        <Col span={8}>
                                            <Form.Item name="con_terminated_date" label="Résilié le">
                                                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabled />
                                            </Form.Item>
                                        </Col>
                                        <Col span={16}>
                                            <Form.Item name="con_terminated_reason" label="Motif de résiliation">
                                                <Input disabled />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                )}
                            </Col>

                            {/* Colonne de droite : Boutons d'action */}
                            < Col span={6} style={{ paddingLeft: '8px', paddingRight: '8px' }}>
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
                                {contractId && conStatus === CONTRACT_STATUS.ACTIVE && conBeingEdited === false && (
                                    <Row gutter={8}>
                                        <Col span={12}>
                                            <Button
                                                type="secondary"
                                                size="default"
                                                icon={<MailOutlined />}
                                                onClick={handleSend}
                                                style={{ width: '100%', margin: "4px" }}
                                                disabled={false}
                                            >
                                                Envoyer
                                            </Button>
                                        </Col>
                                        <Col span={12}>
                                            <Button
                                                type="secondary"
                                                size="default"
                                                icon={<PrinterOutlined />}
                                                onClick={handlePrint}
                                                style={{ width: '100%', margin: "4px" }}
                                                disabled={false}
                                            >
                                                Imprimer
                                            </Button>
                                        </Col>
                                    </Row>
                                )}
                                {
                                    contractId && (
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
                                                    <CanAccess permission="contracts.delete">
                                                        <Popconfirm
                                                            title="Êtes-vous sûr de vouloir supprimer ce contrat ?"
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
                                                    </CanAccess>
                                                </Col>
                                            )}
                                        </Row>
                                    )
                                }
                                {
                                    contractId && conStatus === CONTRACT_STATUS.ACTIVE && conBeingEdited === false && (
                                        <Row gutter={8}>
                                            <Col span={24}>
                                                <Button
                                                    type="secondary"
                                                    danger
                                                    size="default"
                                                    onClick={handleOpenTerminateModal}
                                                    style={{ width: '100%', margin: "4px" }}
                                                    disabled={false}
                                                >
                                                    Résilier le contrat
                                                </Button>
                                            </Col>
                                        </Row>
                                    )
                                }
                            </Col >
                        </Row >

                        {/* Section 2: Lignes de contrat */}
                        < div style={{ marginTop: '24px' }}>
                            <BizDocumentLinesTable
                                ref={linesTableRef}
                                dataSource={contractLines}
                                loading={loadingLines}
                                disabled={formDisabled}
                                documentId={contractId}
                                saveLineApi={contractsGenericApi.saveLine}
                                deleteLineApi={contractsGenericApi.deleteLine}
                                updateLinesOrderApi={contractsGenericApi.updateLinesOrder}
                                onLinesChanged={fetchContractLines}
                                config={dynamicConfig}
                                onRequestDocumentCreation={handleRequestDocumentCreation}
                            />
                        </div >

                        {/* Section 3: Totaux et Marges */}
                        < div style={{ paddingTop: '16px' }}>
                            <Row gutter={16}>
                                <Col span={10}>
                                    {showMarginTable && (
                                        <BizDocumentMarginTable dataSource={marginData} loading={loadingLines} />
                                    )}
                                </Col>
                                <Col offset={6} span={8}>
                                    <BizDocumentTotalsCard
                                        totals={totals}
                                        config={getModuleConfig(conOperation).totalsConfig}
                                    />
                                </Col>
                            </Row>
                        </div >
                    </>
                )
            }
        ];

        // Ajouter l'onglet "Objets Liés" uniquement si con_id existe
        if (contractId) {
            items.push({
                key: 'linked-objects',
                label: 'Objets Liés',
                children: (
                    <Suspense fallback={<TabLoader />}>
                        <LinkedObjectsTab
                            module="contracts"
                            recordId={contractId}
                            apiFunction={contractsGenericApi.getLinkedObjects}
                        />
                    </Suspense>
                )
            });

            items.push({
                key: 'files',
                label: `Documents${documentsCount !== undefined ? ` (${documentsCount})` : ''}`,
                children: (
                    <Suspense fallback={<TabLoader />}>
                        <FilesTab
                            module="contracts"
                            recordId={contractId}
                            getDocumentsApi={contractsGenericApi.getDocuments}
                            uploadDocumentsApi={contractsGenericApi.uploadDocuments}
                            onCountChange={setDocumentsCount}
                        />
                    </Suspense>
                )
            });
        }

        return items;
    }, [contractId, conOperation, conStatus, conBeingEdited, conIsInvoicingMgmt, fkPtrId, statusActionButtons, contractLines, loadingLines, marginData, totals]);

    const handleBack = useCallback(() => {
        const currentPath = window.location.pathname;
        if (currentPath.includes('/customercontracts')) {
            navigate('/customercontracts');
        } else {
            navigate('/suppliercontracts');
        }
    }, [navigate]);

    return (
        <PageContainer
            title={
                <Space>
                    {pageLabel ? `Contrat - ${pageLabel}`  : (contractId ? "" : "Nouveau contrat")}
                </Space>
            }
            headerStyle={{
                center: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                        <Space>
                            {formatStatus(conStatus)}
                        </Space>
                        {(conStatus === CONTRACT_STATUS.TERMINATED || conStatus === CONTRACT_STATUS.TERMINATING) && conTerminatedReason && (
                            <div style={{ fontSize: '12px', color: '#ff4d4f' }}>
                                Motif de résiliation : {conTerminatedReason}
                            </div>
                        )}
                    </div>
                )
            }}
            actions={
                <Space>
                    <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
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
                            con_status: 0,
                            con_date: dayjs(),
                            con_operation: conOperation,
                            con_is_invoicing_mgmt: false,
                            con_is_bulk_invoicing: false,
                        }}
                    >
                        <Form.Item name="con_id" hidden>
                            <Input />
                        </Form.Item>
                        <Form.Item name="con_status" hidden>
                            <Input />
                        </Form.Item>
                        <Form.Item name="con_operation" hidden>
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

            {/* Modal de résiliation */}
            {terminateModalOpen && (
                <Suspense fallback={null}>
                    <ContractTerminationModal
                        open={terminateModalOpen}
                        contractId={contractId}
                        onCancel={() => {
                            setTerminateModalOpen(false);
                        }}
                    />
                </Suspense>
            )}

            {/* Dialog d'envoi d'email */}
            {contractId && emailDialogOpen && (
                <Suspense fallback={null}>
                    <EmailDialog
                        open={emailDialogOpen}
                        onClose={() => {
                            setEmailDialogOpen(false);
                            setEmailAttachments([]);
                        }}
                        emailContext={conOperation === CONTRACT_OPERATION.CUSTOMER_CONTRACT ? "sale" : "company"}
                        templateType="contract"
                        documentId={contractId}
                        partnerId={fkPtrId}
                        initialAttachments={emailAttachments}
                    />
                </Suspense>
            )}
        </PageContainer>
    );
}
