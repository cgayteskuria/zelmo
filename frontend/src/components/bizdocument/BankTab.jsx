import { useState, useEffect } from "react";
import { Button, Table } from "antd";
import { PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, StarFilled } from "@ant-design/icons";
import { createEditActionColumn } from "../table/EditActionColumn";
import BankModal from "./BankModal";
import { bankDetailsApi } from "../../services/api";
import CanAccess from "../common/CanAccess";

/**
 * Composant BankTab
 * Affiche la liste des comptes bancaires d'une entité (Partner ou Company)
 * avec possibilité d'ajouter/éditer
 */
export default function BankTab({
    entityType = "partner", // "partner" ou "company"
    entityId = null,
    permission = "partners.edit"
}) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedBankId, setSelectedBankId] = useState(null);

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
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
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
        </div>
    );
}
