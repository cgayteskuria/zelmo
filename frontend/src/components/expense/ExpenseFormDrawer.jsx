import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Drawer, Form, Input, Button, DatePicker, Row, Col, Space, Upload, Table, InputNumber, Spin, Image, Empty, Popconfirm, Divider, Tooltip } from "antd";
import { message } from '../../utils/antdStatic';
import {  DeleteOutlined, PlusOutlined, SaveOutlined, InboxOutlined, FileImageOutlined, FilePdfOutlined, EyeOutlined, RotateRightOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { taxsApi, documentsApi, expenseOcrApi, expenseCategoriesApi } from "../../services/api";
import ExpenseCategorySelect from "../select/ExpenseCategorySelect";
import TaxSelect from "../select/TaxSelect";
import { formatCurrency } from "../../utils/formatters";
import { TAX_TYPE } from "../../utils/taxFormatters";
import { useEntityForm } from "../../hooks/useEntityForm";
import { compressImage, rotateImage } from "../../utils/image";

const { Dragger } = Upload;
const { TextArea } = Input;

export default function ExpenseFormDrawer({ open, onClose, expenseReportId, expenseId = null, disabled = false, onSuccess, periodFrom = null, periodTo = null, initialFile = null, expensesApi }) {
    const [form] = Form.useForm();
    const [saving, setSaving] = useState(false);
    const [lines, setLines] = useState([]);
    const [excType, setExcType] = useState(null);

    const selectedCategoryId = Form.useWatch('fk_exc_id', form);
    useEffect(() => {
        if (!selectedCategoryId) { setExcType(null); return; }
        expenseCategoriesApi.get(selectedCategoryId)
            .then(res => setExcType(res.data?.exc_type ?? null))
            .catch(() => setExcType(null));
    }, [selectedCategoryId]);
    const [receiptFile, setReceiptFile] = useState(null);
    const [receiptUrl, setReceiptUrl] = useState(null);
    const [receiptFileType, setReceiptFileType] = useState(null);
    const [ocrEnabled, setOcrEnabled] = useState(null);
    const [ocrProcessing, setOcrProcessing] = useState(false);
    const [dateOutOfPeriod, setDateOutOfPeriod] = useState(false);
    const [rotating, setRotating] = useState(false);

    const blobUrlsRef = useRef(new Set());

    const isEdit = !!expenseId;

    // Vérifier si la date est dans la période
    const checkDateInPeriod = useCallback((date) => {
        if (!date || (!periodFrom && !periodTo)) {
            setDateOutOfPeriod(false);
            return;
        }
        const isOutside = (periodFrom && date.isBefore(periodFrom, 'day')) ||
            (periodTo && date.isAfter(periodTo, 'day'));
        setDateOutOfPeriod(isOutside);
    }, [periodFrom, periodTo]);

    // Référence pour savoir si le fichier initial a déjà été traité
    const initialFileProcessedRef = useRef(false);

    // Callback pour transformer les données chargées
    const onDataLoaded = useCallback(async (data) => {
        const expense = data.data || data;

        // Transformer les données pour le formulaire
        form.setFieldsValue({
            exp_date: expense.exp_date ? dayjs(expense.exp_date) : null,
            fk_exc_id: expense.fk_exc_id || expense.category?.id,
            exp_merchant: expense.exp_merchant,
            exp_notes: expense.exp_notes,
        });

        // Charger les lignes
        if (expense.lines && expense.lines.length > 0) {
            const loadedLines = expense.lines.map((line, index) => ({
                key: index + 1,
                id: line.id,
                fk_tax_id: line.tax.id,
                exl_amount_ht: parseFloat(line.exl_amount_ht) || 0,
                exl_amount_tva: parseFloat(line.exl_amount_tva) || 0,
                exl_amount_ttc: parseFloat(line.exl_amount_ttc) || 0,
                exl_tax_rate: parseFloat(line.tax.exl_tax_rate) || 0,
            }));
            setLines(loadedLines);
        }

        // Charger le justificatif       
        if (expense.fk_doc_id) {
            try {
                const response = await documentsApi.download(expense.fk_doc_id);
                const blob = response instanceof Blob ? response : null;

                if (!blob) {
                    throw new Error("Format de réponse invalide");
                }

                const url = URL.createObjectURL(blob);
                blobUrlsRef.current.add(url); // ✅ Tracker l'URL

                setReceiptUrl(url); // ✅ Une seule fois
                setReceiptFileType(blob.type);
            } catch (error) {
                message.error("Erreur lors du chargement du document");
                console.error("Erreur lors du téléchargement du document", error);
            }
        }
    }, [form]);

    // Utilisation de useEntityForm pour le chargement et la suppression
    const { loading, remove, entity } = useEntityForm({
        api: expensesApi,
        entityId: expenseId,
        idField: 'id',
        form,
        open,
        onDataLoaded,
        onDelete: () => {
            onSuccess?.();
            onClose?.();
        },
        messages: {
            delete: 'Dépense supprimée',
            loadError: 'Erreur lors du chargement de la dépense',
            deleteError: 'Erreur lors de la suppression',
        },
    });

    // Reset à l'ouverture pour nouvelle dépense
    useEffect(() => {
        if (!open) return; // 👈 Add this guard

        if (!expenseId) {
            form.resetFields();
            setLines([{
                key: Date.now(),
                fk_tax_id: null,
                exl_tax_rate: 0,
                exl_amount_ht: 0,
                exl_amount_tva: 0,
                exl_amount_ttc: 0
            }]);
            setReceiptFile(null);
            setReceiptUrl(null);
            setReceiptFileType(null);
            setDateOutOfPeriod(false);
        }
    }, [open, expenseId, form]);


    useEffect(() => {
        // Cleanup quand le drawer se ferme
        return () => {
            if (!open) {
                // Nettoyer toutes les URLs blob trackées
                blobUrlsRef.current.forEach(url => {
                    URL.revokeObjectURL(url);
                });
                blobUrlsRef.current.clear();

                // Reset des états
                setLines([]);
                setReceiptFile(null);
                setReceiptUrl(null);
                setReceiptFileType(null);
                setDateOutOfPeriod(false);
                form.resetFields();
            }
        };
    }, [open]); // ✅ Ne dépend que de 'open'

    // Calcul des totaux
    const totals = useMemo(() => {
        let totalHT = 0;
        let totalTVA = 0;
        let totalTTC = 0;

        lines.forEach(line => {
            const ht = parseFloat(line.exl_amount_ht) || 0;
            const taxRate = line.exl_tax_rate || 0;
            const tva = ht * (taxRate / 100);
            const ttc = ht + tva;

            totalHT += ht;
            totalTVA += tva;
            totalTTC += ttc;
        });

        return lines.reduce((acc, line) => ({
            totalHT: acc.totalHT + (parseFloat(line.exl_amount_ht) || 0),
            totalTVA: acc.totalTVA + (parseFloat(line.exl_amount_tva) || 0),
            totalTTC: acc.totalTTC + (parseFloat(line.exl_amount_ttc) || 0),
        }), { totalHT: 0, totalTVA: 0, totalTTC: 0 });
    }, [lines]);

    // Gestion des lignes TVA
    const addLine = useCallback(() => {
        setLines(prev => [...prev, {
            key: Date.now(),
            fk_tax_id: null,
            exl_tax_rate: 0,
            exl_amount_ht: 0,
            exl_amount_tva: 0,
            exl_amount_ttc: 0
        }]);
    }, []);

    const removeLine = useCallback((index) => {
        if (lines.length === 1) {
            message.warning("Une dépense doit avoir au moins une ligne");
            return;
        }
        setLines(prev => prev.filter((_, i) => i !== index));
    }, [lines.length]);

    const updateLine = useCallback((index, field, value) => {
        setLines(prev => {
            const newLines = [...prev];
            newLines[index][field] = value;

            // Recalculer les montants si nécessaire
            if (field === "exl_amount_ht" || field === "exl_tax_rate" || field === "fk_tax_id") {
                const ht = parseFloat(newLines[index].exl_amount_ht) || 0;
                const taxRate = parseFloat(newLines[index].exl_tax_rate) || 0;

                newLines[index].exl_tax_rate = taxRate;
                newLines[index].exl_amount_tva = Math.round(ht * (taxRate / 100) * 100) / 100;
                newLines[index].exl_amount_ttc = Math.round((ht + newLines[index].exl_amount_tva) * 100) / 100;

             } else if (field === "exl_amount_ttc") {
                const ttc = parseFloat(newLines[index].exl_amount_ttc) || 0;
                const taxRate = parseFloat(newLines[index].exl_tax_rate) || 0;

                // Gérer le cas taxRate = 0
                if (taxRate === 0) {
                    // Si pas de taxe, TTC = HT
                    newLines[index].exl_amount_ht = Math.round(ttc * 100) / 100;
                    newLines[index].exl_amount_tva = 0;
                } else {
                    // Calcul normal avec taxe
                    const ht = ttc / (1 + taxRate / 100);
                    const tva = ttc - ht;

                    newLines[index].exl_amount_ht = Math.round(ht * 100) / 100;
                    newLines[index].exl_amount_tva = Math.round(tva * 100) / 100;
                }
            }

            return newLines;
        });
    }, []);

    const handleTaxChange = useCallback(async (index, taxId, option) => {
        setLines(prev => {
            const newLines = [...prev];
            newLines[index].fk_tax_id = taxId;
            return newLines;
        });

        if (taxId) {
            try {
                const response = await taxsApi.get(taxId);
                const tax = response.data;

                if (tax?.tax_rate !== undefined) {
                    updateLine(index, "exl_tax_rate", tax.tax_rate);
                }
            } catch (error) {
                console.error("Erreur lors du chargement de la taxe", error);
            }
        } else {
            updateLine(index, "exl_tax_rate", 0);
        }
    }, [updateLine]);

    const handleRotateImage = useCallback(async () => {
        if (!receiptFile || !receiptFileType?.startsWith('image/')) {
            message.warning("Seules les images peuvent être pivotées");
            return;
        }

        setRotating(true);
        try {
            // Pivoter l'image de 90 degrés
            const rotatedFile = await rotateImage(receiptFile, 90);

            // Mettre à jour le fichier et l'aperçu
            setReceiptFile(rotatedFile);

            // Révoquer l'ancienne URL et créer une nouvelle
            if (receiptUrl) {
                blobUrlsRef.current.delete(receiptUrl);
                URL.revokeObjectURL(receiptUrl);
            }

            const newUrl = URL.createObjectURL(rotatedFile);
            blobUrlsRef.current.add(newUrl);
            setReceiptUrl(newUrl);

            message.success("Image pivotée de 90°");
        } catch (error) {
            console.error("Erreur lors de la rotation:", error);
            message.error("Erreur lors de la rotation de l'image");
        } finally {
            setRotating(false);
        }
    }, [receiptFile, receiptFileType, receiptUrl]);

    // Fonction isolée pour vérifier le statut
    const checkOcrStatus = useCallback(async () => {
        // Si on a déjà une réponse (true ou false), on ne rappelle pas l'API
        if (ocrEnabled !== null) return ocrEnabled;

        try {
            const response = await expenseOcrApi.isEnabled();
            const status = response.data?.ocr_enabled || false;
            setOcrEnabled(status);
            return status;
        } catch (error) {
            setOcrEnabled(false);
            return false;
        }
    }, [ocrEnabled]);

    // Le useEffect appelle toujours la fonction au montage
    useEffect(() => {
        if (open && !isEdit) {
            checkOcrStatus();
        }
    }, [open, isEdit, checkOcrStatus]);

    //  Gestion du justificatif 
    const handleReceiptUpload = useCallback(async (file) => {

        // Validation de la taille
        const maxSize = 5 * 1024 * 1024; // 5 Mo
        if (file.size > maxSize) {
            message.error("Le fichier est trop volumineux (max 5 Mo)");
            return false;
        }

        const isOcrActive = await checkOcrStatus();

        let processedFile = file;

        // Compresser l'image si nécessaire
        if (file.type.startsWith('image/')) {

            try {
                processedFile = await compressImage({
                    file: file,
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1920,
                    quality: 0.8
                });

            } catch (error) {
                console.error("❌ Erreur compression:", error);
                message.warning("Impossible de compresser l'image, utilisation du fichier original");
                processedFile = file;
            }
        }

        // Cas 1: Nouvelle dépense (pas encore créée)
        if (!expenseId) {
            setReceiptFile(processedFile);
            setReceiptFileType(processedFile.type);

            const url = URL.createObjectURL(processedFile);
            blobUrlsRef.current.add(url);
            setReceiptUrl(url);

            // Si OCR est activé, traiter le fichier
            if (isOcrActive) {
                setOcrProcessing(true);
                try {
                    const ocrResponse = await expenseOcrApi.processReceipt(processedFile);
                    if (ocrResponse.success && ocrResponse.data) {
                        const ocrData = ocrResponse.data;

                        // Pré-remplir le formulaire avec les données OCR
                        form.setFieldsValue({
                            exp_date: ocrData.exp_date ? dayjs(ocrData.exp_date) : null,
                            exp_merchant: ocrData.exp_merchant || undefined,
                            fk_exc_id: ocrData.fk_exc_id || undefined,
                            exp_notes: ocrData.notes || undefined,
                        });

                        // Vérifier la date si elle existe
                        if (ocrData.exp_date) {
                            checkDateInPeriod(dayjs(ocrData.exp_date));
                        }

                        // Pré-remplir les lignes si disponibles
                        if (ocrData.lines && ocrData.lines.length > 0) {
                            const ocrLines = ocrData.lines.map((line, index) => ({
                                key: Date.now() + index,
                                fk_tax_id: line.fk_tax_id || null,
                                exl_tax_rate: line.exl_tax_rate || 0,
                                exl_amount_ht: line.exl_amount_ht || 0,
                                exl_amount_tva: line.exl_amount_tva || 0,
                                exl_amount_ttc: line.exl_amount_ttc || 0,
                            }));
                            setLines(ocrLines);
                        }

                        message.success("Données extraites du justificatif");
                    }
                } catch (error) {
                    console.error("Erreur OCR:", error);
                    message.warning("Impossible d'extraire les données du justificatif");
                } finally {
                    setOcrProcessing(false);
                }
            }

            return false; // Empêcher l'upload automatique
        }

        // Cas 2: Dépense existante, upload immédiat
        try {
            const response = await expensesApi.uploadReceipt(expenseId, processedFile);

            const url = response.data.url;
            blobUrlsRef.current.add(url); // ✅ Tracker l'URL

            setReceiptUrl(url);
            setReceiptFileType(processedFile.type);
            message.success("Justificatif uploadé");
        } catch (error) {
            console.error("Erreur upload:", error);
            message.error("Erreur lors de l'upload du justificatif");
        }

        return false; // Empêcher l'upload automatique d'Ant Design
    }, [expenseId, checkOcrStatus, form, checkDateInPeriod]);

    // Traiter le fichier initial (drag & drop depuis la liste)
    useEffect(() => {
        if (open && initialFile && !isEdit && !initialFileProcessedRef.current) {
            initialFileProcessedRef.current = true;
            // Attendre que l'OCR soit vérifié puis traiter le fichier
            const processFile = async () => {
                // Petit délai pour s'assurer que ocrEnabled est mis à jour
                await new Promise(resolve => setTimeout(resolve, 150));
                handleReceiptUpload(initialFile);
            };
            processFile();
        }

        // Reset le flag quand le drawer se ferme
        if (!open) {
            initialFileProcessedRef.current = false;
        }
    }, [open, initialFile, isEdit, handleReceiptUpload]);

    // Sauvegarde
    const handleSubmit = async (values) => {
        if (lines.length === 0 || !lines.some(l => l.exl_amount_ht > 0)) {
            message.error("Veuillez ajouter au moins une ligne avec un montant");
            return;
        }

        const invalidAmounts = lines.some(line => !line.exl_amount_ht || line.exl_amount_ht <= 0);
        if (invalidAmounts) {
            message.error("Chaque ligne doit avoir un montant HT supérieur à 0");
            return;
        }
        const missingTax = lines.some(line => !line.fk_tax_id);
        if (missingTax) {
            message.error("Veuillez sélectionner une TVA pour chaque ligne");
            return;
        }

        setSaving(true);
        try {
            const data = {
                fk_exr_id: expenseReportId,
                fk_exc_id: values.fk_exc_id,
                exp_date: values.exp_date?.format("YYYY-MM-DD"),
                exp_description: values.exp_description,
                exp_merchant: values.exp_merchant,
                exp_payment_method: values.exp_payment_method,
                exp_notes: values.exp_notes,
                lines: lines,
                // Indiquer si le justificatif a été supprimé (en mode édition uniquement)
                ...(isEdit && !receiptFile && !receiptUrl && { delete_receipt: true })
            };

            if (isEdit) {
                await expensesApi.update(expenseId, data);
                message.success("Dépense mise à jour");
            } else {
                await expensesApi.createWithReceipt(data, receiptFile);
                message.success("Dépense créée");
            }

            onSuccess?.();
            onClose();
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || "Erreur lors de la sauvegarde";
            if (Array.isArray(errorMsg)) {
                message.error(errorMsg.join(' | '));
            } else if (typeof errorMsg === 'object') {
                const allMessages = Object.values(errorMsg).flat().join(' | ');
                message.error(allMessages);
            } else {
                message.error(errorMsg);
            }
        } finally {
            setSaving(false);
        }
    };

    // Colonnes du tableau des lignes
    const lineColumns = [
        {
            title: "Mt. HT",
            dataIndex: "exl_amount_ht",
            key: "exl_amount_ht",
            align: "right",
            width: 120,
            render: (_, record, index) => (
                <div>
                    <InputNumber
                    
                        value={record.exl_amount_ht}
                        onChange={(v) => updateLine(index, "exl_amount_ht", v)}
                        precision={2}
                        min={0.01}  // ✅ Minimum > 0
                        style={{ width: "100%" }}
                        disabled={disabled}
                        status={!record.exl_amount_ht || record.exl_amount_ht <= 0 ? 'error' : undefined}  // ✅ Rouge si vide ou 0
                    />
                    {(!record.exl_amount_ht || record.exl_amount_ht <= 0) && (
                        <div style={{ color: '#ff4d4f', fontSize: '12px', marginTop: '4px' }}>
                            Montant requis
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: "TVA",
            dataIndex: "fk_tax_id",
            key: "fk_tax_id",
            width: 120,
            align: "right",
            render: (_, record, index) => (
                <div>
                    <TaxSelect
                        value={record.fk_tax_id ?? undefined}
                        selectDefault={true}
                        loadInitially={true}
                        onDefaultSelected={(taxId) => handleTaxChange(index, taxId)}
                        filters={{ tax_use: TAX_TYPE.PURCHASE, tax_is_active: 1, ...(excType ? { tax_scope: excType } : {}) }}
                        onChange={(taxId, option) => handleTaxChange(index, taxId, option)}
                        style={{ width: "100%" }}
                        disabled={disabled}
                        allowClear={false}  // ✅ Empêche la suppression
                        status={!record.fk_tax_id ? 'error' : undefined}  // ✅ Affiche en rouge si vide
                    />
                    {!record.fk_tax_id && (
                        <div style={{ color: '#ff4d4f', fontSize: '12px', marginTop: '4px' }}>
                            TVA requise
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: "Montant TVA",
            dataIndex: "exl_amount_tva",
            key: "exl_amount_tva",
            width: 100,
            align: "right",
            render: (_, record) => formatCurrency(record.exl_amount_tva || 0),
        },
        {
            title: "TTC",
            dataIndex: "exl_amount_ttc",
            key: "exl_amount_ttc",
            width: 110,
            align: "right",
            render: (_, record, index) => (
                <InputNumber
                    value={record.exl_amount_ttc}
                    onChange={(v) => updateLine(index, "exl_amount_ttc", v)}
                    precision={2}
                    min={0}
                    style={{ width: "100%" }}
                    disabled={disabled}
                />
            ),
        },
        {
            title: "",
            key: "actions",
            width: 40,
            render: (_, record, index) =>
                lines.length > 1 && !disabled && (
                    <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => removeLine(index)}
                    />
                ),
        },
    ];

    // Déterminer si le justificatif est une image ou un PDF
    const isImage = receiptFileType?.startsWith('image/');
    const isPdf = receiptFileType === 'application/pdf';

    return (
        <Drawer
            title={isEdit ? "Modifier la dépense" : "Nouvelle dépense"}
            open={open}
            onClose={onClose}         
            styles={{
                wrapper: { width: 1050 },
            }}
            forceRender
            destroyOnHidden
            footer={
                !disabled && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        {isEdit ? (
                            <Popconfirm
                                title="Supprimer cette dépense ?"
                                description="Cette action est irréversible."
                                onConfirm={remove}
                                okText="Supprimer"
                                cancelText="Annuler"
                                okButtonProps={{ danger: true }}
                            >
                                <Button danger icon={<DeleteOutlined />} loading={loading}>
                                    Supprimer
                                </Button>
                            </Popconfirm>
                        ) : (
                            <div />
                        )}
                        <Space>
                            <Button onClick={onClose}>Annuler</Button>
                            <Button
                                type="primary"
                                icon={<SaveOutlined />}
                                loading={saving}
                                onClick={() => form.submit()}
                            >
                                {isEdit ? "Mettre à jour" : "Créer"}
                            </Button>
                        </Space>
                    </div>
                )
            }
        >
            <Spin spinning={loading}>
                <Row gutter={24}>
                    {/* Colonne gauche : Justificatif */}
                    <Col span={10}>
                        <div style={{
                            border: "1px solid #d9d9d9",
                            borderRadius: 8,
                            padding: 16,
                            height: "100%",
                            minHeight: 500,
                            display: "flex",
                            flexDirection: "column"
                        }}><Spin spinning={ocrProcessing} tip="Analyse OCR en cours...">
                                {receiptUrl ? (
                                    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                                        {/* ✅ Bouton de rotation pour les images */}
                                        {isImage && !disabled && !isEdit && (
                                            <div style={{ marginBottom: 8, textAlign: 'center' }}>
                                                <Tooltip title="Pivoter l'image de 90° dans le sens horaire">
                                                    <Button
                                                        icon={<RotateRightOutlined />}
                                                        onClick={handleRotateImage}
                                                        loading={rotating}
                                                        size="small"
                                                    >
                                                        Pivoter
                                                    </Button>
                                                </Tooltip>
                                            </div>
                                        )}

                                        <div style={{
                                            flex: 1,
                                            display: "flex",
                                            justifyContent: "center",
                                            alignItems: "center",
                                            backgroundColor: "#fafafa",
                                            borderRadius: 8,
                                            overflow: "hidden"
                                        }}>
                                            {isImage ? (
                                                <Image
                                                    src={receiptUrl}
                                                    alt="Justificatif"
                                                    style={{ maxWidth: "100%", height: "auto", maxHeight: 450 }}
                                                    preview={{
                                                        cover: <EyeOutlined />
                                                    }}
                                                />
                                            ) : isPdf ? (
                                                <iframe
                                                    src={receiptUrl}
                                                    style={{ width: "100%", height: 450, border: "none" }}
                                                    title="Justificatif PDF"
                                                />
                                            ) : (
                                                <div style={{ textAlign: "center", padding: 40 }}>
                                                    <FilePdfOutlined style={{ fontSize: 48, color: "#999" }} />
                                                    <p>Fichier joint</p>
                                                    <Button
                                                        type="link"
                                                        href={receiptUrl}
                                                        target="_blank"
                                                        icon={<EyeOutlined />}
                                                    >
                                                        Ouvrir
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                        <Tooltip title="Supprimer le justificatif">
                                            <Button
                                                danger
                                                icon={<DeleteOutlined />}
                                                style={{ width: "100%", marginTop: 10 }}
                                                onClick={() => {
                                                    if (receiptUrl) {
                                                        blobUrlsRef.current.delete(receiptUrl);
                                                        URL.revokeObjectURL(receiptUrl);
                                                    }
                                                    setReceiptFile(null);
                                                    setReceiptUrl(null);
                                                    setReceiptFileType(null);
                                                    message.success("Justificatif supprimé");
                                                }}
                                            >
                                                Supprimer
                                            </Button>
                                        </Tooltip>
                                    </div>
                                ) : (
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                                        {!disabled ? (

                                            <Dragger
                                                beforeUpload={handleReceiptUpload}
                                                showUploadList={false}
                                                accept=".jpg,.jpeg,.png,.pdf"
                                                style={{
                                                    minHeight: 450,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                disabled={ocrProcessing}
                                            >
                                                <p className="ant-upload-drag-icon">
                                                    <InboxOutlined />
                                                </p>
                                                <p className="ant-upload-text">
                                                    Cliquez ou glissez un fichier ici
                                                </p>
                                                <p className="ant-upload-hint">
                                                    PDF ou image (JPG, PNG) - Max 5 Mo
                                                    {ocrEnabled && (
                                                        <>
                                                            <br />
                                                            <strong>OCR activé</strong> - Les données seront extraites automatiquement
                                                        </>
                                                    )}
                                                </p>
                                            </Dragger>

                                        ) : (
                                            <Empty
                                                image={<FileImageOutlined style={{ fontSize: 64, color: "#ccc" }} />}
                                                description="Aucun justificatif"
                                            />
                                        )}
                                    </div>
                                )}
                            </Spin>
                        </div>
                    </Col>

                    {/* Colonne droite : Formulaire */}
                    <Col span={14}>
                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={handleSubmit}
                            disabled={disabled}
                        >
                            <Row gutter={16}>
                                <Col span={8}>
                                    <Form.Item
                                        name="exp_date"
                                        label="Date"
                                        rules={[{ required: true, message: "Date requise" }]}
                                        help={dateOutOfPeriod && (
                                            <span style={{ color: '#faad14' }}>
                                                Date hors période de la note de frais
                                            </span>
                                        )}
                                    >
                                        <DatePicker
                                            format="DD/MM/YYYY"
                                            placeholder="Sélectionner la date"
                                            onChange={checkDateInPeriod}
                                            status={dateOutOfPeriod ? 'warning' : undefined}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item
                                        name="fk_exc_id"
                                        label="Catégorie"
                                        rules={[{ required: true, message: "Catégorie requise" }]}
                                    >
                                        <ExpenseCategorySelect
                                            loadInitially={!expenseId}
                                            initialData={entity?.category}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item
                                        name="exp_merchant"
                                        label="Commerçant"
                                        rules={[{ required: true, message: "Commerçant requis" }]}
                                    >
                                        <Input placeholder="Nom du commerçant" />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Form.Item name="exp_notes" label="Notes">
                                <TextArea rows={2} placeholder="Notes additionnelles (optionnel)" />
                            </Form.Item>

                            <Divider titlePlacement="left">Lignes</Divider>

                            <Table
                                dataSource={lines}
                                columns={lineColumns}
                                pagination={false}
                                size="small"
                                rowKey="key"
                                footer={() =>
                                    !disabled && (
                                        <Button
                                            type="dashed"
                                            onClick={addLine}
                                            disabled={lines.length >= 4}
                                            icon={<PlusOutlined />}
                                            block
                                        >
                                            Ajouter une ligne
                                        </Button>
                                    )
                                }
                            />

                            <Divider titlePlacement="left">Totaux</Divider>

                            <div style={{
                                backgroundColor: "#fafafa",
                                padding: 16,
                                borderRadius: 8,
                                textAlign: "right"
                            }}>
                                <Row>
                                    <Col span={12}><strong>Total HT :</strong></Col>
                                    <Col span={12}>{formatCurrency(totals.totalHT)}</Col>
                                </Row>
                                <Row style={{ marginTop: 8 }}>
                                    <Col span={12}><strong>Total TVA :</strong></Col>
                                    <Col span={12}>{formatCurrency(totals.totalTVA)}</Col>
                                </Row>
                                <Row style={{ marginTop: 8 }}>
                                    <Col span={12}>
                                        <strong style={{ fontSize: 16 }}>Total TTC :</strong>
                                    </Col>
                                    <Col span={12}>
                                        <strong style={{ fontSize: 16 }}>
                                            {formatCurrency(totals.totalTTC)}
                                        </strong>
                                    </Col>
                                </Row>
                            </div>
                        </Form>
                    </Col>
                </Row>
            </Spin>
        </Drawer>
    );
}