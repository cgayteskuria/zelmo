import { useState } from "react";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import PageContainer from "../../components/common/PageContainer";
import CanAccess from "../../components/common/CanAccess";
import TimeWeekView from "./TimeWeekView";
import TimeEntryForm from "./TimeEntryForm";
import { useDrawerManager } from "../../hooks/useDrawerManager";

export default function TimeWeekPage() {
    const { drawerOpen, selectedItemId, closeDrawer, openForCreate, openForEdit } = useDrawerManager();
    const [refreshKey, setRefreshKey] = useState(0);

    const handleSubmit = () => setRefreshKey(k => k + 1);

    return (
        <PageContainer
            title="Vue semaine"
            actions={
                <CanAccess permission="time.create">
                    <Button type="primary" icon={<PlusOutlined />} onClick={openForCreate} size="large">
                        Nouvelle saisie
                    </Button>
                </CanAccess>
            }
        >
            <TimeWeekView
                key={refreshKey}
                onEntryClick={(row) => openForEdit(row.ten_id)}
                onCreateEntry={openForCreate}
            />

            {drawerOpen && (
                <TimeEntryForm
                    open={drawerOpen}
                    onClose={closeDrawer}
                    entryId={selectedItemId}
                    onSubmit={handleSubmit}
                />
            )}
        </PageContainer>
    );
}
