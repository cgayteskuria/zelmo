import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Typography, Card } from "antd";
import { BuildOutlined } from "@ant-design/icons";
import PageContainer from "../../components/common/PageContainer";
import Company from "./Company";
import PurchaseOrderConf from "./PurchaseOrderConf";
import SaleOrderConf from "./SaleOrderConf";
import InvoiceConf from "./InvoiceConf";
import ContractConf from "./ContractConf";
import AccountConfig from "../Accounting/AccountConfig";
import TicketConfig from "./TicketConfig";
import ExpenseConfig from "./ExpenseConfig";
import TimeConfig from "./TimeConfig";

const { Title, Paragraph, Text } = Typography;

// Correspondance entre le segment d'URL et la clé du drawer
const DRAWER_MAP = {
    "company-config":      "company",
    "purchase-order-conf": "purchase",
    "sale-order-conf":     "sale",
    "contract-conf":       "contract",
    "invoice-conf":        "invoice",
    "account-config":      "account",
    "ticket-config":       "ticket",
    "expense-config":      "expense",
    "time-config":         "time",
};

const DRAWER_DEFAULT = {
    company: false, purchase: false, sale: false, contract: false,
    invoice: false, account: false, ticket: false, expense: false, time: false,
};

export default function Settings() {
    const location = useLocation();
    const navigate = useNavigate();
    const [drawers, setDrawers] = useState(DRAWER_DEFAULT);

    // Ouvre automatiquement le drawer correspondant au sous-chemin
    useEffect(() => {
        const segment = location.pathname.split("/").pop();
        const key = DRAWER_MAP[segment];
        if (key) {
            setDrawers(prev => ({ ...prev, [key]: true }));
        }
    }, [location.pathname]);

    const close = (key) => {
        setDrawers(prev => ({ ...prev, [key]: false }));
        navigate("/settings", { replace: true });
    };

    return (
        <PageContainer title="Paramètres">
            <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 0" }}>
                <Title level={3} style={{ marginBottom: 8 }}>
                    <BuildOutlined style={{ marginRight: 10 }} />
                    Configuration de l'application
                </Title>
                <Paragraph style={{ fontSize: 15, color: "var(--color-muted)", marginBottom: 24 }}>
                    Tous les paramètres sont accessibles depuis le menu de navigation à gauche,
                    dans la section <strong>CONFIGURATION</strong>. Les sous-menus sont organisés
                    par module&nbsp;: général, assistance, achat, vente, contrat, facturation,
                    comptabilité, stock, notes de frais, temps et prospection.
                </Paragraph>
                <Card
                    size="small"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--color-border)" }}
                >
                    <Text type="secondary">
                        Certains paramètres s'ouvrent dans un panneau latéral (configuration des modules),
                        d'autres affichent une page dédiée (listes, séquences, comptes, etc.).
                    </Text>
                </Card>
            </div>

            {drawers.company && (
                <Company
                    companyId={1}
                    open={drawers.company}
                    onClose={() => close("company")}
                    drawerSize="large"
                />
            )}
            {drawers.purchase && (
                <PurchaseOrderConf
                    purchaseOrderConfId={1}
                    open={drawers.purchase}
                    onClose={() => close("purchase")}
                    drawerSize="large"
                />
            )}
            {drawers.sale && (
                <SaleOrderConf
                    saleOrderConfId={1}
                    open={drawers.sale}
                    onClose={() => close("sale")}
                    drawerSize="large"
                />
            )}
            {drawers.contract && (
                <ContractConf
                    contractConfId={1}
                    open={drawers.contract}
                    onClose={() => close("contract")}
                    drawerSize="large"
                />
            )}
            {drawers.invoice && (
                <InvoiceConf
                    invoiceConfId={1}
                    open={drawers.invoice}
                    onClose={() => close("invoice")}
                    drawerSize="large"
                />
            )}
            {drawers.account && (
                <AccountConfig
                    open={drawers.account}
                    onClose={() => close("account")}
                    drawerSize="large"
                />
            )}
            {drawers.ticket && (
                <TicketConfig
                    open={drawers.ticket}
                    onClose={() => close("ticket")}
                    drawerSize="large"
                />
            )}
            {drawers.expense && (
                <ExpenseConfig
                    open={drawers.expense}
                    onClose={() => close("expense")}
                    drawerSize="large"
                />
            )}
            {drawers.time && (
                <TimeConfig
                    open={drawers.time}
                    onClose={() => close("time")}
                    drawerSize="large"
                />
            )}
        </PageContainer>
    );
}
