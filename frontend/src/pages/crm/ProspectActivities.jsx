import { useRef, useMemo, useState, useCallback, useEffect } from "react";
import { Button, Switch, Tooltip, Space } from "antd";
import { message } from '../../utils/antdStatic';
import dayjs from "dayjs";
import { PlusOutlined, CheckOutlined, UnorderedListOutlined, CalendarOutlined } from "@ant-design/icons";
import ServerTable from "../../components/table";
import { formatDate, formatDateTime } from "../../utils/formatters";
import PageContainer from "../../components/common/PageContainer";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import { formatActivityType } from "../../configs/OpportunityConfig";
import { prospectActivitiesApi } from "../../services/apiProspect";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import ActivityFormModal from "../../components/crm/ActivityFormModal";
import { useAuth } from "../../contexts/AuthContext";
import UserSelect from "../../components/select/UserSelect";
import WeeklyCalendar, { getWeekStart } from "../../components/crm/WeeklyCalendar";

export default function ProspectActivities() {
    const gridRef = useRef(null);
    const [pendingOnly, setPendingOnly] = useState(true);
    const [viewMode, setViewMode] = useState(
        () => localStorage.getItem('zelmo_activities_view') || "list"
    );

    const handleSetViewMode = useCallback((mode) => {
        setViewMode(mode);
        localStorage.setItem('zelmo_activities_view', mode);
    }, []);

    const [weekStart, setWeekStart] = useState(() => getWeekStart(dayjs()));
    const { user, can } = useAuth();
    const canViewAll  = can('prospect-activities.view_all');
    const canViewTeam = can('prospect-activities.view_team');
    const [calendarSellerId, setCalendarSellerId] = useState(() => user?.id ?? null);
    const [calendarActivities, setCalendarActivities] = useState([]);
    const [calendarLoading, setCalendarLoading] = useState(false);
    const [createDefaultValues, setCreateDefaultValues] = useState({});

    const { drawerOpen, selectedItemId, closeDrawer, openForCreate, openForEdit } = useDrawerManager();
    const { handleRowClick } = useRowHandler(openForEdit, "id");

    const fetchCalendarActivities = useCallback(async () => {
        if (viewMode !== "calendar") return;
        setCalendarLoading(true);
        try {
            const res = await prospectActivitiesApi.calendar({
                date_from: weekStart.format('YYYY-MM-DD'),
                date_to: weekStart.add(6, 'day').format('YYYY-MM-DD'),
                ...(calendarSellerId ? { seller_id: calendarSellerId } : {}),
            });
            setCalendarActivities(res.data || []);
        } catch {
            message.error("Erreur lors du chargement du calendrier");
        } finally {
            setCalendarLoading(false);
        }
    }, [viewMode, weekStart, calendarSellerId]);

    useEffect(() => { fetchCalendarActivities(); }, [fetchCalendarActivities]);

    const handleFormSubmit = async () => {
        if (viewMode === "list") { if (gridRef.current?.reload) await gridRef.current.reload(); }
        else await fetchCalendarActivities();
    };

    const handleMarkDone = async (row) => {
        try {
            await prospectActivitiesApi.markAsDone(row.id);
            message.success("Activité terminée");
            if (viewMode === "list") gridRef.current?.reload?.();
            else await fetchCalendarActivities();
        } catch { message.error("Erreur"); }
    };

    const rowClassName = useCallback((record) => {
        const isOverdue = !record.pac_is_done && record.pac_due_date && dayjs(record.pac_due_date).isBefore(dayjs());
        return isOverdue ? "row-overdue" : "";
    }, []);

    const handleActivityResize = useCallback(async (id, { pac_date, pac_due_date }) => {
        try {
            await prospectActivitiesApi.update(id, { pac_date, pac_due_date });
            await fetchCalendarActivities();
        } catch {
            message.error("Erreur lors du redimensionnement");
        }
    }, [fetchCalendarActivities]);

    const handleSlotClick = useCallback((day, hour) => {
        setCreateDefaultValues({ pac_date: day.hour(hour).minute(0).second(0) });
        openForCreate();
    }, [openForCreate]);

    const handleNewActivity = useCallback(() => {
        setCreateDefaultValues({});
        openForCreate();
    }, [openForCreate]);

    const userInitialData = useMemo(() => user ? {
        usr_id: user.id,
        usr_firstname: user.firstname,
        usr_lastname: user.lastname,
    } : null, [user]);

    const columns = useMemo(() => [
        {
            key: "pac_type", title: "Type", width: 110, filterType: "select",
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
            key: "pac_subject", title: "Sujet", filterType: "text",
            render: (value) => value?.length > 40
                ? <Tooltip title={value}>{value.slice(0, 50)}…</Tooltip>
                : value,
        },
        { key: "ptr_name", title: "Prospect", filterType: "text", ellipsis: true },
        { key: "opp_label", title: "Opportunité", filterType: "text", ellipsis: true },
        { key: "contact_names", title: "Contact(s)", filterType: "text", ellipsis: true, render: (v) => v || null },
        { key: "pac_date", title: "Échéance", width: 145, align: "center", filterType: "date", render: (v) => formatDateTime(v) },
        { key: "seller_name", title: "Commercial", width: 150, filterType: "text", ellipsis: true },
        {
            key: "mark_done", title: "", width: 50,
            render: (_, record) => !record.pac_is_done ? (
                <Button size="small" type="text" icon={<CheckOutlined />}
                    onClick={(e) => { e.stopPropagation(); handleMarkDone(record); }} />
            ) : null,
        },
        createEditActionColumn({ permission: "opportunities.edit", onEdit: handleRowClick, idField: "id", mode: "table" }),
    ], [handleRowClick]);

    const sellerFilter = (canViewAll || canViewTeam) ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                Commercial :
            </span>
            <UserSelect
                value={calendarSellerId}
                onChange={setCalendarSellerId}
                style={{ width: 220 }}
                filters={canViewAll ? { is_seller: 1 } : { is_managed_seller: 1 }}
                loadInitially
                initialData={userInitialData}
                allowClear
                placeholder={canViewAll ? "Tous les commerciaux" : "Mes commerciaux"}
            />
        </div>
    ) : null;

    return (
        <PageContainer
            title="Activités de prospection"
            actions={
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    {viewMode === "list" && (
                        <>
                            <span style={{ color: 'var(--color-muted)' }}>À faire uniquement</span>
                            <Switch checked={pendingOnly} onChange={setPendingOnly} />
                        </>
                    )}
                    <Space.Compact>
                        <Button
                            icon={<UnorderedListOutlined />}
                            type={viewMode === "list" ? "primary" : "default"}
                            onClick={() => handleSetViewMode("list")}
                        >
                            Liste
                        </Button>
                        <Button
                            icon={<CalendarOutlined />}
                            type={viewMode === "calendar" ? "primary" : "default"}
                            onClick={() => handleSetViewMode("calendar")}
                        >
                            Calendrier
                        </Button>
                    </Space.Compact>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleNewActivity} size="large">
                        Nouvelle activité
                    </Button>
                </div>
            }
        >
            {viewMode === "list" ? (
                <ServerTable
                    key={`activities-${pendingOnly}`}
                    ref={gridRef}
                    fetchFn={(params) => prospectActivitiesApi.list({ ...params, pending_only: pendingOnly })}
                    columns={columns}
                    defaultSort={{ field: "pac_due_date", order: "ASC" }}
                    onRowClick={handleRowClick}
                    rowClassName={rowClassName}
                />
            ) : (
                <WeeklyCalendar
                    activities={calendarActivities}
                    weekStart={weekStart}
                    onWeekChange={setWeekStart}
                    onSlotClick={handleSlotClick}
                    onActivityClick={openForEdit}
                    onActivityResize={handleActivityResize}
                    loading={calendarLoading}
                    toolbarExtra={sellerFilter}
                    hideSunday
                />
            )}

            {drawerOpen && (
                <ActivityFormModal
                    open={drawerOpen}
                    onClose={closeDrawer}
                    activityId={selectedItemId}
                    onSubmit={handleFormSubmit}
                    defaultValues={createDefaultValues}
                />
            )}
        </PageContainer>
    );
}
