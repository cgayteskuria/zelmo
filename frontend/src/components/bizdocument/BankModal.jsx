import { useState, useEffect } from "react";
import { Modal, Form, Input, Button, Row, Col, Switch, App, Alert, Spin, Popconfirm, } from "antd";
import { SaveOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, DeleteOutlined } from "@ant-design/icons";
import { bankDetailsApi } from "../../services/api";
import AccountSelect from "../select/AccountSelect";

/**
 * Composant BankModal
 * Modal pour créer/éditer un compte bancaire avec validation IBAN
 */
export default function BankModal({
    open,
    onClose,
    onSuccess,
    bankId = null,
    entityType = "partner", // "partner" ou "company"
    entityId = null
}) {
    const [form] = Form.useForm();
    const { message } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [bankData, setBankData] = useState(null);
    const [ibanValidation, setIbanValidation] = useState(null); // null, 'validating', 'success', 'error'
    const [ibanMessage, setIbanMessage] = useState(null);
    const [validationTimeout, setValidationTimeout] = useState(null);

    /**
     * Charger les données si édition
     */
    useEffect(() => {
        if (open && bankId) {
            loadBankData();
        } else if (open) {
            form.resetFields();
            setBankData(null);
            setIbanValidation(null);
            setIbanMessage(null);
        }
    }, [open, bankId]);

    const loadBankData = async () => {
        try {
            setLoading(true);
            const response = await bankDetailsApi.get(bankId);
            setBankData(response.data);
            form.setFieldsValue(response.data);
        } catch (error) {
            message.error("Erreur lors du chargement des données bancaires");
        } finally {
            setLoading(false);
        }
    };

    /**
     * Validation IBAN
     */
    const validateIban = async (iban) => {
        if (!iban || iban.length < 15) {
            setIbanValidation(null);
            setIbanMessage(null);
            // Effacer les champs BBAN
            form.setFieldsValue({
                bts_bank_code: null,
                bts_sort_code: null,
                bts_account_nbr: null,
                bts_bban_key: null
            });
            return;
        }

        setIbanValidation('validating');
        setIbanMessage('Validation en cours...');

        try {
            const response = await bankDetailsApi.validateIban(iban);

            if (response.success) {
                setIbanValidation('success');
                setIbanMessage(`IBAN valide - ${response.data.country_name} (${response.data.country_code})`);

                // Remplir automatiquement les champs BBAN
                form.setFieldsValue({
                    bts_iban: response.data.formatted,
                    bts_bank_code: response.data.bank_code || '',
                    bts_sort_code: response.data.sort_code || '',
                    bts_account_nbr: response.data.account_nbr || '',
                    bts_bban_key: response.data.bban_key || ''
                });
            } else {
                setIbanValidation('error');
                setIbanMessage(response.message || 'IBAN invalide');
                // Effacer les champs BBAN
                form.setFieldsValue({
                    bts_bank_code: null,
                    bts_sort_code: null,
                    bts_account_nbr: null,
                    bts_bban_key: null
                });
            }
        } catch (error) {
            setIbanValidation('error');
            setIbanMessage('Erreur lors de la validation de l\'IBAN');
        }
    };

    /**
     * Formatage IBAN (espaces tous les 4 caractères)
     */
    const formatIban = (value) => {
        const cleaned = value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        return cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    };

    /**
     * Gestion de la saisie IBAN avec debounce
     */
    const handleIbanChange = (e) => {
        const formatted = formatIban(e.target.value);
        form.setFieldsValue({ bts_iban: formatted });

        // Débounce : attendre 800ms après la dernière frappe
        if (validationTimeout) {
            clearTimeout(validationTimeout);
        }

        const timeout = setTimeout(() => {
            validateIban(formatted);
        }, 800);

        setValidationTimeout(timeout);
    };

    /**
     * Soumission du formulaire
     */
    const handleSubmit = async (values) => {
        try {
            setLoading(true);

            const payload = {
                ...values,
                // Ajouter l'ID de l'entité parente (partner ou company)
                [`fk_${entityType === 'partner' ? 'ptr' : 'cop'}_id`]: entityId
            };

            if (bankId) {
                await bankDetailsApi.update(bankId, payload);
                message.success("Compte bancaire mis à jour avec succès");
            } else {
                await bankDetailsApi.create(payload);
                message.success("Compte bancaire créé avec succès");
            }

            form.resetFields();
            onSuccess?.();
            onClose?.();
        } catch (error) {
            message.error(error.message || "Erreur lors de l'enregistrement");
        } finally {
            setLoading(false);
        }
    };

    /**
     * Fermeture du modal
     */
    const handleClose = () => {
        form.resetFields();
        setBankData(null);
        setIbanValidation(null);
        setIbanMessage(null);
        if (validationTimeout) {
            clearTimeout(validationTimeout);
        }
        onClose?.();
    };

    /**
     * Rendu de l'indicateur de validation IBAN
     */
    const renderIbanValidation = () => {
        if (!ibanValidation) return null;

        let icon, color;
        if (ibanValidation === 'validating') {
            icon = <SyncOutlined spin />;
            color = 'info';
        } else if (ibanValidation === 'success') {
            icon = <CheckCircleOutlined />;
            color = 'success';
        } else {
            icon = <CloseCircleOutlined />;
            color = 'error';
        }

        return (
            <Alert
                title={ibanMessage}
                type={color}
                showIcon
                icon={icon}
                style={{ marginBottom: 16 }}
            />
        );
    };

    const handleDelete = async () => {
        try {
            setLoading(true);
            await bankDetailsApi.delete(bankId);
            message.success("Compte bancaire supprimé avec succès");
            onSuccess?.(); // Refresh the grid
            onClose?.(); // Close the modal
        } catch (error) {
            message.error(error.message || "Erreur lors de la suppression");
        } finally {
            setLoading(false);
        }
    };


    return (
        <Modal
            title={bankId ? "Édition d'un compte bancaire" : "Nouveau compte bancaire"}
            open={open}
            onCancel={handleClose}
            width={800}
            footer={[
                <Popconfirm
                    title="Êtes-vous sûr de vouloir supprimer cette bank ?"
                    description="Cette action est irréversible."
                    onConfirm={handleDelete}
                    okText="Supprimer"
                    cancelText="Annuler"
                    okButtonProps={{ danger: true }}
                >
                    <Button
                        danger
                        icon={<DeleteOutlined />}
                        loading={loading}
                    >
                        Supprimer
                    </Button>
                </Popconfirm>,
                <Button key="cancel" onClick={handleClose}>
                    Annuler
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={loading}
                    onClick={() => form.submit()}
                >
                    Enregistrer
                </Button>,


            ]}
        >
            <Spin spinning={loading} tip="Chargement...">
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{
                        bts_is_active: true,
                        bts_is_default: false
                    }}
                >
                    <Form.Item name="bts_id" hidden>
                        <Input />
                    </Form.Item>

                    {/* Section: Informations générales */}
                    <div className="box" style={{ marginBottom: 16 }}>
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="bts_label"
                                    label="Nom"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Le nom est requis"
                                        }
                                    ]}
                                >
                                    <Input placeholder="Ex: Compte principal" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    {/* Section: IBAN */}
                    <div className="box" style={{ marginBottom: 16 }}>
                        <h4 style={{ marginBottom: 16, fontWeight: "bold" }}>
                            Informations bancaires
                        </h4>
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="bts_iban"
                                    label="IBAN"
                                    rules={[
                                        {
                                            required: true,
                                            message: "L'IBAN est requis"
                                        }
                                    ]}
                                    extra="Saisissez l'IBAN pour remplir automatiquement les champs ci-dessous"
                                >
                                    <Input
                                        placeholder="FR76 1234 5678 90AB CDEF GHIJ K12"
                                        onChange={handleIbanChange}
                                        onBlur={(e) => validateIban(e.target.value)}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        {renderIbanValidation()}

                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item
                                    name="bts_bic"
                                    label="BIC / SWIFT"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Le BIC est requis"
                                        }
                                    ]}
                                >
                                    <Input placeholder="Ex: BNPAFRPPXXX" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="bts_bnal_address"
                                    label="Domiciliation"
                                    rules={[
                                        {
                                            required: true,
                                            message: "La domiciliation est requise"
                                        }
                                    ]}
                                >
                                    <Input placeholder="Ex: BNP PARIBAS PARIS" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    {/* Section: Composants BBAN (auto-remplis) */}
                    <div className="box" style={{ marginBottom: 16 }}>
                        <h4 style={{ marginBottom: 8, fontWeight: "bold" }}>
                            Composants BBAN{" "}
                            <span style={{ fontSize: "12px", fontWeight: "normal", color: "#666" }}>
                                (Remplis automatiquement depuis l'IBAN)
                            </span>
                        </h4>
                        <Row gutter={[16, 8]}>
                            <Col span={6}>
                                <Form.Item
                                    name="bts_bank_code"
                                    label="Code Banque"
                                >
                                    <Input placeholder="Auto" readOnly />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item
                                    name="bts_sort_code"
                                    label="Code Guichet"
                                >
                                    <Input placeholder="Auto" readOnly />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item
                                    name="bts_account_nbr"
                                    label="N° de compte"
                                >
                                    <Input placeholder="Auto" readOnly />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item
                                    name="bts_bban_key"
                                    label="Clé RIB"
                                >
                                    <Input placeholder="Auto" readOnly />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    {/* Section: Compte comptable (uniquement pour company) */}
                    {entityType === "company" && (
                        <div className="box" style={{ marginBottom: 16 }}>
                            <Row gutter={[16, 8]}>
                                <Col span={12}>
                                    <Form.Item
                                        name="fk_acc_id"
                                        label="Compte comptable"
                                        rules={[
                                            {
                                                required: true,
                                                message: "Le compte comptable est requis"
                                            }
                                        ]}
                                    >
                                        <AccountSelect
                                            filters={{ type: ['asset_cash'], isActive: true }}
                                            loadInitially={false}
                                            initialData={bankData?.account}
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </div>
                    )}

                    {/* Section: Statuts */}
                    <div className="box">
                        <Row gutter={[16, 8]}>

                            <Col span={4}>
                                <Form.Item
                                    name="bts_is_active"
                                    label="Actif"
                                    valuePropName="checked"
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item
                                    name="bts_is_default"
                                    label="Banque par défaut"
                                    valuePropName="checked"
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                </Form>
            </Spin>
        </Modal>
    );
}
