import { useEffect, useState, useMemo, useCallback, lazy, Suspense, useRef } from "react";
import { Form, Input, Button, Row, Col, DatePicker, Popconfirm, Tabs, Space, Spin, Alert, App, Tag } from "antd";
import { DeleteOutlined, SaveOutlined, CopyOutlined, ArrowLeftOutlined, MailOutlined, PrinterOutlined, LockOutlined, UnlockOutlined, LeftOutlined, RightOutlined, CloudUploadOutlined } from "@ant-design/icons";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useListNavigation } from "../../hooks/useListNavigation";
import dayjs from "dayjs";
import PageContainer from "../../components/common/PageContainer";
import { invoicesGenericApi, partnersApi } from "../../services/api";
import { eInvoicingApi } from "../../services/apiEInvoicing";
import { getUser } from "../../services/auth";
import { useEntityForm } from "../../hooks/useEntityForm";
import ContactSelect from "../../components/select/ContactSelect";
import SellerSelect from "../../components/select/SellerSelect";
import PartnerSelect from "../../components/select/PartnerSelect";
import PaymentModeSelect from "../../components/select/PaymentModeSelect";
import PaymentConditionSelect from "../../components/select/PaymentConditionSelect";
import TaxPositionSelect from "../../components/select/TaxPositionSelect";
import { formatStatus, formatPaymentStatus, INVOICE_STATUS, INVOICE_OPERATION, getModuleConfig, PAYMENTS_TAB_CONFIG, PAYMENT_DIALOG_CONFIG } from "../../configs/InvoiceConfig.jsx";
import { handleBizPrint } from "../../utils/BizDocumentUtils.js";
import { createDateValidator } from '../../utils/writingPeriod';
import BizDocumentLinesTable from "../../components/bizdocument/BizDocumentLinesTable";
import BizDocumentMarginTable, { calculateMargins } from "../../components/bizdocument/BizDocumentMarginTable";
import BizDocumentTotalsCard from "../../components/bizdocument/BizDocumentTotalsCard";

// Import lazy des composants lourds
const LinkedObjectsTab = lazy(() => import('../../components/bizdocument/LinkedObjectsTab'));
const FilesTab = lazy(() => import('../../components/bizdocument/FilesTab'));
const PaymentsTab = lazy(() => import('../../components/bizdocument/PaymentsTab'));
const EmailDialog = lazy(() => import('../../components/bizdocument/EmailDialog'));
const EInvoicingInvoicePanel = lazy(() => import('../../components/einvoicing/EInvoicingInvoicePanel'));

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
 * Composant Invoice
 * Page d'édition d'une facture client ou fournisseur
 */
export default function Invoice() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [form] = Form.useForm();
    const { message } = App.useApp();

    const { hasNav, hasPrev, hasNext, goToPrev, goToNext, position } = useListNavigation();

    const invoiceId = id === 'new' ? null : parseInt(id, 10);
    const invOperationParam = searchParams.get('inv_operation'); // Récupère inv_operation de l'URL

    const [invoiceLines, setInvoiceLines] = useState([]);
    const invoiceLinesRef = useRef([])
    const [loadingLines, setLoadingLines] = useState(false);
    const pendingLineTypeRef = useRef(null);
    const linesTableRef = useRef(null);
    const fetchInvoiceLinesRef = useRef(null); // toujours à jour, évite la TDZ dans onDataLoadedCallback

    const [showDeleteBtn, setShowDeleteBtn] = useState(false);
    const [formDisabled, setFormDisabled] = useState(true);
    const [invStatus, setInvStatus] = useState(0);
    const [invBeingEdited, setInvBeingEdited] = useState(false);
    const [invOperation, setInvOperation] = useState(null);
    const [invPaymentProgress, setInvPaymentProgress] = useState(0);
    const [usageInfo, setUsageInfo] = useState({ isUsed: false, usedBy: [] });
    const [showMarginTable, setShowMarginTable] = useState(false);
    const [documentsCount, setDocumentsCount] = useState(undefined);
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const [emailAttachments, setEmailAttachments] = useState([]);
    const [fkTapId, setFkTapId] = useState(false);

    const [fkCtcId, setFkCtcId] = useState(null);
    const [showDeliveryAddress, setShowDeliveryAddress] = useState(false);
    const [eInvoicingTransmission, setEInvoicingTransmission] = useState(null);
    const [transmitting, setTransmitting] = useState(false);

    const [totals, setTotals] = useState({
        totalHT: 0,
        totalTVA: 0,
        totalTTC: 0,
        totalPaid: 0,
        amountRemaining: 0,
    });

    const [marginData, setMarginData] = useState([]);
    const fkPtrId = Form.useWatch('fk_ptr_id', form);
    //const fkTapId = Form.useWatch('fk_tap_id', form);
    //const fkCtcId = Form.useWatch('fk_ctc_id', form);

    const [pageLabel, setPageLabel] = useState();
    const [linkedObjectsRefreshTrigger, setLinkedObjectsRefreshTrigger] = useState(0);

    // Configuration dynamique basée sur inv_operation
    const dynamicConfig = useMemo(() => {
        // Utiliser invOperation depuis le state ou depuis le param URL pour les nouvelles factures         
        return {
            ...getModuleConfig(invOperation),
            fkTapId: fkTapId, // Ajouter la position fiscale à la config pour la passer en paramettre à la modal

        };
    }, [invOperation, fkTapId]);

    // Mémoriser les callbacks
    const transformData = useCallback((data) => ({
        ...data,
        inv_date: data.inv_date ? dayjs(data.inv_date) : null,
        inv_duedate: data.inv_duedate ? dayjs(data.inv_duedate) : null,
    }), []);

    const onSuccessCallback = useCallback(({ action, data }) => {
        if (action === 'create' && pendingLineTypeRef.current !== null && data?.id) {
            navigate(`${getBasePath()}/${data.id}`, { replace: true });
            return;
        }

        if (action === 'create' || action === 'delete') {
            navigate(getBasePath());
        }
    }, [navigate]);

    const onDeleteCallback = useCallback(() => {
        navigate(getBasePath());
    }, [navigate]);

    // Vérifier si un avoir ou acompte est utilisé (DOIT être déclaré AVANT onDataLoadedCallback)
    const checkInvoiceUsage = useCallback(async (invId) => {
        try {
            const response = await invoicesGenericApi.checkUsage(invId);
            if (response.data.isUsed) {
                setUsageInfo({
                    isUsed: true,
                    usedBy: response.data.usedBy
                });
            }
        } catch (error) {
            console.error("Erreur lors de la vérification de l'utilisation:", error);
        }
    }, []);

    // Calculer automatiquement la date de d'echance quand inv_date ou fk_dur_id_payment_condition change
    const calculateDueDate = async (invDate, fkDurIdPaymentCondition) => {
        if (!invDate || !fkDurIdPaymentCondition) return;

        try {
            const response = await invoicesGenericApi.calculateDueDate(
                fkDurIdPaymentCondition,
                invDate.format('YYYY-MM-DD')
            );
            if (response.data?.nextDate) {
                form.setFieldValue('inv_duedate', dayjs(response.data.nextDate));
            }
        } catch (error) {
            console.error('Erreur lors du calcul de la date d\'écheance:', error);
        }
    };


    const onDataLoadedCallback = useCallback((data) => {

        if (data.inv_number) {
            const label = data.partner?.ptr_name
                ? `${data.inv_number} - ${data.partner.ptr_name}`
                : data.inv_number;
            setPageLabel(label);
        }

        setFkCtcId(data.fk_ctc_id ?? null);

        setDocumentsCount(data.documents_count ?? 0);
        setFkTapId(data.fk_tap_id ?? null);

        setInvStatus(data.inv_status);
        setInvBeingEdited(Boolean(data.inv_being_edited) ?? false);
        setInvOperation(data.inv_operation);
        setInvPaymentProgress(data.inv_payment_progress ?? 0);
        setShowDeliveryAddress(Boolean(data.inv_delivery_address));

        // Vérifier si l'avoir ou l'acompte est utilisé
        if (data.inv_operation === INVOICE_OPERATION.CUSTOMER_REFUND || data.inv_operation === INVOICE_OPERATION.SUPPLIER_REFUND ||
            data.inv_operation === INVOICE_OPERATION.CUSTOMER_DEPOSIT || data.inv_operation === INVOICE_OPERATION.SUPPLIER_DEPOSIT) {
            checkInvoiceUsage(data.inv_id);
        }

        // Charger les lignes (via ref pour éviter la TDZ — fetchInvoiceLines est déclaré plus bas)
        fetchInvoiceLinesRef.current?.();

        // Charger le statut e-facturation si la facture est finalisée
        if (data.inv_status === INVOICE_STATUS.FINALIZED || data.inv_status === INVOICE_STATUS.ACCOUNTED) {
            eInvoicingApi.getTransmissionStatus(data.inv_id).then((res) => {
                setEInvoicingTransmission(res.data ?? null);
            }).catch(() => {
                setEInvoicingTransmission(null);
            });
        }

    }, []);

    // Déterminer le chemin de base selon l'URL actuelle
    const getBasePath = () => {
        const currentPath = window.location.pathname;
        if (currentPath.includes('/customer-invoices')) {
            return '/customer-invoices';
        } else {
            return '/supplier-invoices';
        }
    };

    const { submit, remove, loading, loadError, entity } = useEntityForm({
        api: invoicesGenericApi,
        entityId: invoiceId,
        idField: 'inv_id',
        form,
        open: true,
        onDataLoaded: onDataLoadedCallback,
        transformData,
        onSuccess: onSuccessCallback,
        onDelete: onDeleteCallback,
    });

    // Fonction helper pour formater les dates
    const formatFormDates = useCallback((values) => ({
        ...values,
        inv_date: values.inv_date ? values.inv_date.format('YYYY-MM-DD') : null,
        inv_duedate: values.inv_duedate ? values.inv_duedate.format('YYYY-MM-DD') : null,
    }), []);

    const handleFormSubmit = useCallback(async (values) => {
        const formattedValues = formatFormDates(values);
        await submit(formattedValues);
    }, [formatFormDates, submit]);

    // Handler pour création document avant ajout ligne
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

    // Ouvrir modal ligne après création document
    useEffect(() => {
        if (invoiceId && pendingLineTypeRef.current !== null && linesTableRef.current) {
            linesTableRef.current.openAddModal(pendingLineTypeRef.current);
            pendingLineTypeRef.current = null;
        }
    }, [invoiceId]);

    const handlePartnerOnChange = async (partnerId) => {
        if (!partnerId) return; // Pas de partenaire sélectionné, on sort

        // Réinitialiser le contact quand le client change
        form.setFieldValue('fk_ctc_id', null);
        setFkCtcId(null);

        try {
            const response = await partnersApi.get(partnerId);
            const partnerData = response.data;
            const moduleConfig = getModuleConfig(invOperation);

            // Remplir les champs du formulaire avec les données du partenaire
            const addressParts = [
                partnerData.ptr_address,
                [partnerData.ptr_zip, partnerData.ptr_city].filter(Boolean).join(' '),
            ].filter(Boolean);
            if (addressParts.length > 0) {
                form.setFieldValue('inv_ptr_address', addressParts.join('\n'));
            }
            const currentOperation = invOperation || parseInt(invOperationParam);
            const isSupplierOp = [3, 4, 6].includes(currentOperation);
            const deliveryAddress = isSupplierOp
                ? partnerData.ptr_supplier_delivery_address
                : partnerData.ptr_customer_delivery_address;
            const effectiveDeliveryAddress = deliveryAddress || addressParts.join('\n') || null;
            form.setFieldValue('inv_delivery_address', effectiveDeliveryAddress);
            setShowDeliveryAddress(!!effectiveDeliveryAddress);
            if (partnerData[moduleConfig.field.pam]) {
                form.setFieldValue('fk_pam_id', partnerData[moduleConfig.field.pam]);
            }
            if (partnerData[moduleConfig.field.paymentCondition]) {
                form.setFieldValue('fk_dur_id_payment_condition', partnerData[moduleConfig.field.paymentCondition]);
                calculateDueDate(form.getFieldValue('inv_date'), partnerData[moduleConfig.field.paymentCondition]);
            }


        } catch (error) {
            console.error("Erreur lors du chargement des données du partenaire :", error);
            message.error("Impossible de charger les informations du partenaire.");
        }
    };

    const handleChangeStatus = useCallback(async (status) => {
        try {

            if (status === 1 && invoiceLinesRef.length === 0) {
                message.error('La facture ne contient aucune ligne');
                return;
            }

            await form.validateFields();
            const currentValues = form.getFieldsValue();
            const formattedValues = formatFormDates({
                ...currentValues,
                inv_status: status,
            });

            const result = await submit(formattedValues);
            setInvStatus(status);
            form.setFieldValue('inv_status', status);
            if (result?.data?.inv_number) {
                const label = result.data.partner?.ptr_name
                    ? `${result.data.inv_number} - ${result.data.partner.ptr_name}`
                    : result.data.inv_number;
                setPageLabel(label);
            }
        } catch (error) {
            console.error('Erreur de validation:', error);
            message.error('Veuillez corriger les erreurs du formulaire avant de continuer');
        }
    }, [invoiceLines, form, submit]);

    const handleChangeBeingEdited = useCallback(async (beingEdited) => {
        try {
            if (beingEdited !== true) {
                await form.validateFields();
            }

            const currentValues = form.getFieldsValue();
            const formattedValues = formatFormDates({
                ...currentValues,
                inv_being_edited: beingEdited,
            });
            await submit(formattedValues);
            setInvBeingEdited(Boolean(beingEdited));
        } catch (error) {
            console.error('Erreur de validation:', error);
            //  message.error('Veuillez corriger les erreurs du formulaire avant de continuer');
        }
    }, [form, submit]);

    // Auto-remplir le commercial avec l'utilisateur connecté lors de la création
    useEffect(() => {
        if (!invoiceId) {
            const currentUser = getUser();
            if (currentUser && currentUser.id) {
                form.setFieldValue('fk_usr_id_seller', currentUser.id);
            }
        }
    }, [invoiceId, form]);

    // Initialiser inv_operation depuis l'URL lors de la création
    useEffect(() => {
        if (!invoiceId && invOperationParam) {
            form.setFieldValue('inv_operation', parseInt(invOperationParam, 10));
            setInvOperation(parseInt(invOperationParam, 10));
        }
    }, [invoiceId, invOperationParam, form]);

    // Initialiser le tableau de marge
    useEffect(() => {
        if (invOperation) {
            //Affiche le tableau de marge
            setShowMarginTable(getModuleConfig(invOperation).features.showMarginTable)
        }
    }, [invOperation]);


    // Gérer les erreurs de chargement (ID inexistant ou non autorisé)
    useEffect(() => {
        if (loadError && invoiceId) {
            message.error("La facture demandée n'existe pas ou vous n'avez pas les droits pour y accéder");
            navigate(getBasePath());
        }
    }, [loadError, invoiceId, navigate]);

    // Validation personnalisée pour la date d'échéance
    const validateDueDate = useCallback((_, value) => {
        if (!value) {
            return Promise.resolve();
        }
        const invoiceDate = form.getFieldValue('inv_date');
        if (invoiceDate && value.isBefore(invoiceDate, 'day')) {
            return Promise.reject(new Error('La date d\'échéance doit être supérieure ou égale à la date de facture'));
        }
        return Promise.resolve();
    }, [form]);

    const handleDelete = useCallback(async () => {
        await remove();
    }, [remove]);

    const handleDuplicate = useCallback(async () => {
        try {
            const result = await invoicesGenericApi.duplicate(invoiceId);
            message.success("Facture dupliquée avec succès");

            window.location.href = `${getBasePath()}/${result.data.id}`;
        } catch (error) {
            console.error(error);
            message.error("Erreur lors de la duplication");
        }
    }, [invoiceId, navigate]);

    // Fonction pour récupérer les lignes
    const fetchInvoiceLines = useCallback(async () => {
        if (!invoiceId) {
            setInvoiceLines([]);
            invoiceLinesRef.current = [];
            setTotals({
                totalHT: 0,
                totalTVA: 0,
                totalTTC: 0,
                totalPaid: 0,
                amountRemaining: 0,
            });
            setMarginData([]);
            return;
        }

        setLoadingLines(true);
        try {
            const response = await invoicesGenericApi.getLines(invoiceId);

            setInvoiceLines(response.data || []);
            invoiceLinesRef.current = response.data || [];

            if (response.totals) {
                setTotals({
                    totalHT: response.totals.totalht || 0,
                    totalTVA: response.totals.tax || 0,
                    totalTTC: response.totals.totalttc || 0,
                    totalPaid: response.totals.totalPaid || 0,
                    amountRemaining: response.totals.amountRemaining || 0,
                });
            }

            if (response.margins) {
                setMarginData(calculateMargins(response.margins));
            }
        } catch (error) {
            console.error("Erreur lors du chargement des lignes:", error);
            message.error("Erreur lors du chargement des lignes");
            setInvoiceLines([]);
            invoiceLinesRef.current = [];

        } finally {
            setLoadingLines(false);
        }

    }, [invoiceId]);

    // Maintient la ref à jour — onDataLoadedCallback l'utilise pour éviter la TDZ
    fetchInvoiceLinesRef.current = fetchInvoiceLines;

    // Gérer l'activation/désactivation du formulaire
    useEffect(() => {
        // Si l'avoir ou l'acompte est utilisé, désactiver le formulaire
        if (usageInfo.isUsed) {
            setFormDisabled(true);
            return;
        }

        if (invStatus === INVOICE_STATUS.DRAFT) {
            setFormDisabled(false);
        } else if (invStatus === INVOICE_STATUS.FINALIZED && invBeingEdited === true) {
            setFormDisabled(false);
        } else if (invStatus === INVOICE_STATUS.FINALIZED && invBeingEdited === false) {
            setFormDisabled(true);
        } else {
            setFormDisabled(true);
        }
    }, [invStatus, invBeingEdited, usageInfo.isUsed]);

    // Gérer l'affichage du bouton Supprimer
    useEffect(() => {
        if ((invStatus === INVOICE_STATUS.DRAFT || invStatus === null) && Number(invPaymentProgress) === 0) {
            setShowDeleteBtn(true);
        } else {
            setShowDeleteBtn(false);
        }
    }, [invStatus, invPaymentProgress]);

    // Recharger les données de la facture
    const reloadInvoiceData = useCallback(async () => {
        if (!invoiceId) return;

        try {
            const response = await invoicesGenericApi.get(invoiceId);
            const data = response.data;

            // Mettre à jour le statut de paiement
            setInvPaymentProgress(data.inv_payment_progress ?? 0);
            setInvStatus(data.inv_status);

            // Recharger les lignes pour mettre à jour les totaux
            await fetchInvoiceLines();

            // Forcer le rechargement de l'onglet Objets Liés
            setLinkedObjectsRefreshTrigger(prev => prev + 1);

        } catch (error) {
            console.error("Erreur lors du rechargement de la facture:", error);
            message.error("Erreur lors du rechargement des données");
        }
    }, [invoiceId, fetchInvoiceLines]);


    const handleTaxChange = async (value) => {
        setFkTapId(value);

        if (!invoiceId || invoiceLines.length === 0) return;

        try {
            const response = await invoicesGenericApi.updateLinesTaxPosition(invoiceId, value);

            if (response.success) {
                message.success(response.message);
                await fetchInvoiceLines();
            }

        } catch (error) {
            message.error("Erreur lors de la mise à jour des taxes des lignes");
        }
    };

   

    const handleSend = useCallback(async () => {
        if (!invoiceId) {
            message.error("Veuillez enregistrer la facture avant de l'envoyer");
            return;
        }

        try {
            message.loading({ content: "Préparation de l'email...", key: "emailPrep" });

            // Générer le PDF
            const response = await invoicesGenericApi.printPdf(invoiceId);
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
    }, [invoiceId]);

    const handlePrint = useCallback(async () => {
        await handleBizPrint(
            invoicesGenericApi.printPdf,
            invoiceId,
            "Veuillez enregistrer la facture avant de l'imprimer"
        );
    }, [invoiceId]);

    const handleTransmitInvoice = useCallback(async () => {
        if (!invoiceId) return;

        // Validation des champs Facture-X requis (factures clients uniquement)
        const isCustomerOp = invOperation === INVOICE_OPERATION.CUSTOMER_INVOICE || invOperation === INVOICE_OPERATION.CUSTOMER_REFUND;
        if (isCustomerOp && fkPtrId) {
            setTransmitting(true);
            let partner;
            try {
                const res = await partnersApi.get(fkPtrId);
                partner = res.data;
            } catch {
                setTransmitting(false);
                message.error("Impossible de vérifier la fiche client avant transmission.", 8);
                return;
            }

            const missing = [];
            if (!partner?.ptr_siret || !/^\d{14}$/.test(partner.ptr_siret)) {
                missing.push('SIRET du client (14 chiffres)');
            }
            if (!partner?.ptr_country_code) {
                missing.push('Code pays du client');
            }
            if (missing.length > 0) {
                setTransmitting(false);
                message.error({
                    content: (
                        <span>
                            Champs requis manquants sur la fiche client :<br />
                            {missing.map((f, i) => <span key={i}>• {f}<br /></span>)}
                            Veuillez compléter la fiche partenaire avant de transmettre.
                        </span>
                    ),
                    duration: 10,
                });
                return;
            }
        } else {
            setTransmitting(true);
        }

        try {
            const res = await eInvoicingApi.transmitInvoice(invoiceId);
            message.success("Facture transmise au PA avec succès.");
            setEInvoicingTransmission(res.data ?? null);
        } catch (err) {
            message.error(err?.message ?? "Erreur lors de la transmission.", 8);
        } finally {
            setTransmitting(false);
        }
    }, [invoiceId, invOperation, fkPtrId]);

    // Boutons d'action selon le statut
    const statusActionButtons = useMemo(() => {
        const buttons = [];

        if (invStatus === INVOICE_STATUS.DRAFT) {
            buttons.push({
                key: 'finalize',
                label: "Finaliser",
                icon: <LockOutlined />,
                onClick: () => handleChangeStatus(1),
                type: 'primary'
            });
        } else if (invStatus === INVOICE_STATUS.FINALIZED && invBeingEdited === true) {
            buttons.push({
                key: 'validate',
                label: "Valider les modifications",
                icon: <LockOutlined />,
                onClick: () => handleChangeBeingEdited(false),
                type: 'primary'
            });
        } else if (invStatus === INVOICE_STATUS.FINALIZED && invBeingEdited === false && Number(invPaymentProgress) === 0 && !usageInfo.isUsed && !eInvoicingTransmission) {
            buttons.push({
                key: 'modify',
                label: "Modifier la facture",
                icon: <UnlockOutlined />,
                // onClick: () => handleChangeStatus(0),²
                onClick: () => handleChangeBeingEdited(true),
                type: 'secondary'
            });
        }

        return buttons;
    }, [invStatus, invBeingEdited, invPaymentProgress, eInvoicingTransmission]);

    const tabItems = useMemo(() => {
        const items = [
            {
                key: 'fiche',
                label: 'Contenu',
                children: (
                    <>
                        <Row gutter={[0, 8]}>
                            <Col span={18} className="box" style={{ backgroundColor: "var(--layout-body-bg)", paddingLeft: '16px', paddingRight: '16px' }}>
                                <Row gutter={[16, 8]}>
                                    <Col span={4}>
                                        <Form.Item
                                            name="inv_date"
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
                                                    const durIdPaymentCondition = form.getFieldValue('fk_dur_id_payment_condition');
                                                    calculateDueDate(date, durIdPaymentCondition);
                                                }} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={4}>
                                        <Form.Item
                                            name="inv_duedate"
                                            label="Date d'échéance"
                                            rules={[
                                                { required: true, message: "Date d'échéance requise" },
                                                { validator: validateDueDate }
                                            ]}
                                            dependencies={['inv_date']}
                                        >
                                            <DatePicker
                                                format="DD/MM/YYYY"
                                                style={{ width: '100%' }}

                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item
                                            name="inv_externalreference"
                                            label="Réf. externe"
                                            rules={[
                                                {
                                                    required: !getBasePath().includes('customer'),
                                                    message: "Réf. externe requise pour les factures fournisseurs"
                                                }
                                            ]}
                                        >
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item
                                            name="fk_usr_id_seller"
                                            label="Commercial"
                                        >
                                            <SellerSelect
                                                loadInitially={!invoiceId ? true : false}
                                                initialData={entity?.seller}
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={[16, 8]}>
                                    <Col span={8}>
                                        <Form.Item
                                            name="fk_ptr_id"
                                            label={getBasePath().includes('customer') ? "Client" : "Fournisseur"}
                                            rules={[{ required: true, message: "Partenaire requis" }]}
                                        >
                                            <PartnerSelect
                                                loadInitially={!invoiceId ? true : false}
                                                initialData={entity?.partner}
                                                filters={getBasePath().includes('customer') ? {
                                                    is_active: 1,
                                                    OR: { is_prospect: 1, is_customer: 1 }
                                                } : {
                                                    is_active: 1,
                                                    is_supplier: 1
                                                }}
                                                onChange={handlePartnerOnChange}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        {invOperation && getModuleConfig(invOperation).features.showTaxPosition && (
                                            < Form.Item
                                                name="fk_tap_id"
                                                label="Position fiscale"
                                            >
                                                <TaxPositionSelect
                                                    loadInitially={!invoiceId ? true : false}
                                                    initialData={entity?.tax_position}
                                                    onChange={handleTaxChange}
                                                    allowClear
                                                />
                                            </Form.Item>
                                        )}
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="fk_ctc_id" label="Contact">
                                            <ContactSelect
                                                key={`ctc-${fkPtrId}`}
                                                value={fkCtcId}
                                                onChange={setFkCtcId}
                                                initialData={entity?.contact}
                                                filters={{ is_active: 1, ptrId: fkPtrId }}
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={[16, 8]}>
                                    <Col span={8}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 6 }}>
                                            <span
                                                onClick={() => setShowDeliveryAddress(false)}
                                                style={{ cursor: 'pointer', fontWeight: !showDeliveryAddress ? 600 : 400, color: !showDeliveryAddress ? 'inherit' : '#aaa', fontSize: 13 }}
                                            >Adresse de Facturation</span>
                                            <span
                                                onClick={() => setShowDeliveryAddress(true)}
                                                style={{ cursor: 'pointer', fontWeight: showDeliveryAddress ? 600 : 400, color: showDeliveryAddress ? 'inherit' : '#aaa', fontSize: 13 }}
                                            >Adresse de Livraison</span>
                                        </div>
                                        {!showDeliveryAddress ? (
                                            <Form.Item name="inv_ptr_address" style={{ marginBottom: 0 }}>
                                                <TextArea rows={4} placeholder="Adresse complète de facturation" />
                                            </Form.Item>
                                        ) : (
                                            <Form.Item name="inv_delivery_address" style={{ marginBottom: 0 }}>
                                                <TextArea rows={4} placeholder="Adresse complète de livraison" />
                                            </Form.Item>
                                        )}
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item
                                            name="fk_dur_id_payment_condition"
                                            label="Condition de règlement"
                                            rules={[{ required: true, message: "Condition de règlement requise" }]}
                                        >
                                            <PaymentConditionSelect
                                                loadInitially={!invoiceId ? true : false}
                                                initialData={entity?.payment_condition}
                                                onChange={(durIdPaymentCondition) => {
                                                    const invDate = form.getFieldValue('inv_date');
                                                    calculateDueDate(invDate, durIdPaymentCondition);
                                                }}
                                            />
                                        </Form.Item>

                                        <Form.Item
                                            name="fk_pam_id"
                                            label="Mode de règlement"
                                            rules={[{ required: true, message: "Mode de règlement requis" }]}
                                            style={{ marginTop: '-4px' }}
                                        >
                                            <PaymentModeSelect
                                                loadInitially={!invoiceId ? true : false}
                                                initialData={entity?.payment_mode}
                                            />
                                        </Form.Item>

                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="inv_note" label="Note interne">
                                            <TextArea rows={4} placeholder="Notes internes non visibles par le client" />
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
                                            <Button color="green" variant="solid" size="default" icon={<SaveOutlined />} onClick={() => form.submit()} style={{ width: '100%', margin: "4px" }}>
                                                Enregistrer
                                            </Button>
                                        </Col>
                                    )}
                                </Row>
                                {invoiceId && (invStatus === INVOICE_STATUS.FINALIZED || invStatus === INVOICE_STATUS.ACCOUNTED) && invBeingEdited === false && (
                                    <>
                                        <Row gutter={8}>
                                            <Col span={12}>
                                                <Button type="secondary" size="default" icon={<MailOutlined />} onClick={handleSend} style={{ width: '100%', margin: "4px" }} disabled={false}>
                                                    Envoyer
                                                </Button>
                                            </Col>
                                            <Col span={12}>
                                                <Button type="secondary" size="default" icon={<PrinterOutlined />} onClick={handlePrint} style={{ width: '100%', margin: "4px" }} disabled={false}>
                                                    Imprimer
                                                </Button>
                                            </Col>
                                        </Row>
                                        {(invOperation === INVOICE_OPERATION.CUSTOMER_INVOICE || invOperation === INVOICE_OPERATION.CUSTOMER_REFUND) && (
                                            <Row gutter={8}>
                                                <Col span={24}>
                                                    <Button
                                                        size="default"
                                                        icon={<CloudUploadOutlined />}
                                                        onClick={handleTransmitInvoice}
                                                        loading={transmitting}
                                                        disabled={!!eInvoicingTransmission}
                                                        style={{ width: '100%', margin: "4px" }}
                                                        type={eInvoicingTransmission ? "default" : "default"}
                                                    >
                                                        {eInvoicingTransmission
                                                            ? `${eInvoicingTransmission.eit_status_label ?? eInvoicingTransmission.eit_status} — ${
                                                                eInvoicingTransmission.eit_transmitted_at
                                                                    ? dayjs(eInvoicingTransmission.eit_transmitted_at).format('DD/MM/YYYY HH:mm')
                                                                    : ''
                                                              }`
                                                            : "Transmettre via PDP"}
                                                    </Button>
                                                </Col>
                                            </Row>
                                        )}
                                    </>
                                )}
                                {invoiceId && (
                                    <Row gutter={8}>
                                        <Col span={showDeleteBtn ? 12 : 24}>
                                            <Button type="secondary" size="default" icon={<CopyOutlined />} onClick={handleDuplicate} style={{ width: '100%', margin: "4px" }} disabled={false}>
                                                Dupliquer
                                            </Button>
                                        </Col>
                                        {showDeleteBtn && (
                                            <Col span={12}>
                                                <Popconfirm
                                                    title="Êtes-vous sûr de vouloir supprimer cette facture ?"
                                                    description="Cette action est irréversible."
                                                    onConfirm={handleDelete}
                                                    okText="Oui, supprimer"
                                                    cancelText="Annuler"
                                                    okButtonProps={{ danger: true, disabled: false }}
                                                    cancelButtonProps={{ disabled: false }}
                                                >
                                                    <Button size="default" danger icon={<DeleteOutlined />} style={{ width: '100%', margin: "4px" }} disabled={false}>
                                                        Supprimer
                                                    </Button>
                                                </Popconfirm>
                                            </Col>
                                        )}
                                    </Row>
                                )}
                                {/* Afficher message si l'avoir ou l'acompte est utilisé */}
                                {usageInfo.isUsed && (
                                    <Alert
                                        description={
                                            invOperation === 5 || invOperation === 6
                                                ? `L'acompte est utilisé par : ${usageInfo.usedBy.join(', ')}`
                                                : `L'avoir est utilisé par : ${usageInfo.usedBy.join(', ')}`
                                        }
                                        type="warning"
                                        showIcon
                                        style={{ margin: '16px' }}
                                    />
                                )}
                            </Col>
                        </Row >

                        <div style={{ marginTop: '24px' }}>
                            <BizDocumentLinesTable
                                ref={linesTableRef}
                                dataSource={invoiceLines}
                                loading={loadingLines}
                                disabled={formDisabled}
                                documentId={invoiceId}
                                saveLineApi={invoicesGenericApi.saveLine}
                                deleteLineApi={invoicesGenericApi.deleteLine}
                                updateLinesOrderApi={invoicesGenericApi.updateLinesOrder}
                                onLinesChanged={fetchInvoiceLines}
                                config={dynamicConfig}
                                onRequestDocumentCreation={handleRequestDocumentCreation}
                            />
                        </div>

                        <div style={{ paddingTop: '16px' }}>
                            <Row gutter={16}>
                                <Col span={10}>
                                    {showMarginTable && (
                                        <BizDocumentMarginTable dataSource={marginData} loading={loadingLines} />
                                    )}
                                </Col>
                                <Col span={6}></Col>
                                <Col span={8}>
                                    <BizDocumentTotalsCard totals={totals}
                                        config={getModuleConfig(invOperation).totalsConfig} />
                                </Col>
                            </Row>
                        </div>
                    </>
                )
            }
        ];

        if (invoiceId) {
            items.push({
                key: 'payments',
                label: 'Règlement',
                children: (
                    <Suspense fallback={<TabLoader />}>
                        <PaymentsTab
                            parentId={invoiceId}
                            parentStatus={invBeingEdited ? false : invStatus}
                            parentPaymentProgress={invPaymentProgress}
                            parentData={{
                               
                                usageInfo: usageInfo,
                                operation: invOperation,
                            }}
                            config={PAYMENTS_TAB_CONFIG}
                            dialogConfig={PAYMENT_DIALOG_CONFIG}
                            onPaymentChange={reloadInvoiceData}
                        />
                    </Suspense>
                )
            });
            items.push({
                key: 'linked-objects',
                label: 'Objets Liés',
                children: (
                    <Suspense fallback={<TabLoader />}>
                        <LinkedObjectsTab
                            module="invoices"
                            recordId={invoiceId}
                            apiFunction={invoicesGenericApi.getLinkedObjects}
                            refreshTrigger={linkedObjectsRefreshTrigger}
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
                            module="invoices"
                            recordId={invoiceId}
                            getDocumentsApi={invoicesGenericApi.getDocuments}
                            uploadDocumentsApi={invoicesGenericApi.uploadDocuments}
                            onCountChange={setDocumentsCount}
                        />
                    </Suspense>
                )
            });

            if (eInvoicingTransmission) {
                items.push({
                    key: 'einvoicing',
                    label: (
                        <Space size={4}>
                            <CloudUploadOutlined />
                            Facturation Élec.
                        </Space>
                    ),
                    children: (
                        <Suspense fallback={<TabLoader />}>
                            <EInvoicingInvoicePanel invoiceId={invoiceId} invOperation={invOperation} />
                        </Suspense>
                    )
                });
            }
        }

        return items;
    }, [invoiceId, handleSend, handlePrint, statusActionButtons, formDisabled, invStatus, invBeingEdited, showDeleteBtn, handleDuplicate, handleDelete, invoiceLines, loadingLines, fetchInvoiceLines, handleRequestDocumentCreation, totals, marginData, fkPtrId, validateDueDate, invPaymentProgress, invOperation, eInvoicingTransmission, transmitting, handleTransmitInvoice]);

    const handleBack = useCallback(() => {
        navigate(getBasePath());
    }, [navigate]);


    // Calcul du titre de la page
    const pageTitle = useMemo(() => {
        const labels = {
            1: "Facture client",        // OPERATION_CUSTOMER_INVOICE
            2: "Avoir client",          // OPERATION_CUSTOMER_REFUND
            3: "Facture fournisseur",        // OPERATION_SUPPLIER_INVOICE
            4: "Avoir fournisseur",          // OPERATION_SUPPLIER_REFUND
            5: "Acompte client",        // OPERATION_CUSTOMER_DEPOSIT
            6: "Acompte fournisseur",        // OPERATION_SUPPLIER_DEPOSIT
        };

        const docTypeLabel = labels[invOperation] || "Facture";
        if (pageLabel) {
            return `${docTypeLabel} - ${pageLabel}`;
        }
        return invoiceId ? "" : `Nouvelle ${docTypeLabel.toLowerCase()}`;

    }, [invOperation, pageLabel]);

    return (
        <PageContainer
            title={
                <Space>
                    {pageTitle}
                </Space>
            }
            headerStyle={{
                center: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                        <Space>
                            {formatStatus(invStatus)}
                            {formatPaymentStatus(invPaymentProgress)}
                            {eInvoicingTransmission && (
                                <Tag
                                    icon={<CloudUploadOutlined />}
                                    color={eInvoicingTransmission.eit_status_color ?? ({
                                        DEPOSEE: "processing", QUALIFIEE: "processing", MISE_A_DISPO: "processing",
                                        ACCEPTEE: "success", PAYEE: "success",
                                        REFUSEE: "error", LITIGE: "error", ERROR: "error",
                                        EN_PAIEMENT: "warning",
                                    }[eInvoicingTransmission.eit_status] ?? "default")}
                                >
                                    PDP : {eInvoicingTransmission.eit_status_label ?? eInvoicingTransmission.eit_status}
                                </Tag>
                            )}
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
                    <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
                        Retour
                    </Button>
                </Space>
            }
        >
            <Spin spinning={loading} tip="Chargement...">
                <div style={{ background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)" }}>
                    <Form
                        disabled={formDisabled}
                        component={false}
                        form={form}
                        layout="vertical"
                        onFinish={handleFormSubmit}
                        initialValues={{
                            inv_status: 0,
                            inv_date: dayjs(),
                            inv_duedate: dayjs().add(30, 'days'),
                        }}
                    >
                        <Form.Item name="inv_id" hidden>
                            <Input />
                        </Form.Item>
                        <Form.Item name="inv_status" hidden>
                            <Input />
                        </Form.Item>
                        <Form.Item name="inv_operation" hidden>
                            <Input />
                        </Form.Item>



                        <Tabs
                            items={tabItems}
                            styles={{ content: { padding: 8 } }}
                        />
                    </Form>
                </div>
            </Spin>

            {/* Dialog d'envoi d'email */}
            {invoiceId && emailDialogOpen && (
                <Suspense fallback={null}>
                    <EmailDialog
                        open={emailDialogOpen}
                        onClose={() => {
                            setEmailDialogOpen(false);
                            setEmailAttachments([]);
                        }}
                        emailContext="invoice"
                        templateType="invoice"
                        documentId={invoiceId}
                        partnerId={fkPtrId}
                        defaultRecipientId={fkCtcId}
                        initialAttachments={emailAttachments}
                    />
                </Suspense>
            )}
        </PageContainer>
    );
}
