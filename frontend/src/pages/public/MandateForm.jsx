import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getMandateData, submitMandate } from "../../services/apiMandate";

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
    maxWidth: 720,
    width: "100%",
    margin: "0 auto",
    padding: "24px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
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
  fieldGroup: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  fieldGroupFull: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  label: {
    fontSize: 13,
    color: "#666",
    fontWeight: 500,
  },
  required: {
    color: "#ff4d4f",
    marginLeft: 2,
  },
  input: {
    padding: "8px 12px",
    border: "1px solid #d9d9d9",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "inherit",
    transition: "border-color 0.2s",
  },
  inputError: {
    borderColor: "#ff4d4f",
  },
  errorText: {
    fontSize: 12,
    color: "#ff4d4f",
    marginTop: 2,
  },
  consentRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 4,
  },
  consentText: {
    fontSize: 13,
    color: "#555",
    lineHeight: 1.5,
  },
  submitBtn: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#1677ff",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
    transition: "background-color 0.2s",
  },
  submitBtnDisabled: {
    backgroundColor: "#d9d9d9",
    cursor: "not-allowed",
  },
  statusCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    padding: 40,
    textAlign: "center",
  },
  statusIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: 600,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    color: "#666",
  },
  globalError: {
    backgroundColor: "#fff2f0",
    border: "1px solid #ffccc7",
    borderRadius: 6,
    padding: "10px 14px",
    color: "#cf1322",
    fontSize: 14,
    marginTop: 4,
  },
};

const STATUS_CONFIG = {
  expired: {
    icon: "⏰",
    title: "Lien expiré",
    color: "#ff4d4f",
    text: "Ce lien a expiré. Contactez votre interlocuteur pour en obtenir un nouveau.",
  },
  already_completed: {
    icon: "✅",
    title: "Mandat déjà enregistré",
    color: "#52c41a",
    text: "Ce mandat a déjà été complété. Vous pouvez fermer cette page.",
  },
  not_found: {
    icon: "❌",
    title: "Lien invalide",
    color: "#ff4d4f",
    text: "Ce lien est invalide ou introuvable. Vérifiez l'URL reçue par email.",
  },
  error: {
    icon: "⚠️",
    title: "Erreur",
    color: "#faad14",
    text: "Une erreur est survenue. Veuillez réessayer ultérieurement.",
  },
  submitted: {
    icon: "✅",
    title: "Mandat enregistré avec succès",
    color: "#52c41a",
    text: "Le prélèvement automatique a bien été mis en place. Un email de confirmation vous a été envoyé.",
  },
};

function formatIban(value) {
  const clean = value.toUpperCase().replace(/\s/g, "");
  return clean.replace(/(.{4})/g, "$1 ").trim();
}

export default function MandateForm() {
  const { token } = useParams();

  const [pageStatus, setPageStatus] = useState("loading");
  const [partnerName, setPartnerName] = useState("");

  const [form, setForm] = useState({
    ptr_name: "",
    ptr_address: "",
    ptr_zip: "",
    ptr_city: "",
    ptr_country_code: "FR",
    email: "",
    ptr_siret: "",
    iban: "",
    bic: "",
    bank_domiciliation: "",
    account_holder: "",
    consent: false,
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await getMandateData(token);
        const d = res.data;
        setPartnerName(d.ptr_name || "");
        setForm((prev) => ({
          ...prev,
          ptr_name: d.ptr_name || "",
          ptr_address: d.ptr_address || "",
          ptr_zip: d.ptr_zip || "",
          ptr_city: d.ptr_city || "",
          ptr_country_code: d.ptr_country_code || "FR",
          email: d.ptr_email || "",
          ptr_siret: d.ptr_siret || "",
          account_holder: d.ptr_name || "",
        }));
        setPageStatus("valid");
      } catch (err) {
        if (err.status === 410) {
          const msg = err.message || "";
          if (msg.includes("expiré")) setPageStatus("expired");
          else if (msg.includes("complété")) setPageStatus("already_completed");
          else setPageStatus("error");
        } else if (err.status === 404) {
          setPageStatus("not_found");
        } else {
          setPageStatus("error");
        }
      }
    }
    load();
  }, [token]);

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const handleIbanBlur = () => {
    set("iban", formatIban(form.iban));
  };

  const validate = () => {
    const e = {};
    if (!form.ptr_name.trim()) e.ptr_name = "Champ requis";
    if (!form.email.trim()) e.email = "Champ requis";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Email invalide";
    if (!form.iban.trim()) e.iban = "Champ requis";
    if (!form.bic.trim()) e.bic = "Champ requis";
    if (!form.bank_domiciliation.trim()) e.bank_domiciliation = "Champ requis";
    if (!form.account_holder.trim()) e.account_holder = "Champ requis";
    if (!form.consent) e.consent = "Vous devez accepter le mandat";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError(null);
    const e2 = validate();
    if (Object.keys(e2).length > 0) {
      setErrors(e2);
      return;
    }
    setSubmitting(true);
    try {
      await submitMandate(token, {
        ...form,
        iban: form.iban.replace(/\s/g, ""),
        consent: true,
      });
      setPageStatus("submitted");
    } catch (err) {
      setGlobalError(err.message || "Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  const isFormComplete =
    form.ptr_name.trim() &&
    form.email.trim() &&
    form.iban.trim() &&
    form.bic.trim() &&
    form.bank_domiciliation.trim() &&
    form.account_holder.trim() &&
    form.consent;

  if (pageStatus === "loading") {
    return (
      <div style={{ ...styles.page, justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "#999" }}>Chargement…</p>
      </div>
    );
  }

  if (pageStatus !== "valid") {
    const cfg = STATUS_CONFIG[pageStatus] || STATUS_CONFIG.error;
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <h1 style={styles.headerTitle}>Prélèvement automatique SEPA</h1>
        </div>
        <div style={styles.content}>
          <div style={styles.statusCard}>
            <div style={{ ...styles.statusIcon }}>{cfg.icon}</div>
            <div style={{ ...styles.statusTitle, color: cfg.color }}>{cfg.title}</div>
            <p style={styles.statusText}>{cfg.text}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>Prélèvement automatique SEPA</h1>
          {partnerName && (
            <p style={styles.headerSub}>Autorisation de prélèvement — {partnerName}</p>
          )}
        </div>
      </div>

      <div style={styles.content}>
        <form onSubmit={handleSubmit} noValidate>

          {/* Section 1 — Informations société */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Informations société</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={styles.fieldGroupFull}>
                <Field
                  label="Raison sociale" required
                  error={errors.ptr_name}
                  value={form.ptr_name}
                  onChange={(v) => set("ptr_name", v)}
                />
              </div>
              <div style={styles.fieldGroup}>
                <Field
                  label="Adresse"
                  value={form.ptr_address}
                  onChange={(v) => set("ptr_address", v)}
                />
                <Field
                  label="Code postal"
                  value={form.ptr_zip}
                  onChange={(v) => set("ptr_zip", v)}
                />
              </div>
              <div style={styles.fieldGroup}>
                <Field
                  label="Ville"
                  value={form.ptr_city}
                  onChange={(v) => set("ptr_city", v)}
                />
                <Field
                  label="SIRET"
                  value={form.ptr_siret}
                  onChange={(v) => set("ptr_siret", v)}
                  maxLength={14}
                />
              </div>
              <div style={styles.fieldGroupFull}>
                <Field
                  label="Email de contact" required type="email"
                  error={errors.email}
                  value={form.email}
                  onChange={(v) => set("email", v)}
                />
              </div>
            </div>
          </div>

          {/* Section 2 — Coordonnées bancaires */}
          <div style={{ ...styles.card, marginTop: 20 }}>
            <h2 style={styles.cardTitle}>Coordonnées bancaires</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={styles.fieldGroupFull}>
                <Field
                  label="Titulaire du compte" required
                  error={errors.account_holder}
                  value={form.account_holder}
                  onChange={(v) => set("account_holder", v)}
                />
              </div>
              <div style={styles.fieldGroupFull}>
                <Field
                  label="IBAN" required
                  error={errors.iban}
                  value={form.iban}
                  onChange={(v) => set("iban", v.toUpperCase())}
                  onBlur={handleIbanBlur}
                  placeholder="FR76 3000 6000 0112 3456 7890 189"
                  style={{ fontFamily: "monospace", letterSpacing: 1 }}
                  maxLength={42}
                />
              </div>
              <div style={styles.fieldGroup}>
                <Field
                  label="BIC / SWIFT" required
                  error={errors.bic}
                  value={form.bic}
                  onChange={(v) => set("bic", v.toUpperCase())}
                  placeholder="BNPAFRPPXXX"
                  maxLength={11}
                />
                <Field
                  label="Domiciliation bancaire" required
                  error={errors.bank_domiciliation}
                  value={form.bank_domiciliation}
                  onChange={(v) => set("bank_domiciliation", v)}
                  placeholder="BNP PARIBAS PARIS"
                />
              </div>
            </div>
          </div>

          {/* Section 3 — Consentement */}
          <div style={{ ...styles.card, marginTop: 20 }}>
            <h2 style={styles.cardTitle}>Autorisation de prélèvement</h2>
            <div style={styles.consentRow}>
              <input
                type="checkbox"
                id="consent"
                checked={form.consent}
                onChange={(e) => {
                  set("consent", e.target.checked);
                  if (errors.consent) setErrors((prev) => ({ ...prev, consent: null }));
                }}
                style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, cursor: "pointer" }}
              />
              <label htmlFor="consent" style={{ ...styles.consentText, cursor: "pointer" }}>
                En cochant cette case, j'autorise la société à émettre des prélèvements automatiques SEPA sur
                le compte bancaire indiqué ci-dessus. Ce mandat est valable jusqu'à révocation écrite.
              </label>
            </div>
            {errors.consent && (
              <p style={{ ...styles.errorText, marginTop: 8 }}>{errors.consent}</p>
            )}

            {globalError && (
              <div style={{ ...styles.globalError, marginTop: 12 }}>{globalError}</div>
            )}

            <button
              type="submit"
              disabled={!isFormComplete || submitting}
              style={{
                ...styles.submitBtn,
                ...(!isFormComplete || submitting ? styles.submitBtnDisabled : {}),
              }}
            >
              {submitting ? "Envoi en cours…" : "VALIDER LE MANDAT SEPA"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

function Field({ label, required, error, value, onChange, onBlur, type = "text", placeholder, style, maxLength }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>
        {label}
        {required && <span style={styles.required}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        maxLength={maxLength}
        style={{
          ...styles.input,
          ...(error ? styles.inputError : {}),
          ...(style || {}),
        }}
      />
      {error && <span style={styles.errorText}>{error}</span>}
    </div>
  );
}
