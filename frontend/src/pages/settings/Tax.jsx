import { Drawer, Form, Input, Button, Row, Col, Popconfirm, Spin, Space, Checkbox, InputNumber, Select, Switch, Tag, Tooltip, message } from "antd";
import { DeleteOutlined, SaveOutlined, PlusOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { useEffect, useState, useCallback, useMemo } from "react";
import { taxsApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";
import CanAccess from "../../components/common/CanAccess";
import AccountSelect from "../../components/select/AccountSelect";
import TaxTagSelect from "../../components/select/TaxTagSelect";

const TAX_TYPES = [
    { value: 'sale', label: 'TVA sur ventes' },
    { value: 'purchase', label: 'TVA sur achats' },
];

const TAX_EXIGIBILITY_TYPES = [
    { value: 'on_invoice', label: 'Sur la facture' },
    { value: 'on_payment', label: 'Sur le paiement' },
];

const TAX_SCOPE_TYPES = [
    { value: 'all', label: 'Tous' },
    { value: 'conso', label: 'Produits' },
    { value: 'service', label: 'Service' },
];

const newLine = (docType, repType) => ({
    trl_document_type: docType,
    trl_repartition_type: repType,
    fk_acc_id: null,
    ttg_ids: [],
    trl_factor_percent: 100,
    trl_sign: 1,
});

const getRequiredDocTypes = (use) =>
    use === 'sale'     ? ['out_invoice', 'out_refund']
    : use === 'purchase' ? ['in_invoice', 'in_refund']
    : [];

// ── Ligne de ventilation (base ou TVA) ───────────────────────────────────────
function LineRow({ repType, line, onChange, onRemove }) {
    return (
        <Row gutter={[6, 0]} align="middle" style={{ marginBottom: 5 }}>
            <Col style={{ width: 68 }}>
                <Tag
                    color={repType === 'base' ? 'processing' : 'warning'}
                    style={{ margin: 0, width: '100%', textAlign: 'center' }}
                >
                    {repType === 'base' ? 'Base HT' : 'TVA'}
                </Tag>
            </Col>

            <Col style={{ width: 280 }}>
                <TaxTagSelect
                    size="small"
                    mode="multiple"
                    style={{ width: '100%' }}
                    value={line.ttg_ids ?? []}
                    onChange={(v) => onChange({ ...line, ttg_ids: v ?? [] })}
                    popupMatchSelectWidth={400}
                    maxTagCount="responsive"
                />
            </Col>

            <Col style={{ width: 88 }}>
                <InputNumber
                    size="small"
                    min={-100}
                    max={100}
                    step={1}
                    style={{ width: '100%' }}
                    value={line.trl_factor_percent}
                    onChange={(v) => onChange({ ...line, trl_factor_percent: v ?? 100 })}
                    suffix="%"
                />
            </Col>

            <Col style={{ width: 200 }}>
                {repType === 'tax' && (
                    <AccountSelect
                        size="small"
                        value={line.fk_acc_id}
                        style={{ width: '100%' }}
                        onChange={(v) => onChange({ ...line, fk_acc_id: v })}
                        placeholder="Compte GL"
                        filters={{ type: ['asset_current', 'liability_current'] }}
                        popupMatchSelectWidth={400}
                    />
                )}
            </Col>

            <Col style={{ width: 20 }}>
                {repType === 'tax' && onRemove && (
                    <DeleteOutlined
                        style={{ color: '#ff4d4f', cursor: 'pointer', fontSize: 13 }}
                        onClick={onRemove}
                    />
                )}
            </Col>
        </Row>
    );
}

// ── Éditeur de ventilation pour un type de document ──────────────────────────
function RepartitionEditor({ docType, allLines, onLinesChange }) {
    const docLines = allLines.filter(l => l.trl_document_type === docType);
    const baseLine = docLines.find(l => l.trl_repartition_type === 'base') ?? newLine(docType, 'base');
    const taxLines = docLines.filter(l => l.trl_repartition_type === 'tax');

    const replaceDocLines = (newDocLines) =>
        onLinesChange([
            ...allLines.filter(l => l.trl_document_type !== docType),
            ...newDocLines,
        ]);

    const updateBase = (updated) => replaceDocLines([updated, ...taxLines]);

    const updateTax = (idx, updated) =>
        replaceDocLines([baseLine, ...taxLines.map((l, i) => (i === idx ? updated : l))]);

    const addTax = () => replaceDocLines([baseLine, ...taxLines, newLine(docType, 'tax')]);

    const removeTax = (idx) =>
        replaceDocLines([baseLine, ...taxLines.filter((_, i) => i !== idx)]);

    return (
        <div>
            {/* En-tête colonnes */}
            <Row gutter={[6, 0]} style={{ marginBottom: 4 }}>
                <Col style={{ width: 68 }} />
                <Col style={{ width: 280 }}>
                    <span style={{ fontSize: 11, color: '#aaa' }}>Tag TVA</span>
                </Col>
                <Col style={{ width: 88 }}>
                    <span style={{ fontSize: 11, color: '#aaa' }}>Facteur %</span>
                </Col>
                <Col style={{ width: 200 }}>
                    <span style={{ fontSize: 11, color: '#aaa' }}>Compte GL</span>
                </Col>
                <Col style={{ width: 20 }} />
            </Row>

            {/* Ligne Base HT */}
            <LineRow repType="base" line={baseLine} onChange={updateBase} />

            {/* Lignes TVA */}
            {taxLines.length === 0 ? (
                <LineRow
                    repType="tax"
                    line={newLine(docType, 'tax')}
                    onChange={(u) => replaceDocLines([baseLine, u])}
                />
            ) : (
                taxLines.map((line, i) => (
                    <LineRow
                        key={i}
                        repType="tax"
                        line={line}
                        onChange={(u) => updateTax(i, u)}
                        onRemove={taxLines.length > 1 ? () => removeTax(i) : undefined}
                    />
                ))
            )}

            <Button
                size="small"
                type="dashed"
                icon={<PlusOutlined />}
                onClick={addTax}
                style={{ marginTop: 4 }}
            >
                Ligne TVA supplémentaire
            </Button>
        </div>
    );
}

// ── Section de ventilation avec titre ────────────────────────────────────────
function RepartitionSection({ title, docType, allLines, onLinesChange }) {
    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {title}
            </div>
            <RepartitionEditor
                docType={docType}
                allLines={allLines}
                onLinesChange={onLinesChange}
            />
        </div>
    );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function Tax({ taxId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();
    const pageLabel = Form.useWatch("tax_label", form);
    const taxUse = Form.useWatch("tax_use", form);

    const [repLines, setRepLines] = useState([]);
    const [savingLines, setSavingLines] = useState(false);

    const { submit, remove, loading } = useEntityForm({
        api: taxsApi,
        entityId: taxId,
        idField: "tax_id",
        form,
        open,
        onSuccess: ({ action, data }, closeDrawer = true) => {
            onSubmit?.({ action, data });
            if (closeDrawer) onClose?.();
        },
        onDelete: () => {
            onSubmit?.({ action: "delete" });
            onClose?.();
        },
    });

    const loadRepartitionLines = useCallback(async () => {
        if (!taxId) { setRepLines([]); return; }
        try {
            const res = await taxsApi.getRepartitionLines(taxId);
            setRepLines(res.data ?? []);
        } catch {
            setRepLines([]);
        }
    }, [taxId]);

    useEffect(() => {
        if (!open) return;
        loadRepartitionLines();
    }, [open, taxId, loadRepartitionLines]);

    // Pré-peupler les lignes par défaut lors de la création quand taxUse change
    useEffect(() => {
        if (taxId) return; // Uniquement pour les nouvelles taxes
        if (!taxUse) { setRepLines([]); return; }
        const docTypes = getRequiredDocTypes(taxUse);
        setRepLines(docTypes.flatMap(dt => [newLine(dt, 'base'), newLine(dt, 'tax')]));
    }, [taxUse, taxId]);

    // Vérifier si les répartitions sont suffisantes pour activer la taxe
    const hasValidRepartitions = useMemo(() => {
        const required = getRequiredDocTypes(taxUse);
        if (!required.length) return false;
        return required.every(dt => repLines.some(l => l.trl_document_type === dt));
    }, [taxUse, repLines]);

    // Forcer tax_is_active à false si les répartitions deviennent invalides
    useEffect(() => {
        if (!hasValidRepartitions) {
            form.setFieldValue('tax_is_active', false);
        }
    }, [hasValidRepartitions, form]);

    const handleSaveRepartitionLines = async (idOverride) => {
        const id = idOverride ?? taxId;
        if (!id) return;
        setSavingLines(true);
        try {
            await taxsApi.saveRepartitionLines(id, { lines: repLines });
            if (!idOverride) {
                message.success("Ventilation enregistrée");
                onSubmit?.({ action: "update" });
            }
        } catch (error) {
            const errors = error?.data?.errors;
            if (errors) {
                const first = Object.values(errors).flat()[0];
                message.error(first);
            } else {
                message.error(error?.message ?? "Erreur lors de l'enregistrement de la ventilation");
            }
            throw error;
        } finally {
            setSavingLines(false);
        }
    };

    const handleClose = () => {
        form.resetFields();
        onClose?.();
    };

    const repSections = taxUse === 'sale'
        ? [
            { title: 'Factures client', docType: 'out_invoice' },
            { title: 'Avoirs client', docType: 'out_refund' },
        ]
        : taxUse === 'purchase'
            ? [
                { title: 'Factures fournisseur', docType: 'in_invoice' },
                { title: 'Avoirs fournisseur', docType: 'in_refund' },
            ]
            : [];

    const isBusy = loading || savingLines;

    const drawerActions = (
        <Space style={{ width: "100%", display: "flex", paddingRight: 15, justifyContent: "flex-end" }}>
            {taxId && (
                <>
                    <div style={{ flex: 1 }} />
                    <CanAccess permission="accountings.delete">
                        <Popconfirm
                            title="Supprimer cette taxe"
                            description="Êtes-vous sûr de vouloir supprimer cette taxe ?"
                            onConfirm={() => remove()}
                            okText="Oui"
                            cancelText="Non"
                        >
                            <Button danger icon={<DeleteOutlined />}>Supprimer</Button>
                        </Popconfirm>
                    </CanAccess>
                </>
            )}
            <Button onClick={handleClose}>Annuler</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()} loading={isBusy}>
                Enregistrer
            </Button>
        </Space>
    );

    const handleFormFinish = async (values) => {
        if (!taxId) {
            // Création : créer la taxe puis sauvegarder les lignes de répartition
            setSavingLines(true);
            try {
                const res = await taxsApi.create(values);
                const newTax = res.data;
                if (repLines.length > 0) {
                    await handleSaveRepartitionLines(newTax.tax_id);
                }
                message.success('Taxe créée avec succès');
                onSubmit?.({ action: 'create', data: newTax });
                form.resetFields();
                onClose?.();
            } catch (err) {
                const errors = err?.data?.errors;
                if (errors) {
                    const first = Object.values(errors).flat()[0];
                    message.error(first);
                } else {
                    message.error(err?.message ?? "Erreur lors de la création");
                }
            } finally {
                setSavingLines(false);
            }
        } else {
            await submit(values);
            form.resetFields();
        }
    };

    return (
        <Drawer
            title={pageLabel ? `Édition — ${pageLabel}` : "Nouvelle taxe"}
            placement="right"
            onClose={handleClose}
            open={open}
            size={drawerSize}
            footer={drawerActions}
            forceRender
        >
            <Spin spinning={isBusy} tip="Chargement...">
                <Form form={form} layout="vertical" onFinish={handleFormFinish}>
                    <Form.Item name="tax_id" hidden><Input /></Form.Item>

                    {/* ── Informations générales ── */}
                    <div className="box" style={{ marginBottom: 16 }}>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    name="tax_label"
                                    label="Libellé"
                                    rules={[{ required: true, message: "Le libellé est requis" }]}
                                    extra={<span style={{ fontSize: 11, color: '#8c8c8c' }}>Abréviations : <b>Enc.</b> = encaissement (TVA collectée à réception du paiement client) — <b>Déc.</b> = décaissement (TVA déductible à la date du règlement fournisseur)</span>}
                                >
                                    <Input placeholder="Ex : TVA 20% ventes" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="tax_print_label"
                                    label="Libellé sur impression"
                                    rules={[{ required: true, message: "Le libellé est requis" }]}
                                    extra={<span style={{ fontSize: 11, color: '#8c8c8c' }}></span>}
                                >
                                    <Input placeholder="20 %" />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={16}>
                            <Col span={8}>
                                <Form.Item
                                    name="tax_use"
                                    label="Usage"
                                    rules={[{ required: true, message: "Le type est requis" }]}
                                >
                                    <Select placeholder="Sélectionner un type" options={TAX_TYPES} />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item
                                    name="tax_rate"
                                    label="Taux"
                                    rules={[{ required: true, message: "Le taux est requis" }]}
                                >
                                    <InputNumber
                                        min={0} max={100} step={0.01}
                                        style={{ width: '100%' }}
                                        placeholder="20.00"
                                        suffix="%"
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={10}>
                                <Form.Item
                                    name="tax_exigibility"
                                    label="Exigibilité"
                                    rules={[{ required: true, message: "L'exigibilité est requise" }]}
                                    initialValue="on_invoice"
                                >
                                    <Select options={TAX_EXIGIBILITY_TYPES} />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col span={8}>
                                <Form.Item
                                    name="tax_scope"
                                    label="Portée"
                                    rules={[{ required: true, message: "La portée est requise" }]}
                                    initialValue="all"
                                >
                                    <Select options={TAX_SCOPE_TYPES} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="tax_is_active"
                                    label={
                                        <span>
                                            Active&nbsp;
                                            {!hasValidRepartitions && (
                                                <Tooltip title="Configurez la ventilation comptable pour pouvoir activer cette taxe">
                                                    <InfoCircleOutlined style={{ color: '#faad14' }} />
                                                </Tooltip>
                                            )}
                                        </span>
                                    }
                                    valuePropName="checked"
                                    initialValue={false}
                                >
                                    <Switch
                                        checkedChildren="Oui"
                                        unCheckedChildren="Non"
                                        disabled={!hasValidRepartitions}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name="tax_is_default" valuePropName="checked" initialValue={true} style={{ paddingTop: 29 }}>
                                    <Checkbox>Par défaut</Checkbox>
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    {/* ── Ventilation comptable ── */}
                    {repSections.length > 0 && (
                        <CanAccess permission="accountings.edit">
                            <div className="box">
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                    <h4 style={{ margin: 0 }}>Ventilation comptable</h4>
                                    {taxId && (
                                        <Button
                                            size="small"
                                            type="primary"
                                            icon={<SaveOutlined />}
                                            loading={savingLines}
                                            onClick={() => handleSaveRepartitionLines()}
                                        >
                                            Enregistrer
                                        </Button>
                                    )}
                                </div>
                                <p style={{ fontSize: 12, color: "#999", margin: "0 0 10px" }}>
                                    Associez un tag TVA (case CA3) à chaque ligne de ventilation.
                                    Pour l'autoliquidation, ajoutez une ligne TVA supplémentaire avec facteur négatif (−100 %).
                                </p>
                                {repSections.map(({ title, docType }) => (
                                    <RepartitionSection
                                        key={docType}
                                        title={title}
                                        docType={docType}
                                        allLines={repLines}
                                        onLinesChange={setRepLines}
                                    />
                                ))}
                            </div>
                        </CanAccess>
                    )}
                </Form>
            </Spin>
        </Drawer>
    );
}
