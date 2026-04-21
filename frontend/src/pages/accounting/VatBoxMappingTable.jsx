import { useState, useEffect, useCallback } from "react";
import { Spin, Tag, Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import { message } from "../../utils/antdStatic";
import { vatReportMappingApi } from "../../services/apiAccounts";

// ── Styles DGFiP (palette officielle CA3-SD) ──────────────────────────────────

const S = {
    table: {
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 12,
        fontFamily: "Arial, sans-serif",
        marginBottom: 8,
        border: "1px solid #afafaf",
    },
    n1Th: {
        backgroundColor: "#004586",
        color: "#fff",
        fontWeight: 700,
        textTransform: "uppercase",
        padding: "6px 8px",
        textAlign: "left",
        fontSize: 11,
        letterSpacing: 0.5,
    },
    n2Th: {
        backgroundColor: "#bcdef2",
        color: "#004586",
        fontWeight: 600,
        padding: "4px 8px",
        textAlign: "left",
        fontSize: 11,
        borderBottom: "1px solid #afafaf",
    },
    codeCell: {
        backgroundColor: "#fcc",
        color: "#004586",
        fontWeight: 700,
        width: 44,
        textAlign: "center",
        padding: "3px 5px",
        border: "1px solid #e8e8e8",
        whiteSpace: "nowrap",
        fontSize: 11,
    },
    labelCell: {
        padding: "3px 8px",
        border: "1px solid #e8e8e8",
        color: "#222",
        verticalAlign: "middle",
    },
    typeCell: {
        padding: "3px 6px",
        border: "1px solid #e8e8e8",
        width: 110,
        textAlign: "center",
        verticalAlign: "middle",
    },
    signCell: {
        padding: "3px 6px",
        border: "1px solid #e8e8e8",
        width: 50,
        textAlign: "center",
        verticalAlign: "middle",
        color: "#555",
    },
    tagCell: {
        padding: "3px 8px",
        border: "1px solid #e8e8e8",
        width: 240,
        verticalAlign: "middle",
        color: "#555",
        fontSize: 11,
    },
    formulaCell: {
        padding: "3px 8px",
        border: "1px solid #e8e8e8",
        width: 220,
        verticalAlign: "middle",
        color: "#777",
        fontSize: 11,
        fontFamily: "monospace",
    },
    computedRow: {
        backgroundColor: "#f5f5f0",
    },
    editableRow: {
        backgroundColor: "#f0f8ff",
    },
};

// ── Libellés ──────────────────────────────────────────────────────────────────

const AMOUNT_TYPE_LABELS = {
    base_ht:    { color: "geekblue", label: "Base HT" },
    tax_amount: { color: "purple",   label: "Montant TVA" },
    computed:   { color: "gold",     label: "Calculée" },
};

const REGIME_LABELS = {
    CA3:  "CA3",
    CA12: "CA12",
    BOTH: "CA3 + CA12",
};

// ── Rendu de la formule JSON ──────────────────────────────────────────────────

function renderFormula(formula) {
    if (!formula) return null;
    if (formula.op === "sum") {
        return `Σ(${(formula.boxes || []).join(", ")})`;
    }
    if (formula.op === "diff") {
        return `${formula.minuend} − ${formula.subtrahend}`;
    }
    if (formula.op === "max0diff") {
        return `max(0, ${formula.minuend} − ${formula.subtrahend})`;
    }
    return JSON.stringify(formula);
}

// ── Composant principal ───────────────────────────────────────────────────────

/**
 * VatBoxMappingTable — Table de consultation du mapping TVA tag-based.
 *
 * @param {string}  regime   'CA3' | 'CA12'
 * @param {boolean} disabled Non utilisé (conservé pour compatibilité parent)
 */
export default function VatBoxMappingTable({ regime = "CA3", disabled = false }) {
    const [loading, setLoading] = useState(false);
    const [rows, setRows]       = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await vatReportMappingApi.list(regime);
            setRows(res?.data?.data ?? []);
        } catch {
            message.error("Impossible de charger le mapping TVA.");
        } finally {
            setLoading(false);
        }
    }, [regime]);

    useEffect(() => { load(); }, [load]);

    if (loading) {
        return <Spin size="small" style={{ display: "block", margin: "24px auto" }} />;
    }

    if (rows.length === 0) {
        return (
            <div style={{ padding: 16, color: "#888", textAlign: "center" }}>
                Aucun mapping configuré pour le régime {regime}.
            </div>
        );
    }

    // Grouper par section
    const sections = [];
    const seen = {};
    for (const r of rows) {
        const sec = r.trm_section || "Autres";
        if (!seen[sec]) {
            seen[sec] = [];
            sections.push({ section: sec, rows: seen[sec] });
        }
        seen[sec].push(r);
    }

    return (
        <div>
            {sections.map(({ section, rows: sRows }) => (
                <table key={section} style={S.table} cellPadding={0} cellSpacing={0}>
                    <colgroup>
                        <col style={{ width: 44 }} />
                        <col />
                        <col style={{ width: 110 }} />
                        <col style={{ width: 50 }} />
                        <col style={{ width: 240 }} />
                        <col style={{ width: 220 }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th colSpan={6} style={S.n1Th}>{section}</th>
                        </tr>
                        <tr>
                            <th style={{ ...S.n2Th, textAlign: "center" }}>N°</th>
                            <th style={S.n2Th}>Libellé</th>
                            <th style={{ ...S.n2Th, textAlign: "center" }}>Type</th>
                            <th style={{ ...S.n2Th, textAlign: "center" }}>Signe</th>
                            <th style={S.n2Th}>Tag TVA</th>
                            <th style={S.n2Th}>Formule / Infos</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sRows.map((r) => {
                            const typeCfg = AMOUNT_TYPE_LABELS[r.trm_amount_type] || { color: "default", label: r.trm_amount_type };
                            const isComputed = r.trm_amount_type === "computed";
                            const isEditable = !!r.trm_is_editable;
                            const rowStyle = isComputed ? S.computedRow : isEditable ? S.editableRow : {};

                            return (
                                <tr key={r.trm_id} style={rowStyle}>
                                    <td style={S.codeCell}>{r.trm_box}</td>
                                    <td style={S.labelCell}>
                                        {isComputed
                                            ? <strong>{r.trm_label}</strong>
                                            : r.trm_label}
                                        {isEditable && (
                                            <Tooltip title="Case saisissable manuellement">
                                                <Tag color="cyan" style={{ marginLeft: 6, fontSize: 10 }}>Saisie</Tag>
                                            </Tooltip>
                                        )}
                                        {r.trm_regime !== "BOTH" && r.trm_regime !== regime && (
                                            <Tag color="default" style={{ marginLeft: 4, fontSize: 10 }}>
                                                {REGIME_LABELS[r.trm_regime]}
                                            </Tag>
                                        )}
                                    </td>
                                    <td style={S.typeCell}>
                                        <Tag color={typeCfg.color}>{typeCfg.label}</Tag>
                                    </td>
                                    <td style={S.signCell}>
                                        {isComputed ? (
                                            <span style={{ color: "#bbb" }}>—</span>
                                        ) : r.trm_sign === 1 ? (
                                            <span style={{ color: "#cf1322", fontWeight: 700 }}>+</span>
                                        ) : (
                                            <span style={{ color: "#389e0d", fontWeight: 700 }}>−</span>
                                        )}
                                    </td>
                                    <td style={S.tagCell}>
                                        {r.tag_code ? (
                                            <Tooltip title={r.tag_name}>
                                                <code style={{ fontSize: 11 }}>{r.tag_code}</code>
                                            </Tooltip>
                                        ) : isComputed ? (
                                            <span style={{ color: "#bbb", fontStyle: "italic" }}>calculée</span>
                                        ) : isEditable ? (
                                            <span style={{ color: "#bbb", fontStyle: "italic" }}>saisie manuelle</span>
                                        ) : (
                                            <span style={{ color: "#f5222d" }}>
                                                <InfoCircleOutlined /> non mappé
                                            </span>
                                        )}
                                        {r.trm_tax_rate > 0 && (
                                            <span style={{ marginLeft: 6, color: "#888" }}>({r.trm_tax_rate}%)</span>
                                        )}
                                    </td>
                                    <td style={S.formulaCell}>
                                        {isComputed && r.trm_formula
                                            ? renderFormula(r.trm_formula)
                                            : null}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            ))}
        </div>
    );
}
