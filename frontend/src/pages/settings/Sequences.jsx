import { useState, useEffect, useCallback } from "react";
import { Table, Input, Switch, Button, Tag, Tooltip, Typography, Alert, Spin } from "antd";
import { SaveOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { message } from "../../utils/antdStatic";
import PageContainer from "../../components/common/PageContainer";
import CanAccess from "../../components/common/CanAccess";
import { sequencesApi } from "../../services/api";

const { Text, Paragraph } = Typography;

const MODULE_LABELS = {
    custinvoice:   "Facture client",
    custrefund:    "Avoir client",
    suppinvoice:   "Facture fournisseur",
    supprefund:    "Avoir fournisseur",
    custdeposit:   "Acompte client",
    suppdeposit:   "Acompte fournisseur",
    saleorder:     "Commande client",
    purchaseorder: "Commande fournisseur",
    deliverynote:  "Bon de livraison",
    ticket:        "Ticket assistance",
    expense:       "Note de frais",
    timeentry:     "Saisie de temps",
    payment:       "Paiement",
    contract:      "Contrat",
    charge:        "Charge",
};

const PATTERN_HELP = [
    { token: "{yyyy}", desc: "Année sur 4 chiffres (ex : 2026)" },
    { token: "{yy}",   desc: "Année sur 2 chiffres (ex : 26)" },
    { token: "{mm}",   desc: "Mois sur 2 chiffres (ex : 03)" },
    { token: "{dd}",   desc: "Jour sur 2 chiffres (ex : 15)" },
    { token: "{0000@1}", desc: "Compteur avec 4 chiffres, départ à 1 (ex : 0001, 0042…)" },
    { token: "{000@1}",  desc: "Compteur avec 3 chiffres" },
];

function PatternPreview({ pattern }) {
    if (!pattern) return null;
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const yy   = yyyy.slice(2);
    const mm   = String(now.getMonth() + 1).padStart(2, "0");
    const dd   = String(now.getDate()).padStart(2, "0");
    const preview = pattern
        .replace(/\{yyyy\}/g, yyyy)
        .replace(/\{yy\}/g, yy)
        .replace(/\{mm\}/g, mm)
        .replace(/\{dd\}/g, dd)
        .replace(/\{0+@\d+\}/g, (m) => {
            const zeros = (m.match(/0+/) || ["0"])[0].length;
            return String(1).padStart(zeros, "0");
        });
    return <Text type="secondary" style={{ fontSize: 12, marginTop: 2, display: "block" }}>Aperçu : <code style={{ fontSize: 12 }}>{preview}</code></Text>;
}

export default function Sequences() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState([]);
    const [saving, setSaving] = useState({});

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await sequencesApi.list();
            const data = (res?.data ?? res) ?? [];
            setRows(data.map(r => ({ ...r, _pattern: r.seq_pattern, _yearly: r.seq_yearly_reset })));
        } catch {
            message.error("Erreur lors du chargement des séquences.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleChange = (id, field, value) => {
        setRows(prev => prev.map(r => r.seq_id === id ? { ...r, [field]: value } : r));
    };

    const handleSave = async (row) => {
        setSaving(s => ({ ...s, [row.seq_id]: true }));
        try {
            await sequencesApi.update(row.seq_id, {
                seq_pattern:      row._pattern,
                seq_yearly_reset: row._yearly ? 1 : 0,
            });
            setRows(prev => prev.map(r => r.seq_id === row.seq_id
                ? { ...r, seq_pattern: r._pattern, seq_yearly_reset: r._yearly }
                : r
            ));
            message.success(`Séquence « ${row.seq_label} » mise à jour.`);
        } catch (err) {
            message.error(err?.message ?? "Erreur lors de la sauvegarde.");
        } finally {
            setSaving(s => ({ ...s, [row.seq_id]: false }));
        }
    };

    const isDirty = (row) =>
        row._pattern !== row.seq_pattern || Boolean(row._yearly) !== Boolean(row.seq_yearly_reset);

    const columns = [
        {
            title: "Module",
            dataIndex: "seq_module",
            key: "module",
            width: 200,
            render: (v, row) => (
                <div>
                    <Text strong style={{ fontSize: 13 }}>
                        {MODULE_LABELS[v] ?? row.seq_label}
                    </Text>
                    {row.seq_submodule && (
                        <Text type="secondary" style={{ display: "block", fontSize: 11 }}>
                            {row.seq_submodule}
                        </Text>
                    )}
                </div>
            ),
        },
        {
            title: "Libellé",
            dataIndex: "seq_label",
            key: "label",
            width: 200,
            ellipsis: true,
            render: (v) => <Text type="secondary" style={{ fontSize: 13 }}>{v}</Text>,
        },
        {
            title: (
                <span>
                    Modèle de numérotation
                    <Tooltip title={
                        <div style={{ fontSize: 12 }}>
                            <div style={{ fontWeight: 600, marginBottom: 6 }}>Variables disponibles :</div>
                            {PATTERN_HELP.map(p => (
                                <div key={p.token} style={{ marginBottom: 3 }}>
                                    <code style={{ background: "rgba(255,255,255,0.15)", padding: "1px 4px", borderRadius: 3 }}>{p.token}</code>
                                    {" "}{p.desc}
                                </div>
                            ))}
                        </div>
                    }>
                        <InfoCircleOutlined style={{ marginLeft: 6, color: "var(--color-muted)" }} />
                    </Tooltip>
                </span>
            ),
            key: "pattern",
            
            render: (_, row) => (
                <CanAccess
                    permission="settings.company.edit"
                    fallback={<code style={{ fontSize: 13 }}>{row.seq_pattern}</code>}
                >
                    <div style={{ maxWidth: 250 }}>
                        <Input
                            value={row._pattern}
                            onChange={(e) => handleChange(row.seq_id, "_pattern", e.target.value)}
                            style={{ fontFamily: "monospace", fontSize: 13 }}
                            placeholder="Ex : FA-{yyyy}-{0000@1}"
                        />
                        <PatternPreview pattern={row._pattern} />
                    </div>
                </CanAccess>
            ),
        },
        {
            title: (
                <span>
                    Remise à zéro annuelle
                    <Tooltip title="Si activé, le compteur repart à 1 au 1er janvier de chaque année.">
                        <InfoCircleOutlined style={{ marginLeft: 6, color: "var(--color-muted)" }} />
                    </Tooltip>
                </span>
            ),
            key: "yearly",
            width: 160,
            align: "center",
            render: (_, row) => (
                <CanAccess
                    permission="settings.company.edit"
                    fallback={<Tag color={row.seq_yearly_reset ? "success" : "default"}>{row.seq_yearly_reset ? "Oui" : "Non"}</Tag>}
                >
                    <Switch
                        checked={Boolean(row._yearly)}
                        onChange={(v) => handleChange(row.seq_id, "_yearly", v)}
                        checkedChildren="Oui"
                        unCheckedChildren="Non"
                    />
                </CanAccess>
            ),
        },
        {
            title: "",
            key: "actions",
            width: 200,
            align: "right",
            render: (_, row) => (
                <CanAccess permission="settings.company.edit">
                    <Button
                        icon={<SaveOutlined />}
                        type={isDirty(row) ? "primary" : "default"}
                        size="small"
                        loading={saving[row.seq_id]}
                        disabled={!isDirty(row)}
                        onClick={() => handleSave(row)}
                    >
                        Enregistrer
                    </Button>
                </CanAccess>
            ),
        },
    ];

    return (
        <PageContainer title="Séquences de numérotation">
            <Alert
                type="info"
                showIcon
                message="Paramétrage des numérotations automatiques"
                description={
                    <>
                        Configurez ici le modèle de numérotation de chaque module. Les séquences sont générées automatiquement lors de la création des documents.
                        <br />
                        <strong>Attention :</strong> modifier un pattern n'affecte pas les numéros déjà générés.
                    </>
                }
                style={{ marginBottom: 16 }}
                closable
            />

            <Spin spinning={loading}>
                <Table
                    columns={columns}
                    dataSource={rows}
                    rowKey="seq_id"
                    pagination={false}
                    size="middle"
                    rowClassName={(row) => isDirty(row) ? "row-dirty" : ""}
                    style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-card)" }}
                />
            </Spin>

            <style>{`
                .row-dirty td { background: #fefce8 !important; }
            `}</style>
        </PageContainer>
    );
}
