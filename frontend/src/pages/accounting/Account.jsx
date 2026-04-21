import { Drawer, Form, Input, Button, Space, Popconfirm, Spin, Switch, Select } from "antd";
import { DeleteOutlined, SaveOutlined } from "@ant-design/icons";
import { accountsApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";
import CanAccess from "../../components/common/CanAccess";

const ACC_TYPE_OPTIONS = [
    {
        label: 'Actif',
        options: [
            { label: 'Clients (utilisé pour le lettrage automatique)',             value: 'asset_receivable' },
            { label: 'Banque et Caisse',                   value: 'asset_cash' },
            { label: 'Actifs circulants (Stocks, créances diverses)',                value: 'asset_current' },
            { label: 'Actif immobilisé',             value: 'asset_non_current' },
            { label: "Charges constatées d'avance",  value: 'asset_prepayments' },
            { label: 'Immobilisations corporelles',              value: 'asset_fixed' },
        ],
    },
    {
        label: 'Passif',
        options: [
            { label: 'Fournisseurs (utilisé pour le lettrage automatique)', value: 'liability_payable' },
            { label: 'Cartes de crédit',    value: 'liability_credit_card' },
            { label: 'Passifs circulants (Dettes fiscales, sociales à court terme)',      value: 'liability_current' },
            { label: 'Dettes à long terme (Emprunts)',  value: 'liability_non_current' },
        ],
    },
    {
        label: 'Capitaux propres',
        options: [
            { label: 'Capital social, réserves',          value: 'equity' },
            { label: 'Bénéfice/Perte de l\'exercice (Report à nouveau automatique)',    value: 'equity_unaffected' },
            { label: 'Résultats reportés',        value: 'equity_retained' },
            { label: "Résultat de l'exercice",    value: 'equity_current_year_earnings' },
        ],
    },
    {
        label: 'Produits',
        options: [
            { label: 'Chiffre d\'affaires (Ventes de marchandises/services)',         value: 'income' },
            { label: 'Autres produits (Produits financiers, subventions)',  value: 'income_other' },
        ],
    },
    {
        label: 'Charges',
        options: [
            { label: 'Charges d\'exploitation.',          value: 'expense' },
            { label: 'Dotations aux amortissements',   value: 'expense_depreciation' },
            { label: 'Coût des ventes (Achats de marchandises)',  value: 'expense_direct_cost' },
        ],
    },
    {
        label: 'Autres',
        options: [
            { label: 'Hors bilan', value: 'off_balance' },
        ],
    },
];

/**
 * Composant Account
 * Formulaire d'édition/création d'un compte comptable dans un Drawer
 */
export default function Account({ accountId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();

    const pageLabel = Form.useWatch("acc_label", form);
    const accCode = Form.useWatch("acc_code", form);

    const { submit, remove, loading } = useEntityForm({
        api: accountsApi,
        entityId: accountId,
        idField: 'acc_id',
        form,
        open,

        onSuccess: ({ action, data }) => {
            onSubmit?.({ action, data });
            onClose?.();
        },

        onDelete: ({ id }) => {
            onSubmit?.({ action: 'delete', id });
            onClose?.();
        },
    });

    const drawerActions = (
        <Space>
            {accountId && (
                <CanAccess permission="accountings.edit">
                    <Popconfirm
                        title="Êtes-vous sûr de vouloir supprimer ce compte ?"
                        description="Cette action est irréversible."
                        onConfirm={remove}
                        okText="Supprimer"
                        cancelText="Annuler"
                        okButtonProps={{ danger: true }}
                    >
                        <Button danger icon={<DeleteOutlined />} loading={loading}>
                            Supprimer
                        </Button>
                    </Popconfirm>
                </CanAccess>
            )}
            <Button onClick={onClose}>Annuler</Button>
            <CanAccess permission={accountId ? "accountings.edit" : "accountings.create"}>
                <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()} loading={loading}>
                    {accountId ? "Enregistrer" : "Créer"}
                </Button>
            </CanAccess>
        </Space>
    );

    return (
        <Drawer
            title={
                pageLabel ? `Édition - ${pageLabel}` : "Nouveau compte"
            }
            open={open}
            onClose={onClose}
            size={drawerSize}
            footer={drawerActions}
            forceRender
            destroyOnHidden
        >
            <Spin spinning={loading} tip="Chargement...">
                <Form form={form} layout="vertical" onFinish={submit} autoComplete="off">
                    <Form.Item name="acc_id" hidden>
                        <Input />
                    </Form.Item>
                    <Form.Item name="acc_code" label="N° Compte" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="acc_label" label="Libellé" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="acc_type" label="Type de compte" rules={[{ required: true, message: "Le type de compte est requis" }]}>
                        <Select
                            placeholder="Sélectionner un type"
                            options={ACC_TYPE_OPTIONS}
                            showSearch
                            optionFilterProp="label"
                        />
                    </Form.Item>
                    <Form.Item name="acc_is_active" label="Actif" valuePropName="checked" initialValue={true}>
                        <Switch checkedChildren="Oui" unCheckedChildren="Non" />
                    </Form.Item>
                    {String(accCode ?? "").startsWith("4") && (
                        <Form.Item name="acc_is_letterable" label="Lettrable" valuePropName="checked">
                            <Switch />
                        </Form.Item>
                    )}
                </Form>
            </Spin>
        </Drawer>
    );
}
