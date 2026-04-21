import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Modal, Form, Input, Button, Upload, Alert, Space, DatePicker, InputNumber, Table, Spin, Row, Col, Card, Typography, Popconfirm } from "antd";
import { message } from '../../utils/antdStatic';
import { UploadOutlined, CloudUploadOutlined, DeleteOutlined, PlusOutlined, WarningOutlined, FilePdfOutlined, CheckCircleOutlined, CloseCircleOutlined, UserAddOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import PartnerSelect from "../select/PartnerSelect";
import ProductSelect from "../select/ProductSelect";
import TaxSelect from "../select/TaxSelect";
import PaymentModeSelect from "../select/PaymentModeSelect";
import PaymentConditionSelect from "../select/PaymentConditionSelect";
import { invoiceOcrApi, partnersApi, taxsApi } from "../../services/api";

const { TextArea } = Input;
const { Title, Text } = Typography;

/**
 * Format currency value
 */
const formatCurrency = (value) => {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
    }).format(value);
};

/**
 * Modal for OCR-based supplier invoice import
 */
export default function InvoiceOcrImportDrawer({ open, onClose, onSuccess }) {
    const [form] = Form.useForm();

    const partnerRef = useRef(null);

    // States
    const [uploading, setUploading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [previewToken, setPreviewToken] = useState(null);
    const [pdfBase64, setPdfBase64] = useState(null);
    const [extractedData, setExtractedData] = useState(null);
    const [lines, setLines] = useState([]);
    const [duplicateWarning, setDuplicateWarning] = useState(null);
    const [vendorNotMatched, setVendorNotMatched] = useState(false);
    const [defaultProduct, setDefaultProduct] = useState(null);


    const [addingPartner, setAddingPartner] = useState(false);

    // Résoudre le taux effectif via les TRL (même logique que BizDocumentLineModal)
    // Toujours 'in_invoice' car ce drawer est exclusivement pour les factures fournisseur
    const fetchEffectiveTaxRate = useCallback(async (taxId) => {
        if (!taxId) return 0;
        try {
            const res = await taxsApi.getRepartitionLines(taxId);
            const rate = parseFloat(res.tax_rate) ?? 0;
            const trlLines = (res.data ?? []).filter(l =>
                l.trl_repartition_type === 'tax' && l.trl_document_type === 'in_invoice'
            );
            if (trlLines.length > 0) {
                const netFactor = trlLines.reduce((sum, l) => sum + parseFloat(l.trl_factor_percent ?? 100), 0);
                return rate * netFactor / 100;
            }
            return rate;
        } catch {
            return 0;
        }
    }, []);

    // Enrichit un tableau de lignes avec le taux effectif (résolution en parallèle)
    const loadLinesWithEffectiveTaxRates = useCallback(async (rawLines) => {
        const uniqueTaxIds = [...new Set(rawLines.map(l => l.fk_tax_id).filter(Boolean))];
        const rateMap = {};
        await Promise.all(uniqueTaxIds.map(async (taxId) => {
            rateMap[taxId] = await fetchEffectiveTaxRate(taxId);
        }));
        return rawLines.map(line => ({
            ...line,
            effective_tax_rate: line.fk_tax_id
                ? (rateMap[line.fk_tax_id] ?? line.tax_rate ?? 20)
                : (line.tax_rate ?? 20),
        }));
    }, [fetchEffectiveTaxRate]);

    // Reset state on close
    useEffect(() => {
        if (!open) {
            form.resetFields();
            setPreviewToken(null);
            setPdfBase64(null);
            setExtractedData(null);
            setLines([]);
            setDuplicateWarning(null);
            setVendorNotMatched(false);
            setUploading(false);
            setProcessing(false);
        }
    }, [open, form]);

    // Cleanup on unmount or close
    useEffect(() => {
        return () => {
            if (previewToken) {
                invoiceOcrApi.cancel(previewToken).catch(() => { });
            }
        };
    }, [previewToken]);

    // Handle file upload
    const handleUpload = async ({ file }) => {
        const formData = new FormData();
        formData.append("file", file);

        setUploading(true);

        try {
            const response = await invoiceOcrApi.upload(formData);

            if (response.success) {
                const data = response.data;
                setPreviewToken(data.token);
                setExtractedData(data);

                // Set form values
                form.setFieldsValue({
                    fk_ptr_id: data.vendor?.ptr_id,
                    inv_externalreference: data.ocr_data.invoice_number,
                    inv_date: data.ocr_data.date ? dayjs(data.ocr_data.date) : dayjs(),
                    inv_duedate: data.ocr_data.due_date
                        ? dayjs(data.ocr_data.due_date)
                        : (data.ocr_data.date ? dayjs(data.ocr_data.date) : dayjs()),
                    fk_pam_id: data.vendor?.fk_pam_id,
                    fk_dur_id_payment_condition: data.payment_condition?.dur_id,
                });

                setDefaultProduct(data.default_product);
                // Set lines with effective tax rates resolved from TRL
                const rawLines = data.line_items.map((item, index) => ({
                    key: index,
                    fk_prt_id: item.prt_id,
                    fk_tax_id: item.fk_tax_id,
                    inl_prtlib: item.prt_label || item.description,
                    inl_prtdesc: item.description,
                    inl_qty: item.quantity,
                    inl_priceunitht: item.price,
                    inl_discount_percent: item.discount_percent || 0,
                    tax_rate: item.tax_rate_matched,
                    matched: item.matched,
                }));
                const enrichedLines = await loadLinesWithEffectiveTaxRates(rawLines);
                setLines(enrichedLines);

                // Check for warnings
                if (data.duplicate) {
                    setDuplicateWarning(data.duplicate);
                }
                if (!data.vendor?.matched) {
                    setVendorNotMatched(true);
                }

                // Load PDF preview
                loadPdfPreview(data.token);

                message.success("Document analysé avec succès");
            } else {
                message.error(response.message || "Erreur lors de l'analyse");
            }
        } catch (error) {
            message.error(
                error.response?.data?.message || error.message || "Erreur lors de l'analyse du document"
            );
        } finally {
            setUploading(false);
        }
    };

    // Load PDF preview
    const loadPdfPreview = async (token) => {
        try {
            const response = await invoiceOcrApi.getPreview(token);
            if (response.success) {
                setPdfBase64(response.data.pdf);
            }
        } catch (error) {
            console.error("Erreur chargement PDF:", error);
        }
    };

    // Calculate totals based on lines
    const totals = useMemo(() => {
        let totalHT = 0;
        let totalTVA = 0;

        lines.forEach((line) => {
            const lineHTBeforeDiscount = (line.inl_qty || 0) * (line.inl_priceunitht || 0);
            const discountAmount = lineHTBeforeDiscount * ((line.inl_discount_percent || 0) / 100);
            const lineHT = lineHTBeforeDiscount - discountAmount;
            const lineTVA = lineHT * ((line.effective_tax_rate ?? line.tax_rate ?? 20) / 100);
            totalHT += lineHT;
            totalTVA += lineTVA;
        });

        return {
            totalHT,
            totalTVA,
            totalTTC: totalHT + totalTVA,
        };
    }, [lines]);

    // Check if calculated total differs from extracted total
    const hasTotalMismatch = useMemo(() => {      
        if (!extractedData) return false;
        const diff = Math.abs(totals.totalTTC - (extractedData.ocr_data.total || 0));
        return diff > 0.01; // Tolérance de 1 centime (évite les erreurs d'arrondi flottant)
    }, [totals, extractedData]);

    // Handle line edit
    const handleLineChange = (key, field, value) => {
        if (field === 'fk_tax_id') {
            fetchEffectiveTaxRate(value).then(effectiveRate => {
                setLines((prev) =>
                    prev.map((line) =>
                        line.key === key
                            ? { ...line, fk_tax_id: value, effective_tax_rate: effectiveRate }
                            : line
                    )
                );
            });
        } else {
            setLines((prev) =>
                prev.map((line) => (line.key === key ? { ...line, [field]: value } : line))
            );
        }
    };

    // Handle line delete
    const handleLineDelete = (key) => {
        setLines((prev) => prev.filter((line) => line.key !== key));
    };

    // Handle add line
    const handleAddLine = async () => {
        const newKey = Math.max(...lines.map((l) => l.key), 0) + 1;
        const taxId = defaultProduct.tax_purchase.tax_id;
        const effectiveRate = await fetchEffectiveTaxRate(taxId);
        setLines((prev) => [
            ...prev,
            {
                key: newKey,
                fk_prt_id: defaultProduct.prt_id,
                inl_prtlib: defaultProduct.prt_label,
                inl_prtdesc: "",
                inl_qty: 1,
                inl_priceunitht: 0,
                inl_discount_percent: 0,
                tax_rate: defaultProduct.tax_purchase.tax_rate,
                effective_tax_rate: effectiveRate,
                fk_tax_id: taxId,
                matched: false,
            },
        ]);
    };

    // Handle add new partner
    const handleAddPartner = async () => {
        if (!extractedData?.vendor?.ptr_name) {
            message.warning("Aucun nom de fournisseur extrait du document");
            return;
        }

        setAddingPartner(true);
        try {
            // Créer le nouveau partenaire         
            const response = await partnersApi.create({
                ptr_name: extractedData.ocr_data.vendor.name,
                ptr_address: extractedData.ocr_data.vendor.address,
                ptr_phone: extractedData.ocr_data.vendor.phone_number,
                ptr_vat_number: extractedData.ocr_data.vendor.vat_number,
                ptr_is_supplier: 1,
                ptr_is_active: 1,
            });

            if (response.success) {
                const newPartnerId = response.data.ptr_id;
                const newPartnerName = response.data.ptr_name;

                // Injecter l'option dans le select AVANT de setter la valeur du formulaire
                // (reload est async, la valeur serait définie avant que l'option soit disponible)
                partnerRef.current.injectOption({ value: newPartnerId, label: newPartnerName });
                form.setFieldsValue({ fk_ptr_id: newPartnerId });
                setVendorNotMatched(false);

                message.success(`Fournisseur "${newPartnerName}" créé avec succès`);
            } else {
                message.error(response.message || "Erreur lors de la création du fournisseur");
            }
        } catch (error) {
            message.error(
                error.response?.data?.message || error.message || "Erreur lors de la création du fournisseur"
            );
        } finally {
            setAddingPartner(false);
        }
    };

    // Handle confirm import
    const handleConfirm = async () => {
        try {
            await form.validateFields();

            if (lines.length === 0) {
                message.error("Veuillez ajouter au moins une ligne");
                return;
            }

            // Validate lines
            const invalidLines = lines.filter((l) => !l.fk_tax_id || !l.inl_prtlib);
            if (invalidLines.length > 0) {
                message.error("Veuillez compléter toutes les lignes (désignation et TVA requises)");
                return;
            }

            setProcessing(true);

            const values = form.getFieldsValue();
            const payload = {
                token: previewToken,
                fk_ptr_id: values.fk_ptr_id,
                inv_date: values.inv_date.format("YYYY-MM-DD"),
                inv_duedate: values.inv_duedate?.format("YYYY-MM-DD"),
                inv_externalreference: values.inv_externalreference,
                fk_pam_id: values.fk_pam_id,
                fk_dur_id_payment_condition: values.fk_dur_id_payment_condition,
                inv_note: values.inv_note,
                lines: lines.map((line) => ({
                    fk_prt_id: line.fk_prt_id,
                    fk_tax_id: line.fk_tax_id,
                    inl_prtlib: line.inl_prtlib,
                    inl_prtdesc: line.inl_prtdesc,
                    inl_qty: line.inl_qty,
                    inl_priceunitht: line.inl_priceunitht,
                    inl_discount_percent: line.inl_discount_percent,
                })),
            };

            const response = await invoiceOcrApi.confirm(payload);

            if (response.success) {
                message.success(`Facture ${response.data.inv_number} créée avec succès`);
                onSuccess && onSuccess(response.data);
                onClose();
            } else {
                message.error(response.message || "Erreur lors de la création");
            }
        } catch (error) {
            if (error.errorFields) {
                message.error("Veuillez remplir tous les champs obligatoires");
            } else {
                message.error(
                    error.response?.data?.message || error.message || "Erreur lors de la création"
                );
            }
        } finally {
            setProcessing(false);
        }
    };

    // Handle cancel
    const handleCancel = () => {
        if (previewToken) {
            invoiceOcrApi.cancel(previewToken).catch(() => { });
        }
        onClose();
    };

    // Lines table columns
    const lineColumns = [
        {
            title: "Produit",
            dataIndex: "fk_prt_id",
            width: 180,
            render: (value, record) => (
                <ProductSelect
                size="small"
                    loadInitially={true}
                    value={value}
                    onChange={(v) => handleLineChange(record.key, "fk_prt_id", v)}
                    filters={{ is_purchasable: 1 }}
                    style={{ width: "100%" }}               
                  
                />
            ),
        },
        {
            title: "Désignation",
            dataIndex: "inl_prtlib",
            width: 120,
            render: (value, record) => (
                <Input
                size="small"
                    value={value}
                    onChange={(e) => handleLineChange(record.key, "inl_prtlib", e.target.value)}
                    // size="small"
                    status={!value ? "error" : undefined}
                />
            ),
        },
        {
            title: "Qté",
            dataIndex: "inl_qty",
            width: 70,
            render: (value, record) => (
                <InputNumber
                    value={value}
                    onChange={(v) => handleLineChange(record.key, "inl_qty", v)}
                    min={0}
                    style={{ width: "100%" }}
                  size="small"
                />
            ),
        },
        {
            title: "PU HT",
            dataIndex: "inl_priceunitht",
            width: 100,
            render: (value, record) => (
                <InputNumber
                    value={value}
                    onChange={(v) => handleLineChange(record.key, "inl_priceunitht", v)}
                    min={0}
                    precision={2}
                    style={{ width: "100%" }}
                  size="small"
                />
            ),
        },
        {
            title: "% Rem.",
            dataIndex: "inl_discount_percent",
            width: 80,
            render: (value, record) => (
                <InputNumber
                    value={value}
                    onChange={(v) => handleLineChange(record.key, "inl_discount_percent", v)}
                    min={0}
                    max={100}
                    precision={2}
                    style={{ width: "100%" }}
                       size="small"
                    formatter={(val) => `${val}%`}
                    parser={(val) => val.replace('%', '')}
                />
            ),
        },
        {
            title: "TVA",
            dataIndex: "fk_tax_id",
            width: 100,
            render: (value, record) => (
                <TaxSelect
                    value={value}
                    loadInitially={true}
                    onChange={(v) => handleLineChange(record.key, "fk_tax_id", v)}
                    filters={{ tax_use: 'purchase', tax_is_active: 1 }}
                    style={{ width: "100%" }}
                    selectProps={{ size: "small", status: !value ? "error" : undefined }}
                />
            ),
        },
        {
            title: "Total HT",
            width: 90,
            align: "right",
            render: (_, record) => {
                const htBeforeDiscount = (record.inl_qty || 0) * (record.inl_priceunitht || 0);
                const discount = htBeforeDiscount * ((record.inl_discount_percent || 0) / 100);
                const totalHT = htBeforeDiscount - discount;
                return <Text strong>{formatCurrency(totalHT)}</Text>;
            },
        },
        {
            title: "",
            width: 40,
            render: (_, record) => (
                <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleLineDelete(record.key)}
                    size="small"
                />
            ),
        },
    ];

    return (
        <Modal
            title={
                <Space>
                    <FilePdfOutlined />
                    <span>Import de facture fournisseur depuis PDF</span>
                </Space>
            }
            open={open}
            onCancel={handleCancel}
            width="95%"
            destroyOnHidden
            centered
            styles={{ body: { padding: 0, height: "calc(100vh - 150px)", overflow: "hidden" } }}
            footer={null}
        >
            <div style={{ display: "flex", height: "100%" }}>
                {/* Left Panel - PDF Preview */}
                <div
                    style={{
                        width: "40%",
                        borderRight: "1px solid #f0f0f0",
                        display: "flex",
                        flexDirection: "column",
                        background: "#fafafa",
                    }}
                >
                    {!pdfBase64 ? (
                        <div
                            style={{
                                flex: 1,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Upload.Dragger
                                customRequest={handleUpload}
                                accept=".pdf"
                                maxCount={1}
                                showUploadList={false}
                                disabled={uploading}
                                style={{
                                    padding: 40,
                                    background: "#fff",
                                    border: "2px dashed #d9d9d9",
                                    borderRadius: 8,
                                }}
                            >
                                <div style={{ textAlign: "center" }}>
                                    {uploading ? (
                                        <>
                                            <Spin size="large" />
                                            <Title level={4} style={{ marginTop: 24, color: "#1890ff" }}>
                                                Analyse en cours...
                                            </Title>
                                            <Text type="secondary">
                                                Veuillez patienter pendant l'extraction des données
                                            </Text>
                                        </>
                                    ) : (
                                        <>
                                            <CloudUploadOutlined style={{ fontSize: 64, color: "#1890ff" }} />
                                            <Title level={4} style={{ marginTop: 16 }}>
                                                Téléchargez votre facture fournisseur
                                            </Title>
                                            <Text type="secondary">
                                                Glissez-déposez un fichier PDF ou cliquez pour sélectionner
                                            </Text>
                                            <div style={{ marginTop: 24 }}>
                                                <Button type="primary" icon={<UploadOutlined />} size="large">
                                                    Sélectionner un fichier PDF
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </Upload.Dragger>
                        </div>
                    ) : (
                        <iframe
                            src={`data:application/pdf;base64,${pdfBase64}`}
                            style={{ flex: 1, border: "none", width: "100%" }}
                            title="Aperçu PDF"
                        />
                    )}
                </div>

                {/* Right Panel - Data Validation Form */}
                <div
                    style={{
                        width: "60%",
                        overflow: "auto",
                        paddingLeft: 20,
                        background: "#fff",
                    }}
                >
                    {!extractedData ? (
                        <div
                            style={{
                                textAlign: "center",
                                padding: 60,
                                color: "#999",
                            }}
                        >
                            <FilePdfOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                            <Title level={4} type="secondary">
                                Les informations extraites apparaîtront ici
                            </Title>
                            <Text type="secondary">Commencez par télécharger un fichier PDF</Text>
                        </div>
                    ) : (
                        <Spin spinning={processing} tip="Création de la facture...">

                            <Form form={form} layout="vertical" size="middle">
                                <Card
                                    title="Informations de la facture"
                                    size="small"
                                    style={{ marginBottom: 16 }}
                                >
                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <Form.Item
                                                label="Fournisseur"
                                                required // Affiche l'astérisque rouge
                                                // validateStatus={vendorNotMatched ? "warning" : undefined}
                                                help={vendorNotMatched ? (
                                                    <span style={{ color: '#1890ff' }}>
                                                        Fournisseur {extractedData.ocr_data.vendor.name} non reconnu automatiquement. Veuillez le sélectionner manuellement ou créer un nouveau fournisseur.
                                                    </span>
                                                ) : undefined}
                                            >
                                                <Space.Compact style={{ width: '100%' }}>
                                                    {/* On met un Form.Item sans label ici pour la gestion de la valeur */}
                                                    <Form.Item
                                                        name="fk_ptr_id"
                                                        noStyle // Très important : enlève les marges et le style du Form.Item interne
                                                        rules={[{ required: true, message: "Fournisseur requis" }]}

                                                    >
                                                        <PartnerSelect
                                                            ref={partnerRef}
                                                            filters={{ is_supplier: 1, is_active: 1 }}
                                                            loadInitially={true}
                                                            style={{ width: '100%' }}
                                                        />
                                                    </Form.Item>

                                                    {/* Le bouton s'affiche à côté seulement si le fournisseur n'est pas trouvé */}
                                                    {vendorNotMatched && extractedData?.vendor?.ptr_name && (
                                                        <Popconfirm
                                                            title="Créer un nouveau fournisseur"
                                                            description={`Voulez-vous créer le fournisseur "${extractedData.vendor.ptr_name}" ?`}
                                                            onConfirm={handleAddPartner}
                                                            okText="Oui"
                                                            cancelText="Non"
                                                        >
                                                            <Button
                                                                type="primary"
                                                                icon={<UserAddOutlined />}
                                                                loading={addingPartner}
                                                            >
                                                                Ajouter
                                                            </Button>
                                                        </Popconfirm>
                                                    )}
                                                </Space.Compact>
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item
                                                name="inv_externalreference"
                                                label="Référence facture fournisseur"
                                                rules={[{ required: true, message: "Référence requise" }]}
                                                validateStatus={duplicateWarning ? "warning" : undefined}
                                                help={duplicateWarning ? `Une facture avec cette référence existe déjà (${duplicateWarning.inv_number})` : undefined}

                                            >
                                                <Input placeholder="N° de facture du fournisseur" />
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    <Row gutter={16}>
                                        <Col span={6}>
                                            <Form.Item
                                                name="inv_date"
                                                label="Date de facture"
                                                rules={[{ required: true, message: "Date requise" }]}
                                            >
                                                <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
                                            </Form.Item>
                                        </Col>
                                        <Col span={6}>
                                            <Form.Item
                                                name="inv_duedate"
                                                label="Date d'échéance"
                                                rules={[{ required: true, message: "Date d'échéance requise" }]}
                                            >
                                                <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
                                            </Form.Item>
                                        </Col>
                                        <Col span={6}>
                                            <Form.Item
                                                name="fk_pam_id"
                                                label="Mode de règlement"
                                                rules={[{ required: true, message: "Mode de règlement requis" }]}>
                                                <PaymentModeSelect
                                                    loadInitially={true} />
                                            </Form.Item>
                                        </Col>
                                        <Col span={6}>
                                            <Form.Item
                                                name="fk_dur_id_payment_condition"
                                                label="Condition de règlement"
                                                rules={[{ required: true, message: "Condition de règlement" }]}
                                            >
                                                <PaymentConditionSelect
                                                    loadInitially={extractedData?.payment_condition ? false : true}
                                                    initialData={extractedData?.payment_condition}
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </Card>
                            </Form>

                            <Card
                                title={
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                        }}
                                    >
                                        <span>Lignes de facture ({lines.length})</span>
                                        <Button
                                            type="secondary"
                                            icon={<PlusOutlined />}
                                            onClick={handleAddLine}
                                            size="small"
                                        >
                                            Ajouter une ligne
                                        </Button>
                                    </div>
                                }
                                size="small"
                                style={{ marginBottom: 16 }}
                            >
                                <Table
                                    dataSource={lines}
                                    tableLayout="fixed"
                                    columns={lineColumns}
                                    pagination={false}
                                    size="small"
                                    rowKey="key"
                                    rowClassName={(record) =>
                                        record.matched ? "row-matched" : "row-not-matched"
                                    }

                                />
                            </Card>

                            {/* Totals */}
                            <Card size="small" style={{ marginBottom: 16, paddingBottom: 15 }}>
                                <Row gutter={16}>
                                    <Col span={8}>
                                        <div style={{ textAlign: "center" }}>
                                            <Text type="secondary">Total HT</Text>
                                            <Title level={4} style={{ margin: 0 }}>
                                                {formatCurrency(totals.totalHT)}
                                            </Title>
                                        </div>
                                    </Col>
                                    <Col span={8}>
                                        <div style={{ textAlign: "center" }}>
                                            <Text type="secondary">Total TVA</Text>
                                            <Title level={4} style={{ margin: 0 }}>
                                                {formatCurrency(totals.totalTVA)}
                                            </Title>
                                        </div>
                                    </Col>
                                    <Col span={8}>
                                        <div style={{ textAlign: "center" }}>
                                            <Text type="secondary">Total TTC</Text>
                                            <Title level={3} style={{ margin: 0, color: "#1890ff" }}>
                                                {formatCurrency(totals.totalTTC)}
                                            </Title>
                                        </div>
                                    </Col>
                                </Row>
                            </Card>
                            {hasTotalMismatch && (
                                <Alert
                                    type="error"
                                    icon={<WarningOutlined />}
                                    title="Différence de montant détectée"
                                    description={`Le total calculé (${formatCurrency(totals.totalTTC)}) diffère du total extrait (${formatCurrency(extractedData.ocr_data.total)}). Veuillez vérifier les lignes de facture.
                                    `}
                                    showIcon
                                    style={{ marginBottom: 14 }}
                                />
                            )}
                            {/* Action buttons */}
                            <div style={{ textAlign: "right" }}>
                                <Space>
                                    <Button onClick={handleCancel} icon={<CloseCircleOutlined />}>
                                        Annuler
                                    </Button>
                                    <Button
                                        type="primary"
                                        size="large"
                                        icon={<CheckCircleOutlined />}
                                        onClick={handleConfirm}
                                        loading={processing}
                                        disabled={lines.length === 0}
                                    >
                                        Créer la facture fournisseur
                                    </Button>
                                </Space>
                            </div>
                        </Spin>
                    )}

                </div>
            </div>
        </Modal>
    );
}