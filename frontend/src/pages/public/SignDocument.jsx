import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import SignaturePad from "signature_pad";
import { QRCodeSVG } from "qrcode.react";
import { getSigningData, submitSignature } from "../../services/apiSignature";

const CGV_VERSION = "v2026-01";

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f5f5f5",
    fontFamily: "Arial, sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    backgroundColor: "#1a1a2e",
    color: "#fff",
    padding: "16px 24px",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  headerTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
  },
  headerSub: {
    margin: 0,
    fontSize: 13,
    opacity: 0.7,
  },
  content: {
    flex: 1,
    maxWidth: 900,
    width: "100%",
    margin: "0 auto",
    padding: "24px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    padding: 24,
  },
  cardTitle: {
    margin: "0 0 16px",
    fontSize: 16,
    fontWeight: 600,
    color: "#333",
    borderBottom: "1px solid #eee",
    paddingBottom: 12,
  },
  pdfEmbed: {
    width: "100%",
    height: 500,
    border: "none",
    borderRadius: 4,
  },
  pdfFallback: {
    textAlign: "center",
    padding: "32px 16px",
  },
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  metaItem: {
    backgroundColor: "#f8f9fa",
    borderRadius: 6,
    padding: "10px 14px",
  },
  metaLabel: {
    fontSize: 11,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 15,
    fontWeight: 600,
    color: "#333",
  },
  nameRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 20,
  },
  nameField: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  nameLabel: {
    fontSize: 12,
    color: "#555",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  nameInput: {
    padding: "8px 12px",
    border: "1px solid #ddd",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  signatureBox: {
    border: "2px dashed #ccc",
    borderRadius: 8,
    backgroundColor: "#fafafa",
    cursor: "crosshair",
    display: "block",
    touchAction: "none",
    width: "100%",
  },
  clearBtn: {
    background: "none",
    border: "1px solid #ddd",
    borderRadius: 4,
    padding: "6px 14px",
    cursor: "pointer",
    color: "#666",
    fontSize: 13,
    marginTop: 8,
  },
  cgvRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "12px 0",
    borderTop: "1px solid #eee",
    marginTop: 16,
  },
  checkbox: {
    width: 18,
    height: 18,
    marginTop: 2,
    cursor: "pointer",
    flexShrink: 0,
  },
  cgvLabel: {
    fontSize: 14,
    color: "#444",
    cursor: "pointer",
  },
  submitBtn: {
    width: "100%",
    padding: "14px",
    fontSize: 16,
    fontWeight: 700,
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
    marginTop: 16,
    transition: "background 0.2s",
  },
  submitBtnActive: {
    backgroundColor: "#1a73e8",
    color: "#fff",
  },
  submitBtnDisabled: {
    backgroundColor: "#e0e0e0",
    color: "#aaa",
    cursor: "not-allowed",
  },
  notice: {
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    marginTop: 8,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    gap: 20,
  },
  overlayText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
    letterSpacing: 0.3,
  },
  spinner: {
    width: 52,
    height: 52,
    border: "5px solid rgba(255,255,255,0.25)",
    borderTop: "5px solid #fff",
    borderRadius: "50%",
    animation: "spin 0.9s linear infinite",
  },
  statusBox: (color) => ({
    backgroundColor: color === "error" ? "#fff3f3" : color === "success" ? "#f0fff4" : "#f5f5f5",
    border: `1px solid ${color === "error" ? "#ffcdd2" : color === "success" ? "#c8e6c9" : "#e0e0e0"}`,
    borderRadius: 8,
    padding: 32,
    textAlign: "center",
  }),
  statusTitle: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 1.6,
  },
};

const spinKeyframes = `@keyframes spin { to { transform: rotate(360deg); } }`;

export default function SignDocument() {
  const { token } = useParams();
  const canvasRef = useRef(null);
  const padRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [tokenStatus, setTokenStatus] = useState("valid"); // valid | expired | already_signed | not_found | error
  const [signingData, setSigningData] = useState(null);
  const [cgvAccepted, setCgvAccepted] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [signerFirstname, setSignerFirstname] = useState("");
  const [signerLastname, setSignerLastname] = useState("");

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    fetchSigningData();
  }, [token]);

  useEffect(() => {
    if (signingData && canvasRef.current && !padRef.current) {
      const pad = new SignaturePad(canvasRef.current, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "#1a1a2e",
      });
      padRef.current = pad;
      pad.addEventListener("endStroke", () => {
        setHasSignature(!pad.isEmpty());
      });

      // Attendre le layout final avant de redimensionner
      requestAnimationFrame(() => resizeCanvas());

      // ResizeObserver pour gérer les changements de taille (mobile, rotation)
      const observer = new ResizeObserver(() => resizeCanvas());
      observer.observe(canvasRef.current);
      return () => observer.disconnect();
    }
  }, [signingData]);

  const resizeCanvas = () => {
    if (!canvasRef.current || !padRef.current) return;
    const canvas = canvasRef.current;
    const data = padRef.current.toData();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
    padRef.current.fromData(data);
  };

  const fetchSigningData = async () => {
    try {
      const res = await getSigningData(token);
      setSigningData(res.data);
      setTokenStatus("valid");
    } catch (err) {
      if (err.status === 410) {
        const msg = err.message || "";
        setTokenStatus(msg.includes("déjà") ? "already_signed" : "expired");
      } else if (err.status === 404) {
        setTokenStatus("not_found");
      } else {
        setTokenStatus("error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    padRef.current?.clear();
    setHasSignature(false);
  };

  const handleSubmit = async () => {
    if (!cgvAccepted || !hasSignature || submitting) return;

    const signatureImage = padRef.current?.toDataURL("image/png");
    if (!signatureImage) return;

    setSubmitting(true);
    try {
      await submitSignature(token, {
        signature_image: signatureImage,
        cgv_accepted: true,
        cgv_version: signingData?.cgv_version || CGV_VERSION,
        signer_firstname: signerFirstname.trim(),
        signer_lastname: signerLastname.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      alert(err.message || "Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (v) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

  const formatDate = (d) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <h1 style={styles.headerTitle}>Signature électronique</h1>
        </div>
        <div style={{ ...styles.content, alignItems: "center", justifyContent: "center" }}>
          <p>Chargement du document…</p>
        </div>
      </div>
    );
  }

  if (tokenStatus !== "valid") {
    const messages = {
      expired: {
        title: "Lien expiré",
        text: "Ce lien de signature a expiré. Veuillez contacter l'émetteur du document pour en obtenir un nouveau.",
        color: "error",
      },
      already_signed: {
        title: "Document déjà signé",
        text: "Ce document a déjà été signé. Vous devriez avoir reçu une confirmation par email.",
        color: "success",
      },
      not_found: {
        title: "Lien introuvable",
        text: "Ce lien de signature est invalide. Veuillez vérifier l'URL ou contacter l'émetteur.",
        color: "error",
      },
      error: {
        title: "Erreur",
        text: "Une erreur inattendue est survenue. Veuillez réessayer ou contacter l'émetteur.",
        color: "error",
      },
    };
    const m = messages[tokenStatus] || messages.error;
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <h1 style={styles.headerTitle}>Signature électronique</h1>
        </div>
        <div style={styles.content}>
          <div style={styles.statusBox(m.color)}>
            <div style={styles.statusTitle}>{m.title}</div>
            <div style={styles.statusText}>{m.text}</div>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <h1 style={styles.headerTitle}>Signature électronique</h1>
        </div>
        <div style={styles.content}>
          <div style={styles.statusBox("success")}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
            <div style={styles.statusTitle}>Document signé avec succès</div>
            <div style={styles.statusText}>
              Votre signature électronique a bien été enregistrée.
              <br />
              Un email de confirmation avec le document signé a été envoyé à{" "}
              <strong>{signingData?.signer_email}</strong>.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const docTypeLabel = signingData?.doc_type === "sale_order" ? "Devis" : "Contrat";

  return (
    <div style={styles.page}>
      <style>{spinKeyframes}</style>

      {submitting && (
        <div style={styles.overlay}>
          <div style={styles.spinner} />
          <p style={styles.overlayText}>Signature en cours, veuillez patienter…</p>
        </div>
      )}

      <div style={styles.header}>
        {signingData?.company_logo && (
          <img
            src={signingData.company_logo}
            alt={signingData.company_name || ''}
            style={{ height: 40, objectFit: 'contain', flexShrink: 0 }}
          />
        )}
        <div>
          <h1 style={styles.headerTitle}>Signature électronique — {docTypeLabel}</h1>
          <p style={styles.headerSub}>
            Lien valable jusqu&apos;au {formatDate(signingData?.expires_at)}
          </p>
        </div>
      </div>

      <div style={styles.content}>
        {/* Informations du document */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Informations du document</h2>
          <div style={styles.metaGrid}>
            <div style={styles.metaItem}>
              <div style={styles.metaLabel}>Numéro</div>
              <div style={styles.metaValue}>{signingData?.doc_number}</div>
            </div>
            <div style={styles.metaItem}>
              <div style={styles.metaLabel}>Client</div>
              <div style={styles.metaValue}>{signingData?.partner_name}</div>
            </div>
            <div style={styles.metaItem}>
              <div style={styles.metaLabel}>Montant HT</div>
              <div style={styles.metaValue}>{formatCurrency(signingData?.total_ht)}</div>
            </div>
          </div>
        </div>

        {/* Document PDF */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Document à signer</h2>
          {!isMobile ? (
            <embed
              src={`data:application/pdf;base64,${signingData?.pdf_base64}`}
              type="application/pdf"
              style={styles.pdfEmbed}
            />
          ) : (
            <div style={styles.pdfFallback}>
              <p>La visionneuse PDF n&apos;est pas disponible sur mobile.</p>
              <a
                href={`data:application/pdf;base64,${signingData?.pdf_base64}`}
                download={`${docTypeLabel}_${signingData?.doc_number}.pdf`}
                style={{ color: "#1a73e8", fontWeight: 600 }}
              >
                Télécharger le document (PDF)
              </a>
            </div>
          )}
        </div>

        {/* QR code mobile — visible uniquement sur desktop */}
        {!isMobile && (
          <div style={{ ...styles.card, display: "flex", alignItems: "center", gap: 24 }}>
            <QRCodeSVG
              value={window.location.href}
              size={110}
              level="M"
              style={{ flexShrink: 0 }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: "#333" }}>
                Signer depuis votre mobile
              </div>
              <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>
                Scannez ce QR code avec votre téléphone pour ouvrir le document et apposer votre signature manuscrite avec votre doigt.
              </div>
            </div>
          </div>
        )}

        {/* Zone de signature */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Votre signature</h2>

          {/* Identité du signataire */}
          <div style={styles.nameRow}>
            <div style={styles.nameField}>
              <label style={styles.nameLabel}>Prénom</label>
              <input
                type="text"
                style={styles.nameInput}
                placeholder="Votre prénom"
                value={signerFirstname}
                onChange={(e) => setSignerFirstname(e.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div style={styles.nameField}>
              <label style={styles.nameLabel}>Nom</label>
              <input
                type="text"
                style={styles.nameInput}
                placeholder="Votre nom"
                value={signerLastname}
                onChange={(e) => setSignerLastname(e.target.value)}
                autoComplete="family-name"
              />
            </div>
          </div>

          <p style={{ fontSize: 14, color: "#555", marginBottom: 12 }}>
            Dessinez votre signature dans le cadre ci-dessous.
          </p>

          <canvas
            ref={canvasRef}
            style={{ ...styles.signatureBox, height: isMobile ? 180 : 140 }}
          />
          <div>
            <button style={styles.clearBtn} onClick={handleClear} type="button">
              Effacer
            </button>
          </div>

          {/* Acceptation des CGV */}
          <div style={styles.cgvRow}>
            <input
              id="cgv-check"
              type="checkbox"
              style={styles.checkbox}
              checked={cgvAccepted}
              onChange={(e) => setCgvAccepted(e.target.checked)}
            />
            <label htmlFor="cgv-check" style={styles.cgvLabel}>
              J&apos;ai lu et j&apos;accepte les{" "}
              {signingData?.cgv_url ? (
                <a
                  href={signingData.cgv_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#1a73e8", fontWeight: 600 }}
                >
                  Conditions Générales de Vente
                </a>
              ) : (
                <strong>Conditions Générales de Vente</strong>
              )}{" "}
              ({signingData?.cgv_version || CGV_VERSION}).
              En signant ce document, j&apos;atteste agir en mon nom ou au nom
              de la société représentée.
            </label>
          </div>

          <button
            style={{
              ...styles.submitBtn,
              ...(cgvAccepted && hasSignature && signerFirstname.trim() && signerLastname.trim() && !submitting
                ? styles.submitBtnActive
                : styles.submitBtnDisabled),
            }}
            disabled={!cgvAccepted || !hasSignature || !signerFirstname.trim() || !signerLastname.trim() || submitting}
            onClick={handleSubmit}
            type="button"
          >
            {submitting ? "Signature en cours…" : "SIGNER CE DOCUMENT"}
          </button>

          <p style={styles.notice}>
            🔒 Signature électronique simple (niveau SES — règlement eIDAS n°910/2014).
            Votre adresse IP, l'horodatage et l'empreinte du document sont enregistrés.
            Ce niveau de signature constitue un faisceau de preuves recevable en justice.

          </p>
        </div>
      </div>
    </div>
  );
}
