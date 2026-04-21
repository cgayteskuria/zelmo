import { useEffect, useState, useMemo, useCallback, lazy, Suspense, useRef } from "react";
import { Form, Input, Button, Row, Col, DatePicker, Popconfirm, Tabs, Space, Spin, Modal } from "antd";
import { message } from '../../utils/antdStatic';
import { DeleteOutlined, SaveOutlined, CopyOutlined, ArrowLeftOutlined, MailOutlined, PrinterOutlined, LockOutlined, UnlockOutlined, CheckCircleOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useListNavigation } from "../../hooks/useListNavigation";
import dayjs from "dayjs";
import PageContainer from "../../components/common/PageContainer";
import { purchaseOrdersGenericApi, partnersApi } from "../../services/api";
import { getUser, can } from "../../services/auth";

import ContactSelect from "../../components/select/ContactSelect";
import SellerSelect from "../../components/select/SellerSelect";
import PartnerSelect from "../../components/select/PartnerSelect";
import PaymentModeSelect from "../../components/select/PaymentModeSelect";
import PaymentConditionSelect from "../../components/select/PaymentConditionSelect";
import { useEntityForm } from "../../hooks/useEntityForm";
import { formatStatus, formatInvoicingState, formatDeliveryState, getModuleConfig, ORDER_STATUS, ORDER_DELIVERY_STATUS, ORDER_INVOICING_STATUS } from "../../configs/PurchaseOrderConfig";
import { handleBizPrint } from "../../utils/BizDocumentUtils.js";
import { createDateValidator } from '../../utils/writingPeriod';
import BizDocumentLinesTable from "../../components/bizdocument/BizDocumentLinesTable";

import BizDocumentTotalsCard from "../../components/bizdocument/BizDocumentTotalsCard";
import WarehouseSelect from "../../components/select/WarehouseSelect";
// Import lazy des composants lourds
const LinkedObjectsTab = lazy(() => import('../../components/bizdocument/LinkedObjectsTab'));
const FilesTab = lazy(() => import('../../components/bizdocument/FilesTab'));
const BizLineSelectionModal = lazy(() => import('../../components/bizdocument/BizLineSelectionModal'));
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
 * Composant PurchaseOrder
 * Page d'édition d'une commande fournisseur
 */
export default function PurchaseOrder() {
    const { id } = useParams();

    const navigate = useNavigate();
    const [form] = Form.useForm();

    const { hasNav, hasPrev, hasNext, goToPrev, goToNext, position } = useListNavigation();

    const purchaseOrderId = id === 'new' ? null : parseInt(id, 10);

    const [orderLines, setOrderLines] = useState([]);
    const [loadingLines, setLoadingLines] = useState(false);
    const pendingLineTypeRef = useRef(null); // Type de ligne à ajouter après création du document
    const linesTableRef = useRef(null); // Référence au composant BizDocumentLinesTable

    const [showDeleteBtn, setShowDeleteBtn] = useState(false);
    const [formDisabled, setFormDisabled] = useState(true);
    const [porStatus, setPorStatus] = useState(0);
    const [porBeingEdited, setPorBeingEdited] = useState(false);
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const [emailAttachments, setEmailAttachments] = useState([]);

    const [isLockedByDelivery, setIsLockedByDelivery] = useState(false);

    const [porInvoicingState, setPorInvoicingState] = useState(0);
    const [porDeliveryState, setPorDeliveryState] = useState(0);
    const [documentsCount, setDocumentsCount] = useState(undefined);
    const [totals, setTotals] = useState({
        totalHT: 0,
        totalTVA: 0,
        totalTTC: 0,
        totalhtsub: 0,
        totalhtcomm: 0,
        isSub: 0
    });

    const fkPtrId = Form.useWatch('fk_ptr_id', form);

    const [pageLabel, setPageLabel] = useState();
    const [porCancelReason, setPorCancelReason] = useState('');

    // Mémoriser les callbacks pour éviter les re-renders inutiles
    const transformData = useCallback((data) => ({
        ...data,
        por_date: data.por_date ? dayjs(data.por_date) : null,
        por_valid: data.por_valid ? dayjs(data.por_valid) : null,
    }), []);

    const onSuccessCallback = useCallback(({ action, data }) => {
        // Si c'est une création et qu'on a un type de ligne en attente
        if (action === 'create' && pendingLineTypeRef.current !== null && data?.id) {
            // Naviguer vers la nouvelle URL avec l'ID
            navigate(`/purchase-quotations/${data.id}`, { replace: true });
            // Le useEffect ci-dessous ouvrira le modal après le chargement
            return;
        }

        // Comportement normal : rediriger lors de la création/suppression vers la liste
        if (action === 'create' || action === 'delete') {
            // Déterminer l'URL de retour en fonction de l'URL actuelle
            const currentPath = window.location.pathname;
            if (currentPath.includes('/purchase-quotations')) {
                navigate('/purchase-quotations');
            } else {
                navigate('/purchase-orders');
            }
        }
        // Lors d'une mise à jour, rester sur la page
    }, [navigate]);

    const onDeleteCallback = useCallback(({ id }) => {
        const currentPath = window.location.pathname;
        if (currentPath.includes('/purchase-quotations')) {
            navigate('/purchase-quotations');
        } else {
            navigate('/purchase-orders');
        }
    }, [navigate]);

    const onDataLoadedCallback = useCallback((data) => {
        if (data.por_number) {
            const label = data.partner?.ptr_name
                ? `${data.por_number} - ${data.partner.ptr_name}`
                : data.por_number;
            setPageLabel(label);
        }
        setDocumentsCount(data.documents_count ?? 0);
        setPorStatus(data.por_status);
        setPorBeingEdited(Boolean(data.por_being_edited) ?? false);
        setPorCancelReason(data.por_cancel_reason || '');

        setPorInvoicingState(data.por_invoicing_state || 0);
        setPorDeliveryState(data.por_delivery_state || 0);
        setIsLockedByDelivery(Boolean(data.is_locked_by_delivery));
    }, []);

    // Déterminer le chemin de base selon l'URL actuelle
    const getBasePath = () => {
        const currentPath = window.location.pathname;
        if (currentPath.includes('/purchase-quotations')) {
            return '/purchase-quotations';
        } else {
            return '/purchase-orders';
        }
    };

    /**
     * Instance du formulaire CRUD
     */
    const { submit, remove, loading, loadError, reload, entity } = useEntityForm({
        api: purchaseOrdersGenericApi,
        entityId: purchaseOrderId,
        idField: 'por_id',
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
        por_date: values.por_date ? values.por_date.format('YYYY-MM-DD') : null,
        por_valid: values.por_valid ? values.por_valid.format('YYYY-MM-DD') : null,
    }), []);


    // Handler appelé quand on veut ajouter une ligne mais que le document n'existe pas encore
    const handleRequestDocumentCreation = useCallback(async (lineType) => {
        try {
            // Valider le formulaire
            await form.validateFields();
            const values = form.getFieldsValue();

            // Stocker le type de ligne demandé
            pendingLineTypeRef.current = lineType;

            // Soumettre le formulaire pour créer le document
            const formattedValues = formatFormDates(values);
            await submit(formattedValues);
            // La navigation et l'ouverture du modal se feront dans onSuccessCallback
        } catch (error) {
            if (error.errorFields) {
                message.error('Veuillez remplir tous les champs obligatoires avant d\'ajouter des lignes');
            }
            pendingLineTypeRef.current = null;
        }
    }, [form, formatFormDates, submit]);

    // useEffect pour ouvrir le modal après la création du document et la navigation
    useEffect(() => {
        if (purchaseOrderId && pendingLineTypeRef.current !== null && linesTableRef.current) {
            // Ouvrir le modal pour ajouter la ligne
            linesTableRef.current.openAddModal(pendingLineTypeRef.current);
            // Réinitialiser le type en attente
            pendingLineTypeRef.current = null;
        }
    }, [purchaseOrderId]);

    const validateAndSubmitOrder = async ({
        requireFinalCheck,
        payload,
        afterSubmit,
    }) => {
        // Vérifier qu'il y a au moins une ligne
        if (requireFinalCheck && orderLines.length === 0) {
            const label = porStatus <= 2 ? 'de devis' : 'de Commande';
            message.error(`Vous devez ajouter au moins une ligne ${label} avant de finaliser`);
            return;
        }

        const currentValues = form.getFieldsValue();
        // Validation Ant Design
        await form.validateFields();

        const formattedValues = formatFormDates({
            ...currentValues,
            ...payload,
        });

        await submit(formattedValues);
        afterSubmit();
    };

    const handleFormSubmit = useCallback(async (values) => {
        // Vérifier si une ligne a un abonnement       
        const formattedValues = formatFormDates(values);
        await submit(formattedValues);
    }, [orderLines, porStatus, formatFormDates, submit]);


    const handleChangeStatus = useCallback(async (status) => {
        try {
            await validateAndSubmitOrder({
                requireFinalCheck: status === 1,
                payload: { ord_status: status },
                afterSubmit: () => setPorStatus(status),
            });
        } catch (error) {
            console.error('Erreur de validation:', error);
        }
    }, [orderLines, porStatus, form, submit]);


    const handleChangeBeingEdited = useCallback(async (beingEdited) => {
        try {
            await validateAndSubmitOrder({
                requireFinalCheck: beingEdited === false,
                payload: { por_being_edited: beingEdited },
                afterSubmit: () => setPorBeingEdited(Boolean(beingEdited)),
            });
        } catch (error) {
            console.error('Erreur de validation:', error);
        }
    }, [form, submit]);

    const handleConfirmOrder = useCallback(async () => {
        try {
            await form.validateFields();
            const currentValues = form.getFieldsValue();
            const formattedValues = formatFormDates({
                ...currentValues,
                por_status: 3,
            });
            await submit(formattedValues);
            setPorStatus(3);
            message.success('Commande confirmée avec succès');
        } catch (error) {
            console.error('Erreur lors de la confirmation:', error);
            message.error('Erreur lors de la confirmation');
        }
    }, [form, submit]);

    const handleRefuseOrder = useCallback(() => {
        setCancelModalOpen(true);
    }, []);

    const handleRefuseOrderSubmit = useCallback(async () => {
        if (!cancelReason.trim()) {
            message.error('Veuillez saisir une raison de refus');
            return;
        }

        try {
            const currentValues = form.getFieldsValue();
            const newStatus = porStatus === ORDER_STATUS.FINALIZED ? ORDER_STATUS.REFUSED_QUOTE : porStatus === ORDER_STATUS.CONFIRMED ? ORDER_STATUS.CANCELLED : porStatus;

            const formattedValues = formatFormDates({
                ...currentValues,
                por_status: newStatus,
                por_cancel_reason: cancelReason,
            });
            await submit(formattedValues);
            setPorStatus(newStatus);
            setCancelModalOpen(false);
            setCancelReason('');
            message.success('Commande refusée');
        } catch (error) {
            console.error('Erreur lors du refus:', error);
            message.error('Erreur lors du refus');
        }
    }, [form, porStatus, cancelReason, submit]);

    // Fonction pour récupérer les lignes
    const fetchOrderLines = useCallback(async () => {
        if (!purchaseOrderId) {
            setOrderLines([]);
            setTotals({ totalHT: 0, totalTVA: 0, totalTTC: 0 });
            return;
        }

        setLoadingLines(true);
        try {
            const response = await purchaseOrdersGenericApi.getLines(purchaseOrderId);
            setOrderLines(response.data || []);

            // Mettre à jour les totaux si disponibles
            if (response.totals) {
                setTotals({
                    totalHT: response.totals.totalht || 0,
                    totalTVA: response.totals.tax || 0,
                    totalTTC: response.totals.totalttc || 0,
                });
            }

            //On check si le champ Engagement est devenu obligatoire
            const hasSubscription = response.data.some(line => line.isSubscription === true || line.isSubscription === 1);
            if (!hasSubscription) {
                form.setFields([{ name: 'fk_dur_id', errors: [], },]);
            } else {
                const errorMsg = 'Le champ Engagement est requis car la commande contient au moins une ligne avec abonnement';
                form.setFields([{ name: 'fk_dur_id', errors: [errorMsg], },]);
            }

        } catch (error) {
            console.error("Erreur lors du chargement des lignes:", error);
            message.error("Erreur lors du chargement des lignes");
            setOrderLines([]);
        } finally {
            setLoadingLines(false);
        }
    }, [purchaseOrderId]);

    const handleOpenInvoiceModal = useCallback(() => {
        setInvoiceModalOpen(true);
    }, [orderLines]);

    const handleGenerateInvoice = useCallback(async (linesWithQty) => {
        if (!linesWithQty || linesWithQty.length === 0) {
            message.error('Veuillez sélectionner au moins une ligne à facturer');
            return;
        }

        try {
            // Appel API pour générer la facture avec les lignes et quantités sélectionnées
            const result = await purchaseOrdersGenericApi.generateInvoice(purchaseOrderId, linesWithQty);

            message.success('Facture générée avec succès');
            setInvoiceModalOpen(false);

            // Recharger les données de la commande pour mettre à jour l'état de facturation
            await reload(false);

            // Optionnel: naviguer vers la facture créée            
            if (result?.data?.invoice_id) {
                navigate(`/customer-invoices/${result.data.invoice_id}`);
            }
        } catch (error) {
            console.error('Erreur lors de la génération:', error);
            message.error(error?.message || 'Erreur lors de la génération de la facture');
        }
    }, [purchaseOrderId]);

    const handleMarkAsFullyInvoiced = useCallback(() => {
        Modal.confirm({
            title: 'Confirmer l\'action',
            content: 'Voulez-vous vraiment marquer cette commande fournisseur comme totalement facturée ?',
            okText: 'Confirmer',
            cancelText: 'Annuler',
            onOk: async () => {
                try {
                    await purchaseOrdersGenericApi.update(purchaseOrderId, {
                        por_invoicing_state: ORDER_INVOICING_STATUS.FULLY
                    });
                    message.success('Commande marquée comme facturée');
                    await reload(false);
                } catch (error) {
                    console.error('Erreur lors de la mise à jour du statut:', error);
                    message.error('Erreur lors de la mise à jour du statut');
                }
            }
        });
    }, [purchaseOrderId, reload]);

    const handleMarkAsFullyReceived = useCallback(() => {
        Modal.confirm({
            title: 'Confirmer l\'action',
            content: 'Voulez-vous vraiment marquer cette commande fournisseur comme totalement réceptionnée ?',
            okText: 'Confirmer',
            cancelText: 'Annuler',
            onOk: async () => {
                try {
                    await purchaseOrdersGenericApi.update(purchaseOrderId, {
                        por_reception_state: ORDER_DELIVERY_STATUS.FULLY
                    });
                    message.success('Commande marquée comme réceptionnée');
                    await reload(false);
                } catch (error) {
                    console.error('Erreur lors de la mise à jour du statut:', error);
                    message.error('Erreur lors de la mise à jour du statut');
                }
            }
        });
    }, [purchaseOrderId, reload]);

    // Auto-remplir le demandeur avec l'utilisateur connecté lors de la création
    useEffect(() => {
        if (!purchaseOrderId) {
            const currentUser = getUser();
            if (currentUser && currentUser.id) {
                form.setFieldValue('fk_usr_id_requester', currentUser.id);
            }
        }
    }, [purchaseOrderId, form]);

    // Gérer les erreurs de chargement (ID inexistant ou non autorisé)
    useEffect(() => {
        if (loadError && purchaseOrderId) {
            message.error("La commande fournisseur demandée n'existe pas ou vous n'avez pas les droits pour y accéder");
            navigate('/purchase-orders');
        }
    }, [loadError, purchaseOrderId, navigate]);


    // Validation personnalisée pour la date de validité
    const validateValidDate = useCallback((_, value) => {
        if (!value) {
            return Promise.resolve();
        }
        const orderDate = form.getFieldValue('por_date');
        if (orderDate && value.isBefore(orderDate, 'day')) {
            const label = porStatus <= ORDER_STATUS.REFUSED_QUOTE ? 'du devis' : 'de la commande';
            return Promise.reject(new Error(`La date de validité doit être supérieure ou égale à la date ${label}`));
        }
        return Promise.resolve();
    }, [form, porStatus]);


    const handleDelete = useCallback(async () => {
        await remove();
    }, [remove]);

    const handleDuplicate = useCallback(async () => {
        try {
            const result = await purchaseOrdersGenericApi.duplicate(purchaseOrderId);
            message.success("Enregistrement dupliqué avec succès");
            window.location.href = `${getBasePath()}/${result.data.id}`;
            //navigate(`/purchase-orders/${result.data.por_id}`);
        } catch (error) {
            console.error(error);
            message.error("Erreur lors de la duplication");
        }
    }, [purchaseOrderId, navigate]);


    // Charger les lignes au montage et quand purchaseOrderId change
    useEffect(() => {
        fetchOrderLines();
    }, [fetchOrderLines]);

    // Gérer l'activation/désactivation du formulaire selon por_status et porBeingEdited
    useEffect(() => {
        if (porStatus === ORDER_STATUS.DRAFT) {
            // Brouillon : formulaire actif
            setFormDisabled(false);
        } else if (porStatus === ORDER_STATUS.FINALIZED && porBeingEdited === true) {
            // Validé mais en cours de modification : formulaire actif
            setFormDisabled(false);
        } else if (porStatus === ORDER_STATUS.FINALIZED && porBeingEdited === false) {
            // Validé et non en cours de modification : formulaire inactif
            setFormDisabled(true);
        } else if (porStatus === ORDER_STATUS.CONFIRMED && porBeingEdited === true) {
            // En cours mais en cours de modification : formulaire actif
            setFormDisabled(false);
        } else if (porStatus === ORDER_STATUS.CONFIRMED && porBeingEdited === false) {
            // En cours et non en cours de modification : formulaire inactif
            setFormDisabled(true);
        } else {
            // Par défaut : formulaire inactif
            setFormDisabled(true);
        }
    }, [porStatus, porBeingEdited]);

    // Gérer l'affichage du bouton Supprimer
    useEffect(() => {
        if (porInvoicingState === ORDER_INVOICING_STATUS.NOT_INVOICED && porDeliveryState === ORDER_DELIVERY_STATUS.NOT_DELIVERED && porStatus !== ORDER_STATUS.REFUSED_QUOTE && porStatus != ORDER_STATUS.CANCELLED) {
            setShowDeleteBtn(true);
        } else {
            setShowDeleteBtn(false);
        }
    }, [porInvoicingState, porDeliveryState, porStatus]);

    const handlePartnerOnChange = async (partnerId) => {
        if (!partnerId) return; // Pas de partenaire sélectionné, on sort

        // Réinitialiser le contact quand le fournisseur change
        form.setFieldValue('fk_ctc_id', null);

        try {
            const response = await partnersApi.get(partnerId);
            const partnerData = response.data;
            const moduleConfig = getModuleConfig();

            // Remplir les champs du formulaire avec les données du partenaire
            if (partnerData.ptr_address) {
                form.setFieldValue('inv_ptr_address', partnerData.ptr_address);
            }
            if (partnerData[moduleConfig.field.pam]) {
                form.setFieldValue('fk_pam_id', partnerData[moduleConfig.field.pam]);
            }
            if (partnerData[moduleConfig.field.paymentCondition]) {
                form.setFieldValue('fk_dur_id_payment_condition', partnerData[moduleConfig.field.paymentCondition]);
            }
        } catch (error) {
            console.error("Erreur lors du chargement des données du partenaire :", error);
            message.error("Impossible de charger les informations du partenaire.");
        }
    };

    // Fonctions handlers pour les boutons
    const handleSend = useCallback(async () => {
        if (!purchaseOrderId) {
            message.error("Veuillez enregistrer la commande avant de l'envoyer");
            return;
        }

        try {
            message.loading({ content: "Préparation de l'email...", key: "emailPrep" });

            // Générer le PDF
            const response = await purchaseOrdersGenericApi.printPdf(purchaseOrderId);
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
    }, [purchaseOrderId]);

    const handlePrint = useCallback(async () => {
        await handleBizPrint(
            purchaseOrdersGenericApi.printPdf,
            purchaseOrderId,
            "Veuillez enregistrer la commande avant de l'imprimer"
        );
    }, [purchaseOrderId]);

    // Fonction pour déterminer les boutons d'action à afficher
    const statusActionButtons = useMemo(() => {
        const buttons = [];

        if (porStatus === ORDER_STATUS.DRAFT) {
            buttons.push({
                key: 'finalize',
                label: "Finaliser",
                icon: <LockOutlined />,
                onClick: () => handleChangeStatus(1),
                type: 'primary'
            });
        } else if (porStatus === ORDER_STATUS.FINALIZED && porBeingEdited === true) {
            buttons.push({
                key: 'validate',
                label: "Valider les modifications",
                icon: <LockOutlined />,
                onClick: () => handleChangeBeingEdited(false),
                type: 'primary'
            });
        } else if (porStatus === ORDER_STATUS.FINALIZED && porBeingEdited === false) {
            buttons.push({
                key: 'confirm',
                label: "Confirmer la commande",
                icon: <CheckCircleOutlined />,
                onClick: handleConfirmOrder,
                type: 'primary',
                color: 'green'
            });
            buttons.push({
                key: 'modify',
                label: "Modifier le devis",
                icon: <UnlockOutlined />,
                onClick: () => handleChangeStatus(0),
                type: 'secondary'
            });
            buttons.push({
                key: 'refuse',
                label: "Annuler le devis",
                icon: <DeleteOutlined />,
                onClick: handleRefuseOrder,
                type: 'secondary',
            });
        } else if (porStatus === ORDER_STATUS.CONFIRMED && porBeingEdited === true) {
            // En cours et en cours de modification
            buttons.push({
                key: 'validate',
                label: "Valider les modifications",
                icon: <LockOutlined />,
                onClick: () => handleChangeBeingEdited(false),
                type: 'primary'
            });
        } else if (porStatus === ORDER_STATUS.CONFIRMED && porBeingEdited === false && porInvoicingState === ORDER_INVOICING_STATUS.NOT_INVOICED && porDeliveryState === ORDER_DELIVERY_STATUS.NOT_DELIVERED) {
            buttons.push({
                key: 'reopen',
                label: "Rouvrir la commande",
                icon: <UnlockOutlined />,
                onClick: () => handleChangeBeingEdited(true),
                type: 'primary'
            });
            buttons.push({
                key: 'refuse',
                label: "Annuler la commande",
                icon: <DeleteOutlined />,
                onClick: handleRefuseOrder,
                type: 'secondary',
                danger: true
            });
        }


        return buttons;
    }, [porStatus, porBeingEdited, porDeliveryState, porInvoicingState, handleChangeStatus, handleChangeBeingEdited, handleMarkAsFullyInvoiced, handleMarkAsFullyReceived]);

    const actionButtons = useMemo(() => {
        const buttons = [];

        // Boutons pour marquer manuellement comme facturé/livré (seulement si commande confirmée et non en édition)
        if (porStatus === ORDER_STATUS.CONFIRMED && porBeingEdited === false) {
            // Bouton "Indiquer comme Facturé" si pas encore totalement facturé
            if ((porInvoicingState === ORDER_INVOICING_STATUS.NOT_INVOICED || porInvoicingState === ORDER_INVOICING_STATUS.PARTIALLY) && can('purchase-orders.edit')) {
                buttons.push({
                    key: 'mark-invoiced',
                    label: "Indiquer comme Facturé",
                    // icon: <CheckCircleOutlined />,
                    onClick: handleMarkAsFullyInvoiced,
                    type: 'secondary'
                });
            }

            // Bouton "Indiquer comme Livré" si pas encore totalement livré
            if ((porDeliveryState === ORDER_DELIVERY_STATUS.NOT_DELIVERED || porDeliveryState === ORDER_DELIVERY_STATUS.PARTIALLY) && can('purchase-porers.edit')) {
                buttons.push({
                    key: 'mark-delivered',
                    label: "Indiquer comme Livré",
                    // icon: <CheckCircleOutlined />,
                    onClick: handleMarkAsFullyReceived,
                    type: 'secondary'
                });
            }
        }

        return buttons;
    }, [porStatus, porBeingEdited, porDeliveryState, porInvoicingState, handleConfirmOrder, handleRefuseOrder, handleMarkAsFullyInvoiced, handleMarkAsFullyReceived]);

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

                                <Row gutter={[16, 8]}>
                                    <Col span={4}>
                                        <Form.Item
                                            name="por_date"
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
                                    <Col span={4}>
                                        <Form.Item
                                            name="por_valid"
                                            label="Date de validité"
                                            rules={[
                                                { required: true, message: "Date de validité requise" },
                                                { validator: validateValidDate }
                                            ]}
                                            dependencies={['por_date']}
                                        >
                                            <DatePicker
                                                format="DD/MM/YYYY"
                                                style={{ width: '100%' }}

                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item
                                            name="fk_usr_id_requester"
                                            label="Demandeur"
                                        >
                                            <SellerSelect
                                                loadInitially={!purchaseOrderId ? true : false}
                                                initialData={entity?.seller}
                                            />
                                        </Form.Item>
                                    </Col>

                                </Row>
                                <Row gutter={[16, 8]}>
                                    <Col span={8}>
                                        <Form.Item
                                            name="fk_ptr_id"
                                            label="Fournisseur"
                                            rules={[{ required: true, message: "Fournisseur requis" }]}
                                        >
                                            <PartnerSelect
                                                loadInitially={!purchaseOrderId ? true : false}
                                                initialData={entity?.partner}
                                                filters={{
                                                    is_active: 1,
                                                    is_supplier: 1
                                                }}
                                                onChange={handlePartnerOnChange} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="fk_ctc_id" label="Contact Fournisseur">
                                            <ContactSelect
                                                key={`ctc-${fkPtrId}`}
                                                initialData={entity?.contact}
                                                filters={{
                                                    is_active: 1,
                                                    ptrId: fkPtrId
                                                }} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="por_externalreference" label="Réf fournisseur">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={[16, 8]}>
                                    <Col span={8}>
                                        <Form.Item
                                            name="por_ptr_address"
                                            label="Adresse du fournisseur"
                                        >
                                            <TextArea
                                                rows={4}
                                                placeholder="Adresse complète du fournisseur"
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item
                                            name="fk_dur_id_payment_condition"
                                            label="Condition de règlement"
                                            rules={[{ required: true, message: "Condition de règlement requise" }]}
                                        >
                                            <PaymentConditionSelect
                                                loadInitially={!purchaseOrderId ? true : false}
                                                initialData={entity?.payment_condition}
                                            />
                                        </Form.Item>
                                        <Form.Item
                                            name="fk_pam_id"
                                            label="Mode de règlement"
                                            rules={[{ required: true, message: "Mode de règlement requis" }]}
                                            style={{ marginTop: '-4px' }}
                                        >
                                            <PaymentModeSelect
                                                loadInitially={!purchaseOrderId ? true : false}
                                                initialData={entity?.payment_mode} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="por_note" label="Note interne">
                                            <TextArea
                                                rows={1}
                                                placeholder="Notes internes"
                                            />
                                        </Form.Item>
                                        <Form.Item
                                            name="fk_whs_id"
                                            label="Entrepôt"
                                            rules={[{ required: true, message: "L'entrepôt est obligatoire" }]}
                                            style={{ marginTop: '-4px' }}
                                        >
                                            <WarehouseSelect
                                                loadInitially={!purchaseOrderId ? true : false}
                                                initialData={entity?.warehouse}
                                                selectDefault={true}
                                                onDefaultSelected={(id) => {
                                                    //  if (!entity?.warehouse) {
                                                    form.setFieldValue('fk_whs_id', id);
                                                    //  }
                                                }}
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
                                            <Button color="green" variant="solid" size="default" icon={<SaveOutlined />} onClick={() => form.submit()} style={{ width: '100%', margin: "4px" }}>
                                                Enregistrer
                                            </Button>
                                        </Col>
                                    )}
                                </Row>
                                {purchaseOrderId && ((porStatus === 1 && porBeingEdited === false) || (porStatus === 3 && porBeingEdited === false)) && (
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
                                )}

                                {purchaseOrderId && (
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
                                                    title="Êtes-vous sûr de vouloir supprimer cette commande ?"
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
                                <Row gutter={8}>
                                    {actionButtons.map((btn) => (
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
                                {purchaseOrderId && porStatus === ORDER_STATUS.CONFIRMED && (porInvoicingState === ORDER_INVOICING_STATUS.NOT_INVOICED || porInvoicingState === ORDER_INVOICING_STATUS.PARTIALLY) && porBeingEdited === false && can('invoices.create') && (
                                    <Row gutter={8}>
                                        <Col span={24}>
                                            <Button
                                                type="secondary"
                                                size="default"
                                                style={{ width: '100%', margin: "4px" }}
                                                disabled={false}
                                                onClick={handleOpenInvoiceModal}
                                            >
                                                Générer la facture
                                            </Button>
                                        </Col>
                                    </Row>
                                )}
                            </Col>

                        </Row>

                        {/* Section 3: Lignes */}
                        <div style={{ marginTop: '24px' }}>
                            <BizDocumentLinesTable
                                ref={linesTableRef}
                                dataSource={orderLines}
                                loading={loadingLines}
                                disabled={formDisabled}
                                documentId={purchaseOrderId}
                                saveLineApi={purchaseOrdersGenericApi.saveLine}
                                deleteLineApi={purchaseOrdersGenericApi.deleteLine}
                                updateLinesOrderApi={purchaseOrdersGenericApi.updateLinesOrder}
                                onLinesChanged={fetchOrderLines}
                                config={getModuleConfig()}
                                onRequestDocumentCreation={handleRequestDocumentCreation}
                            />
                        </div>

                        {/* Section 4: Totaux */}
                        <div style={{ paddingTop: '16px' }}>
                            <Row gutter={16}>
                                <Col span={16}></Col>
                                <Col span={8}>
                                    <BizDocumentTotalsCard
                                        totals={totals}
                                        config={getModuleConfig().totalsConfig}
                                    />
                                </Col>
                            </Row>
                        </div>
                    </>
                )
            }
        ];

        // Ajouter l'onglet "Objets Liés" uniquement si por_id existe
        if (purchaseOrderId) {
            items.push({
                key: 'linked-objects',
                label: 'Objets Liés',
                children: (
                    <Suspense fallback={<TabLoader />}>
                        <LinkedObjectsTab
                            module="purchase-orders"
                            recordId={purchaseOrderId}
                            apiFunction={purchaseOrdersGenericApi.getLinkedObjects}
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
                            module="purchase-orders"
                            recordId={purchaseOrderId}
                            getDocumentsApi={purchaseOrdersGenericApi.getDocuments}
                            uploadDocumentsApi={purchaseOrdersGenericApi.uploadDocuments}
                            onCountChange={setDocumentsCount}
                        />
                    </Suspense>
                )
            });
        }

        return items;
    }, [purchaseOrderId, formDisabled, statusActionButtons, porStatus, porBeingEdited, orderLines, fkPtrId, form, reload]);

    const handleBack = () => {
        navigate('/purchase-orders');
    };

    return (
        <PageContainer
            title={
                <Space>
                    {pageLabel ? `Commande fournisseur - ${pageLabel}` : (purchaseOrderId ? "" : "Nouvelle commande fournisseur")}
                </Space>
            }
            headerStyle={{
                center: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                        <Space>
                            {formatStatus(porStatus)}
                            {porDeliveryState != null && formatDeliveryState(porDeliveryState)}
                            {porInvoicingState != null && formatInvoicingState(porInvoicingState)}
                        </Space>
                        {porStatus === 2 && porCancelReason && (
                            <div style={{ fontSize: '12px', color: '#ff4d4f' }}>
                                Motif d'annulation : {porCancelReason}
                            </div>
                        )}
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
                            por_status: 0,
                            por_date: dayjs(),
                        }}
                    >
                        <Form.Item name="por_id" hidden>
                            <Input />
                        </Form.Item>
                        <Form.Item name="por_status" hidden>
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

            {/* Modal d'annulation de commande */}
            <Modal
                title="Annuler la commande"
                centered={true}
                destroyOnHidden={true}
                open={cancelModalOpen}
                onOk={handleRefuseOrderSubmit}
                onCancel={() => {
                    setCancelModalOpen(false);
                    setCancelReason('');
                }}
                okText="Annuler la commande"
                cancelText="Fermer"
                okButtonProps={{ danger: true }}
            >
                <Form.Item
                    label="Raison de l'annulation"
                    required
                    style={{ marginTop: '20px' }}
                >
                    <TextArea
                        rows={4}
                        placeholder="Veuillez saisir la raison de l'annulation de la commande"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                    />
                </Form.Item>
            </Modal>
            {/* Modal de sélection des lignes à facturer */}
            {invoiceModalOpen && (
                <Suspense fallback={<TabLoader />}>
                    <BizLineSelectionModal
                        open={invoiceModalOpen}
                        title="Sélectionner les lignes à facturer"
                        okText="Générer la facture"
                        dataSource={orderLines}
                        onOk={handleGenerateInvoice}
                        onCancel={() => setInvoiceModalOpen(false)}
                    />
                </Suspense>
            )}

            {/* Dialog d'envoi d'email */}
            {purchaseOrderId && emailDialogOpen && (
                <Suspense fallback={null}>
                    <EmailDialog
                        open={emailDialogOpen}
                        onClose={() => {
                            setEmailDialogOpen(false);
                            setEmailAttachments([]);
                        }}
                        emailContext="company"
                        templateType="purchase"
                        documentId={purchaseOrderId}
                        partnerId={fkPtrId}
                        initialAttachments={emailAttachments}
                    />
                </Suspense>
            )}
        </PageContainer>
    );
}
