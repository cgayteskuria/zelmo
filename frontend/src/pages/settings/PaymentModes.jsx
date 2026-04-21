import { useRef } from "react";
import { Button } from "antd";
import { PlusOutlined, SettingOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import CanAccess from "../../components/common/CanAccess";

import { paymentModesApi } from "../../services/api";
import PaymentMode from "./PaymentMode";

export default function PaymentModes() {
    const gridRef = useRef(null);
    const { drawerOpen, selectedItemId, closeDrawer, openForCreate, openForEdit } = useDrawerManager();

    const handleFormSubmit = async () => {
        if (gridRef.current?.reload) await gridRef.current.reload();
    };

    const { handleRowClick } = useRowHandler(openForEdit, "id");

    const columns = [
        { key: "pam_label", title: "Libellé", filterType: "text", ellipsis: true },
        createEditActionColumn({ permission: "accountings.edit", onEdit: handleRowClick, idField: "id", mode: "table" }),
    ];

    const breadcrumbItems = [
        { title: <Link to="/settings"><SettingOutlined /> Configuration</Link> },
        { title: "Modes de paiement" },
    ];

    return (
        <PageContainer
            title="Modes de paiement"
            breadcrumb={breadcrumbItems}
            actions={
                <CanAccess permission="accountings.create">
                    <Button type="primary" icon={<PlusOutlined />} onClick={openForCreate} size="large">
                        Ajouter
                    </Button>
                </CanAccess>
            }
        >
            <ServerTable
                ref={gridRef}
                fetchFn={(params) => paymentModesApi.list(params)}
                columns={columns}
                defaultSort={{ field: 'pam_label', order: 'ASC' }}
                onRowClick={handleRowClick}
            />
            {drawerOpen && (
                <PaymentMode
                    open={drawerOpen}
                    onClose={closeDrawer}
                    paymentModeId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
