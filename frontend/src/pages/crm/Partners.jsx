import { useRef, useMemo, useState } from "react";
import { Button, Tooltip } from "antd";
import { PlusOutlined, FunnelPlotOutlined } from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import ServerTable from "../../components/table";
import { formatCurrency } from "../../utils/formatters";
import PageContainer from "../../components/common/PageContainer";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";

import CanAccess from "../../components/common/CanAccess";

import { partnersApi, customersApi, suppliersApi, prospectsApi } from "../../services/api";
import Partner from "./Partner";
import Opportunity from "./Opportunity";

/**
 * Affiche la liste avec une grid interactive
 */
export default function Partners() {

    const gridRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();

    // Drawer pour les partenaires
    const {
        drawerOpen,
        selectedItemId,
        closeDrawer,
        openForCreate,
        openForEdit
    } = useDrawerManager();

    // Drawer pour les opportunités (prospects uniquement)
    const [oppDrawerOpen, setOppDrawerOpen] = useState(false);
    const [oppDefaultValues, setOppDefaultValues] = useState({});

    const isProspectPage = location.pathname.startsWith('/prospects');
    const isCustomerPage = location.pathname.startsWith('/customers');

    const openNewOpportunity = (record) => {
        setOppDefaultValues({ fk_ptr_id: record.id });
        setOppDrawerOpen(true);
    };

    const closeOppDrawer = () => {
        setOppDrawerOpen(false);
        setOppDefaultValues({});
    };

    // Configuration en fonction du type de page
    const pageConfig = useMemo(() => {
        if (location.pathname.startsWith('/customers')) {
            return {
                title: "Clients",
                buttonLabel: "Ajouter un client",
                fetchData: customersApi.list,
                basePath: "/customers",
                permissionPrefix: "customers"
            };
        }
        if (location.pathname.startsWith('/suppliers')) {
            return {
                title: "Fournisseurs",
                buttonLabel: "Ajouter un fournisseur",
                fetchData: suppliersApi.list,
                basePath: "/suppliers",
                permissionPrefix: "suppliers"
            };
        }
        if (location.pathname.startsWith('/prospects')) {
            return {
                title: "Prospects",
                buttonLabel: "Ajouter un prospect",
                fetchData: prospectsApi.list,
                basePath: "/prospects",
                permissionPrefix: "prospects"
            };
        }
        // Default: partners
        return {
            title: "Partenaires",
            buttonLabel: "Ajouter un partenaire",
            fetchData: partnersApi.list,
            basePath: "/partners",
            permissionPrefix: "partners"
        };
    }, [location.pathname]);

    const permissions = useMemo(() => ({
        create: `${pageConfig.permissionPrefix}.create`,
        edit: `${pageConfig.permissionPrefix}.edit`,
    }), [pageConfig.permissionPrefix]);

    // Handler simplifié qui recharge juste la grid
    const handleFormSubmit = async () => {
        if (gridRef.current?.reload) {
            await gridRef.current.reload();
        }
    };

    const { handleRowClick } = useRowHandler(openForEdit);

    const columns = useMemo(() => {
        const baseColumns = [
            { key: "ptr_name", title: "Nom", filterType: "text", ellipsis: true, render: (v) => <strong>{v}</strong> },
            { key: "ptr_city", title: "Ville", width: 150, filterType: "text", ellipsis: true, },
            { key: "ptr_phone", title: "Téléphone", width: 140, filterType: "text", },
            { key: "ptr_email", title: "Email", width: 200, filterType: "text", ellipsis: true, },
            { key: "seller_name", title: "Commercial", width: 160, filterType: "text", ellipsis: true, },

        ];
        if (isProspectPage || isCustomerPage) {
            baseColumns.push({
                key: "opp_count",
                title: "Opportunités",
                width: 120,
                align: "center",
                sorter: true,
                render: (value) => value || 0,
            });
        }
        // Ajouter la colonne pipeline seulement si showPipeline est true
        if (pageConfig.showPipeline) {
            baseColumns.push({
                key: "pipeline_amount",
                title: "Pipeline",
                width: 130,
                align: "right",
                sorter: true,
                render: (value) => formatCurrency(value),
            });
        }

        // Ajouter colonne "Nouvelle opportunité" pour les prospects
        if (isProspectPage) {
            baseColumns.push({
                key: "new_opp",
                title: "",
                width: 50,
                render: (_, record) => (
                    <Tooltip title="Nouvelle opportunité">
                        <Button
                            size="small"
                            type="text"
                            icon={<FunnelPlotOutlined />}
                            onClick={(e) => {
                                e.stopPropagation();
                                openNewOpportunity(record);
                            }}
                        />
                    </Tooltip>
                ),
            });
        }

        // Toujours en dernière position
        baseColumns.push(
            createEditActionColumn({ permission: permissions.edit, onEdit: handleRowClick, idField: "id", mode: "table", })
        );

        return baseColumns;
    }, [pageConfig.showPipeline, isProspectPage]);


    return (
        <PageContainer
            title={pageConfig.title}
            actions={
                <CanAccess permission={permissions.create}>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={openForCreate}
                        size="large"
                    >
                        {pageConfig.buttonLabel}
                    </Button>
                </CanAccess>
            }
        >
            <ServerTable
                key={location.pathname}
                ref={gridRef}
                fetchFn={pageConfig.fetchData}
                columns={columns}
                defaultSort={{ field: "ptr_name", order: "ASC" }}
                onRowClick={handleRowClick}
            />

            {drawerOpen && (
                <Partner
                    open={drawerOpen}
                    onClose={closeDrawer}
                    partnerId={selectedItemId}
                    onSubmit={handleFormSubmit}
                    csv={true}
                />
            )}

            {oppDrawerOpen && (
                <Opportunity
                    open={oppDrawerOpen}
                    onClose={closeOppDrawer}
                    opportunityId={null}
                    onSubmit={handleFormSubmit}
                    defaultValues={oppDefaultValues}
                />
            )}
        </PageContainer>
    );
}
