import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    Steps, Card, Form, Button,
    Tag, Space, Descriptions, Popconfirm, Alert,
    Typography, Divider, Spin, Tooltip, Drawer, Table, Switch, InputNumber
} from "antd";
import {
    ArrowLeftOutlined, ArrowRightOutlined,
    LockOutlined, InfoCircleOutlined,
    SearchOutlined, DeleteOutlined, EditOutlined, CheckCircleOutlined,
} from "@ant-design/icons";
import { Input as AntInput } from "antd";
import PageContainer from "../../components/common/PageContainer";
import PeriodSelector from "../../components/common/PeriodSelector";
import { vatDeclarationsApi, accountingClosuresApi } from "../../services/apiAccounts";
import { accountConfigApi } from "../../services/api";
import { getWritingPeriod } from "../../utils/writingPeriod";
import { message } from "../../utils/antdStatic";
import dayjs from "dayjs";

const { Title } = Typography;

// ── Libellés ──────────────────────────────────────────────────────────────────

const TYPE_LABELS = {
    monthly: "Mensuelle",
    quarterly: "Trimestrielle",
    mini_reel: "Mini-réel",
};

const REGIME_LABELS = {
    debits: "Sur les débits",
    encaissements: "Sur les encaissements",
};

const SYSTEM_LABELS = {
    reel: "CA3 (Régime réel)",
    simplifie: "CA12 (Régime simplifié)",
};

// ── Styles Cerfa — palette officielle DGFiP ───────────────────────────────────

const S = {
    table: {
        width: "100%", borderCollapse: "separate", borderSpacing: 0,
        fontFamily: "Arial, sans-serif", fontSize: 12,
        marginBottom: 0,
        tableLayout: "fixed",
    },
    tableWrapper: {
        borderRadius: 'var(--ant-border-radius-lg)',
        border: "1px solid #afafaf",
        overflow: "hidden",
        marginBottom: 0,
    },
    rowTitle: {
        backgroundColor: "#004586", color: "#fff", fontWeight: 700,
        padding: "5px 10px", textTransform: "uppercase", fontSize: 11,
        letterSpacing: "0.04em", textAlign: "left",
    },
    rowSubtitle: {
        backgroundColor: "#bcdef2", color: "#004586", fontWeight: 600,
        padding: "3px 8px", fontSize: 11,
        borderBottom: "1px solid #afafaf", borderRight: "1px solid #afafaf",
    },
    rowSubtitle2: {
        backgroundColor: "#dce9f5", color: "#004586",
        padding: "3px 8px", fontSize: 11, fontStyle: "italic",
        borderBottom: "1px solid #bcdef2",
    },
    theadTh: {
        backgroundColor: "#bcdef2", color: "#004586", fontWeight: 600,
        padding: "10px 8px", fontSize: 11,
        borderBottom: "1px solid #afafaf", borderRight: "1px solid #afafaf",
    },
    numCell: {
        backgroundColor: "#fcc", color: "#004586", fontWeight: 700,
        textAlign: "center", width: 44, padding: "3px 4px",
        borderRight: "1px solid #afafaf", borderBottom: "1px solid #e0e0e0",
        fontSize: 11, whiteSpace: "nowrap",
    },
    labelCell: {
        padding: "3px 8px",
        borderBottom: "1px solid #e0e0e0", borderRight: "1px solid #afafaf",
        color: "#333", verticalAlign: "middle",
    },
    codeCell: {
        textAlign: "center", width: 64, padding: "3px 4px",
        borderBottom: "1px solid #e0e0e0", borderRight: "1px solid #afafaf",
        fontSize: 10, color: "#666", fontWeight: 400,
    },
    baseCell: {
        textAlign: "center", padding: "3px 6px", width: 130,
        borderBottom: "1px solid #e0e0e0", borderRight: "1px solid #afafaf",
        verticalAlign: "middle",
    },
    amtCell: {
        textAlign: "center", padding: "3px 6px",
        borderBottom: "1px solid #e0e0e0", borderRight: "1px solid #afafaf",
        verticalAlign: "middle"
    },
    valueBox: {
        backgroundColor: "#dfdfd7", border: "1px solid #afafaf",
        display: "inline-block", textAlign: "right",
        padding: "1px 5px", minWidth: 90, color: "#333",
    },
};


// ── Rendu Cerfa ───────────────────────────────────────────────────────────────

// Style commun des cellules de valeur Cerfa (lecture seule)
const S_VALUE = {
    backgroundColor: "#dfdfd7", border: "1px solid #afafaf", borderRadius: 'var(--radius-input)',
    display: "inline-block", textAlign: "right",
    padding: "1px var(--space-sm)", minWidth: 110, color: "#333",
    fontFamily: "Arial, sans-serif", fontSize: 12,
};
const S_VALUE_FORMULA = {
    ...S_VALUE,
    backgroundColor: "#e8eaf0", fontWeight: 700,
};


function NumCell({ value, isFormula, hasTag, extraStyle = {} }) {
    // if (!hasTag) return <span style={{ ...S_VALUE_EMPTY, ...extraStyle }}>—</span>;
    const style = isFormula ? { ...S_VALUE_FORMULA, ...extraStyle } : { ...S_VALUE, ...extraStyle };
    return <span style={style}>{Math.round(value ?? 0).toLocaleString("fr-FR")}</span>;
}

/**
 * Rendu d'une ligne DATA ou FORMULA.
 *
 * - showBaseCol / showTaxCol : colonne affichée si trm_has_base_ht/trm_has_tax_amt != 0
 *   (null = pas encore en DB → on affiche tout par défaut)
 * - baseActive / taxActive : input actif si tag configuré (vdl_label/tax = 1)
 * - FORMULA / computed : input en lecture seule
 */
const MANUAL_TYPES = ["PREVIOUS_CREDIT", "REFUND_REQUESTED"];

function BoxRow({ line, declarationId, onDrill, indent = 0, isDraft = false, onLineAmountChange }) {
    const box = line.vdl_box;
    const isFormula = line.vdl_row_type === "FORMULA" || line.vdl_row_type === "TOTAL";
    const isManual = isDraft && MANUAL_TYPES.includes(line.vdl_special_type);

    const showBaseCol = !!line.vdl_has_base_ht;
    const showTaxCol = !!line.vdl_has_tax_amt || isFormula;

    const amt = line.vdl_amount_tva ?? 0;
    const labelPadding = 8 + indent * 14;

    const [editValue, setEditValue] = useState(amt);
    useEffect(() => { setEditValue(amt); }, [amt]);

    const vdlId = line.vdl_id;

    const drillIcon = (declarationId && !isFormula) ? (
        <Tooltip title="Voir les écritures sources">
            <Button
                type="link"
                size="small"
                icon={<SearchOutlined />}
                style={{ padding: "0 2px", color: "#bbb", marginLeft: 4 }}
                onClick={() => onDrill(vdlId, declarationId)}
            />
        </Tooltip>
    ) : null;

    const taxCell = isManual ? (
        <InputNumber
            value={editValue}
            onChange={setEditValue}
            onBlur={() => onLineAmountChange && onLineAmountChange(line, editValue ?? 0)}
            min={0}
            precision={0}
            style={{ ...S_VALUE, width: 110, border: "1px solid #1677ff", padding: "0 4px", display: "inline-block" }}
            controls={false}
            size="small"
        />
    ) : (
        showTaxCol && <NumCell value={amt} isFormula={isFormula} />
    );

    return (
        <tr>
            <td style={S.numCell}>{box}</td>
            <td style={{ ...S.labelCell, paddingLeft: labelPadding }}>
                <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    {isFormula ? <strong>{line.vdl_label}</strong> : line.vdl_label}
                </span>
            </td>
            <td style={S.codeCell}>{line.vdl_dgfip_code ?? ""}</td>
            <td style={S.baseCell}>
                {showBaseCol && (
                    <NumCell value={line.vdl_base_ht} isFormula={isFormula} />
                )}
            </td>
            <td style={S.amtCell}>{taxCell}</td>
            <td style={S.amtCell}> {drillIcon}</td>
        </tr>
    );
}

/**
 * Rendu du Cerfa complet.
 *
 * La hiérarchie est déduite de fk_trm_id_parent / trm_order côté backend,
 * qui se reflète dans l'ordre des lignes et leur vdl_row_type :
 *   TITLE → profondeur 0  (en-tête de cadre, ex : "OPÉRATIONS IMPOSABLES")
 *   SUBTITLE → profondeur 1  (sous-cadre)
 *   SUBTITLE2 → profondeur 2  (sous-sous-cadre)
 *   DATA / TOTAL → ligne de données indentée selon la profondeur courante
 *
 * On track l'indent courant en itérant dans l'ordre de vdl_order.
 */
function CerfaTable({ lines, declarationId, onDrill, isDraft = false, onLineAmountChange }) {

    let currentIndent = 0;
    const rows = (lines || []).map((line, idx) => {
        switch (line.vdl_row_type) {
            case "TITLE":
                currentIndent = 0;
                return (
                    <tr key={idx}>
                        <td colSpan={6} style={S.rowTitle}>
                            {line.vdl_label}
                        </td>
                    </tr>
                );
            case "SUBTITLE":
                currentIndent = 1;
                return (
                    <tr key={idx}>
                        <td colSpan={6} style={S.rowSubtitle}>
                            {line.vdl_label}
                        </td>
                    </tr>
                );
            case "SUBTITLE2":
                currentIndent = 2;
                return (
                    <tr key={idx}>
                        <td colSpan={6} style={S.rowSubtitle2}>
                            {line.vdl_label}
                        </td>
                    </tr>
                );
            default:
                return (
                    <BoxRow
                        key={idx}
                        line={line}
                        declarationId={declarationId}
                        onDrill={onDrill}
                        indent={currentIndent}
                        isDraft={isDraft}
                        onLineAmountChange={onLineAmountChange}
                    />
                );
        }
    });

    return (
        <div style={S.tableWrapper}>
        <div style={{ fontFamily: "Arial, sans-serif", fontSize: 12 }}>
            <table style={S.table} cellPadding={0} cellSpacing={0}>
                <colgroup>
                    <col style={{ width: 44 }} />
                    <col />
                    <col style={{ width: 64 }} />
                    <col style={{ width: 130 }} />
                    <col style={{ width: 140 }} />
                    <col style={{ width: 40 }} />
                </colgroup>
                <thead>
                    <tr>
                        <th style={{ ...S.theadTh, textAlign: "center" }}>N°</th>
                        <th style={S.theadTh}>Libellé</th>
                        <th style={{ ...S.theadTh, textAlign: "center" }}>Code</th>
                        <th style={{ ...S.theadTh, textAlign: "center" }}>Base HT (€)</th>
                        <th style={{ ...S.theadTh, textAlign: "center", borderRight: "none" }}>TVA (€)</th>
                        <th style={S.theadTh}></th>
                    </tr>
                </thead>
                <tbody>{rows}</tbody>
            </table>
        </div>
        </div>
    );
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function VatDeclaration() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isNew = id === "new";

    const [form] = Form.useForm();
    const [step, setStep] = useState(0);
    const [initLoading, setInitLoading] = useState(true);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [confirming, setConfirming] = useState(false);

    // Config
    const [vatConfig, setVatConfig] = useState(null);
    const [writingPeriod, setWritingPeriod] = useState(null);

    // Données
    const [declaration, setDeclaration] = useState(null);
    const [previewLines, setPreviewLines] = useState([]);
    const [creditPrevious, setCreditPrevious] = useState(0);
    const [includeDraft, setIncludeDraft] = useState(true);

    // Drill-down
    const [auditDrawer, setAuditDrawer] = useState(false);
    const [auditBox, setAuditBox] = useState(null);
    const [auditLines, setAuditLines] = useState([]);
    const [auditLoading, setAuditLoading] = useState(false);

    const savedFormValues = useRef(null);

    // ── Suppression brouillon ─────────────────────────────────────────────────

    const handleDelete = async () => {
        if (!declaration?.vdc_id) return;
        try {
            await vatDeclarationsApi.delete(declaration.vdc_id);
            message.success("Déclaration supprimée.");
            navigate("/vat-declarations");
        } catch (e) {
            const data = e?.response?.data;
            message.error(data?.message || "Erreur lors de la suppression.");
        }
    };

    // ── Initialisation ────────────────────────────────────────────────────────

    const init = useCallback(async () => {
        setInitLoading(true);
        try {
            const [cfgRes, wp, exRes] = await Promise.all([
                accountConfigApi.get(),
                getWritingPeriod(),
                accountingClosuresApi.getCurrentExercise(),
            ]);

            const cfg = cfgRes.data;
            const regime = cfg.aco_vat_regime || "debits";
            const periodicity = cfg.aco_vat_periodicity || "monthly";
            const vatSystem = cfg.aco_vat_system || "reel";
            setVatConfig({ regime, periodicity, vatSystem });
            setWritingPeriod(wp);

            if (isNew) {
                const listRes = await vatDeclarationsApi.list({ per_page: 1, sort: "vdc_period_end", dir: "desc" });
                const lastDecl = listRes.data?.[0] || null;

                const creditBox = vatSystem === "simplifie" ? "T4" : "27";
                const creditLine = (lastDecl?.lines || []).find((l) => l.vdl_box === creditBox);
                setCreditPrevious(creditLine?.vdl_amount_tva > 0 ? creditLine.vdl_amount_tva : 0);

                const exerciseStart = exRes.data?.start_date;
                const exerciseEnd   = exRes.data?.end_date;
                form.setFieldsValue({
                    period: {
                        start: exerciseStart || null,
                        end:   exerciseEnd   || null,
                    },
                });
            } else {
                const res = await vatDeclarationsApi.get(id);
                const d = res.data;
                setDeclaration(d);

                setPreviewLines(d.lines);

                /* const localVatSystem = d.vdc_system || vatSystem;
                 const creditBox = localVatSystem === "simplifie" ? "R5" : "22";
                 const creditLine = (d.lines || []).find((l) => l.vdl_box === creditBox);
                 setCreditPrevious(creditLine?.vdl_amount_tva || 0);*/

                form.setFieldsValue({
                    period: { start: d.vdc_period_start, end: d.vdc_period_end },
                });

                setStep(1);
            }
        } catch {
            message.error("Erreur lors du chargement de la configuration TVA.");
        } finally {
            setInitLoading(false);
        }
    }, [id, isNew, form]);

    useEffect(() => { init(); }, [init]);

    // ── Étape 0 → 1 : Calculer et sauvegarder ────────────────────────────────

    const handlePreview = async (values) => {
        setPreviewLoading(true);
        try {
            // Supprimer le brouillon précédent si existant
            if (declaration?.vdc_id && declaration.vdc_status === "draft") {
                try { await vatDeclarationsApi.delete(declaration.vdc_id); } catch { /* ignore */ }
                setDeclaration(null);
            }

            // Calculer ET sauvegarder en une seule étape
            const saveRes = await vatDeclarationsApi.create({
                period_start: values.period?.start,
                period_end: values.period?.end,
                type: vatConfig.periodicity,
                regime: vatConfig.regime,
                credit_previous: creditPrevious,
                vat_system: vatConfig.vatSystem,
                include_draft: includeDraft,
            });

            savedFormValues.current = values;
            setDeclaration(saveRes.data);
            setPreviewLines(saveRes.data.lines || []);
            setStep(1);
            navigate(`/vat-declarations/${saveRes.data.vdc_id}`, { replace: true });
        } catch (e) {
            const data = e?.response?.data;
            if (data?.errors) {
                Object.values(data.errors).flat().forEach((m) => message.error(m));
            } else {
                message.error(data?.message || "Erreur lors du calcul.");
            }
        } finally {
            setPreviewLoading(false);
        }
    };

    // ── Drill-down ────────────────────────────────────────────────────────────

    const openDrillDown = async (vdlId, vdclId) => {

        setAuditLines([]);
        setAuditDrawer(true);
        setAuditLoading(true);

        try {
            const res = await vatDeclarationsApi.boxLines(vdclId, vdlId);
            setAuditLines(res.data || []);
        } catch {
            setAuditLines([]);
        }

        setAuditLoading(false);
    };

    // ── Modification manuelle (PREVIOUS_CREDIT / REFUND_REQUESTED) ───────────

    const handleManualLineChange = async (line, newAmount) => {
        if (!declaration?.vdc_id) return;
        try {
            const res = await vatDeclarationsApi.updateLineAmount(declaration.vdc_id, line.vdl_id, newAmount);
            setPreviewLines(res.data?.lines || []);
        } catch (e) {
            message.error(e?.response?.data?.message || "Erreur lors de la mise à jour.");
        }
    };

    // ── Clôture (génère l'OD + passe en closed) ──────────────────────────────

    const handleClose = async () => {
        setConfirming(true);
        try {
            await vatDeclarationsApi.close(declaration.vdc_id);
            // Recharger via show() pour obtenir vdc_can_delete et les relations à jour
            const fresh = await vatDeclarationsApi.get(declaration.vdc_id);
            setDeclaration(fresh.data);
            setPreviewLines(fresh.data?.lines || previewLines);
            message.success("Déclaration clôturée — écriture OD générée.");
        } catch (e) {
            message.error(e?.response?.data?.message || "Erreur lors de la clôture.");
        } finally {
            setConfirming(false);
        }
    };

    // ── Données pour alertes ──────────────────────────────────────────────────

    const isCA12 = vatConfig?.vatSystem === "simplifie" || declaration?.vdc_system === "simplifie";
    const creditOutputBox = isCA12 ? "T4" : "27";
    const creditInputBox = isCA12 ? "R5" : "22";
    const creditOutputLine = previewLines.find((l) => l.vdl_box === creditOutputBox);

    const wpStart = writingPeriod ? dayjs(writingPeriod.startDate) : undefined;
    const wpEnd = writingPeriod ? dayjs(writingPeriod.endDate) : undefined;

    const [labelEditing, setLabelEditing] = useState(false);
    const [labelValue, setLabelValue] = useState("");

    const isDraft = declaration?.vdc_status === "draft";

    const handleLabelEdit = () => {
        setLabelValue(declaration?.vdc_label || "");
        setLabelEditing(true);
    };

    const handleLabelSave = async () => {
        if (!labelValue.trim()) { setLabelEditing(false); return; }
        try {
            const res = await vatDeclarationsApi.updateLabel(declaration.vdc_id, labelValue.trim());
            setDeclaration(prev => ({ ...prev, vdc_label: res.data.vdc_label }));
        } catch {
            message.error("Erreur lors de la mise à jour du libellé.");
        }
        setLabelEditing(false);
    };

    const pageTitle = isNew
        ? `Nouvelle déclaration TVA (${vatConfig?.vatSystem === "simplifie" ? "CA12" : "CA3"})`
        : declaration
            ? (labelEditing
                ? <AntInput
                    value={labelValue}
                    onChange={e => setLabelValue(e.target.value)}
                    onPressEnter={handleLabelSave}
                    onBlur={handleLabelSave}
                    autoFocus
                    style={{ width: 260, fontSize: 16, fontWeight: 600 }}
                    suffix={<CheckCircleOutlined onClick={handleLabelSave} style={{ cursor: "pointer", color: "#1677ff" }} />}
                  />
                : <span>
                    {declaration.vdc_label || `Déclaration TVA ${dayjs(declaration.vdc_period_start).format("MM/YYYY")}`}
                    {isDraft && (
                        <EditOutlined
                            onClick={handleLabelEdit}
                            style={{ marginLeft: 10, fontSize: 14, color: "#1677ff", cursor: "pointer" }}
                        />
                    )}
                  </span>)
            : "Déclaration TVA";


    return (
        <PageContainer
            title={pageTitle}
            actions={
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/vat-declarations")}>
                    Retour
                </Button>
            }
        >
            <Spin spinning={initLoading} tip="Chargement de la configuration TVA…">

                {/* ── ÉTAPE 0 : SAISIE PÉRIODE ── */}
                {step === 0 && (
                    <Card>
                        {vatConfig && (
                            <Alert
                                type="info"
                                showIcon
                                icon={<InfoCircleOutlined />}
                                style={{ marginBottom: 20 }}
                                title={
                                    <>
                                        Formulaire : <strong>{SYSTEM_LABELS[vatConfig.vatSystem] || vatConfig.vatSystem}</strong>
                                        {" · Périodicité : "}
                                        <strong>{TYPE_LABELS[vatConfig.periodicity] || vatConfig.periodicity}</strong>
                                        {" · Régime : "}
                                        <strong>{REGIME_LABELS[vatConfig.regime] || vatConfig.regime}</strong>
                                        . Ces paramètres sont configurés dans les <em>Paramètres comptables</em>.
                                    </>
                                }
                            />
                        )}

                        <Form form={form} layout="vertical" onFinish={handlePreview}>
                            <Form.Item
                                label="Période de déclaration"
                                name="period"
                                rules={[{
                                    validator: (_, v) =>
                                        v?.start && v?.end
                                            ? Promise.resolve()
                                            : Promise.reject("Sélectionnez une période"),
                                }]}
                                extra={
                                    writingPeriod && (
                                        <span style={{ color: "#888", fontSize: 12 }}>
                                            Période d'écriture autorisée :{" "}
                                            {dayjs(writingPeriod.startDate).format("DD/MM/YYYY")} —{" "}
                                            {dayjs(writingPeriod.endDate).format("DD/MM/YYYY")}
                                        </span>
                                    )
                                }
                            >
                                <PeriodSelector
                                    presets={true}
                                    minDate={wpStart}
                                    maxDate={wpEnd}
                                />
                            </Form.Item>

                            <Form.Item>
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    <Space align="center">
                                        <Switch
                                            checked={includeDraft}
                                            onChange={setIncludeDraft}
                                            size="small"
                                        />
                                        <span style={{ color: includeDraft ? "#d46b08" : "#888", fontSize: 13 }}>
                                            Inclure les écritures en brouillon (non comptabilisées)
                                        </span>
                                    </Space>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        loading={previewLoading}
                                        icon={<ArrowRightOutlined />}
                                        size="large"
                                    >
                                        Calculer la déclaration
                                    </Button>
                                </div>
                            </Form.Item>
                        </Form>
                    </Card>
                )}

                {/* ── ÉTAPE 1 : PRÉVISUALISATION ── */}
                {step === 1 && (
                    <Card>
                        <Title level={5} style={{ marginBottom: 16 }}>
                            Prévisualisation — vérifiez les montants avant validation
                        </Title>

                        <Descriptions bordered size="small" style={{ marginBottom: 16 }}>
                            <Descriptions.Item label="Période">
                                {dayjs(declaration.vdc_period_start).format("DD/MM/YYYY")} —{" "}
                                {dayjs(declaration.vdc_period_end).format("DD/MM/YYYY")}
                            </Descriptions.Item>
                            <Descriptions.Item label="Formulaire">
                                {SYSTEM_LABELS[declaration.vdc_system] || "CA3"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Type">
                                {TYPE_LABELS[declaration.vdc_type] || declaration.vdc_type}
                            </Descriptions.Item>
                            <Descriptions.Item label="Régime">
                                {REGIME_LABELS[declaration.vdc_regime] || declaration.vdc_regime}
                            </Descriptions.Item>
                            <Descriptions.Item label="Statut">
                                <Tag color={declaration.vdc_status === "closed" ? "green" : "default"}>
                                    {declaration.vdc_status === "closed" ? "Clôturée" : "Brouillon"}
                                </Tag>
                            </Descriptions.Item>
                            {declaration.move && (
                                <Descriptions.Item label="Écriture OD">
                                    {declaration.move.amo_piece} — {declaration.move.amo_label}
                                </Descriptions.Item>
                            )}
                        </Descriptions>

                        <Spin spinning={previewLoading}>
                            <CerfaTable
                                lines={previewLines}
                                declarationId={declaration?.vdc_id}
                                onDrill={openDrillDown}
                                isDraft={isDraft}
                                onLineAmountChange={handleManualLineChange}
                            />
                        </Spin>
                        {creditOutputLine && creditOutputLine.vdl_amount_tva > 0 && (
                            <Alert
                                type="success"
                                showIcon
                                style={{ marginBottom: 16, marginTop: 16 }}
                                title={
                                    <>
                                        <strong>
                                            Crédit de TVA à reporter (case {creditOutputBox}) :{" "}
                                            {Number(creditOutputLine.vdl_amount_tva).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                                        </strong>
                                        <div>Ce montant sera reporté en case {creditInputBox} de votre prochaine déclaration.</div>
                                    </>
                                }
                            />
                        )}
                        <Divider />
                        <Space style={{ width: "100%", display: "flex", paddingRight: "15px", justifyContent: "flex-end" }}>
                            {declaration?.vdc_can_delete && (
                                <Popconfirm
                                    title={isDraft ? "Supprimer ce brouillon ?" : "Annuler cette déclaration clôturée ?"}
                                    description={
                                        isDraft
                                            ? "Les écritures comptables verrouillées seront libérées."
                                            : <span style={{ maxWidth: 360, display: "block" }}>
                                                L'écriture OD sera supprimée et les lettrages associés
                                                annulés. Cette action est irréversible.
                                              </span>
                                    }
                                    onConfirm={handleDelete}
                                    okText="Supprimer"
                                    cancelText="Annuler"
                                    okButtonProps={{ danger: true }}
                                >
                                    <Button danger icon={<DeleteOutlined />} size="large">
                                        Supprimer
                                    </Button>
                                </Popconfirm>
                            )}

                            {isDraft && (
                                <Popconfirm
                                    title="Valider et clôturer la déclaration ?"
                                    description={
                                        <span style={{ maxWidth: 360, display: "block" }}>
                                            Cette action génère une écriture OD en comptabilité et
                                            clôture définitivement la déclaration. Les écritures
                                            comptables de cette période ne seront plus modifiables.
                                            Cette action est irréversible.
                                        </span>
                                    }
                                    onConfirm={handleClose}
                                    okText="Valider et clôturer"
                                    cancelText="Annuler"
                                    okButtonProps={{ danger: true }}
                                >
                                    <Button type="primary" icon={<LockOutlined />} loading={confirming} size="large">
                                        Valider et clôturer
                                    </Button>
                                </Popconfirm>
                            )}
                        </Space>
                    </Card>
                )}
            </Spin>

            {/* ── DRAWER DRILL-DOWN ── */}
            <Drawer
                title={`Écritures sources`}
                open={auditDrawer}
                onClose={() => setAuditDrawer(false)}
                styles={{ body: { padding: 12 }, wrapper: { width: '50%' } }}
            >
                <Spin spinning={auditLoading}>
                    <Table
                        dataSource={auditLines}
                        rowKey="aml_id"
                        size="small"
                        pagination={false}
                        scroll={{ x: true }}
                        locale={{ emptyText: "Aucune écriture trouvée pour cette case." }}
                        columns={[

                            {
                                title: "Écrit.",
                                dataIndex: "amo_id",
                                width: 100,
                                render: (id) => id
                                    ? <a href={`/account-moves/${id}`} target="_blank" rel="noopener noreferrer">{id}</a>
                                    : '-',
                            },
                            {
                                title: "Date",
                                dataIndex: "amo_date",
                                width: 80,
                                render: (v) => v ? dayjs(v).format("DD/MM/YYYY") : "—",
                            },
                            {
                                title: "Compte",
                                dataIndex: "acc_code",
                                width: 90,
                                render: (code, row) => (
                                    <Tooltip title={row.acc_label}>
                                        <span style={{ fontFamily: "monospace" }}>{code}</span>
                                    </Tooltip>
                                ),
                            },
                            {
                                title: "Libellé",
                                dataIndex: "aml_label",
                                ellipsis: true,
                            },
                            {
                                title: "Débit (€)",
                                dataIndex: "aml_debit",
                                align: "right",
                                width: 100,
                                render: (v) => v > 0
                                    ? v.toLocaleString("fr-FR", { minimumFractionDigits: 2 })
                                    : "",
                            },
                            {
                                title: "Crédit (€)",
                                dataIndex: "aml_credit",
                                align: "right",
                                width: 100,
                                render: (v) => v > 0
                                    ? v.toLocaleString("fr-FR", { minimumFractionDigits: 2 })
                                    : "",
                            },
                        ]}

                    />

                </Spin>
            </Drawer>
        </PageContainer>
    );
}
