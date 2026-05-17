import { useState } from "react";
import { Tag, Modal, Tooltip } from "antd";
import { FileImageOutlined } from "@ant-design/icons";
import { TAX_TYPE } from "../utils/taxFormatters";

/**
 * Configuration complète du module SaleOrder
 * Utilisée pour les composants génériques (BizDocumentLineModal, FilesTab, etc.)
 */

/**
 * Constantes pour les statuts de commande
 */
export const ORDER_STATUS = {
  DRAFT: 0,
  FINALIZED: 1,
  REFUSED_QUOTE: 2,
  CONFIRMED: 3,
  CANCELLED: 4,
  INVOICED: 5
};

// Constantes d'état de facturation
export const ORDER_INVOICING_STATUS = {
  NOT_INVOICED: 0,
  PARTIALLY: 1,
  FULLY: 2,
  IN_CONTRACT: 3,
};

export const ORDER_DELIVERY_STATUS = {
  NOT_DELIVERED: 0,
  PARTIALLY: 1,
  FULLY: 2,
};


/**
 * Configuration des statuts de commande client
 */
export const STATUS_CONFIG = {
  null: { label: "Brouillon", color: "default" },
  0: { label: "Brouillon", color: "default" },
  1: { label: "Attente validation", color: "orange" },
  2: { label: "Refusé", color: "red" },
  3: { label: "En cours", color: "blue" },
  4: { label: "Annulé", color: "magenta" },
  5: { label: "Terminé", color: "green" },
};

/**
 * Configuration des états de facturation
 */
export const INVOICING_STATE_CONFIG = {
  null: { label: "Non facturée", color: "orange" },
  0: { label: "Non facturée", color: "orange" },
  1: { label: "Partiellement facturée", color: "orange" },
  2: { label: "Facturée", color: "green" },
  3: { label: "Facturée / En contrat", color: "green" },
};

/**
 * Configuration des états de livraison
 */
export const DELIVERY_STATE_CONFIG = {
  null: { label: "Non réalisée", color: "default" },
  0: { label: "Non réalisée", color: "orange" },
  1: { label: "Partiellement réalisée", color: "orange" },
  2: { label: "Réalisée", color: "green" },
};

/**
 * Formatteur pour le statut de commande
 * @param {object|number} params - Soit un objet avec params.value, soit directement la valeur
 * @returns {JSX.Element} Tag formaté
 */
export const formatStatus = (params) => {
  const value = (params !== null && typeof params === 'object') ? params.value : params;
  const config = STATUS_CONFIG[value] || { label: "Inconnu", color: "default" };
  return <Tag color={config.color} variant='outlined'>{config.label}</Tag>;
};

/**
 * Formatteur pour l'état de facturation
 * @param {object|number} params - Soit un objet avec params.value, soit directement la valeur
 * @returns {JSX.Element} Tag formaté
 */
export const formatInvoicingState = (params) => {
  const value = (params !== null && typeof params === 'object') ? params.value : params;
  const config = INVOICING_STATE_CONFIG[value] || { label: "-", color: "default" };
  return <Tag color={config.color} variant='outlined'>{config.label}</Tag>;
};

/**
 * Formatteur pour l'état de livraison
 * @param {object|number} params - Soit un objet avec params.value, soit directement la valeur
 * @returns {JSX.Element} Tag formaté
 */
export const formatDeliveryState = (params) => {
  const value = (params !== null && typeof params === 'object') ? params.value : params;
  const config = DELIVERY_STATE_CONFIG[value] || { label: "-", color: "default" };
  return <Tag color={config.color} variant='outlined'>{config.label}</Tag>;
};


function SignaturePreviewCell({ signerName, imageData }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span>
        {signerName ? `Signé par ${signerName}` : "Signature apposée"}{" "}
        <Tooltip title="Voir la signature">
          <FileImageOutlined
            onClick={(e) => { e.preventDefault(); setOpen(true); }}
            style={{ color: "#1677ff", cursor: "pointer", fontSize: 14, marginLeft: 4 }}
          />
        </Tooltip>
      </span>
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        title="Signature électronique"
        width={520}
        centered
      >
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          {signerName && (
            <p style={{ marginBottom: 12, color: "#555" }}>
              Signataire : <strong>{signerName}</strong>
            </p>
          )}
          <img
            src={imageData}
            alt="Signature"
            style={{ maxWidth: "100%", border: "1px solid #e0e0e0", borderRadius: 4, background: "#fff" }}
          />
        </div>
      </Modal>
    </>
  );
}

/**
 * Configuration de l'affichage de l'historique pour le module SaleOrder.
 * Utilisée par HistoryTimeline pour rendre les champs lisibles par un humain.
 */
export const HISTORY_FIELD_CONFIG = {
  labels: {
    ord_status:                "Statut",
    ord_number:                "Numéro",
    ord_date:                  "Date",
    ord_valid:                 "Date de validité",
    ord_invoicing_state:       "État de facturation",
    ord_delivery_state:        "État de livraison",
    ord_totalht:               "Total HT",
    ord_totaltax:              "Total TVA",
    ord_totalttc:              "Total TTC",
    ord_note:                  "Note",
    ord_being_edited:          "En cours d'édition",
    ord_sign_token_used_at:    "Date de signature",
    ord_sign_cgv_version:      "Version CGV acceptée",
    ord_sign_signature_image:  "Signature électronique",
    ord_sign_token_expires_at: "Expiration du lien de signature",
    fk_ptr_id:                 "Client",
    fk_ctc_id:                 "Contact",
    fk_tap_id:                 "Tarification",
    fk_pam_id:                 "Mode de paiement",
    fk_dur_id:                 "Durée d'engagement",
    fk_dur_id_renew:           "Durée de renouvellement",
    fk_dur_id_invoicing:       "Fréquence de facturation",
    fk_dur_id_notice:          "Préavis",
    fk_usr_id_seller:          "Commercial",
  },
  formatters: {
    ord_status:           (v) => STATUS_CONFIG[v]?.label ?? String(v),
    ord_invoicing_state:  (v) => INVOICING_STATE_CONFIG[v]?.label ?? String(v),
    ord_delivery_state:   (v) => DELIVERY_STATE_CONFIG[v]?.label ?? String(v),
    ord_being_edited:     (v) => (v ? "Oui" : "Non"),
    ord_totalht:          (v) => v != null ? `${parseFloat(v).toFixed(2)} €` : "—",
    ord_totaltax:         (v) => v != null ? `${parseFloat(v).toFixed(2)} €` : "—",
    ord_totalttc:         (v) => v != null ? `${parseFloat(v).toFixed(2)} €` : "—",
    ord_sign_signature_image: (v, allChanges) => {
      if (!v) return "—";
      let signerName = null;
      try {
        const raw = allChanges?.ord_validation_data;
        const vdNew = raw && typeof raw === "object" ? raw.new : raw;
        if (vdNew) {
          const parsed = typeof vdNew === "string" ? JSON.parse(vdNew) : vdNew;
          signerName = parsed?.name ?? null;
        }
      } catch {}
      return <SignaturePreviewCell signerName={signerName} imageData={v} />;
    },
  },
  hidden: [
    "ord_sign_audit",
    "ord_sign_token",
    "ord_validation_data",
    "ord_sign_cgv_accepted",
  ],
};

export const getModuleConfig = () => {

  return {

    // Type de taxe pour filtrer les produits
    taxType: { tax_use: TAX_TYPE.SALE },

    field: { pam: "fk_pam_id_customer", paymentCondition: "fk_dur_id_payment_condition_customer" },

    // Filtre de produit (is_saleable = 1 pour vente)
    productFilter: { is_active: 1, is_saleable: 1 },

    // Identifiant du module
    name: "sale-orders",

    // Titre du module
    title: "Commandes clients",
    titleSingular: "Commande client",

    // Préfixe pour les permissions
    permissionPrefix: "sale-orders",

    // Endpoints API
    api: {
      base: "/api/sale-orders",
      lines: (orderId) => `/api/sale-orders/${orderId}/lines`,
      documents: (orderId) => `/api/sale-orders/${orderId}/documents`,
      duplicate: (orderId) => `/api/sale-orders/${orderId}/duplicate`,
      linkedObjects: (orderId) => `/api/sale-orders/${orderId}/linked-objects`,
      pdf: (orderId) => `/api/sale-orders/${orderId}/pdf`,
    },

    // Configuration des documents
    documents: {
      module: "sale-orders",
    },


    // Configuration du tableau de lignes
    linesTableConfig: {
      columnsConfig: {
        showMargin: true,
        showMarginPercent: true,
        showQtyReceived: false,
        showIsSubscription: true,
      },
    },

    // Configuration des totaux
    totalsConfig: {
      showSubscription: true,
      showOneTime: true,
    },

    // Configurations des statuts
    statusConfig: STATUS_CONFIG,
    invoicingStateConfig: INVOICING_STATE_CONFIG,
    deliveryStateConfig: DELIVERY_STATE_CONFIG,

    // Fonctionnalités activées
    features: {
      showMarginTable: true,
      showSubscription: true, // Afficher checkbox abonnement
      showPurchasePrice: true, // Afficher prix d'achat
    },
  }

}


