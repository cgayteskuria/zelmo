import { useRef, useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Tag, Popconfirm } from "antd";
import { message } from '../../utils/antdStatic';
import { PlusOutlined, CheckCircleOutlined, EditOutlined, CheckOutlined } from "@ant-design/icons";
import {  formatDate } from "../../utils/formatters";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import CanAccess from "../../components/common/CanAccess";

import { customerDeliveryNotesApi, supplierReceptionNotesApi, deliveryNotesApi } from "../../services/api";

/**
 * Page de liste des bons de livraison/réception
 * Le type est déterminé par l'URL :
 * - /customer-delivery-notes : Bons de livraison client
 * - /supplier-reception-notes : Bons de réception fournisseur
 */
export default function DeliveryNotes() {
    const gridRef = useRef(null);
    const location = useLocation();
    const navigate = useNavigate();
    const [draftCount, setDraftCount] = useState(null);

    const isCustomer = location.pathname.includes('customer');
    const basePath = isCustomer ? '/customer-delivery-notes' : '/supplier-reception-notes';
    const api = isCustomer ? customerDeliveryNotesApi : supplierReceptionNotesApi;

    const fetchDraftCount = useCallback(async () => {
        try {
            const response = await deliveryNotesApi.getDraftCounts();
            setDraftCount(isCustomer ? response.data.customer_drafts : response.data.supplier_drafts);
        } catch {
            // Silently ignore
        }
    }, [isCustomer]);

    useEffect(() => {
        fetchDraftCount();
    }, [fetchDraftCount]);

    const handleRowClick = useCallback((row) => {
        const id = row?.id ?? row;
        if (id) {
            navigate(`${basePath}/${id}`);
        }
    }, [navigate, basePath]);

    const handleCreate = useCallback(() => {
        navigate(`${basePath}/new`);
    }, [navigate, basePath]);

    const handleValidate = async (noteId) => {
        try {
            const response = await api.validate(noteId);
            if (response.data?.remainder_note) {
                message.success("Bon marqué comme livré. Un nouveau bon brouillon a été créé pour le reliquat.", 5);
            } else {
                message.success("Bon marqué comme livré avec succès");
            }
            if (gridRef.current?.reload) {
                await gridRef.current.reload();
            }
            fetchDraftCount();
        } catch (error) {
            message.error(error.response?.data?.message || "Erreur lors de la validation");
        }
    };

    const formatStatus = (value) => {
        if (value === 0) {
            return <Tag icon={<EditOutlined />} color="default">Brouillon</Tag>;
        } else if (value === 1) {
            return <Tag icon={<CheckCircleOutlined />} color="success">Livré</Tag>;
        }
        return <Tag color="default">Inconnu</Tag>;
    };

    const columns = [
        { key: "dln_number", title: "Numéro", width: 120 },
        { key: "dln_date", title: "Date", width: 110, filterType: "date", render: (value) => formatDate(value) },
        { key: "ptr_name", title: isCustomer ? "Client" : "Fournisseur", ellipsis: true, filterType: "text" },
        { key: "warehouse_name", title: "Entrepôt", width: 150 },
        { key: "dln_externalreference", title: "Réf. externe", width: 120 },
        { key: "dln_carrier", title: "Transporteur", width: 130 },
        { key: "dln_tracking_number", title: "N° suivi", width: 120 },
        { key: "dln_status", title: "Statut", width: 110, render: (value) => formatStatus(value) },
        {
            key: "validate_action",
            title: " ",
            width: 120,
            render: (value, record) => {
                if (record.dln_status !== 0) return null;
                return (
                    <CanAccess permission="delivery-notes.edit">
                        <Popconfirm
                            title="Marquer comme livré ?"
                            description="Cette action créera les mouvements de stock et ne peut pas être annulée."
                            onConfirm={(e) => {
                                e?.stopPropagation?.();
                                handleValidate(record.id);
                            }}
                            onCancel={(e) => e?.stopPropagation?.()}
                            okText="Confirmer"
                            cancelText="Annuler"
                        >
                            <Button
                                type="link"
                                size="small"
                                icon={<CheckOutlined />}
                                style={{ color: '#52c41a' }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                Valider
                            </Button>
                        </Popconfirm>
                    </CanAccess>
                );
            },
        },
        createEditActionColumn({ permission: "stocks.view", onEdit: handleRowClick, mode: "table" })
    ];

    const baseTitle = isCustomer ? "Bons de livraison client" : "Bons de réception fournisseur";
    const pageTitle = draftCount > 0 ? `${baseTitle} (${draftCount} en attente)` : baseTitle;
    const buttonLabel = isCustomer ? "Nouveau bon de livraison" : "Nouveau bon de réception";

    return (
        <PageContainer
            title={pageTitle}
            actions={
                <CanAccess permission="delivery-notes.create">
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleCreate}
                        size="large"
                    >
                        {buttonLabel}
                    </Button>
                </CanAccess>
            }
        >
            <ServerTable
                key={basePath}
                ref={gridRef}
                columns={columns}
                fetchFn={api.list}
                onRowClick={handleRowClick}
                defaultSort={{ field: 'dln_date', order: 'DESC' }}
            />
        </PageContainer>
    );
}
