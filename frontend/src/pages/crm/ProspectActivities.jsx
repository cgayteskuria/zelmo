import { useRef, useMemo, useState } from "react";
import { Button, Tag, Switch } from "antd";
import { message } from '../../utils/antdStatic';
import { PlusOutlined, CheckOutlined } from "@ant-design/icons";
import ServerTable from "../../components/table";
import { formatDate } from "../../utils/formatters";
import PageContainer from "../../components/common/PageContainer";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import { formatActivityType } from "../../configs/OpportunityConfig";
import { prospectActivitiesApi } from "../../services/apiProspect";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import ActivityFormModal from "../../components/crm/ActivityFormModal";

export default function ProspectActivities() {
    const gridRef = useRef(null);
    const [pendingOnly, setPendingOnly] = useState(true);

    const { drawerOpen, selectedItemId, closeDrawer, openForCreate, openForEdit } = useDrawerManager();
    const { handleRowClick } = useRowHandler(openForEdit, "id");

    const handleFormSubmit = async () => {
        if (gridRef.current?.reload) await gridRef.current.reload();
    };

    const handleMarkDone = async (row) => {
        try {
            await prospectActivitiesApi.markAsDone(row.id);
            message.success("Activité terminée");
            gridRef.current?.reload?.();
        } catch {
            message.error("Erreur");
        }
    };

    const columns = useMemo(() => [
        {
            key: "pac_type",
            title: "Type",
            width: 110,
            filterType: "select",
            filterOptions: [
                { value: "call", label: "Appel" },
                { value: "email", label: "Email" },
                { value: "meeting", label: "Réunion" },
                { value: "note", label: "Note" },
                { value: "task", label: "Tâche" },
            ],
            render: (value) => formatActivityType(value),
        },
        {
            key: "pac_subject",
            title: "Sujet",
            filterType: "text",
            ellipsis: true,
        },
        {
            key: "ptr_name",
            title: "Prospect",
            filterType: "text",
            ellipsis: true,
        },
        {
            key: "opp_label",
            title: "Opportunité",
            filterType: "text",
            ellipsis: true,
        },
        {
            key: "pac_date",
            title: "Date",
            width: 120,
            align: "center",
            filterType: "date",
            render: (value) => formatDate(value),
        },
        {
            key: "pac_due_date",
            title: "Échéance",
            width: 120,
            align: "center",
            filterType: "date",
            render: (value) => formatDate(value),
        },
        {
            key: "seller_name",
            title: "Commercial",
            width: 150,
            filterType: "text",
            ellipsis: true,
        },
        {
            key: "pac_is_done",
            title: "Statut",
            width: 100,
            align: "center",
            render: (value) => value ? <Tag color="green">Fait</Tag> : <Tag color="orange">À faire</Tag>,
        },
        {
            key: "mark_done",
            title: "",
            width: 50,
            render: (_, record) => !record.pac_is_done ? (
                <Button size="small" type="text" icon={<CheckOutlined />} onClick={(e) => { e.stopPropagation(); handleMarkDone(record); }} />
            ) : null,
        },
        createEditActionColumn({ permission: "opportunities.edit", onEdit: handleRowClick, idField: "id", mode: "table" }),
    ], [handleRowClick]);

    return (
        <PageContainer
            title="Activités de prospection"
            actions={
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <span>À faire uniquement</span>
                    <Switch checked={pendingOnly} onChange={setPendingOnly} />
                    <Button type="primary" icon={<PlusOutlined />} onClick={openForCreate} size="large">
                        Nouvelle activité
                    </Button>
                </div>
            }
        >
            <ServerTable
                key={`activities-${pendingOnly}`}
                ref={gridRef}
                fetchFn={(params) => prospectActivitiesApi.list({ ...params, pending_only: pendingOnly })}
                columns={columns}
                defaultSort={{ field: "pac_due_date", order: "ASC" }}
                onRowClick={handleRowClick}
            />

            {drawerOpen && (
                <ActivityFormModal
                    open={drawerOpen}
                    onClose={closeDrawer}
                    activityId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
