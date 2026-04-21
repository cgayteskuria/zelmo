import { useState, useCallback, useMemo, useEffect, useRef, lazy, Suspense } from "react";
import {
    Button, Input, InputNumber, Space, Spin, App, Popconfirm,
    Tag, Typography, Select, Dropdown, Tooltip, DatePicker, Alert,
} from "antd";
import {
    DeleteOutlined, ArrowLeftOutlined, SendOutlined,
    ClockCircleOutlined, FileTextOutlined, UserOutlined, MailOutlined,
    PushpinOutlined, DownOutlined, InboxOutlined, TeamOutlined,
    EditOutlined, CheckOutlined, CloseOutlined, MergeCellsOutlined,
    HistoryOutlined, PaperClipOutlined, FileOutlined, FilePdfOutlined,
    FileImageOutlined, FileExcelOutlined, FileWordOutlined, MobileOutlined, IdcardOutlined, DesktopOutlined,
    LeftOutlined, RightOutlined
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useListNavigation } from "../../hooks/useListNavigation";
import dayjs from "dayjs";
import DOMPurify from "dompurify";
import RichTextEditor from "../../components/common/RichTextEditor";
import PageContainer from "../../components/common/PageContainer";
import { ticketsApi, documentsApi } from "../../services/api";
import { ARTICLE_COLORS, getArticleDisplayType } from "../../configs/TicketConfig";
import CanAccess from "../../components/common/CanAccess";

// Select components
import ContactSelect from "../../components/select/ContactSelect";
import Contact from "../crm/Contact";
import UserSelect from "../../components/select/UserSelect";
import TicketPrioritySelect from "../../components/select/TicketPrioritySelect";
import TicketSourceSelect from "../../components/select/TicketSourceSelect";
import TicketCategorySelect from "../../components/select/TicketCategorySelect";
import TicketGradeSelect from "../../components/select/TicketGradeSelect";

// Sous-composants ticket
import TicketMergeModal from "./TicketMergeModal";
import TicketTemplatesPicker from "./TicketTemplatesPicker";
import TicketLinksPanel from "./TicketLinksPanel";

// Lazy load du formulaire de création
const TicketCreate = lazy(() => import("./TicketCreate"));

const { Text } = Typography;

const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20 Mo

const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 o";
    if (bytes < 1024) return bytes + " o";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " Ko";
    return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
};

const getFileIcon = (fileName) => {
    const ext = fileName?.split(".").pop()?.toLowerCase();
    switch (ext) {
        case "pdf": return <FilePdfOutlined style={{ color: "#ff4d4f" }} />;
        case "jpg": case "jpeg": case "png": case "gif": case "webp":
            return <FileImageOutlined style={{ color: "#1890ff" }} />;
        case "xls": case "xlsx": case "csv":
            return <FileExcelOutlined style={{ color: "#52c41a" }} />;
        case "doc": case "docx":
            return <FileWordOutlined style={{ color: "#2f54eb" }} />;
        default: return <FileOutlined />;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers UI
// ─────────────────────────────────────────────────────────────────────────────
function getInitials(name) {
    if (!name) return "?";
    const parts = name.trim().split(" ").filter(Boolean);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function BubbleAvatar({ name, color = "#1677ff", size = 28 }) {
    return (
        <div style={{
            width: size, height: size, borderRadius: "50%",
            backgroundColor: color, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: Math.round(size * 0.38), fontWeight: 600, flexShrink: 0,
            opacity: 0.85, marginTop: 4,
        }}>
            {getInitials(name)}
        </div>
    );
}

function SidebarSection({ title, action, children }) {
    return (
        <div style={{ borderBottom: "1px solid #e8e8e8", paddingBottom: 10, marginBottom: 0 }}>
            {(title || action) && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, paddingBottom: 6 }}>
                    {title && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                            {title}
                        </span>
                    )}
                    {action}
                </div>
            )}
            {children}
        </div>
    );
}

function PropRow({ label, children }) {
    return (
        <div style={{ display: "flex", alignItems: "center", minHeight: 30, gap: 6 }}>
            <span style={{ width: 82, flexShrink: 0, fontSize: 11, color: "#888" }}>{label}</span>
            <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
        </div>
    );
}

// Champ inline générique : affiche le texte, clic → ouvre renderEdit
function InlineField({ displayText, renderEdit }) {
    const [editing, setEditing] = useState(false);
    const close = useCallback(() => setEditing(false), []);

    if (editing) {
        return (
            <div onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setEditing(false); }}>
                {renderEdit(close)}
            </div>
        );
    }
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", padding: "2px 0", minHeight: 24 }}
            onClick={() => setEditing(true)}>
            <Text style={{ fontSize: 12, flex: 1, color: displayText ? undefined : "#bbb" }}>
                {displayText || "—"}
            </Text>
            <EditOutlined style={{ opacity: 0.3, fontSize: 11, flexShrink: 0 }} />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Champ contact inline : label + crayon (drawer) + clic → combo
// ─────────────────────────────────────────────────────────────────────────────
function ContactFieldInline({ value, initialData, partnerId, onChange }) {
    const [editing, setEditing] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const displayName = useMemo(() => {
        if (!initialData) return value ? `#${value}` : "—";
        return [initialData.ctc_firstname, initialData.ctc_lastname].filter(Boolean).join(" ") || initialData.ctc_email || "—";
    }, [initialData, value]);

    if (editing) {
        return (
            <div onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setEditing(false); }}>
                <ContactSelect
                    value={value}
                    initialData={initialData}
                    partnerId={partnerId}
                    autoFocus
                    style={{ width: "100%" }}
                    onChange={(val) => { onChange(val); setEditing(false); }}
                />
            </div>
        );
    }

    return (
        <>
            <div style={{ display: "flex", alignItems: "center", gap: 4, width: "100%" }}>
                <Text
                    style={{ cursor: "pointer", fontSize: 12, flex: 1, color: value ? undefined : "#bbb" }}
                    onClick={() => setEditing(true)}
                >
                    {displayName}
                </Text>
                {value && (
                    <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => setDrawerOpen(true)}
                        style={{ opacity: 0.5, flexShrink: 0 }}
                    />
                )}
            </div>
            <Contact
                contactId={value}
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                onSubmit={() => setDrawerOpen(false)}
            />
        </>
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// Bulle d'article dans le thread
// ─────────────────────────────────────────────────────────────────────────────
function ArticleBubble({ article, onDelete, ticketId, onUpdate }) {
    const { message } = App.useApp();
    const [editing, setEditing] = useState(false);
    const [editMessage, setEditMessage] = useState("");
    const [saving, setSaving] = useState(false);
    const [documents, setDocuments] = useState([]);

    useEffect(() => {
        ticketsApi.getArticleDocuments(ticketId, article.tka_id)
            .then((res) => setDocuments(res.data || []))
            .catch(() => {});
    }, [ticketId, article.tka_id]);

    const handleDownload = useCallback(async (docId, fileName) => {
        try {
            const blob = await documentsApi.download(docId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.setAttribute("download", fileName);
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            // silencieux
        }
    }, []);

    const displayType = getArticleDisplayType(article);
    const colors = ARTICLE_COLORS[displayType];
    const isRight = colors.side === "right";
    const isCenter = colors.side === "center";

    const startEdit = useCallback(() => {
        setEditMessage(article.tka_message || "");
        setEditing(true);
    }, [article.tka_message]);

    const cancelEdit = useCallback(() => {
        setEditing(false);
        setEditMessage("");
    }, []);

    const saveEdit = useCallback(async () => {
        if (!editMessage || editMessage === "<p><br></p>") {
            message.warning("Le message ne peut pas être vide");
            return;
        }
        setSaving(true);
        try {
            await ticketsApi.updateArticle(ticketId, article.tka_id, { tka_message: editMessage });
            setEditing(false);
            onUpdate?.();
        } catch {
            message.error("Erreur lors de la modification");
        } finally {
            setSaving(false);
        }
    }, [editMessage, ticketId, article.tka_id, onUpdate]);

    const authorName = useMemo(() => {
        if (article.user?.label) return article.user.label;
        if (article.contact_from) {
            const c = article.contact_from;
            return [c.ctc_firstname, c.ctc_lastname].filter(Boolean).join(" ") || c.ctc_email;
        }
        return "Système";
    }, [article]);

    const toName = useMemo(() => {
        if (!article.contact_to) return null;
        const c = article.contact_to;
        return [c.ctc_firstname, c.ctc_lastname].filter(Boolean).join(" ") || c.ctc_email;
    }, [article]);

    const ccList = useMemo(() => {
        if (!article.tka_cc) return [];
        return article.tka_cc.split(",").map((e) => e.trim()).filter(Boolean);
    }, [article]);

    const bubbleStyle = {
        maxWidth: isCenter ? "82%" : "72%",
        minWidth: isCenter ? undefined : 180,
        padding: "8px 12px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
        ...(displayType === "note" ? {
            border: `1px dashed ${colors.border}`,
            borderRadius: 8,
            backgroundColor: colors.bg,
        } : isRight ? {
            border: `1px solid ${colors.border}`,
            borderRadius: "12px 4px 12px 12px",
            backgroundColor: colors.bg,
        } : {
            borderTop: "1px solid #d9e8ff",
            borderRight: "1px solid #d9e8ff",
            borderBottom: "1px solid #d9e8ff",
            borderLeft: `3px solid ${colors.border}`,
            borderRadius: "4px 12px 12px 12px",
            backgroundColor: colors.bg,
        }),
    };

    return (
        <div style={{
            display: "flex",
            flexDirection: isRight ? "row-reverse" : "row",
            justifyContent: isCenter ? "center" : "flex-start",
            alignItems: "flex-start",
            gap: 8,
            marginBottom: 14,
            padding: "0 4px",
        }}>
            {/* Avatar (absent pour les notes internes centrées) */}
            {!isCenter && (
                <BubbleAvatar name={authorName} color={colors.border} />
            )}

            <div style={bubbleStyle}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <Space size={4} wrap>
                        {displayType === "note" && <PushpinOutlined style={{ color: colors.border }} />}
                        {displayType === "from_contact" && <InboxOutlined style={{ color: colors.border }} />}
                        {displayType === "from_agent" && <TeamOutlined style={{ color: colors.border }} />}
                        <Text strong style={{ fontSize: 12 }}>{authorName}</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            {dayjs(article.tka_date || article.tka_created).format("DD/MM/YYYY HH:mm")}
                        </Text>
                        {article.tka_tps > 0 && (
                            <Tag icon={<ClockCircleOutlined />} color="blue" style={{ fontSize: 11, lineHeight: "18px" }}>
                                {article.tka_tps} mn
                            </Tag>
                        )}
                    </Space>
                    <Space size={2}>
                        {displayType === "note" && !editing && (
                            <CanAccess permission="tickets.edit">
                                <Button type="text" icon={<EditOutlined />} style={{ opacity: 0.5 }} onClick={startEdit} />
                            </CanAccess>
                        )}
                        {displayType === "note" && (
                            <CanAccess permission="tickets.delete">
                                <Popconfirm title="Supprimer ce message ?" onConfirm={() => onDelete(article.tka_id)} okText="Oui" cancelText="Non">
                                    <Button type="text" danger icon={<DeleteOutlined />} style={{ opacity: 0.5 }} />
                                </Popconfirm>
                            </CanAccess>
                        )}
                    </Space>
                </div>

                {/* Destinataire / CC */}
                {(toName || ccList.length > 0) && (
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>
                        {toName && (
                            <span>À :{" "}
                                <Tooltip title={article.contact_to?.ctc_email}>
                                    <span style={{ cursor: "default", borderBottom: "1px dotted #aaa" }}>{toName}</span>
                                </Tooltip>
                            </span>
                        )}
                        {ccList.length > 0 && (
                            <span style={{ marginLeft: 8 }}>CC :{" "}
                                {ccList.map((email, i) => (
                                    <Tooltip key={email} title={email}>
                                        <span style={{ cursor: "default", borderBottom: "1px dotted #aaa" }}>
                                            {i > 0 && ", "}{email}
                                        </span>
                                    </Tooltip>
                                ))}
                            </span>
                        )}
                    </div>
                )}

                {/* Corps */}
                {editing ? (
                    <div>
                        <RichTextEditor value={editMessage} onChange={setEditMessage} height={180} placeholder="Note interne..." />
                        <Space size={4} style={{ marginTop: 6 }}>
                            <Button type="primary" size="small" icon={<CheckOutlined />} loading={saving} onClick={saveEdit}
                                style={{ backgroundColor: "#faad14", borderColor: "#faad14" }}>
                                Enregistrer
                            </Button>
                            <Button size="small" icon={<CloseOutlined />} onClick={cancelEdit}>Annuler</Button>
                        </Space>
                    </div>
                ) : (
                    <div
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.tka_message || "") }}
                        style={{ fontSize: 13, lineHeight: "1.6", wordBreak: "break-word" }}
                    />
                )}

                {/* Pièces jointes */}
                {documents.length > 0 && (
                    <div style={{ marginTop: 8, borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 6 }}>
                        {documents.map((doc) => (
                            <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                                {getFileIcon(doc.fileName)}
                                <Button type="link" size="small" style={{ padding: 0, height: "auto", fontSize: 12 }}
                                    onClick={() => handleDownload(doc.id, doc.fileName)}>
                                    {doc.fileName}
                                </Button>
                                <Text type="secondary" style={{ fontSize: 11 }}>({formatFileSize(doc.fileSize)})</Text>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Événement d'historique dans le thread
// ─────────────────────────────────────────────────────────────────────────────
const HISTORY_FIELD_LABELS = {
    fk_tke_id: "Statut",
    fk_tkp_id: "Priorité",
    fk_tks_id: "Source",
    fk_tkc_id: "Catégorie",
    fk_tkg_id: "Type",
    fk_usr_id_assignedto: "Assigné à",
    tkt_label: "Objet",
    fk_ctc_id_openby: "De",
    fk_ctc_id_opento: "À",
    merge: "Fusion",
};

function HistoryEvent({ event }) {
    const fieldLabel = HISTORY_FIELD_LABELS[event.tkh_field] || event.tkh_field;
    const userName = event.user?.label || "Système";
    const date = dayjs(event.tkh_created).format("DD/MM/YYYY HH:mm");

    return (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <div style={{
                background: "#f5f5f5",
                border: "1px solid #e8e8e8",
                borderRadius: 12,
                padding: "3px 12px",
                fontSize: 11,
                color: "#888",
                maxWidth: "80%",
                textAlign: "center",
            }}>
                <HistoryOutlined style={{ marginRight: 4 }} />
                {event.tkh_field === "merge" ? (
                    <span>Fusion depuis {event.tkh_new_value}</span>
                ) : (
                    <span>
                        <strong>{fieldLabel}</strong> modifié
                        {event.tkh_old_value ? ` (${event.tkh_old_value} → ${event.tkh_new_value ?? "—"})` : ""}
                    </span>
                )}
                <span style={{ marginLeft: 6, opacity: 0.7 }}>· {userName} · {date}</span>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compositeur (3 tabs : Répondre / Note )
// ─────────────────────────────────────────────────────────────────────────────
function TicketComposer({ ticketId, openToContact, partnerId, onArticleCreated }) {
     const { message } = App.useApp();
    const [tab, setTab] = useState("reply"); // "reply" | "note"
    const [composerMessage, setComposerMessage] = useState("");
    const [composerTps, setComposerTps] = useState(0);
    const [composerTo, setComposerTo] = useState(openToContact?.ctc_id ?? null);
    const [composerCc, setComposerCc] = useState([]);
    const [nextStatusId, setNextStatusId] = useState(null);
    const [statusOptions, setStatusOptions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [attachments, setAttachments] = useState([]);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);
    const formTopRef = useRef(null);

    // Scroll le formulaire dans la zone visible dès qu'il s'ouvre
    useEffect(() => {
        if (isOpen && formTopRef.current) {
            formTopRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    }, [isOpen]);

    const totalAttachmentSize = useMemo(
        () => attachments.reduce((s, a) => s + (a.size || 0), 0),
        [attachments]
    );

    const addFiles = useCallback((fileList) => {
        const newFiles = Array.from(fileList).map((f) => ({
            name: f.name,
            file: f,
            size: f.size,
            uid: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
        }));
        setAttachments((prev) => {
            const updated = [...prev, ...newFiles];
            const total = updated.reduce((s, a) => s + (a.size || 0), 0);
            if (total > MAX_ATTACHMENT_SIZE) {
                message.warning(`Taille totale (${formatFileSize(total)}) dépasse la limite de 20 Mo`);
            }
            return updated;
        });
    }, []);

    const removeAttachment = useCallback((uid) => {
        setAttachments((prev) => prev.filter((a) => a.uid !== uid));
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        if (e.dataTransfer?.files?.length > 0) addFiles(e.dataTransfer.files);
    }, [addFiles]);

    const handleDragOver = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }, []);
    const handleDragLeave = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }, []);


    const handleCancel = useCallback(() => {
        setIsOpen(false);
        setComposerMessage("");
        setComposerTps(0);
        setComposerCc([]);
        setNextStatusId(null);
        setAttachments([]);
    }, []);

    useEffect(() => {
        ticketsApi.statusOptions().then((res) => setStatusOptions(res.data || [])).catch(() => { });
    }, []);

    useEffect(() => {
        if (openToContact?.ctc_id) setComposerTo(openToContact.ctc_id);
    }, [openToContact?.ctc_id]);

    const isNote = tab === "note";
    const accentColor = isNote ? "#faad14" : "#52c41a";

    const handleTemplateInsert = useCallback((body) => {
        setComposerMessage((prev) => prev + body);
    }, []);

    const handleSubmit = useCallback(async (overrideStatusId) => {
        const strippedMessage = composerMessage?.replace(/<[^>]*>/g, "").trim();
        if (!strippedMessage) {
            message.warning("Veuillez saisir un message");
            return;
        }
        if (!composerTps || composerTps <= 0) {
            message.warning("Veuillez saisir un temps supérieur à 0");
            return;
        }
        setSubmitting(true);
        try {
            const statusId = overrideStatusId !== undefined ? overrideStatusId : nextStatusId;
            const payload = {
                tka_message: composerMessage,
                tka_is_note: isNote ? 1 : 0,
                tka_tps: composerTps || 0,
            };
            if (!isNote) {
                if (composerTo) payload.fk_ctc_id_to = composerTo;
                if (composerCc.length > 0) payload.tka_cc = composerCc.join(", ");
            }
            if (statusId) payload.fk_tke_id = statusId;

            const res = await ticketsApi.createArticle(ticketId, payload);
            // Uploader les pièces jointes si présentes
            if (attachments.length > 0 && res?.data?.tka_id) {
                const fd = new FormData();
                attachments.forEach((att) => fd.append("files[]", att.file, att.name));
                try {
                    await ticketsApi.uploadArticleDocuments(ticketId, res.data.tka_id, fd);
                } catch {
                    message.warning("Message envoyé mais erreur lors de l'upload des pièces jointes");
                }
            }
            message.success(isNote ? "Note ajoutée" : "Réponse envoyée");
            setComposerMessage("");
            setComposerTps(0);
            setComposerCc([]);
            setNextStatusId(null);
            setAttachments([]);
            setIsOpen(false);
            onArticleCreated(res?.fk_tke_id ?? null);
        } catch (err) {
            console.error("Erreur lors de l'envoi", err);
            message.error("Erreur lors de l'envoi");
        } finally {
            setSubmitting(false);
        }
    }, [composerMessage, isNote, composerTps, composerTo, composerCc, nextStatusId, attachments, ticketId, onArticleCreated]);

    const statusMenuItems = useMemo(() => statusOptions.map((s) => ({
        key: String(s.id),
        label: (
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: s.color || "#999", display: "inline-block" }} />
                {s.label}
            </span>
        ),
        onClick: () => handleSubmit(s.id),
    })), [statusOptions, handleSubmit]);

    const tabConfig = [
        { key: "reply", label: "Répondre", icon: <MailOutlined />, color: "#52c41a" },
        { key: "note", label: "Note interne", icon: <PushpinOutlined />, color: "#faad14" },
    ];

    return (
        <div style={{ flexShrink: 0 }}>

        {/* Formulaire (quand ouvert) */}
        {isOpen && (
        <div ref={formTopRef} style={{ padding: "0 12px 8px" }}>
            <div
                style={{
                    border: `1px solid ${accentColor}`,
                    borderRadius: 12,
                    overflow: "hidden",
                    backgroundColor: "#fff",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    position: "relative",
                }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
            >
                {/* Overlay drag & drop */}
                {dragOver && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(24,144,255,0.08)", border: "2px dashed #1890ff", borderRadius: 12, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                        <div style={{ textAlign: "center", color: "#1890ff" }}>
                            <InboxOutlined style={{ fontSize: 32 }} />
                            <div style={{ marginTop: 4, fontSize: 13 }}>Déposer les fichiers ici</div>
                        </div>
                    </div>
                )}

                {/* Header : titre + onglets */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid #f0f0f0" }}>
                    <Text strong style={{ fontSize: 13, color: accentColor }}>
                        {isNote ? <><PushpinOutlined style={{ marginRight: 6 }} />Note interne</> : <><MailOutlined style={{ marginRight: 6 }} />Répondre</>}
                    </Text>
                    <Space size={4}>
                        {tabConfig.map((t) => (
                            <Button
                                key={t.key}
                                size="small"
                                type={tab === t.key ? "primary" : "text"}
                                icon={t.icon}
                                onClick={() => setTab(t.key)}
                                style={tab === t.key ? { backgroundColor: t.color, borderColor: t.color } : { opacity: 0.55 }}
                            >
                                {t.label}
                            </Button>
                        ))}
                        <Button size="small" type="text" icon={<CloseOutlined />} onClick={handleCancel} style={{ opacity: 0.45 }} />
                    </Space>
                </div>

                {/* Lignes À / CC */}
                {!isNote && (
                    <>
                        <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #f5f5f5", padding: "4px 12px", minHeight: 36 }}>
                            <Text type="secondary" style={{ width: 30, fontSize: 12, flexShrink: 0 }}>À :</Text>
                            <ContactSelect value={composerTo} onChange={setComposerTo} initialData={openToContact} partnerId={partnerId} style={{ flex: 1 }} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #f5f5f5", padding: "4px 12px", minHeight: 36 }}>
                            <Text type="secondary" style={{ width: 30, fontSize: 12, flexShrink: 0 }}>CC :</Text>
                            <Select
                                mode="tags"
                                value={composerCc}
                                onChange={setComposerCc}
                                tokenSeparators={[",", " "]}
                                placeholder="Adresses email..."
                                style={{ flex: 1 }}
                                open={false}
                                notFoundContent={null}
                            />
                        </div>
                    </>
                )}

                {/* Éditeur */}
                <div>
                    <RichTextEditor
                        value={composerMessage}
                        onChange={setComposerMessage}
                        height={180}
                        placeholder={isNote ? "Note interne..." : "Réponse..."}
                    />
                </div>

                {/* Pièces jointes */}
                {attachments.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "4px 12px" }}>
                        {attachments.map((att) => (
                            <Tag key={att.uid} closable onClose={() => removeAttachment(att.uid)}
                                style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", maxWidth: 240 }}>
                                {getFileIcon(att.name)}
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }} title={att.name}>
                                    {att.name}
                                </span>
                                {att.size > 0 && (
                                    <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>({formatFileSize(att.size)})</Text>
                                )}
                            </Tag>
                        ))}
                    </div>
                )}
                {totalAttachmentSize > MAX_ATTACHMENT_SIZE && (
                    <Alert type="error" message={`Taille totale (${formatFileSize(totalAttachmentSize)}) dépasse la limite de 20 Mo`}
                        banner showIcon style={{ margin: "0 12px 4px" }} />
                )}

                {/* Input fichier caché */}
                <input ref={fileInputRef} type="file" multiple style={{ display: "none" }}
                    onChange={(e) => { if (e.target.files?.length > 0) { addFiles(e.target.files); e.target.value = ""; } }} />

                {/* Toolbar */}
                <div style={{
                    backgroundColor: "var(--color-bg-layout, #F8FAFD)",
                    borderTop: "1px solid #e8e8e8",
                    padding: "8px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}>
                    <Space size={4}>
                        <InputNumber
                            min={1}
                            prefix={<ClockCircleOutlined />}
                            value={composerTps}
                            onChange={(val) => setComposerTps(val || 0)}
                            suffix="mn"
                            style={{ width: 110 }}
                        />
                        <Tooltip title="Ajouter une pièce jointe (max 20 Mo)">
                            <Button icon={<PaperClipOutlined />} onClick={() => fileInputRef.current?.click()}>
                                {attachments.length > 0 ? `${attachments.length}` : ""}
                            </Button>
                        </Tooltip>
                        <TicketTemplatesPicker onSelect={handleTemplateInsert} />
                    </Space>
                    <CanAccess permission="tickets.create">
                        <Space.Compact>
                            <Button
                                type="primary"
                                loading={submitting}
                                onClick={() => handleSubmit()}
                                style={isNote ? { "--ant-color-primary": "#faad14" } : {}}
                                icon={isNote ? <PushpinOutlined /> : <SendOutlined />}
                            >
                                {isNote ? "Ajouter la note" : "Envoyer"}
                            </Button>
                            <Dropdown menu={{ items: statusMenuItems }} trigger={["click"]}>
                                <Button type="primary" icon={<DownOutlined />}
                                    style={isNote ? { "--ant-color-primary": "#faad14" } : {}} />
                            </Dropdown>
                        </Space.Compact>
                    </CanAccess>
                </div>
            </div>
        </div>
        )}

        {/* Barre persistante – toujours visible en bas */}
        <div style={{ borderTop: "1px solid #f0f0f0", padding: "8px 16px", flexShrink: 0 }}>
            <Space size={8}>
                <Button
                    icon={<MailOutlined />}
                    type={isOpen && tab === "reply" ? "primary" : "default"}
                    style={isOpen && tab === "reply" ? { backgroundColor: "#52c41a", borderColor: "#52c41a" } : {}}
                    onClick={() => { setTab("reply"); setIsOpen(true); }}
                >
                    Répondre
                </Button>
                <Button
                    icon={<PushpinOutlined />}
                    type={isOpen && tab === "note" ? "primary" : "default"}
                    style={isOpen && tab === "note" ? { backgroundColor: "#faad14", borderColor: "#faad14" } : {}}
                    onClick={() => { setTab("note"); setIsOpen(true); }}
                >
                    Note interne
                </Button>
            </Space>
        </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vue principale d'un ticket existant
// ─────────────────────────────────────────────────────────────────────────────
function TicketView({ ticketId }) {
    const navigate = useNavigate();
    const { hasNav, hasPrev, hasNext, goToPrev, goToNext, position } = useListNavigation();
    const threadEndRef = useRef(null);
    const saveTimerRef = useRef(null);

    // Données ticket
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);

    // Articles + historique (timeline unifiée)
    const [articles, setArticles] = useState([]);
    const [history, setHistory] = useState([]);
    const [loadingTimeline, setLoadingTimeline] = useState(false);

    // Edition du titre inline
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleValue, setTitleValue] = useState("");
    const titleInputRef = useRef(null);

    // Sidebar auto-save
    const [saveStatus, setSaveStatus] = useState(""); // "" | "saving" | "saved"

    // Modale fusion
    const [mergeModalOpen, setMergeModalOpen] = useState(false);

    // ── Chargement initial ──────────────────────────────────────────────────
    const loadTicket = useCallback(async () => {
        try {
            const res = await ticketsApi.get(ticketId);
            const data = res.data;
            setTicket(data);
            setTitleValue(data.tkt_label || "");
        } catch {
            message.error("Erreur lors du chargement du ticket");
        } finally {
            setLoading(false);
        }
    }, [ticketId]);

    const loadTimeline = useCallback(async () => {
        setLoadingTimeline(true);
        try {
            const [articlesRes, historyRes] = await Promise.all([
                ticketsApi.getArticles(ticketId),
                ticketsApi.getHistory(ticketId),
            ]);
            const arts = (articlesRes.data || []).sort(
                (a, b) => new Date(a.tka_date || a.tka_created) - new Date(b.tka_date || b.tka_created)
            );
            setArticles(arts);
            setHistory(historyRes.data || []);
        } catch {
            // silencieux
        } finally {
            setLoadingTimeline(false);
        }
    }, [ticketId]);

    useEffect(() => {
        loadTicket();
        loadTimeline();
    }, [loadTicket, loadTimeline]);

    // Cleanup du timer auto-save au démontage
    useEffect(() => {
        return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    }, []);

    // Auto-scroll vers le bas
    useEffect(() => {
        if (threadEndRef.current && !loadingTimeline) {
            threadEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [articles, loadingTimeline]);

    // ── Timeline unifiée (articles + historique) ───────────────────────────
    const timelineItems = useMemo(() => {
        const items = [
            ...articles.map((a) => ({ type: "article", date: new Date(a.tka_date || a.tka_created), data: a })),
            ...history.map((h) => ({ type: "history", date: new Date(h.tkh_created), data: h })),
        ];
        items.sort((a, b) => a.date - b.date);
        return items;
    }, [articles, history]);

    // ── Edition inline du titre ────────────────────────────────────────────
    const startEditTitle = useCallback(() => {
        setEditingTitle(true);
        setTimeout(() => titleInputRef.current?.focus(), 50);
    }, []);

    const saveTitle = useCallback(async () => {
        if (!titleValue.trim() || titleValue === ticket?.tkt_label) {
            setEditingTitle(false);
            setTitleValue(ticket?.tkt_label || "");
            return;
        }
        try {
            await ticketsApi.update(ticketId, { tkt_label: titleValue });
            setTicket((prev) => ({ ...prev, tkt_label: titleValue }));
            setEditingTitle(false);
        } catch {
            message.error("Erreur lors de la sauvegarde");
        }
    }, [titleValue, ticket, ticketId]);

    const cancelTitle = useCallback(() => {
        setEditingTitle(false);
        setTitleValue(ticket?.tkt_label || "");
    }, [ticket]);

    // ── Sidebar auto-save ──────────────────────────────────────────────────
    const handleSidebarChange = useCallback((field, value) => {
        setTicket((prev) => ({ ...prev, [field]: value }));
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        setSaveStatus("saving");
        saveTimerRef.current = setTimeout(async () => {
            try {
                await ticketsApi.update(ticketId, { [field]: value });
                setSaveStatus("saved");
                setTimeout(() => setSaveStatus(""), 2000);
                const res = await ticketsApi.get(ticketId);
                setTicket(res.data);
            } catch {
                setSaveStatus("");
            }
        }, 800);
    }, [ticketId]);

    // ── Changement contact (De / À) — sauvegarde immédiate + reload ──────────
    const handleContactChange = useCallback(async (field, value) => {
        setTicket((prev) => ({ ...prev, [field]: value }));
        setSaveStatus("saving");
        try {
            await ticketsApi.update(ticketId, { [field]: value });
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus(""), 2000);
            const res = await ticketsApi.get(ticketId);
            setTicket(res.data);
        } catch {
            setSaveStatus("");
        }
    }, [ticketId]);

    // ── Article créé (callback du compositeur) ──────────────────────────────
    const handleArticleCreated = useCallback((newStatusId) => {
        loadTimeline();
        if (newStatusId) {
            loadTicket();
        }
    }, [loadTimeline, loadTicket]);

    // ── Suppression article ─────────────────────────────────────────────────
    const handleDeleteArticle = useCallback(async (articleId) => {
        try {
            await ticketsApi.deleteArticle(ticketId, articleId);
            message.success("Message supprimé");
            loadTimeline();
            loadTicket();
        } catch {
            message.error("Erreur lors de la suppression");
        }
    }, [ticketId, loadTimeline, loadTicket]);

    // ── Suppression ticket ──────────────────────────────────────────────────
    const handleDelete = useCallback(async () => {
        try {
            await ticketsApi.delete(ticketId);
            navigate("/tickets");
        } catch {
            message.error("Erreur lors de la suppression");
        }
    }, [ticketId, navigate]);

    // ── Fusion ─────────────────────────────────────────────────────────────
    const handleMerged = useCallback((targetId) => {
        setMergeModalOpen(false);
        message.success(`Dossier fusionné dans #${targetId}`);
        navigate(`/tickets/${targetId}`);
    }, [navigate]);

    if (loading || !ticket) {
        return (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
                <Spin size="large" />
            </div>
        );
    }

    const partnerId = ticket.fk_ptr_id;

    // ── Titre pour PageContainer ────────────────────────────────────────────
    const headerTitle = editingTitle ? (
        <Space.Compact>
            <Input
                ref={titleInputRef}
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onPressEnter={saveTitle}
                onBlur={saveTitle}
                style={{ fontSize: 14, fontWeight: 500, width: 320,  WebkitTextFillColor: "#000" }}
            />
            <Button icon={<CheckOutlined />} type="primary" onClick={saveTitle} />
            <Button icon={<CloseOutlined />} onClick={cancelTitle} />
        </Space.Compact>
    ) : (
        <Space>
            <Text style={{ color: "#999", fontSize: 13 }}>{ticket.tkt_number || `#${ticketId}`}</Text>
            <Text strong style={{ fontSize: 14 }}>{ticket.tkt_label}</Text>
            <Button type="text" icon={<EditOutlined />} onClick={startEditTitle} style={{ opacity: 0.5 }} />
        </Space>
    );

    // ── RENDER ──────────────────────────────────────────────────────────────
    return (
        <PageContainer
            title={headerTitle}
            headerStyle={{
                center: (
                    <Space>
                        <Tag
                            color={ticket.status?.tke_color || "default"}
                            style={{ fontSize: 13, padding: "3px 12px", margin: 0, borderRadius: 12 }}
                        >
                            {ticket.status?.tke_label || "—"}
                        </Tag>
                        {saveStatus === "saving" && (
                            <Text type="secondary" style={{ fontSize: 11 }}><Spin size="small" /> Enregistrement…</Text>
                        )}
                        {saveStatus === "saved" && (
                            <Text style={{ fontSize: 11, color: "#52c41a" }}><CheckOutlined /> Enregistré</Text>
                        )}
                    </Space>
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
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/tickets")}>
                        Retour
                    </Button>
                </Space>
            }
            fill
        >
            {/* ── CORPS (timeline + sidebar) ─────────────────────────────── */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

                {/* ── TIMELINE ──────────────────────────────────────────── */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    {/* Zone scrollable */}
                    <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
                        <Spin spinning={loadingTimeline}>
                            {timelineItems.length === 0 && !loadingTimeline && (
                                <div style={{ textAlign: "center", padding: "60px 0", color: "#bbb" }}>
                                    <FileTextOutlined style={{ fontSize: 32, display: "block", marginBottom: 8 }} />
                                    Aucun message pour ce dossier
                                </div>
                            )}
                            {timelineItems.map((item, idx) =>
                                item.type === "article" ? (
                                    <ArticleBubble
                                        key={`a-${item.data.tka_id}`}
                                        article={item.data}
                                        onDelete={handleDeleteArticle}
                                        ticketId={ticketId}
                                        onUpdate={loadTimeline}
                                    />
                                ) : (
                                    <HistoryEvent key={`h-${item.data.tkh_id}`} event={item.data} />
                                )
                            )}
                            <div ref={threadEndRef} />
                        </Spin>
                    </div>

                    {/* Compositeur */}
                    <CanAccess permission="tickets.create">
                        <TicketComposer
                            ticketId={ticketId}
                            openToContact={ticket.open_to}
                            partnerId={partnerId}
                            onArticleCreated={handleArticleCreated}
                        />
                    </CanAccess>
                </div>

                {/* ── SIDEBAR 300px ─────────────────────────────────────── */}
                <div style={{
                    width: 300,
                    flexShrink: 0,
                    borderLeft: "1px solid #e8e8e8",
                    overflowY: "auto",
                    backgroundColor: "#fafafa",
                    padding: "0 12px",
                }}>
                    {/* Section CONTACT */}
                    <SidebarSection title="Contact">
                        <PropRow label="Client">
                            <Text strong style={{ fontSize: 12 }}>{ticket.partner?.ptr_name || "—"}</Text>
                        </PropRow>
                        <PropRow label={<><UserOutlined /> De</>}>
                            <ContactFieldInline
                                value={ticket.fk_ctc_id_openby}
                                initialData={ticket.open_by}
                                partnerId={partnerId}
                                onChange={(val) => handleContactChange("fk_ctc_id_openby", val)}
                            />
                        </PropRow>
                        <PropRow label={<><MailOutlined /> À</>}>
                            <ContactFieldInline
                                value={ticket.fk_ctc_id_opento}
                                initialData={ticket.open_to}
                                partnerId={partnerId}
                                onChange={(val) => handleContactChange("fk_ctc_id_opento", val)}
                            />
                        </PropRow>
                        {ticket.open_to && (
                            <div style={{ backgroundColor: "#fff", border: "1px solid #e8e8e8", borderRadius: 6, padding: "6px 8px", marginTop: 6, fontSize: 11 }}>
                                {ticket.open_to.ctc_email && <div style={{ color: "#666", marginBottom: 2 }}><MailOutlined style={{ marginRight: 4 }} />{ticket.open_to.ctc_email}</div>}
                                {ticket.open_to.ctc_job_title && <div style={{ color: "#666", marginBottom: 2 }}><IdcardOutlined style={{ marginRight: 4 }} />{ticket.open_to.ctc_job_title}</div>}
                                {ticket.open_to.ctc_mobile && (
                                    <div style={{ color: "#666", marginBottom: 2 }}>
                                        <MobileOutlined style={{ marginRight: 4 }} />
                                        <a href={`tel:${ticket.open_to.ctc_mobile}`} style={{ color: "inherit" }}>{ticket.open_to.ctc_mobile}</a>
                                    </div>
                                )}
                                {ticket.open_to.devices?.length > 0 && (
                                    <div style={{ color: "#666", display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
                                        <DesktopOutlined style={{ marginRight: 2 }} />
                                        {ticket.open_to.devices.map((d) => (
                                            <Tag key={d.dev_id} style={{ fontSize: 10, padding: "0 4px", margin: 0 }}>{d.dev_hostname}</Tag>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </SidebarSection>

                    {/* Section PROPRIÉTÉS */}
                    <SidebarSection title="Propriétés">
                        <PropRow label="Assigné à">
                            <InlineField
                                displayText={ticket.assigned_to ? [ticket.assigned_to.usr_firstname, ticket.assigned_to.usr_lastname].filter(Boolean).join(" ") || ticket.assigned_to.label : null}
                                renderEdit={(close) => (
                                    <UserSelect
                                        value={ticket.fk_usr_id_assignedto}
                                        initialData={ticket.assigned_to}
                                        loadInitially={false}
                                        allowClear
                                        autoFocus
                                        style={{ width: "100%" }}
                                        onChange={(val) => { handleSidebarChange("fk_usr_id_assignedto", val ?? null); close(); }}
                                    />
                                )}
                            />
                        </PropRow>
                        <PropRow label="Priorité">
                            <InlineField
                                displayText={ticket.priority?.tkp_label}
                                renderEdit={(close) => (
                                    <TicketPrioritySelect
                                        value={ticket.fk_tkp_id}
                                        initialData={ticket.priority}
                                        loadInitially={false}
                                        autoFocus
                                        style={{ width: "100%" }}
                                        onChange={(val) => { handleSidebarChange("fk_tkp_id", val); close(); }}
                                    />
                                )}
                            />
                        </PropRow>
                        <PropRow label="Type">
                            <InlineField
                                displayText={ticket.grade?.tkg_label}
                                renderEdit={(close) => (
                                    <TicketGradeSelect
                                        value={ticket.fk_tkg_id}
                                        initialData={ticket.grade}
                                        loadInitially={false}
                                        autoFocus
                                        style={{ width: "100%" }}
                                        onChange={(val) => { handleSidebarChange("fk_tkg_id", val); close(); }}
                                    />
                                )}
                            />
                        </PropRow>
                        <PropRow label="Source">
                            <InlineField
                                displayText={ticket.source?.tks_label}
                                renderEdit={(close) => (
                                    <TicketSourceSelect
                                        value={ticket.fk_tks_id}
                                        initialData={ticket.source}
                                        loadInitially={false}
                                        autoFocus
                                        style={{ width: "100%" }}
                                        onChange={(val) => { handleSidebarChange("fk_tks_id", val); close(); }}
                                    />
                                )}
                            />
                        </PropRow>
                        <PropRow label="Catégorie">
                            <InlineField
                                displayText={ticket.category?.tkc_label}
                                renderEdit={(close) => (
                                    <TicketCategorySelect
                                        value={ticket.fk_tkc_id}
                                        initialData={ticket.category}
                                        loadInitially={false}
                                        autoFocus
                                        style={{ width: "100%" }}
                                        onChange={(val) => { handleSidebarChange("fk_tkc_id", val); close(); }}
                                    />
                                )}
                            />
                        </PropRow>
                    </SidebarSection>

                    {/* Section DATE & SLA */}
                    <SidebarSection title="Date & SLA">
                        <PropRow label="Créé le">
                            <Text style={{ fontSize: 12, color: "#555" }}>
                                {ticket.tkt_created ? dayjs(ticket.tkt_created).format("DD/MM/YYYY HH:mm") : ticket.created_at ? dayjs(ticket.created_at).format("DD/MM/YYYY HH:mm") : "—"}
                            </Text>
                        </PropRow>
                        <PropRow label="Mise à jour">
                            <Text style={{ fontSize: 12, color: "#555" }}>
                                {ticket.tkt_updated ? dayjs(ticket.tkt_updated).format("DD/MM/YYYY HH:mm") : ticket.updated_at ? dayjs(ticket.updated_at).format("DD/MM/YYYY HH:mm") : "—"}
                            </Text>
                        </PropRow>
                        <PropRow label="Temps passé">
                            <Text style={{ fontSize: 12, color: "#555" }}>
                                {ticket.tkt_tps > 0 ? `${ticket.tkt_tps} mn` : "—"}
                            </Text>
                        </PropRow>
                        <PropRow label="Planifié le">
                            <InlineField
                                displayText={ticket.tkt_scheduled ? dayjs(ticket.tkt_scheduled).format("DD/MM/YYYY HH:mm") : null}
                                renderEdit={(close) => (
                                    <DatePicker
                                        value={ticket.tkt_scheduled ? dayjs(ticket.tkt_scheduled) : null}
                                        format="DD/MM/YYYY HH:mm"
                                        showTime={{ format: "HH:mm" }}
                                        style={{ width: "100%" }}
                                        autoFocus
                                        onChange={(date) => {
                                            handleSidebarChange("tkt_scheduled", date ? date.format("YYYY-MM-DD HH:mm:ss") : null);
                                            close();
                                        }}
                                        onOpenChange={(open) => { if (!open) close(); }}
                                    />
                                )}
                            />
                        </PropRow>
                    </SidebarSection>

                    {/* Section TICKETS LIÉS */}
                    <SidebarSection>
                        <TicketLinksPanel ticketId={ticketId} />
                    </SidebarSection>

                    {/* Actions */}
                    <div style={{ paddingTop: 12, paddingBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                        <CanAccess permission="tickets.edit">
                            <Button block icon={<MergeCellsOutlined />} onClick={() => setMergeModalOpen(true)}>
                                Fusionner
                            </Button>
                        </CanAccess>
                        <CanAccess permission="tickets.delete">
                            <Popconfirm
                                title="Supprimer ce dossier ?"
                                description="Tous les messages et documents seront supprimés."
                                onConfirm={handleDelete}
                                okText="Oui, supprimer"
                                cancelText="Annuler"
                                okButtonProps={{ danger: true }}
                            >
                                <Button block danger icon={<DeleteOutlined />}>Supprimer</Button>
                            </Popconfirm>
                        </CanAccess>
                    </div>
                </div>
            </div>

            {/* Modale fusion */}
            <TicketMergeModal
                open={mergeModalOpen}
                ticketId={ticketId}
                ticketLabel={ticket.tkt_label}
                onMerged={handleMerged}
                onClose={() => setMergeModalOpen(false)}
            />
        </PageContainer>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page principale (routeur new / existant)
// ─────────────────────────────────────────────────────────────────────────────
export default function Ticket() {
    const { id } = useParams();
    const ticketId = id === "new" ? null : parseInt(id, 10);

    if (!ticketId) {
        return (
            <Suspense fallback={<Spin spinning tip="Chargement..." style={{ display: "flex", justifyContent: "center", padding: 60 }} />}>
                <TicketCreate />
            </Suspense>
        );
    }

    return <TicketView ticketId={ticketId} />;
}
