import { useState, useEffect } from "react";
import { App, Button, Input, Modal, Table, Tooltip } from "antd";
import { BankOutlined, CheckCircleOutlined, CloseCircleOutlined, CopyOutlined, PlusOutlined, StarFilled } from "@ant-design/icons";
import { createEditActionColumn } from "../table/EditActionColumn";
import BankModal from "./BankModal";
import { bankDetailsApi } from "../../services/api";
import { generateMandateLink } from "../../services/apiMandate";
import CanAccess from "../common/CanAccess";

export default function BankTab({
    entityType = "partner",
    entityId = null,
    permission = "partners.edit",
    isCustomer = false,
    partnerName = "",
}) {
    const { message } = App.useApp();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedBankId, setSelectedBankId] = useState(null);

    const [mandateLoading, setMandateLoading] = useState(false);
    const [mandateModalOpen, setMandateModalOpen] = useState(false);
    const [mandateUrl, setMandateUrl] = useState(null);
    const [mandateExpiresAt, setMandateExpiresAt] = useState(null);

    useEffect(() => {
        if (entityId) {
            loadData();
        }
    }, [entityId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const fkField = entityType === 'partner' ? 'fk_ptr_id' : 'fk_cop_id';
            const response = await bankDetailsApi.list({ [fkField]: entityId });
            setData(response.data || []);
        } catch (error) {
            console.error("Erreur lors du chargement des banques:", error);
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setSelectedBankId(null);
        setModalOpen(true);
    };

    const handleEdit = (row) => {
        if (row.id) {
            setSelectedBankId(row.id);
            setModalOpen(true);
        }
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setSelectedBankId(null);
    };

    const handleSuccess = () => {
        loadData();
    };

    const handleGenerateMandate = async () => {
        setMandateLoading(true);
        try {
            const res = await generateMandateLink(entityId);
            setMandateUrl(res.data.mandate_url);
            setMandateExpiresAt(res.data.expires_at);
            setMandateModalOpen(true);
        } catch (err) {
            message.error(err.message || "Erreur lors de la génération du lien mandat");
        } finally {
            setMandateLoading(false);
        }
    };

    const handleCopyUrl = () => {
        if (mandateUrl) {
            navigator.clipboard.writeText(mandateUrl);
            message.success("Lien copié dans le presse-papier !");
        }
    };

    const expiryLabel = mandateExpiresAt
        ? new Date(mandateExpiresAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
        : null;

    const columns = [
        { dataIndex: "bts_bnal_address", title: "Dom.", width: 100 },
        { dataIndex: "bts_iban", title: "IBAN" },
        { dataIndex: "bts_bic", title: "BIC", width: 100 },
        {
            dataIndex: "bts_is_default",
            title: "Défaut",
            width: 80,
            align: "center",
            render: (value) => value == 1
                ? <StarFilled style={{ color: '#faad14', fontSize: '18px' }} />
                : null,
        },
        {
            dataIndex: "bts_is_active",
            title: "Actif",
            width: 70,
            align: "center",
            render: (value) => value == 1
                ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '18px' }} />
                : <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: '18px' }} />,
        },
        createEditActionColumn({ permission, onEdit: handleEdit, idField: "id", mode: "table" }),
    ];

    if (!entityId) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                <p>Veuillez d'abord enregistrer cet élément avant d'ajouter des comptes bancaires.</p>
            </div>
        );
    }

    return (
        <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                {entityType === 'partner' && isCustomer && (
                    <CanAccess permission={permission}>
                        <Tooltip title={`Mettre en place un prélèvement auprès de ${partnerName || 'ce client'}`}>
                            <Button
                                icon={<BankOutlined />}
                                onClick={handleGenerateMandate}
                                loading={mandateLoading}
                            >
                                Mandat Client
                            </Button>
                        </Tooltip>
                    </CanAccess>
                )}
                <CanAccess permission={permission}>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleCreate}
                    >
                        Ajouter une banque
                    </Button>
                </CanAccess>
            </div>

            <Table
                rowKey="id"
                columns={columns}
                dataSource={data}
                loading={loading}
                pagination={false}
                size="small"
                onRow={(record) => ({
                    onClick: () => handleEdit(record),
                    style: { cursor: 'pointer' },
                })}
            />

            {modalOpen && (
                <BankModal
                    open={modalOpen}
                    onClose={handleCloseModal}
                    onSuccess={handleSuccess}
                    bankId={selectedBankId}
                    entityType={entityType}
                    entityId={entityId}
                />
            )}

            <Modal
                title="Lien de mandat SEPA"
                open={mandateModalOpen}
                onCancel={() => setMandateModalOpen(false)}
                footer={[
                    <Button key="copy" type="primary" icon={<CopyOutlined />} onClick={handleCopyUrl}>
                        Copier le lien
                    </Button>,
                    <Button key="close" onClick={() => setMandateModalOpen(false)}>
                        Fermer
                    </Button>,
                ]}
            >
                <p>
                    Le lien ci-dessous a été généré
                    {partnerName ? ` pour <strong>${partnerName}</strong>` : ''}.
                    {' '}Un email a été envoyé au partenaire. Le lien est valable <strong>30 jours</strong>.
                </p>
                <Input
                    value={mandateUrl || ''}
                    readOnly
                    style={{ marginBottom: 8 }}
                    addonAfter={
                        <CopyOutlined onClick={handleCopyUrl} style={{ cursor: 'pointer' }} />
                    }
                />
                {expiryLabel && (
                    <p style={{ margin: 0, color: '#888', fontSize: 12 }}>
                        Expire le {expiryLabel}
                    </p>
                )}
            </Modal>
        </div>
    );
}
