import { useRef } from "react";
import { Button, Tag, Switch } from "antd";
import { message } from '../../utils/antdStatic';
import { PlusOutlined, SettingOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { formatCurrency } from "../../utils/formatters";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import CanAccess from "../../components/common/CanAccess";

import { expenseCategoriesApi } from "../../services/api";
import ExpenseCategory from "./ExpenseCategory";

/**
 * Affiche la liste des categories de depenses
 */
export default function ExpenseCategories() {
    const gridRef = useRef(null);

    const {
        drawerOpen,
        selectedItemId,
        closeDrawer,
        openForCreate,
        openForEdit
    } = useDrawerManager();

    const handleFormSubmit = async () => {
        if (gridRef.current?.reload) {
            await gridRef.current.reload();
        }
    };

    const { handleRowClick } = useRowHandler(openForEdit, "exc_id");

    const handleToggleActive = async (record, checked) => {
        try {
            await expenseCategoriesApi.toggleActive(record.id);
            message.success(checked ? "Categorie activee" : "Categorie desactivee");
            if (gridRef.current?.reload) {
                await gridRef.current.reload();
            }
        } catch (error) {
            message.error("Erreur lors de la modification");
        }
    };

    const columns = [
        { key: "exc_name", title: "Nom", ellipsis: true, filterType: "text" },
        { key: "exc_code", title: "Code", width: 140 },
        {
            key: "exc_color", title: "Couleur", width: 90, align: "center",
            render: (value) =>
                value ? (
                    <Tag color={value} style={{ width: 60, textAlign: "center" }}>
                        &nbsp;
                    </Tag>
                ) : (
                    "-"
                )
        },
        {
            key: "account", title: "Compte Cptable", ellipsis: true,
            render: (value) => {
                if (!value) return "-";
                return `${value.acc_code} - ${value.acc_label}`;
            }
        },
        {
            key: "exc_is_active", title: "Actif", width: 80, align: "center",
            render: (value, record) => (
                <CanAccess permission="settings.expenses.edit" fallback={
                    value ? <Tag color="green">Oui</Tag> : <Tag color="red">Non</Tag>
                }>
                    <Switch
                        size="small"
                        checked={value}
                        onChange={(checked) => handleToggleActive(record, checked)}
                    />
                </CanAccess>
            )
        },
        {
            key: "exc_requires_receipt",
            title: "Justif. requis",
            width: 110,
            align: "center",
            render: (value) =>
                value ? <Tag color="blue">Oui</Tag> : <Tag>Non</Tag>
        },
        {
            key: "exc_max_amount",
            title: "Montant max",
            width: 130,
            align: "right",
            render: (value) =>
                value ? formatCurrency(value) : <span style={{ color: "#999" }}>Illimite</span>
        },
        createEditActionColumn({
            permission: "settings.expenses.edit",
            onEdit: handleRowClick,
            mode: "table"
        })
    ];

    const breadcrumbItems = [
        {
            title: (
                <Link to="/settings">
                    <SettingOutlined /> Configuration
                </Link>
            )
        },
        { title: "Categories de depenses" }
    ];

    return (
        <PageContainer
            title="Categories de depenses"
            breadcrumb={breadcrumbItems}
            actions={
                <CanAccess permission="settings.expenses.create">
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={openForCreate}
                        size="large"
                    >
                        Ajouter
                    </Button>
                </CanAccess>
            }
        >
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={expenseCategoriesApi.list}
                onRowClick={handleRowClick}
                rowKey="exc_id"
                defaultSort={{ field: 'exc_name', order: 'ASC' }}
            />

            {drawerOpen && (
                <ExpenseCategory
                    open={drawerOpen}
                    onClose={closeDrawer}
                    expenseCategoryId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
