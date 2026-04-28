import { useEffect, useState, useMemo, useCallback, lazy, Suspense, useRef } from "react";
import { Form, Input, Button, Row, Col, DatePicker, Popconfirm, Tabs, Space, Spin, Card, Modal, Alert } from "antd";
import { message } from '../../utils/antdStatic';
import { DeleteOutlined, SaveOutlined, CopyOutlined, ArrowLeftOutlined, MailOutlined, PrinterOutlined, LockOutlined, CheckCircleOutlined, UnlockOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useListNavigation } from "../../hooks/useListNavigation";
import dayjs from "dayjs";
import PageContainer from "../../components/common/PageContainer";
import { saleOrdersGenericApi, partnersApi } from "../../services/api";
import { getUser, can } from "../../services/auth";
import CommitmentDurationSelect from "../../components/select/CommitmentDurationSelect.jsx";
import ContactSelect from "../../components/select/ContactSelect";
import SellerSelect from "../../components/select/SellerSelect";
import PartnerSelect from "../../components/select/PartnerSelect";
import PaymentModeSelect from "../../components/select/PaymentModeSelect";
import PaymentConditionSelect from "../../components/select/PaymentConditionSelect";
import { useEntityForm } from "../../hooks/useEntityForm";
import { formatStatus, formatInvoicingState, formatDeliveryState, getModuleConfig, ORDER_STATUS, ORDER_DELIVERY_STATUS, ORDER_INVOICING_STATUS } from "../../configs/SaleOrderConfig";
import { handleBizPrint } from "../../utils/BizDocumentUtils.js";
import { createDateValidator } from '../../utils/writingPeriod';
import BizDocumentLinesTable from "../../components/bizdocument/BizDocumentLinesTable";
import BizDocumentMarginTable, { calculateMargins } from "../../components/bizdocument/BizDocumentMarginTable";
import BizDocumentTotalsCard from "../../components/bizdocument/BizDocumentTotalsCard";
import WarehouseSelect from "../../components/select/WarehouseSelect";
// Import lazy des composants lourds
const LinkedObjectsTab = lazy(() => import('../../components/bizdocument/LinkedObjectsTab'));
const FilesTab = lazy(() => import('../../components/bizdocument/FilesTab'));
import BizLineSelectionModal from '../../components/bizdocument/BizLineSelectionModal';
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
 * Composant SaleOrder
 * Page d'édition d'une devis / commande client
 */
export default function SaleOrder() {
    const { id } = useParams();

    const navigate = useNavigate();
    const [form] = Form.useForm();

    const { hasNav, hasPrev, hasNext, goToPrev, goToNext, position } = useListNavigation();

    const saleOrderId = id === 'new' ? null : parseInt(id, 10);

    const [orderLines, setOrderLines] = useState([]);
    const [loadingLines, setLoadingLines] = useState(false);
    const pendingLineTypeRef = useRef(null); // Type de ligne à ajouter après création du document
    const linesTableRef = useRef(null); // Référence au composant BizDocumentLinesTable

    const [showDeliveryAddress, setShowDeliveryAddress] = useState(false);
    const [showDeleteBtn, setShowDeleteBtn] = useState(false);
    const [formDisabled, setFormDisabled] = useState(true);
    const [ordStatus, setOrdStatus] = useState(0);
    const [ordBeingEdited, setOrdBeingEdited] = useState(false);
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const [emailAttachments, setEmailAttachments] = useState([]);

    const [linkedObjectsRefreshKey, setLinkedObjectsRefreshKey] = useState(0);
    const [isLockedByDelivery, setIsLockedByDelivery] = useState(false);

    const [ordInvoicingState, setOrdInvoicingState] = useState(0);
    const [ordDeliveryState, setOrdDeliveryState] = useState(0);
    const [documentsCount, setDocumentsCount] = useState(undefined);
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
    const fkDurId = Form.useWatch('fk_dur_id', form);
    const fkCtcId = Form.useWatch('fk_ctc_id', form);

    const [pageLabel, setPageLabel] = useState();
    const [ordCancelReason, setOrdCancelReason] = useState('');

    // Mémoriser les callbacks pour éviter les re-renders inutiles
    const transformData = useCallback((data) => ({
        ...data,
        ord_date: data.ord_date ? dayjs(data.ord_date) : null,
        ord_valid: data.ord_valid ? dayjs(data.ord_valid) : null,
    }), []);

    const onSuccessCallback = useCallback(({ action, data }) => {
        // Si c'est une création et qu'on a un type de ligne en attente
        if (action === 'create' && pendingLineTypeRef.current !== null && data?.id) {
            // Naviguer vers la nouvelle URL avec l'ID
            navigate(`/sale-quotations/${data.id}`, { replace: true });
            // Le useEffect ci-dessous ouvrira le modal après le chargement
            return;
        }

        // Comportement normal : rediriger lors de la création/suppression vers la liste
        if (action === 'create' || action === 'delete') {
            // Déterminer l'URL de retour en fonction de l'URL actuelle
            const currentPath = window.location.pathname;
            if (currentPath.includes('/sale-quotations')) {
                navigate('/sale-quotations');
            } else {
                navigate('/sale-orders');
            }
        }
        // Lors d'une mise à jour, rester sur la page
    }, [navigate]);

    const onDeleteCallback = useCallback(({ id }) => {
        // Déterminer l'URL de retour en fonction de l'URL actuelle
        const currentPath = window.location.pathname;
        if (currentPath.includes('/sale-quotations')) {
            navigate('/sale-quotations');
        } else {
            navigate('/sale-orders');
        }
    }, [navigate]);

    const onDataLoadedCallback = useCallback((data) => {
        if (data.ord_number) {
            const label = data.partner?.ptr_name
                ? `${data.ord_number} - ${data.partner.ptr_name}`
                : data.ord_number;
            setPageLabel(label);
        }
             // Toujours mettre à jour documentsCount, même si c'est 0
        setDocumentsCount(data.documents_count ?? 0);
        
        setOrdStatus(data.ord_status);
        setOrdBeingEdited(Boolean(data.ord_being_edited) ?? false);
        setOrdCancelReason(data.ord_cancel_reason || '');

        setOrdInvoicingState(data.ord_invoicing_state || 0);
        setOrdDeliveryState(data.ord_delivery_state || 0);
        setIsLockedByDelivery(Boolean(data.is_locked_by_delivery));
        setShowDeliveryAddress(Boolean(data.ord_delivery_address));
    }, []);

    /**
     * Instance du formulaire CRUD
     */
    const { submit, remove, loading, loadError, reload, entity } = useEntityForm({
        api: saleOrdersGenericApi,
        entityId: saleOrderId,
        idField: 'ord_id',
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
        ord_date: values.ord_date ? values.ord_date.format('YYYY-MM-DD') : null,
        ord_valid: values.ord_valid ? values.ord_valid.format('YYYY-MM-DD') : null,
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
        if (saleOrderId && pendingLineTypeRef.current !== null && linesTableRef.current) {
            // Ouvrir le modal pour ajouter la ligne
            linesTableRef.current.openAddModal(pendingLineTypeRef.current);
            // Réinitialiser le type en attente
            pendingLineTypeRef.current = null;
        }
    }, [saleOrderId]);

    const validateAndSubmitOrder = async ({
        requireFinalCheck,
        payload,
        afterSubmit,
    }) => {
        // Vérifier qu'il y a au moins une ligne
        if (requireFinalCheck && orderLines.length === 0) {
            const label = ordStatus <= 2 ? 'de devis' : 'de Commande';
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
    }, [orderLines, ordStatus, formatFormDates, submit]);


    const handleChangeStatus = useCallback(async (status) => {
        try {
            await validateAndSubmitOrder({
                requireFinalCheck: status === 1,
                payload: { ord_status: status },
                afterSubmit: () => setOrdStatus(status),
            });
        } catch (error) {
            console.error('Erreur de validation:', error);
        }
    }, [orderLines, ordStatus, form, submit]);


    const handleChangeBeingEdited = useCallback(async (beingEdited) => {
        try {
            await validateAndSubmitOrder({
                requireFinalCheck: beingEdited === false,
                payload: { ord_being_edited: beingEdited },
                afterSubmit: () => setOrdBeingEdited(Boolean(beingEdited)),
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
                ord_status: 3,
            });
            await submit(formattedValues);
            setOrdStatus(3);
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
            const newStatus = ordStatus === ORDER_STATUS.FINALIZED ? ORDER_STATUS.REFUSED_QUOTE : ordStatus === ORDER_STATUS.CONFIRMED ? ORDER_STATUS.CANCELLED : ordStatus;

            const formattedValues = formatFormDates({
                ...currentValues,
                ord_status: newStatus,
                ord_cancel_reason: cancelReason,
            });
            await submit(formattedValues);
            setOrdStatus(newStatus);
            setCancelModalOpen(false);
            setCancelReason('');
            message.success('Commande refusée');
        } catch (error) {
            console.error('Erreur lors du refus:', error);
            message.error('Erreur lors du refus');
        }
    }, [form, ordStatus, cancelReason, submit]);

    // Fonction pour récupérer les lignes 
    const fetchOrderLines = useCallback(async () => {
        if (!saleOrderId) {
            setOrderLines([]);
            setTotals({ totalHT: 0, totalTVA: 0, totalTTC: 0, totalhtsub: 0, totalhtcomm: 0, isSub: 0 });
            setMarginData([]);
            return;
        }

        setLoadingLines(true);
        try {
            const response = await saleOrdersGenericApi.getLines(saleOrderId);
            setOrderLines(response.data || []);

            // Mettre à jour les totaux si disponibles
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

            // Forcer la revalidation du champ Engagement après chargement des lignes
            // Utiliser un setTimeout pour s'assurer que orderLines est bien mis à jour
            setTimeout(() => {
                const hasSubscription = (response.data || []).some(line => line.isSubscription === true || line.isSubscription === 1);
                const currentValue = form.getFieldValue('fk_dur_id');

                if (hasSubscription && !currentValue) {
                    // Si abonnement présent et champ vide : valider pour afficher l'erreur
                    form.validateFields(['fk_dur_id']).catch(() => { });
                } else if (!hasSubscription) {
                    // Si plus d'abonnement : effacer l'erreur potentielle
                    form.setFields([{
                        name: 'fk_dur_id',
                        errors: []
                    }]);
                }
            }, 0);

            // Calculer et mettre à jour les marges si disponibles
            if (response.margins) {
                setMarginData(calculateMargins(response.margins));
            }
        } catch (error) {
            console.error("Erreur lors du chargement des lignes:", error);
            message.error("Erreur lors du chargement des lignes");
            setOrderLines([]);
        } finally {
            setLoadingLines(false);
        }
    }, [saleOrderId, form]);

    const handleOpenInvoiceModal = useCallback(() => {
        setInvoiceModalOpen(true);
    }, [orderLines]);


    const handleGenerateInvoiceAndContract = async (lines) => {

        if (!lines || lines.length === 0) {
            message.error('Veuillez sélectionner au moins une ligne');
            return;
        }

        try {
            // Appel API pour générer la facture/contrat avec les lignes et quantités sélectionnées
            const result = await saleOrdersGenericApi.generateInvoice(saleOrderId, lines);

            // Message de succès adaptatif et ouverture via dialog
            const hasInvoice = result?.data?.invoice?.id;
            const hasContract = result?.data?.contract?.id;

            if (hasInvoice || hasContract) {
                const invoiceNumber = result?.data?.invoice?.number;
                const contractNumber = result?.data?.contract?.number;

                Modal.success({
                    title: 'Création réussie',
                    content: (
                        <div>
                            {hasInvoice && hasContract && (
                                <p>La facture et le contrat ont été générés avec succès :</p>
                            )}
                            {hasInvoice && !hasContract && (
                                <p>La facture a été générée avec succès :</p>
                            )}
                            {!hasInvoice && hasContract && (
                                <p>Le contrat a été généré avec succès :</p>
                            )}

                            <div style={{ marginTop: 16 }}>
                                {hasInvoice && (
                                    <div style={{ marginBottom: 8 }}>
                                        <strong>Facture :</strong>{' '}
                                        <a
                                            href={`/customer-invoices/${result.data.invoice.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                window.open(`/customer-invoices/${result.data.invoice.id}`, '_blank');
                                            }}
                                        >
                                            {invoiceNumber}
                                        </a>
                                    </div>
                                )}

                                {hasContract && (
                                    <div>
                                        <strong>Contrat :</strong>{' '}
                                        <a
                                            href={`/customercontracts/${result.data.contract.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                window.open(`/customercontracts/${result.data.contract.id}`, '_blank');
                                            }}
                                        >
                                            {contractNumber}
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div >
                    ),
                    okText: 'Fermer',
                    width: 500,
                });
            }
            setInvoiceModalOpen(false);

            // Recharger les données de la commande pour mettre à jour l'état de facturation
            await reload(false);

            // Forcer le reload de l'onglet "Objets Liés" pour afficher la facture/contrat créé
            setLinkedObjectsRefreshKey(prev => prev + 1);

        } catch (error) {
            console.error('Erreur lors de la génération:', error);
            message.error(error?.message || 'Erreur lors de la génération');
        }
    };

    // Fonction wrapper pour générer avec toutes les lignes (cas engagement avec abonnement)
    const handleGenerateAllLines = useCallback(async () => {
        // Transformer toutes les lignes normales au format attendu par l'API
        const formattedLines = orderLines
            .filter(line => line.lineType === 0) // Uniquement les lignes normales (pas titres ni sous-totaux)
            .map(line => ({
                line_id: line.lineId,
                qty: line.qty, // Quantité complète de la ligne
                line_type: line.lineType
            }));

        if (formattedLines.length === 0) {
            message.error('Aucune ligne à traiter');
            return;
        }

        await handleGenerateInvoiceAndContract(formattedLines);
    }, [orderLines, saleOrderId, handleGenerateInvoiceAndContract]);


    const handleMarkAsFullyInvoiced = useCallback(() => {
        Modal.confirm({
            title: 'Confirmer l\'action',
            content: 'Voulez-vous vraiment marquer cette commande comme totalement facturée ?',
            okText: 'Confirmer',
            cancelText: 'Annuler',
            onOk: async () => {
                try {
                    await saleOrdersGenericApi.update(saleOrderId, {
                        ord_invoicing_state: ORDER_INVOICING_STATUS.FULLY
                    });
                    message.success('Commande marquée comme facturée');
                    await reload(false);
                } catch (error) {
                    console.error('Erreur lors de la mise à jour du statut:', error);
                    message.error('Erreur lors de la mise à jour du statut');
                }
            }
        });
    }, [saleOrderId, reload]);

    const handleMarkAsFullyDelivered = useCallback(() => {
        Modal.confirm({
            title: 'Confirmer l\'action',
            content: 'Voulez-vous vraiment marquer cette commande comme totalement livrée ?',
            okText: 'Confirmer',
            cancelText: 'Annuler',
            onOk: async () => {
                try {
                    await saleOrdersGenericApi.update(saleOrderId, {
                        ord_delivery_state: ORDER_DELIVERY_STATUS.FULLY
                    });
                    message.success('Commande marquée comme livrée');
                    await reload(false);
                } catch (error) {
                    console.error('Erreur lors de la mise à jour du statut:', error);
                    message.error('Erreur lors de la mise à jour du statut');
                }
            }
        });
    }, [saleOrderId, reload]);


    // Auto-remplir le commercial avec l'utilisateur connecté lors de la création
    useEffect(() => {
        if (!saleOrderId) {
            const currentUser = getUser();
            if (currentUser && currentUser.id) {
                form.setFieldValue('fk_usr_id_seller', currentUser.id);
            }
        }
    }, [saleOrderId, form]);

    // Gérer les erreurs de chargement (ID inexistant ou non autorisé)
    useEffect(() => {
        if (loadError && saleOrderId) {
            const currentPath = window.location.pathname;
            const label = currentPath.includes('/sale-quotations') ? 'devis' : 'commande';
            message.error(`Le ${label} demandé n'existe pas ou vous n'avez pas les droits pour y accéder`);
            if (currentPath.includes('/sale-quotations')) {
                navigate('/sale-quotations');
            } else {
                navigate('/sale-orders');
            }
        }
    }, [loadError, saleOrderId, navigate]);

    // Validation personnalisée pour la date de validité
    const validateValidDate = useCallback((_, value) => {
        if (!value) {
            return Promise.resolve();
        }
        const orderDate = form.getFieldValue('ord_date');
        if (orderDate && value.isBefore(orderDate, 'day')) {
            const label = ordStatus <= ORDER_STATUS.REFUSED_QUOTE ? 'du devis' : 'de la commande';
            return Promise.reject(new Error(`La date de validité doit être supérieure ou égale à la date ${label}`));
        }
        return Promise.resolve();
    }, [form, ordStatus]);

    // Validation personnalisée pour le champ Engagement
    const validateEngagement = useCallback((_, value) => {
        const hasSubscription = orderLines.some(line => line.isSubscription === true || line.isSubscription === 1);
        if (hasSubscription && !value) {
            return Promise.reject(new Error('Le champ Engagement est requis car la commande contient au moins une ligne avec abonnement'));
        }
        return Promise.resolve();
    }, [orderLines]);


    const handleDelete = useCallback(async () => {
        await remove();
    }, [remove]);

    const handleDuplicate = useCallback(async () => {
        try {
            const result = await saleOrdersGenericApi.duplicate(saleOrderId);
            message.success("Enregistrement dupliquée avec succès");
            
            const currentPath = window.location.pathname;
            const basePath = currentPath.includes('/sale-quotations') ? '/sale-quotations' : '/sale-orders';
            navigate(`${basePath}/${result.data.id}`);
        } catch (error) {
            console.error(error);
            message.error("Erreur lors de la duplication");
        }
    }, [saleOrderId, navigate]);

    // Charger les lignes au montage et quand saleOrderId change
    useEffect(() => {
        fetchOrderLines();
    }, [fetchOrderLines]); // eslint-disable-line react-hooks/exhaustive-deps

    // Gérer l'activation/désactivation du formulaire selon ord_status et ordBeingEdited
    useEffect(() => {
        // Si un BL a été livré, le formulaire est toujours désactivé
        if (isLockedByDelivery) {
            setFormDisabled(true);
            return;
        }

        if (ordStatus === ORDER_STATUS.DRAFT) {
            // Brouillon : formulaire actif
            setFormDisabled(false);
        } else if (ordStatus === ORDER_STATUS.FINALIZED && ordBeingEdited === true) {
            // Finalisé mais en cours de modification : formulaire actif
            setFormDisabled(false);
        } else if (ordStatus === ORDER_STATUS.FINALIZED && ordBeingEdited === false) {
            // Finalisé et non en cours de modification : formulaire inactif

            setFormDisabled(true);
        } else if (ordStatus === ORDER_STATUS.CONFIRMED && ordBeingEdited === true) {
            // Confirmé mais en cours de modification : formulaire actif
            setFormDisabled(false);
        } else if (ordStatus === ORDER_STATUS.CONFIRMED && ordBeingEdited === false) {
            // Confirmé et non en cours de modification : formulaire inactif
            setFormDisabled(true);
        } else {
            // Par défaut : formulaire inactif
            setFormDisabled(true);
        }
    }, [ordStatus, ordBeingEdited, isLockedByDelivery]);


    // Gérer l'affichage du bouton Supprimer
    useEffect(() => {
        if (ordInvoicingState === ORDER_INVOICING_STATUS.NOT_INVOICED && ordDeliveryState === ORDER_DELIVERY_STATUS.NOT_DELIVERED && ordStatus != ORDER_STATUS.REFUSED_QUOTE && ordStatus != ORDER_STATUS.CANCELLED) {
            setShowDeleteBtn(true);
        } else {
            setShowDeleteBtn(false);
        }
    }, [ordInvoicingState, ordDeliveryState]);


    // Remplir automatiquement les champs lors du changement de client
    const handlePartnerOnChange = async (partnerId) => {
        if (!partnerId) return; // Pas de partenaire sélectionné, on sort

        // Réinitialiser le contact quand le client change
        form.setFieldValue('fk_ctc_id', null);

        try {
            const response = await partnersApi.get(partnerId);
            const partnerData = response.data;
            const moduleConfig = getModuleConfig();

            // Remplir les champs du formulaire avec les données du partenaire
            const addressParts = [
                partnerData.ptr_address,
                [partnerData.ptr_zip, partnerData.ptr_city].filter(Boolean).join(' '),
            ].filter(Boolean);
            if (addressParts.length > 0) {
                form.setFieldValue('ord_ptr_address', addressParts.join('\n'));
            }
            const deliveryAddress = partnerData.ptr_customer_delivery_address;
            const effectiveDeliveryAddress = deliveryAddress || addressParts.join('\n') || null;
            form.setFieldValue('ord_delivery_address', effectiveDeliveryAddress);
            setShowDeliveryAddress(!!effectiveDeliveryAddress);
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



    // Fonctions handlers pour les boutons (doivent être déclarées avant tabItems)
    const handleSend = useCallback(async () => {
        if (!saleOrderId) {
            message.error("Veuillez enregistrer le document avant de l'envoyer");
            return;
        }

        try {
            message.loading({ content: "Préparation de l'email...", key: "emailPrep" });

            // Générer le PDF
            const response = await saleOrdersGenericApi.printPdf(saleOrderId);
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
    }, [saleOrderId]);

    const handlePrint = useCallback(async () => {
        await handleBizPrint(
            saleOrdersGenericApi.printPdf,
            saleOrderId,
            "Veuillez enregistrer la commande avant de l'imprimer"
        );
    }, [saleOrderId]);

    // Fonction pour déterminer les boutons d'action à afficher
    const statusActionButtons = useMemo(() => {
        const buttons = [];

        if (ordStatus === ORDER_STATUS.DRAFT) {
            buttons.push({
                key: 'finalize',
                label: "Finaliser",
                icon: <LockOutlined />,
                onClick: () => handleChangeStatus(1),
                type: 'primary'
            });
        } else if (ordStatus === ORDER_STATUS.FINALIZED && ordBeingEdited === true) {
            buttons.push({
                key: 'validate',
                label: "Valider les modifications",
                icon: <LockOutlined />,
                onClick: () => handleChangeBeingEdited(false),
                type: 'primary'
            });
        } else if (ordStatus === ORDER_STATUS.FINALIZED && ordBeingEdited === false) {
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
        } else if (ordStatus === ORDER_STATUS.CONFIRMED && ordBeingEdited === true) {
            buttons.push({
                key: 'validate',
                label: "Valider les modifications",
                icon: <LockOutlined />,
                onClick: () => handleChangeBeingEdited(false),
                type: 'primary'
            });
        } else if (ordStatus === ORDER_STATUS.CONFIRMED && ordBeingEdited === false && ordInvoicingState === ORDER_INVOICING_STATUS.NOT_INVOICED && ordDeliveryState === ORDER_DELIVERY_STATUS.NOT_DELIVERED) {
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
    }, [ordStatus, ordBeingEdited, ordDeliveryState, ordInvoicingState, handleConfirmOrder, handleRefuseOrder, handleMarkAsFullyInvoiced, handleMarkAsFullyDelivered]);


    const actionButtons = useMemo(() => {
        const buttons = [];

        // Boutons pour marquer manuellement comme facturé/livré (seulement si commande confirmée et non en édition)
        if (ordStatus === ORDER_STATUS.CONFIRMED && ordBeingEdited === false) {
            // Bouton "Indiquer comme Facturé" si pas encore totalement facturé
            if ((ordInvoicingState === ORDER_INVOICING_STATUS.NOT_INVOICED || ordInvoicingState === ORDER_INVOICING_STATUS.PARTIALLY) && can('sale-orders.edit')) {
                buttons.push({
                    key: 'mark-invoiced',
                    label: "Indiquer comme Facturé",
                    // icon: <CheckCircleOutlined />,
                    onClick: handleMarkAsFullyInvoiced,
                    type: 'secondary'
                });
            }

            // Bouton "Indiquer comme Livré" si pas encore totalement livré
            if ((ordDeliveryState === ORDER_DELIVERY_STATUS.NOT_DELIVERED || ordDeliveryState === ORDER_DELIVERY_STATUS.PARTIALLY) && can('sale-orders.edit')) {
                buttons.push({
                    key: 'mark-delivered',
                    label: "Indiquer comme Livré",
                    // icon: <CheckCircleOutlined />,
                    onClick: handleMarkAsFullyDelivered,
                    type: 'secondary'
                });
            }
        }

        return buttons;
    }, [ordStatus, ordBeingEdited, ordDeliveryState, ordInvoicingState, handleConfirmOrder, handleRefuseOrder, handleMarkAsFullyInvoiced, handleMarkAsFullyDelivered]);

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

                        <Row gutter={[0, 8]} >
                            <Col span={18} className="box"

                                style={{
                                    backgroundColor: "var(--layout-body-bg)",
                                    paddingLeft: '16px',
                                    paddingRight: '16px',
                                }}>

                                <Row gutter={[16, 8]} >
                                    <Col span={4}>
                                        <Form.Item
                                            name="ord_date"
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
                                            name="ord_valid"
                                            label="Date de validité"
                                            rules={[
                                                { required: true, message: "Date de validité requise" },
                                                { validator: validateValidDate }
                                            ]}
                                            dependencies={['ord_date']}
                                        >
                                            <DatePicker
                                                format="DD/MM/YYYY"
                                                style={{ width: '100%' }}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item
                                            name="fk_usr_id_seller"
                                            label="Commercial"
                                            rules={[{ required: true, message: "Commercial requis" }]}
                                        >
                                            <SellerSelect
                                                loadInitially={!saleOrderId ? true : false}
                                                initialData={entity?.seller}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item
                                            name="fk_dur_id"
                                            label="Engagement"
                                            rules={[
                                                { validator: validateEngagement }
                                            ]}
                                        >
                                            <CommitmentDurationSelect
                                                loadInitially={!saleOrderId ? true : false}
                                                initialData={entity?.commitment_duration}
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={[16, 8]}>
                                    <Col span={8}>
                                        <Form.Item
                                            name="fk_ptr_id"
                                            label="Client"
                                            rules={[{ required: true, message: "Client requis" }]}
                                        >
                                            <PartnerSelect
                                                loadInitially={!saleOrderId ? true : false}
                                                initialData={entity?.partner}
                                                filters={{
                                                    is_active: 1,
                                                    OR: { is_prospect: 1, is_customer: 1 }
                                                }}
                                                onChange={handlePartnerOnChange} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="fk_ctc_id" label="Contact Client">
                                            <ContactSelect
                                                key={`ctc-${fkPtrId}`}
                                                initialData={entity?.contact}
                                                filters={{ is_active: 1, ptrId: fkPtrId }}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="ord_refclient" label="Réf client">
                                            <Input />
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
                                            <Form.Item name="ord_ptr_address" style={{ marginBottom: 0 }}>
                                                <TextArea rows={4} placeholder="Adresse complète de facturation" />
                                            </Form.Item>
                                        ) : (
                                            <Form.Item name="ord_delivery_address" style={{ marginBottom: 0 }}>
                                                <TextArea rows={4} placeholder="Adresse complète de livraison" />
                                            </Form.Item>
                                        )}
                                    </Col>
                                    <Col span={8} >
                                        <Form.Item
                                            name="fk_dur_id_payment_condition"
                                            label="Condition de règlement"
                                            rules={[{ required: true, message: "Condition de règlement requise" }]}
                                        >
                                            <PaymentConditionSelect
                                                loadInitially={!saleOrderId ? true : false}
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
                                                loadInitially={!saleOrderId ? true : false}
                                                initialData={entity?.payment_mode} />
                                        </Form.Item>

                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="ord_note" label="Note interne">
                                            <TextArea
                                                rows={1}
                                                placeholder="Notes internes non visibles par le client"
                                            />
                                        </Form.Item>
                                        <Form.Item
                                            name="fk_whs_id"
                                            label="Entrepôt"
                                            rules={[{ required: true, message: "L'entrepôt est obligatoire" }]}
                                            style={{ marginTop: '-4px' }}
                                        >
                                            <WarehouseSelect
                                                loadInitially={!saleOrderId ? true : false}
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
                            <Col span={6} style={{ paddingLeft: '8px', paddingRight: '8px' }} >
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
                                            <Button color="green" variant="solid" size="default" icon={<SaveOutlined />} onClick={() => form.submit()} style={{ width: '100%', margin: "4px" }} >
                                                Enregistrer
                                            </Button>
                                        </Col>
                                    )}
                                </Row>
                                {saleOrderId && ((ordStatus == ORDER_STATUS.FINALIZED && ordBeingEdited === false) || (ordStatus == ORDER_STATUS.CONFIRMED && ordBeingEdited === false) || (ordStatus == ORDER_STATUS.INVOICED)) && (
                                    <Row gutter={8}>
                                        <Col span={12}>
                                            <Button type="secondary" size="default" icon={<MailOutlined />} onClick={handleSend} style={{ width: '100%', margin: "4px" }} disabled={false} >
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

                                {saleOrderId && (
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
                                                    title="Êtes-vous sûr de vouloir supprimer cette element ?"
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
                                {saleOrderId && ordStatus === ORDER_STATUS.CONFIRMED && (ordInvoicingState === ORDER_INVOICING_STATUS.NOT_INVOICED || ordInvoicingState === ORDER_INVOICING_STATUS.PARTIALLY) && ordBeingEdited === false && can('invoices.create') && (
                                    <Row gutter={8}>
                                        <Col span={24}>
                                            {!fkDurId ? (
                                                // Si fk_dur_id est vide : bouton "Générer facture" qui ouvre le modal
                                                <Button
                                                    type="secondary"
                                                    size="default"
                                                    style={{ width: '100%', margin: "4px" }}
                                                    disabled={false}
                                                    onClick={handleOpenInvoiceModal}
                                                >
                                                    Générer la facture
                                                </Button>
                                            ) : (
                                                // Si fk_dur_id n'est pas vide : bouton "Générer facture et contrat" avec confirmation
                                                <Popconfirm
                                                    title="Vous confirmez la création du contrat et de la facture de mise en service ?"
                                                    description=""
                                                    onConfirm={handleGenerateAllLines}
                                                    okText="Oui, générer"
                                                    cancelText="Annuler"
                                                    okButtonProps={{ danger: false, disabled: false }}
                                                    cancelButtonProps={{ disabled: false }}
                                                >
                                                    <Button type="secondary" size="default" style={{ width: '100%', margin: "4px" }}
                                                        disabled={false}>
                                                        Générer facture et contrat
                                                    </Button>
                                                </Popconfirm>
                                            )}

                                        </Col>
                                    </Row>
                                )}
                                {isLockedByDelivery && (
                                    <Alert
                                        title="Commande verrouillée"
                                        description="Cette commande ne peut plus être modifiée car un bon de livraison a été réalisé."
                                        type="warning"
                                        showIcon
                                        style={{ margin: '16px 0px 0' }}
                                    />
                                )}
                            </Col>
                        </Row >

                        {/* Section 3: Lignes  */}
                        < div style={{ marginTop: '24px' }
                        }>
                            <BizDocumentLinesTable
                                ref={linesTableRef}
                                dataSource={orderLines}
                                loading={loadingLines}
                                disabled={formDisabled}
                                documentId={saleOrderId}
                                saveLineApi={saleOrdersGenericApi.saveLine}
                                deleteLineApi={saleOrdersGenericApi.deleteLine}
                                updateLinesOrderApi={saleOrdersGenericApi.updateLinesOrder}
                                onLinesChanged={fetchOrderLines}
                                config={getModuleConfig()}
                                onRequestDocumentCreation={handleRequestDocumentCreation}
                            />
                        </div >

                        {/* Section 4: Totaux et Marges */}
                        < div style={{ paddingTop: '16px', }}>
                            <Row gutter={16}>
                                <Col span={10}>
                                    <BizDocumentMarginTable
                                        dataSource={marginData}
                                        loading={loadingLines}
                                    />
                                </Col>
                                <Col span={6}></Col>
                                <Col span={8}>
                                    <BizDocumentTotalsCard
                                        totals={totals}
                                        config={getModuleConfig().totalsConfig}
                                    />
                                </Col>
                            </Row>
                        </div >
                    </>
                )
            }
        ];

        // Ajouter l'onglet "Objets Liés" uniquement si ord_id existe
        if (saleOrderId) {
            items.push({
                key: 'linked-objects',
                label: 'Objets Liés',
                children: (
                    <Suspense fallback={<TabLoader />}>
                        <LinkedObjectsTab
                            key={linkedObjectsRefreshKey}
                            module="sale-orders"
                            recordId={saleOrderId}
                            apiFunction={saleOrdersGenericApi.getLinkedObjects}
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
                            module="sale-orders"
                            recordId={saleOrderId}
                            getDocumentsApi={saleOrdersGenericApi.getDocuments}
                            uploadDocumentsApi={saleOrdersGenericApi.uploadDocuments}
                            onCountChange={setDocumentsCount}
                        />
                    </Suspense>
                )
            });
        }

        return items;
    }, [saleOrderId, handleSend, handlePrint, statusActionButtons, actionButtons, linkedObjectsRefreshKey, ordStatus, ordBeingEdited, orderLines, fkPtrId, form, reload]);

    const handleBack = useCallback(() => {
        // Déterminer l'URL de retour en fonction de l'URL actuelle
        const currentPath = window.location.pathname;
        if (currentPath.includes('/sale-quotations')) {
            navigate('/sale-quotations');
        } else {
            navigate('/sale-orders');
        }
    }, [navigate]);


    return (
        <PageContainer

            title={
                <Space>
                    {pageLabel ? `${ordStatus <= 2 ? 'Devis' : 'Commande'} - ${pageLabel}`  : (saleOrderId ? "" : "Nouveau devis")}
                </Space>
            }

            headerStyle={{
                center: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                        <Space>
                            {formatStatus(ordStatus)}
                            {ordInvoicingState != null && formatInvoicingState(ordInvoicingState)}
                            {ordDeliveryState != null && formatDeliveryState(ordDeliveryState)}
                        </Space>
                        {(ordStatus === 2 || ordStatus === 4) && ordCancelReason && (
                            <div style={{ fontSize: '12px', color: '#ff4d4f' }}>
                                Motif {ordStatus === 2 ? 'de refus' : 'd\'annulation'} : {ordCancelReason}
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
                            ord_status: 0,
                            ord_date: dayjs(),
                            ord_valid: dayjs().add(15, 'days'),
                        }}
                    >
                        <Form.Item name="ord_id" hidden>
                            <Input />
                        </Form.Item>
                        <Form.Item name="ord_status" hidden>
                            <Input />
                        </Form.Item>
                        <Tabs
                            //defaultActiveKey="fiche"                          
                            items={tabItems}
                            styles={{
                                content: { padding: 8, },
                            }}
                        />

                    </Form></div>
            </Spin>

            {/* Modal de refus de commande */}
            <Modal
                title="Refuser la commande"
                centered={true}
                destroyOnHidden={true}
                open={cancelModalOpen}
                onOk={handleRefuseOrderSubmit}
                onCancel={() => {
                    setCancelModalOpen(false);
                    setCancelReason('');
                }}
                okText="Refuser"
                cancelText="Annuler"
                okButtonProps={{ danger: true }}
            >
                <Form.Item
                    label="Raison du refus"
                    required
                    style={{ marginTop: '20px' }}
                >
                    <TextArea
                        rows={4}
                        placeholder="Veuillez saisir la raison du refus de la commande"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                    />
                </Form.Item>
            </Modal>

            {/* Modal de sélection des lignes à facturer */}
            <BizLineSelectionModal
                open={invoiceModalOpen}
                title="Sélectionner les lignes à facturer"
                okText="Générer la facture"
                dataSource={orderLines}
                onOk={handleGenerateInvoiceAndContract}
                onCancel={() => setInvoiceModalOpen(false)}
            />

            {/* Dialog d'envoi d'email */}
            {saleOrderId && emailDialogOpen && (
                <Suspense fallback={null}>
                    <EmailDialog
                        open={emailDialogOpen}
                        onClose={() => {
                            setEmailDialogOpen(false);
                            setEmailAttachments([]);
                        }}
                        emailContext="sale"
                        templateType="sale"
                        documentId={saleOrderId}
                        partnerId={fkPtrId}
                        defaultRecipientId={fkCtcId}
                        initialAttachments={emailAttachments}
                    />
                </Suspense>
            )}
        </PageContainer>
    );
}
