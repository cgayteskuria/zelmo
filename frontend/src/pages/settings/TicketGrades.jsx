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

import { ticketGradesApi } from "../../services/api";
import TicketGrade from "./TicketGrade";

export default function TicketGrades() {
    const gridRef = useRef(null);

    const { drawerOpen, selectedItemId, closeDrawer, openForCreate, openForEdit } = useDrawerManager();

    const handleFormSubmit = async () => {
        if (gridRef.current?.reload) {
            await gridRef.current.reload();
        }
    };

    const { handleRowClick } = useRowHandler(openForEdit, "tkg_id");

    const columns = [
        { key: "tkg_label", title: "Libellé", ellipsis: true, filterType: "text" },
        { key: "tkg_order", title: "Ordre", width: 100 },
        {
            key: "tkg_color",
            title: "Couleur",
            width: 130,
            render: (value) => value ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                        display: 'inline-block',
                        width: 16, height: 16,
                        borderRadius: '50%',
                        background: value,
                        border: '1px solid rgba(0,0,0,0.12)',
                        flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 12, color: '#595959', fontFamily: 'monospace' }}>{value}</span>
                </span>
            ) : "-",
        },
        createEditActionColumn({ permission: "settings.ticketingconf.edit", onEdit: handleRowClick, mode: "table" }),
    ];

    const breadcrumbItems = [
        { title: <Link to="/settings"><SettingOutlined /> Configuration</Link> },
        { title: "Grades de tickets" },
    ];

    return (
        <PageContainer
            title="Grades de tickets"
            breadcrumb={breadcrumbItems}
            actions={
                <CanAccess permission="settings.ticketingconf.create">
                    <Button type="primary" icon={<PlusOutlined />} onClick={openForCreate} size="large">
                        Ajouter
                    </Button>
                </CanAccess>
            }
        >
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={ticketGradesApi.list}
                onRowClick={handleRowClick}
                rowKey="tkg_id"
                defaultSort={{ field: 'tkg_order', order: 'ASC' }}
            />

            {drawerOpen && (
                <TicketGrade
                    open={drawerOpen}
                    onClose={closeDrawer}
                    ticketGradeId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
