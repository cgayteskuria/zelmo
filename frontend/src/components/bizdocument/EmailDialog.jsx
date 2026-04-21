import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Modal, Input, Button, Space, Alert, App, Spin, Typography, Tag } from "antd";
import { SendOutlined, PaperClipOutlined, FileOutlined, FilePdfOutlined, FileImageOutlined, FileExcelOutlined, FileWordOutlined, InboxOutlined, } from "@ant-design/icons";
import DOMPurify from "dompurify";
import RichTextEditor from "../common/RichTextEditor";
import { emailApi } from "../../services/apiEmail";
import { messageTemplatesApi } from "../../services/apiSettings";
import { contactsApi } from "../../services/api";
import MessageEmailAccountSelect from "../select/MessageEmailAccountSelect";
import RecipientSelect from "../select/RecipientSelect";

const { Text } = Typography;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25 Mo

/**
 * Formater la taille d'un fichier en unité lisible
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 o";
  if (bytes < 1024) return bytes + " o";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " Ko";
  return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
};

/**
 * Icone selon le type de fichier
 */
const getFileIcon = (fileName) => {
  const ext = fileName?.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return <FilePdfOutlined style={{ color: "#ff4d4f" }} />;
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "webp":
      return <FileImageOutlined style={{ color: "#1890ff" }} />;
    case "xls":
    case "xlsx":
    case "csv":
      return <FileExcelOutlined style={{ color: "#52c41a" }} />;
    case "doc":
    case "docx":
      return <FileWordOutlined style={{ color: "#2f54eb" }} />;
    default:
      return <FileOutlined />;
  }
};

/**
 * EmailDialog - Composant d'envoi d'email re-utilisable (style Outlook)
 *
 * @param {boolean} open - Visibilite du dialog
 * @param {Function} onClose - Fermeture du dialog
 * @param {string} [emailContext='default'] - Contexte pour le compte par defaut ('sale', 'invoice', 'default')
 * @param {string} [templateType] - Type de template a utiliser (ex: 'sale', 'sale_validation', 'invoice')
 * @param {number} [documentId] - ID du document (ord_id ou inv_id) pour charger les donnees automatiquement
 * @param {Object} [templateData={}] - Donnees supplementaires pour le parsing du template
 * @param {Function} [onSendSuccess] - Callback apres envoi reussi
 */
export default function EmailDialog({ open, onClose, emailContext = "company", templateType = null, documentId = null, templateData = {},
  onSendSuccess, partnerId = null,
  defaultRecipientId = null,
  initialAttachments = {}
}) {
  const { message } = App.useApp();
  const fileInputRef = useRef(null);

  // State
  const [emailAccountId, setEmailAccountId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toRecipients, setToRecipients] = useState([]);
  const [ccRecipients, setCcRecipients] = useState([]);
  const [bccRecipients, setBccRecipients] = useState([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [emailAccountsCount, setEmailAccountsCount] = useState(null);

  // Taille totale des pieces jointes
  const totalAttachmentSize = useMemo(
    () => attachments.reduce((sum, att) => sum + (att.size || 0), 0),
    [attachments]
  );

  // Determiner les filtres pour le select des comptes email
  const emailAccountFilters = useMemo(() => {
    switch (emailContext) {
      case "sale":
        return { sale: true };
      case "invoice":
        return { invoice: true };
      default:
        return { company: true };
    }
  }, [emailContext]);

  // Ajouter cette ligne en haut du composant, après les autres useRef
  const templateDataRef = useRef(templateData);

  // Mettre à jour la ref quand templateData change réellement
  useEffect(() => {
    templateDataRef.current = templateData;
  }, [templateData]);

  // Chargement des comptes email et valeurs par defaut a l'ouverture
  useEffect(() => {
    if (!open) return;

    const loadData = async () => {
      setLoading(true);
      setEmailAccountsCount(null);
      try {
        // Charger le template parse si templateType est fourni
        if (templateType) {             

          const response = await messageTemplatesApi.parse(emailContext, templateType, documentId, templateDataRef.current);
          if (response?.success) {
            setSubject(response.data.subject);
            setBody(response.data.body);
          }
        }

        // Charger les contacts du partenaire pour préremplir les destinataires
        if (defaultRecipientId) {
          const contactsResponse = await contactsApi.options({
            ctc_id: defaultRecipientId,
            is_active: 1,
          });
          if (contactsResponse?.data?.length > 0) {
            const emails = contactsResponse.data
              .map(contact => contact.email)
              .filter(email => email);
            setToRecipients(emails);
          }
        } else if (partnerId) {
          const receiveField = emailContext === "invoice" ? "receive_invoice" : "receive_saleorder";
          const contactsResponse = await contactsApi.options({
            ptrId: partnerId,
            is_active: 1,
            [receiveField]: 1
          });
          if (contactsResponse?.data?.length > 0) {
            const emails = contactsResponse.data
              .map(contact => contact.email)
              .filter(email => email);
            setToRecipients(emails);
          }
        }

        // Initialiser les pièces jointes
        if (initialAttachments && initialAttachments.length > 0) {
          setAttachments(initialAttachments);
        }
      } catch (e) {
        console.error("Erreur chargement template:", e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [open, templateType, emailContext, documentId, partnerId]);

  // Validation d'un email
  const isValidEmail = useCallback((email) => EMAIL_REGEX.test(email), []);

  // Ajout de fichiers (depuis input ou drop)
  const addFiles = useCallback(
    (fileList) => {
      const newFiles = Array.from(fileList).map((file) => ({
        name: file.name,
        file: file,
        size: file.size,
        uid: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      }));

      setAttachments((prev) => {
        const updated = [...prev, ...newFiles];
        const newTotal = updated.reduce((s, a) => s + (a.size || 0), 0);
        if (newTotal > MAX_TOTAL_SIZE) {
          message.warning(
            `La taille totale des pieces jointes depasse 25 Mo (${formatFileSize(newTotal)})`
          );
        }
        return updated;
      });
    },
    [message]
  );

  // Suppression d'une piece jointe
  const removeAttachment = useCallback((uid) => {
    setAttachments((prev) => prev.filter((a) => a.uid !== uid));
  }, []);

  // Drag & drop handlers
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        addFiles(files);
      }
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  // Envoi de l'email
  const handleSend = useCallback(async () => {
    // Validations
    if (!emailAccountId) {
      message.error("Veuillez selectionner un compte email expediteur.");
      return;
    }

    const validTo = toRecipients.filter(isValidEmail);
    if (validTo.length === 0) {
      message.error("Veuillez saisir au moins un destinataire valide.");
      return;
    }

    const invalidTo = toRecipients.filter((e) => !isValidEmail(e));
    if (invalidTo.length > 0) {
      message.warning(
        `${invalidTo.length} adresse(s) invalide(s) ignor\u00e9e(s) : ${invalidTo.join(", ")}`
      );
    }

    if (!subject.trim()) {
      message.error("Veuillez saisir un objet.");
      return;
    }

    // Verifier si le body est vide (Quill genere <p><br></p> pour du vide)
    const strippedBody = body.replace(/<(.|\n)*?>/g, "").trim();
    if (!strippedBody) {
      message.error("Veuillez saisir le contenu de l'email.");
      return;
    }

    if (totalAttachmentSize > MAX_TOTAL_SIZE) {
      message.error("La taille totale des pieces jointes depasse 25 Mo.");
      return;
    }

    setSending(true);
    try {
      const formData = new FormData();
      formData.append("email_account_id", emailAccountId);
      formData.append("to", validTo.join(","));

      const validCc = ccRecipients.filter(isValidEmail);
      if (validCc.length > 0) {
        formData.append("cc", validCc.join(","));
      }

      const validBcc = bccRecipients.filter(isValidEmail);
      if (validBcc.length > 0) {
        formData.append("bcc", validBcc.join(","));
      }

      formData.append("subject", subject);
      formData.append("body", DOMPurify.sanitize(body));

      // Pieces jointes
      const documentIds = [];
      attachments.forEach((att) => {
        if (att.file) {
          formData.append("attachments[]", att.file, att.name);
        } else if (att.documentId) {
          documentIds.push(att.documentId);
        }
      });
      if (documentIds.length > 0) {
        formData.append("document_ids", documentIds.join(","));
      }

      const result = await emailApi.send(formData);

      if (result.success) {
        message.success("Email envoye avec succes");
        onSendSuccess?.();
        onClose();
      } else {
        message.error(result.message || "Erreur lors de l'envoi");
      }
    } catch (error) {
      const errMsg =
        error?.response?.data?.message ||
        error?.message ||
        "Erreur lors de l'envoi de l'email";
      message.error(errMsg);
    } finally {
      setSending(false);
    }
  }, [emailAccountId, toRecipients, ccRecipients, bccRecipients, subject, body, attachments, totalAttachmentSize, isValidEmail, message, onSendSuccess, onClose,]);



  return (
    <Modal
      title="Envoyer un email"
      open={open}
      onCancel={sending ? undefined : onClose}
      maskClosable={!sending}
      closable={!sending}
      keyboard={!sending}
      width={1010}
        centered={true}
      styles={{ body: { padding: "12px 24px" } }}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button
            onClick={onClose}
            disabled={sending}>
            Annuler
          </Button>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={sending}
            disabled={emailAccountsCount === 0}
          >
            Envoyer
          </Button>
        </div>
      }
    >
      <Spin spinning={loading} tip="Chargement...">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{ position: "relative" }}
        >
          {/* Overlay drag & drop */}
          {dragOver && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(24, 144, 255, 0.08)",
                border: "2px dashed #1890ff",
                borderRadius: 8,
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <div style={{ textAlign: "center", color: "#1890ff" }}>
                <InboxOutlined style={{ fontSize: 48 }} />
                <div style={{ marginTop: 8, fontSize: 16 }}>
                  Deposer les fichiers ici
                </div>
              </div>
            </div>
          )}

          {/* De (expediteur) - toujours rendu pour que onOptionsLoaded soit appelé */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <Text
              strong
              style={{ width: 50, flexShrink: 0, textAlign: "right", marginRight: 8 }}
            >
              De :
            </Text>
            <MessageEmailAccountSelect
              filters={emailAccountFilters}
              placeholder="Sélectionner un compte ..."
              disabled={sending}
              value={emailAccountId}
              onChange={setEmailAccountId}
              onOptionsLoaded={(count) => setEmailAccountsCount(count)}
              selectDefault
              onDefaultSelected={setEmailAccountId}
              loadInitially
              style={{ flex: 1 }}
            />
          </div>

          {/* Alerte si aucun compte configure */}
          {!loading && emailAccountsCount !== null && emailAccountsCount === 0 && (
            <Alert
              type="error"
              title="Aucun compte email configuré. Veuillez configurer un compte email dans les paramètres."
              showIcon
              style={{ marginBottom: 12 }}
            />
          )}

          {/* A (destinataires) */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <Text
              strong
              style={{ width: 50, flexShrink: 0, textAlign: "right", marginRight: 8 }}
            >
              A :
            </Text>
            <div style={{ flex: 1 }}>
              <RecipientSelect
                value={toRecipients}
                onChange={setToRecipients}
                placeholder="Saisir ou rechercher des contacts..."
                disabled={sending}
              />
            </div>
            <Space size={4} style={{ marginLeft: 8, flexShrink: 0 }}>
              {!showCc && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => setShowCc(true)}
                  style={{ padding: "0 4px" }}
                >
                  Cc
                </Button>
              )}
              {!showBcc && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => setShowBcc(true)}
                  style={{ padding: "0 4px" }}
                >
                  Cci
                </Button>
              )}
            </Space>
          </div>

          {/* CC */}
          {showCc && (
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <Text
                strong
                style={{ width: 50, flexShrink: 0, textAlign: "right", marginRight: 8 }}
              >
                Cc :
              </Text>
              <RecipientSelect
                value={ccRecipients}
                onChange={setCcRecipients}
                placeholder="Saisir ou rechercher des contacts..."
                disabled={sending}
                style={{ flex: 1 }}
              />
            </div>
          )}

          {/* BCC */}
          {showBcc && (
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <Text
                strong
                style={{ width: 50, flexShrink: 0, textAlign: "right", marginRight: 8 }}
              >
                Cci :
              </Text>
              <RecipientSelect
                value={bccRecipients}
                onChange={setBccRecipients}
                placeholder="Saisir ou rechercher des contacts..."
                disabled={sending}
                style={{ flex: 1 }}
              />
            </div>
          )}

          {/* Objet */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <Text
              strong
              style={{ width: 50, flexShrink: 0, textAlign: "right", marginRight: 8 }}
            >
              Objet :
            </Text>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Objet de l'email"
              disabled={sending}
              style={{ flex: 1 }}
            />
          </div>

          {/* Corps de l'email */}
          <div style={{ marginBottom: 8 }}>
            <RichTextEditor
              value={body}
              onChange={setBody}
              height={200}
              placeholder="Redigez votre email..."
              readOnly={sending}
            />
          </div>

          {/* Pieces jointes */}
          <div
            style={{
              borderTop: "1px solid #f0f0f0",
              paddingTop: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <Text strong>
                <PaperClipOutlined style={{ marginRight: 4 }} />
                Pieces jointes
                {attachments.length > 0 && (
                  <Text type="secondary" style={{ fontWeight: "normal", marginLeft: 8 }}>
                    ({attachments.length} fichier{attachments.length > 1 ? "s" : ""} -{" "}
                    {formatFileSize(totalAttachmentSize)})
                  </Text>
                )}
              </Text>
              <Button
                size="small"
                icon={<PaperClipOutlined />}
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
              >
                Ajouter
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files?.length > 0) {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }
                }}
              />
            </div>

            {attachments.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {attachments.map((att) => (
                  <Tag
                    key={att.uid || att.name}
                    closable={!sending}
                    onClose={() => removeAttachment(att.uid)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 8px",
                      maxWidth: 280,
                    }}
                  >
                    {getFileIcon(att.name)}
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 180,
                      }}
                      title={att.name}
                    >
                      {att.name}
                    </span>
                    {att.size > 0 && (
                      <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
                        ({formatFileSize(att.size)})
                      </Text>
                    )}
                  </Tag>
                ))}
              </div>
            )}

            {attachments.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "8px 0",
                  color: "#bfbfbf",
                  fontSize: 12,
                }}
              >
                Glissez-deposez des fichiers ici ou cliquez sur "Ajouter"
              </div>
            )}

            {totalAttachmentSize > MAX_TOTAL_SIZE && (
              <Alert
                type="error"
                message={`Taille totale (${formatFileSize(totalAttachmentSize)}) depasse la limite de 25 Mo`}
                showIcon
                style={{ marginTop: 6 }}
                banner
              />
            )}
          </div>
        </div>
      </Spin>
    </Modal>
  );
}
