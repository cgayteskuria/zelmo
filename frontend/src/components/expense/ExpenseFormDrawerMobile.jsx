import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
    Drawer, Form, Input, Button, DatePicker, Row, Col, Space,
    InputNumber, message, Spin, Image, Empty, Divider, Alert,
    Card, Collapse, FloatButton, Modal, Popconfirm
} from "antd";
import {
    DeleteOutlined, PlusOutlined, SaveOutlined, CameraOutlined,
    FileImageOutlined, EyeOutlined, RotateRightOutlined, CloseOutlined,
    CheckOutlined, PictureOutlined, DollarOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import { taxsApi, documentsApi, expenseOcrApi, expenseCategoriesApi } from "../../services/api";
import ExpenseCategorySelect from "../select/ExpenseCategorySelect";
import TaxSelect from "../select/TaxSelect";
import { formatCurrency } from "../../utils/formatters";
import { TAX_TYPE } from "../../utils/taxFormatters";
import { useEntityForm } from "../../hooks/useEntityForm";
import { compressImage, rotateImage } from "../../utils/image";

const { TextArea } = Input;
const { Panel } = Collapse;

export default function ExpenseFormDrawerMobile({
    open,
    onClose,
    expenseReportId,
    expenseId = null,
    disabled = false,
    onSuccess,
    periodFrom = null,
    periodTo = null,
    initialFile = null,
    expensesApi,
    autoCapture = false
}) {
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
    const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
    const [activeStep, setActiveStep] = useState('photo'); // photo, details, lines

    const blobUrlsRef = useRef(new Set());
    const fileInputRef = useRef(null);

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

    const initialFileProcessedRef = useRef(false);

    // Callback pour transformer les données chargées
    const onDataLoaded = useCallback(async (data) => {
        const expense = data.data || data;

        form.setFieldsValue({
            exp_date: expense.exp_date ? dayjs(expense.exp_date) : null,
            fk_exc_id: expense.fk_exc_id || expense.category?.id,
            exp_merchant: expense.exp_merchant,
            exp_notes: expense.exp_notes,
        });

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

        if (expense.fk_doc_id) {
            try {
                const response = await documentsApi.download(expense.fk_doc_id);
                const blob = response instanceof Blob ? response : null;

                if (!blob) {
                    throw new Error("Format de réponse invalide");
                }

                const url = URL.createObjectURL(blob);
                blobUrlsRef.current.add(url);
                setReceiptUrl(url);
                setReceiptFileType(blob.type);
            } catch (error) {
                message.error("Erreur lors du chargement du document");
                console.error("Erreur lors du téléchargement du document", error);
            }
        }
    }, [form]);

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
        if (!open) return;

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
            setActiveStep('photo');
        }
    }, [open, expenseId, form]);

    // Déclenchement automatique de l'appareil photo
    useEffect(() => {
        if (open && autoCapture && !expenseId && !receiptUrl) {
            const timer = setTimeout(() => {
                fileInputRef.current?.click();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [open, autoCapture, expenseId, receiptUrl]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (!open) {
                blobUrlsRef.current.forEach(url => {
                    URL.revokeObjectURL(url);
                });
                blobUrlsRef.current.clear();
                setLines([]);
                setReceiptFile(null);
                setReceiptUrl(null);
                setReceiptFileType(null);
                setDateOutOfPeriod(false);
                form.resetFields();
            }
        };
    }, [open, form]);

    // Calcul des totaux
    const totals = useMemo(() => {
        return lines.reduce((acc, line) => ({
            totalHT: acc.totalHT + (parseFloat(line.exl_amount_ht) || 0),
            totalTVA: acc.totalTVA + (parseFloat(line.exl_amount_tva) || 0),
            totalTTC: acc.totalTTC + (parseFloat(line.exl_amount_ttc) || 0),
        }), { totalHT: 0, totalTVA: 0, totalTTC: 0 });
    }, [lines]);

    // Gestion des lignes
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

    const handleTaxChange = useCallback(async (index, taxId) => {
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
            const rotatedFile = await rotateImage(receiptFile, 90);
            setReceiptFile(rotatedFile);

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

    // Gestion de la capture photo
    const handleCameraCapture = useCallback((event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        handleReceiptUpload(file);
    }, []);

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

    const handleReceiptUpload = useCallback(async (file) => {
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            message.error("Le fichier est trop volumineux (max 5 Mo)");
            return false;
        }

        const isOcrActive = await checkOcrStatus();
  
        let processedFile = file;

        if (file.type.startsWith('image/')) {
            try {
                processedFile = await compressImage({
                    file: file,
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1920,
                    quality: 0.8
                });
            } catch (error) {
                console.error("Erreur compression:", error);
                message.warning("Impossible de compresser l'image");
                processedFile = file;
            }
        }

        if (!expenseId) {
            setReceiptFile(processedFile);
            setReceiptFileType(processedFile.type);

            const url = URL.createObjectURL(processedFile);
            blobUrlsRef.current.add(url);
            setReceiptUrl(url);

            if (isOcrActive) {
                setOcrProcessing(true);
                try {
                    const ocrResponse = await expenseOcrApi.processReceipt(processedFile);
                    if (ocrResponse.success && ocrResponse.data) {
                        const ocrData = ocrResponse.data;

                        form.setFieldsValue({
                            exp_date: ocrData.exp_date ? dayjs(ocrData.exp_date) : null,
                            exp_merchant: ocrData.exp_merchant || undefined,
                            fk_exc_id: ocrData.fk_exc_id || undefined,
                            exp_notes: ocrData.notes || undefined,
                        });

                        if (ocrData.exp_date) {
                            checkDateInPeriod(dayjs(ocrData.exp_date));
                        }

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
                        setActiveStep('details');
                    }
                } catch (error) {
                    console.error("Erreur OCR:", error);
                    message.warning("Impossible d'extraire les données");
                } finally {
                    setOcrProcessing(false);
                }
            } else {
                setActiveStep('details');
            }

            return false;
        }

        try {
            const response = await expensesApi.uploadReceipt(expenseId, processedFile);
            const url = response.data.url;
            blobUrlsRef.current.add(url);
            setReceiptUrl(url);
            setReceiptFileType(processedFile.type);
            message.success("Justificatif uploadé");
        } catch (error) {
            console.error("Erreur upload:", error);
            message.error("Erreur lors de l'upload");
        }

        return false;
    }, [expenseId, checkOcrStatus, form, checkDateInPeriod, expensesApi]);

    // Traiter le fichier initial
    useEffect(() => {
        if (open && initialFile && !isEdit && !initialFileProcessedRef.current) {
            initialFileProcessedRef.current = true;
            const processFile = async () => {
                await new Promise(resolve => setTimeout(resolve, 150));
                handleReceiptUpload(initialFile);
            };
            processFile();
        }

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
                exp_merchant: values.exp_merchant,
                exp_notes: values.exp_notes,
                lines: lines,
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

    const isImage = receiptFileType?.startsWith('image/');

    return (
        <>
            <Drawer
                title={isEdit ? "Modifier la dépense" : "Nouvelle dépense"}
                open={open}
                onClose={onClose}
                placement="bottom"
                styles={{
                    wrapper: { height: '100vh' },
                    body: { padding: '12px' },
                }}
                footer={
                    !disabled && (activeStep !== 'photo' || receiptUrl || isEdit) ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            padding: '12px',
                            background: '#fff',
                            borderTop: '1px solid #f0f0f0'
                        }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <Button
                                    onClick={onClose}
                                    style={{ flex: 1 }}
                                    size="large"
                                >
                                    Annuler
                                </Button>
                                {isEdit && (
                                    <Popconfirm
                                        title="Supprimer cette dépense ?"
                                        description="Cette action est irréversible."
                                        onConfirm={remove}
                                        okText="Supprimer"
                                        cancelText="Annuler"

                                        okButtonProps={{ danger: true }}
                                    >
                                        <Button
                                            style={{ flex: 1 }}
                                            danger
                                            icon={<DeleteOutlined />}
                                            loading={loading}
                                            size="large"
                                            block
                                        >
                                            Supprimer
                                        </Button>
                                    </Popconfirm>
                                )}
                            </div>
                            <Button
                                type="primary"
                                icon={<SaveOutlined />}
                                loading={saving}
                                onClick={() => form.submit()}
                                size="large"
                            >
                                {isEdit ? "Mettre à jour" : "Créer"}
                            </Button>
                        </div>
                      ) : null 
                }
            >
                <Spin spinning={loading || ocrProcessing} tip={ocrProcessing ? "Analyse en cours..." : "Chargement..."}>
                    {/* Étape 1: Photo */}
                    {!isEdit && activeStep === 'photo' && !receiptUrl && (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16,
                            height: '100%',
                            justifyContent: 'center'
                        }}>
                            <Card>
                                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                    <CameraOutlined style={{ fontSize: 64, color: '#1890ff', marginBottom: 16 }} />
                                    <h2>Ajouter un justificatif</h2>
                                    <p style={{ color: '#666', marginBottom: 24 }}>
                                        {ocrEnabled
                                            ? "Prenez une photo nette du ticket. Les données seront extraites automatiquement."
                                            : "Prenez une photo du ticket de caisse"}
                                    </p>
                                </div>
                            </Card>

                            <Button
                                type="primary"
                                size="large"
                                icon={<CameraOutlined />}
                                onClick={() => fileInputRef.current?.click()}
                                block
                            >
                                Prendre une photo
                            </Button>

                            <Button
                                size="large"
                                icon={<PictureOutlined />}
                                onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.onchange = (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleReceiptUpload(file);
                                    };
                                    input.click();
                                }}
                                block
                            >
                                Choisir depuis la galerie
                            </Button>

                            <Button
                                onClick={() => setActiveStep('details')}
                                block
                                size="large"
                            >
                                Continuer sans photo
                            </Button>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handleCameraCapture}
                                style={{ display: 'none' }}
                            />
                        </div>
                    )}

                    {/* Aperçu photo et formulaire */}
                    {(activeStep !== 'photo' || receiptUrl || isEdit) && (
                        <>
                            {/* Aperçu photo miniature */}
                            {receiptUrl && isImage && (
                                <Card
                                    style={{ marginBottom: 16 }}
                                    styles={{ body: { padding: 8 } }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div
                                            onClick={() => setImagePreviewVisible(true)}
                                            style={{
                                                width: 60,
                                                height: 60,
                                                borderRadius: 4,
                                                overflow: 'hidden',
                                                cursor: 'pointer',
                                                border: '1px solid #d9d9d9'
                                            }}
                                        >
                                            <img
                                                src={receiptUrl}
                                                alt="Justificatif"
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover'
                                                }}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 500 }}>Justificatif ajouté</div>
                                            <div style={{ fontSize: 12, color: '#666' }}>
                                                Touchez pour agrandir
                                            </div>
                                        </div>
                                        {!disabled && !isEdit && (
                                            <Space>
                                                <Button
                                                    icon={<RotateRightOutlined />}
                                                    onClick={handleRotateImage}
                                                    loading={rotating}
                                                    size="small"
                                                />
                                                <Button
                                                    danger
                                                    icon={<DeleteOutlined />}
                                                    onClick={() => {
                                                        if (receiptUrl) {
                                                            blobUrlsRef.current.delete(receiptUrl);
                                                            URL.revokeObjectURL(receiptUrl);
                                                        }
                                                        setReceiptFile(null);
                                                        setReceiptUrl(null);
                                                        setReceiptFileType(null);
                                                    }}
                                                    size="small"
                                                />
                                            </Space>
                                        )}
                                    </div>
                                </Card>
                            )}

                            {/* Formulaire */}
                            <Form
                                form={form}
                                layout="vertical"
                                onFinish={handleSubmit}
                                disabled={disabled}
                            >
                                <Card title="Informations" style={{ marginBottom: 16 }}>
                                    <Form.Item
                                        name="exp_date"
                                        label="Date"
                                        rules={[{ required: true, message: "Date requise" }]}
                                        help={dateOutOfPeriod && (
                                            <span style={{ color: '#faad14' }}>
                                                Date hors période
                                            </span>
                                        )}
                                    >
                                        <DatePicker
                                            format="DD/MM/YYYY"
                                            placeholder="Sélectionner"
                                            onChange={checkDateInPeriod}
                                            status={dateOutOfPeriod ? 'warning' : undefined}
                                            style={{ width: '100%' }}
                                            size="large"
                                        />
                                    </Form.Item>

                                    <Form.Item
                                        name="fk_exc_id"
                                        label="Catégorie"
                                        rules={[{ required: true, message: "Catégorie requise" }]}
                                    >
                                        <ExpenseCategorySelect
                                            loadInitially={!expenseId}
                                            initialData={entity?.category}
                                            size="large"
                                        />
                                    </Form.Item>

                                    <Form.Item
                                        name="exp_merchant"
                                        label="Commerçant"
                                        rules={[{ required: true, message: "Commerçant requis" }]}
                                    >
                                        <Input
                                            placeholder="Nom du commerçant"
                                            size="large"
                                        />
                                    </Form.Item>

                                    <Form.Item name="exp_notes" label="Notes">
                                        <TextArea
                                            rows={3}
                                            placeholder="Notes additionnelles (optionnel)"
                                            size="large"
                                        />
                                    </Form.Item>
                                </Card>

                                {/* Lignes de dépense */}
                                <Card
                                    title="Montants"
                                    style={{ marginBottom: 16 }}
                                    extra={
                                        !disabled && lines.length < 4 && (
                                            <Button
                                                type="link"
                                                icon={<PlusOutlined />}
                                                onClick={addLine}
                                                size="small"
                                            >
                                                Ligne
                                            </Button>
                                        )
                                    }
                                >
                                    {lines.map((line, index) => (
                                        <Card
                                            key={line.key}
                                            size="small"
                                            style={{ marginBottom: 12 }}
                                            title={`Ligne ${index + 1}`}
                                            extra={
                                                lines.length > 1 && !disabled && (
                                                    <Button
                                                        type="text"
                                                        danger
                                                        icon={<DeleteOutlined />}
                                                        onClick={() => removeLine(index)}
                                                        size="small"
                                                    />
                                                )
                                            }
                                        >
                                            <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                                                <div>
                                                    <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                                                        Montant HT
                                                    </div>
                                                    <InputNumber
                                                        inputMode='decimal'
                                                        value={line.exl_amount_ht}
                                                        onChange={(v) => updateLine(index, "exl_amount_ht", v)}
                                                        precision={2}
                                                        min={0.01}
                                                        style={{ width: "100%" }}
                                                        disabled={disabled}
                                                        size="large"
                                                        placeholder="0.00"
                                                        status={!line.exl_amount_ht || line.exl_amount_ht < 0.01 ? 'error' : undefined}
                                                    />
                                                    {(!line.exl_amount_ht || line.exl_amount_ht < 0.01) && (
                                                        <div style={{ color: '#ff4d4f', fontSize: 11, marginTop: 2 }}>
                                                            Montant requis (min 0.01)
                                                        </div>
                                                    )}
                                                </div>

                                                <div>
                                                    <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                                                        TVA
                                                    </div>
                                                    <TaxSelect
                                                        value={line.fk_tax_id ?? undefined}
                                                        selectDefault={true}
                                                        loadInitially={true}
                                                        onDefaultSelected={(taxId) => handleTaxChange(index, taxId)}
                                                        filters={{ tax_use: TAX_TYPE.PURCHASE, tax_is_active: 1, ...(excType ? { tax_scope: excType } : {}) }}
                                                        onChange={(taxId) => handleTaxChange(index, taxId)}
                                                        style={{ width: "100%" }}
                                                        disabled={disabled}
                                                        allowClear={false}
                                                        size="large"
                                                        status={!line.fk_tax_id ? 'error' : undefined}
                                                    />
                                                    {!line.fk_tax_id && (
                                                        <div style={{ color: '#ff4d4f', fontSize: 11, marginTop: 2 }}>
                                                            TVA requise
                                                        </div>
                                                    )}
                                                </div>

                                                <div>
                                                    <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                                                        Montant TTC
                                                    </div>
                                                    <InputNumber
                                                        inputMode='decimal'
                                                        value={line.exl_amount_ttc}
                                                        onChange={(v) => updateLine(index, "exl_amount_ttc", v)}
                                                        precision={2}
                                                        min={0.01}
                                                        style={{ width: "100%" }}
                                                        disabled={disabled}
                                                        size="large"
                                                        placeholder="0.00"
                                                        status={!line.exl_amount_ttc || line.exl_amount_ttc < 0.01 ? 'error' : undefined}
                                                    />
                                                    {(!line.exl_amount_ttc || line.exl_amount_ttc < 0.01) && (
                                                        <div style={{ color: '#ff4d4f', fontSize: 11, marginTop: 2 }}>
                                                            Montant requis
                                                        </div>
                                                    )}
                                                </div>

                                                <div style={{
                                                    padding: '8px 12px',
                                                    background: '#f5f5f5',
                                                    borderRadius: 4,
                                                    fontSize: 12
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span>TVA calculée :</span>
                                                        <strong>{formatCurrency(line.exl_amount_tva || 0)}</strong>
                                                    </div>
                                                </div>
                                            </Space>
                                        </Card>
                                    ))}
                                </Card>

                                {/* Totaux */}
                                <Card style={{ marginBottom: 80 }}>
                                    <div style={{ fontSize: 16 }}>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            marginBottom: 8
                                        }}>
                                            <span>Total HT :</span>
                                            <strong>{formatCurrency(totals.totalHT)}</strong>
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            marginBottom: 8
                                        }}>
                                            <span>Total TVA :</span>
                                            <strong>{formatCurrency(totals.totalTVA)}</strong>
                                        </div>
                                        <Divider style={{ margin: '12px 0' }} />
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            fontSize: 18
                                        }}>
                                            <span><strong>Total TTC :</strong></span>
                                            <strong style={{ color: '#1890ff' }}>
                                                {formatCurrency(totals.totalTTC)}
                                            </strong>
                                        </div>
                                    </div>
                                </Card>
                            </Form>
                        </>
                    )}
                </Spin>
            </Drawer>

            {/* Modal d'aperçu image */}
            <Modal
                open={imagePreviewVisible}
                footer={null}
                onCancel={() => setImagePreviewVisible(false)}
                width="100%"
                style={{ top: 0, paddingBottom: 0, maxWidth: '100vw' }}
                styles={{
                    body: {
                        padding: 0,
                        height: '100vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#000'
                    }
                }}
            >
                {receiptUrl && (
                    <img
                        src={receiptUrl}
                        alt="Justificatif"
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100vh',
                            objectFit: 'contain'
                        }}
                    />
                )}
            </Modal>
        </>
    );
}
