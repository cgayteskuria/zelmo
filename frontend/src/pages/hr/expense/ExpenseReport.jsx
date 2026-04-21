import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Form, Input, Button, Row, Col, DatePicker, Popconfirm, Spin, Card, Space, Modal, Descriptions, Alert, Tabs } from "antd";
import { message } from '../../../utils/antdStatic';
import { DeleteOutlined, SaveOutlined, ArrowLeftOutlined, SendOutlined, CheckOutlined, CloseOutlined, DollarOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useListNavigation } from "../../../hooks/useListNavigation";
import dayjs from "dayjs";
import PageContainer from "../../../components/common/PageContainer";
import { expenseReportsApi, myExpenseReportsApi, createExpensesApi, createMileageExpensesApi } from "../../../services/api";
import { useEntityForm } from "../../../hooks/useEntityForm";
import { getWritingPeriod } from "../../../utils/writingPeriod";
import ExpensesList from "../../../components/expense/ExpensesList";
import MileageExpensesList from "../../../components/expense/MileageExpensesList";

import { formatCurrency } from "../../../utils/formatters";
import { formatStatus, canSubmit, canApprove, canUnapprove, formatPaymentStatus, EXPENSE_REPORT_STATUS, PAYMENTS_TAB_CONFIG, PAYMENT_DIALOG_CONFIG } from "../../../configs/ExpenseConfig";
import CanAccess from "../../../components/common/CanAccess";
import UserSelect from "../../../components/select/UserSelect";


// Import lazy des composants lourds
const ExpenseFormDrawer = lazy(() => import('../../../components/expense/ExpenseFormDrawer'));
const MileageExpenseFormDrawer = lazy(() => import('../../../components/expense/MileageExpenseFormDrawer'));
const PaymentsTab = lazy(() => import('../../../components/bizdocument/PaymentsTab'));

// Composant de chargement pour les onglets
const ElementLoader = () => (
    <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px'
    }}>
        <Spin size="large" tip="Chargement..." spinning={true}>
            <div style={{ minHeight: '200px' }} />
        </Spin>
    </div>
);
const { TextArea } = Input;

export default function ExpenseReport() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const location = useLocation();

    const { hasNav, hasPrev, hasNext, goToPrev, goToNext, position } = useListNavigation();

    const isNew = id === "new";
    const expenseReportId = isNew ? null : parseInt(id, 10);

    // Déterminer quelle API utiliser selon le contexte (mes notes ou équipe)
    const isMyExpenseReports = location.pathname.split('/')[1] === "my-expense-reports";
    const basePath = isMyExpenseReports ? "my-expense-reports" : "expense-reports";
    const api = isMyExpenseReports ? myExpenseReportsApi : expenseReportsApi;

    // API pour les dépenses (nested sous expense-reports)
    const expensesApi = expenseReportId ? createExpensesApi(basePath, expenseReportId) : null;
    const mileageExpensesApi = expenseReportId ? createMileageExpensesApi(basePath, expenseReportId) : null;

    const [saving, setSaving] = useState(false);
    const [expenses, setExpenses] = useState([]);
    const [loadingExpenses, setLoadingExpenses] = useState(false);
    const [status, setStatus] = useState(EXPENSE_REPORT_STATUS.DRAFT);
    const [number, setNumber] = useState("");
    const [totals, setTotals] = useState({ totalHT: 0, totalTVA: 0, totalTTC: 0 });
    const [rejectionReason, setRejectionReason] = useState(null);
    const [paymentProgress, setPaymentProgress] = useState(0);
    const [amountRemaining, setAmountRemaining] = useState(0);
    const [userName, setUserName] = useState(null);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [periodFrom, setPeriodFrom] = useState(null);
    const [periodTo, setPeriodTo] = useState(null);
    const [writingPeriod, setWritingPeriod] = useState(null);

    // Frais kilométriques
    const [mileageExpenses, setMileageExpenses] = useState([]);
    const [mileageDrawerOpen, setMileageDrawerOpen] = useState(false);
    const [selectedMileageExpenseId, setSelectedMileageExpenseId] = useState(null);

    // Permissions retournées par le backend
    const [permissions, setPermissions] = useState({
        canEdit: false,
        canDelete: false,
        canApprove: false,
        isOwner: false,
        canApproveAll: false,
    });
    // Charger la période d'écriture comptable
    useEffect(() => {
        getWritingPeriod()
            .then(period => setWritingPeriod(period))
            .catch(() => setWritingPeriod(null));
    }, []);


    // Chargement de la note de frais via useEntityForm
    const { loading, reload, forbidden } = useEntityForm({
        api,
        form,
        open: !isNew,
        entityId: expenseReportId,
        transformData: (data) => ({
            ...data,
            exr_period_from: data.exr_period_from ? dayjs(data.exr_period_from) : null,
            exr_period_to: data.exr_period_to ? dayjs(data.exr_period_to) : null,
        }),
        onDataLoaded: (data) => {
            setStatus(data.exr_status);
            setNumber(data.exr_number);
            setRejectionReason(data.exr_rejection_reason);
            setUserName(data.user?.usr_firstname + ' ' + data.user?.usr_lastname);
            setPeriodFrom(data.exr_period_from ? dayjs(data.exr_period_from) : null);
            setPeriodTo(data.exr_period_to ? dayjs(data.exr_period_to) : null);
            setExpenses(data.expenses || []);
            setMileageExpenses(data.mileage_expenses || []);
            setTotals({
                totalHT: parseFloat(data.exr_total_amount_ht) || 0,
                totalTVA: parseFloat(data.exr_total_tva) || 0,
                totalTTC: parseFloat(data.exr_total_amount_ttc) || 0,
            });
            setPaymentProgress(data.exr_payment_progress || 0);
            setAmountRemaining(data.exr_amount_remaining ?? data.exr_total_amount_ttc ?? 0);
            // Permissions retournées par le backend
            setPermissions({
                canEdit: data.can_edit ?? false,
                canDelete: data.can_delete ?? false,
                canApprove: data.can_approve ?? false,
                isOwner: data.is_owner ?? false,
                canApproveAll: data.can_approve_all ?? false,
            });
        },

    });


    // Vérifier si la période de la note de frais est dans la période d'écriture
    const isPeriodOutsideWritingPeriod = useCallback(() => {
        if (!writingPeriod?.startDate || !writingPeriod?.endDate) return false;
        if (!periodFrom || !periodTo) return false;

        const wpStart = dayjs(writingPeriod.startDate);
        const wpEnd = dayjs(writingPeriod.endDate);

        // ordre logique
        if (periodFrom.isAfter(periodTo, "day")) return true;

        // entièrement compris dans la writing period (bornes incluses)
        if (periodFrom.isBefore(wpStart, "day")) return true;
        if (periodTo.isAfter(wpEnd, "day")) return true;

        return false;
    }, [writingPeriod, periodFrom, periodTo]);

    // Drawer pour ajouter/modifier une depense
    const [expenseDrawerOpen, setExpenseDrawerOpen] = useState(false);
    const [selectedExpenseId, setSelectedExpenseId] = useState(null);
    const [droppedFile, setDroppedFile] = useState(null);

    // Modal pour le rejet
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState("");

    // Le formulaire est désactivé si le statut ne permet pas l'édition OU si l'utilisateur n'a pas la permission
    // Pour une nouvelle note, on se base sur le statut (draft par défaut, donc éditable)
    const formDisabled = isNew ? false : !permissions.canEdit;

    // Initialiser les valeurs par défaut pour une nouvelle note de frais
    useEffect(() => {
        if (isNew) {
            const startOfMonth = dayjs().startOf('month');
            const endOfMonth = dayjs().endOf('month');
            setTimeout(() => {
                form.setFieldsValue({
                    exr_period_from: startOfMonth,
                    exr_period_to: endOfMonth,
                });
            }, 0);
            setPeriodFrom(startOfMonth);
            setPeriodTo(endOfMonth);
        }
    }, [isNew, form]);

    const reloadExpenses = async () => {
        if (!expenseReportId) return;

        setLoadingExpenses(true);
        try {
            const response = await api.get(expenseReportId);
            const data = response.data;
            setExpenses(data.expenses || []);
            setMileageExpenses(data.mileage_expenses || []);
            setTotals({
                totalHT: parseFloat(data.exr_total_amount_ht) || 0,
                totalTVA: parseFloat(data.exr_total_tva) || 0,
                totalTTC: parseFloat(data.exr_total_amount_ttc) || 0,
            });
        } catch (error) {
            message.error("Erreur lors du rechargement des depenses");
        } finally {
            setLoadingExpenses(false);
        }
    };

    // Sauvegarde du formulaire
    const handleSave = async (values) => {
        setSaving(true);
        try {
            const data = {
                exr_title: values.exr_title,
                exr_description: values.exr_description,
                exr_period_from: values.exr_period_from?.format("YYYY-MM-DD"),
                exr_period_to: values.exr_period_to?.format("YYYY-MM-DD"),
            };

            if (isNew) {
                // Si un salarié est sélectionné (par un approuveur), l'ajouter aux données
                if (selectedUserId) {
                    data.fk_usr_id = selectedUserId;
                }
                const response = await api.create(data);
                message.success("Note de frais creee");

                navigate(`/${location.pathname.split('/')[1]}/${response.data.id}`);
            } else {
                await api.update(expenseReportId, data);
                message.success("Note de frais mise a jour");
            }
        } catch (error) {
            const errorMsg = error.response?.data?.message || "Erreur lors de la sauvegarde";
            message.error(errorMsg);
        } finally {
            setSaving(false);
        }
    };

    // Suppression
    const handleDelete = async () => {
        try {
            await api.delete(expenseReportId);
            message.success("Note de frais supprimee");
            navigate(`/${location.pathname.split('/')[1]}`);
        } catch (error) {
            message.error("Erreur lors de la suppression");
        }
    };

    // Workflow : Soumettre
    const handleSubmit = async () => {
        // Vérifier la période d'écriture
        if (isPeriodOutsideWritingPeriod()) {
            message.error(`La période de la note de frais est en dehors de la période d'écriture comptable (${dayjs(writingPeriod.startDate).format("DD/MM/YYYY")} - ${dayjs(writingPeriod.endDate).format("DD/MM/YYYY")})`);
            return;
        }
        try {
            await api.submit(expenseReportId);
            // Recharger les données pour mettre à jour le statut et les permissions
            await reload();
        } catch (error) {
            message.error(error.response?.data?.message || "Erreur lors de la soumission");
        }
    };

    // Workflow : Approuver
    const handleApprove = async () => {
        // Vérifier la période d'écriture
        if (isPeriodOutsideWritingPeriod()) {
            message.error(`La période de la note de frais est en dehors de la période d'écriture comptable (${dayjs(writingPeriod.startDate).format("DD/MM/YYYY")} - ${dayjs(writingPeriod.endDate).format("DD/MM/YYYY")})`);
            return;
        }
        try {
            await api.approve(expenseReportId);
            message.success("Note de frais approuvee");
            // Recharger les données pour mettre à jour le statut et les permissions
            await reload();
        } catch (error) {
            message.error(error.response?.data?.message || "Erreur lors de l'approbation");
        }
    };

    // Workflow : Rejeter
    const handleReject = async () => {
        if (!rejectReason.trim()) {
            message.error("Veuillez indiquer un motif de rejet");
            return;
        }
        try {
            await api.reject(expenseReportId, rejectReason);
            message.success("Note de frais rejetee");
            setRejectModalOpen(false);
            setRejectReason("");
            // Recharger les données pour mettre à jour le statut et les permissions
            await reload();
        } catch (error) {
            message.error(error.response?.data?.message || "Erreur lors du rejet");
        }
    };

    // Workflow : Désapprouver (retour en statut soumis)
    const handleUnapprove = async () => {
        try {
            await api.unapprove(expenseReportId);
            message.success("Note de frais désapprouvée");
            // Recharger les données pour mettre à jour le statut et les permissions
            await reload();
        } catch (error) {
            message.error(error.response?.data?.message || "Erreur lors de la désapprobation");
        }
    };


    // Gestion des depenses
    const handleAddExpense = () => {
        setSelectedExpenseId(null);
        setDroppedFile(null);
        setExpenseDrawerOpen(true);
    };

    // Gestion du drag & drop de fichier
    const handleFileDrop = (file) => {
        setSelectedExpenseId(null);
        setDroppedFile(file);
        setExpenseDrawerOpen(true);
    };

    const handleEditExpense = (expense) => {
        setSelectedExpenseId(expense.id);
        setExpenseDrawerOpen(true);
    };

    const handleDeleteExpense = async (expense) => {
        if (!api) return;
        try {
            await api.delete(expense.id);
            message.success("Depense supprimee");
            reloadExpenses();
        } catch (error) {
            message.error("Erreur lors de la suppression");
        }
    };

    const handleExpenseSuccess = () => {
        reloadExpenses();
    };

    // Gestion des frais kilométriques
    const handleAddMileageExpense = () => {
        setSelectedMileageExpenseId(null);
        setMileageDrawerOpen(true);
    };

    const handleEditMileageExpense = (expense) => {
        setSelectedMileageExpenseId(expense.id);
        setMileageDrawerOpen(true);
    };

    const handleDeleteMileageExpense = async (expense) => {
        if (!mileageExpensesApi) return;
        try {
            await mileageExpensesApi.delete(expense.id);
            message.success("Frais kilometrique supprime");
            reloadExpenses();
        } catch (error) {
            message.error("Erreur lors de la suppression");
        }
    };

    // Boutons de workflow
    const renderWorkflowButtons = () => {
        const buttons = [];

        // Soumettre : seulement si le propriétaire et que le statut le permet
        if (canSubmit(status, expenses.length, mileageExpenses.length) && (permissions.isOwner || permissions.canApproveAll)) {
            buttons.push(
                <Popconfirm
                    key="submit"
                    title="Soumettre la note de frais ?"
                    description="Une fois soumise, vous ne pourrez plus la modifier."
                    onConfirm={handleSubmit}
                >
                    <Button
                        size="large"
                        type="primary"
                        icon={<SendOutlined />}
                        style={{ width: '100%', margin: "4px" }}>
                        Soumettre pour approbation
                    </Button>
                </Popconfirm>
            );
        }

        // Approuver/Rejeter : basé sur la permission retournée par le backend
        if (canApprove(status) && permissions.canApprove) {
            buttons.push(
                <Popconfirm
                    key="approve-btn"
                    title="Approuver la note de frais ?"
                    onConfirm={handleApprove}
                >
                    <Button type="primary"
                        icon={<CheckOutlined />}
                        size="default"
                        style={{ width: '100%', margin: "4px" }}
                    >
                        Approuver
                    </Button>
                </Popconfirm>,
                <Button
                    key="reject-btn"
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => setRejectModalOpen(true)}
                    size="default"
                    style={{ width: '100%', margin: "4px" }}
                >
                    Rejeter la note de frais
                </Button>
            );
        }

        // Désapprouver : uniquement si approuvée et aucun paiement effectué
        if (canUnapprove(status, paymentProgress) && permissions.canApprove) {
            buttons.push(
                <Popconfirm
                    key="unapprove-btn"
                    title="Désapprouver la note de frais ?"
                    description="Elle retournera en statut 'En attente'."
                    onConfirm={handleUnapprove}
                >
                    <Button
                        danger
                        icon={<CloseOutlined />}
                        size="default"
                        style={{ width: '100%', margin: "4px" }}
                    >
                        Désapprouver
                    </Button>
                </Popconfirm>
            );
        }

        return buttons;
    };



    return (
        <PageContainer
            title={
                <Space>
                    {isNew ? "Nouvelle note de frais" : `Note de frais ${number}`}
                </Space>
            }
            headerStyle={{
                center: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                        <Space>
                            {!isNew && !forbidden && formatStatus(status)}
                            {!isNew && status === EXPENSE_REPORT_STATUS.APPROVED && formatPaymentStatus(paymentProgress)}
                        </Space>

                    </div>
                )
            }}
            actions={
                <Space>
                    {hasNav && (
                        <>
                            <Button icon={<LeftOutlined />} onClick={goToPrev} disabled={!hasPrev} title="Précédent" />
                            <span style={{ fontSize: 12, color: '#888' }}>{position}</span>
                            <Button icon={<RightOutlined />} onClick={goToNext} disabled={!hasNext} title="Suivant" />
                        </>
                    )}
                    <Button icon={<ArrowLeftOutlined />} onClick={() =>
                        navigate(`/${location.pathname.split('/')[1]}`)
                    }>
                        Retour
                    </Button>
                </Space>
            }
        >
            <Spin spinning={loading}>
                {/* Permission refusée */}
                {forbidden && (
                    <Alert
                        type="error"
                        title="Permission refusée"
                        description="Vous n'avez pas les droits nécessaires pour accéder à cette note de frais."
                        showIcon
                    />
                )}

                {!forbidden && (
                    <>
                        {/* Alerte si rejetee */}
                        {status === EXPENSE_REPORT_STATUS.REJECTED && rejectionReason && (
                            <Alert
                                type="error"
                                title="Note de frais rejetee"
                                description={rejectionReason}
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                        )}

                        {/* Alerte si période hors période d'écriture */}
                        {!isNew && isPeriodOutsideWritingPeriod() && (
                            <Alert
                                type="warning"
                                message="Période hors période d'écriture comptable"
                                description={`La période de cette note de frais est en dehors de la période d'écriture comptable (${dayjs(writingPeriod?.startDate).format("DD/MM/YYYY")} - ${dayjs(writingPeriod?.endDate).format("DD/MM/YYYY")}). La soumission et la validation sont bloquées.`}
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                        )}

                        <Row gutter={[0, 8]}>
                            {/* Formulaire principal */}
                            <Col span={18}
                                style={{ paddingRight: 8 }}>
                                <Card >
                                    <Form
                                        form={form}
                                        layout="vertical"
                                        onFinish={handleSave}
                                        disabled={formDisabled}
                                    >
                                        <Row gutter={16}>
                                            <Col span={4}>
                                                <Form.Item
                                                    name="exr_period_from"
                                                    label="Periode du"
                                                >
                                                    <DatePicker
                                                        format="DD/MM/YYYY"
                                                        placeholder="Date debut"
                                                        onChange={(date) => setPeriodFrom(date)}
                                                    />
                                                </Form.Item>
                                            </Col>
                                            <Col span={4}>
                                                <Form.Item
                                                    name="exr_period_to"
                                                    label="Au"
                                                >
                                                    <DatePicker
                                                        format="DD/MM/YYYY"
                                                        placeholder="Date fin"
                                                        onChange={(date) => setPeriodTo(date)}
                                                    />
                                                </Form.Item>
                                            </Col>
                                            <Col span={6}>
                                                {isNew && !isMyExpenseReports ? (
                                                    <CanAccess permission="expenses.approve">
                                                        <Form.Item
                                                            label="Salarié"
                                                            rules={[{ required: true, message: "Sélectionner un salarié" }]}
                                                        >
                                                            <UserSelect
                                                                value={selectedUserId}
                                                                onChange={setSelectedUserId}
                                                                loadInitially={true}
                                                                allowClear
                                                                placeholder="Sélectionner un salarié"
                                                                filters={{ usr_is_employee: true, usr_is_active: true }}
                                                            />
                                                        </Form.Item>
                                                    </CanAccess>
                                                ) : (
                                                    userName && (
                                                        <Form.Item
                                                            label="Salarié">
                                                            <Input
                                                                value={userName}
                                                                readOnly
                                                                className="readOnly"
                                                            />
                                                        </Form.Item>
                                                    )
                                                )}
                                            </Col>

                                            <Col span={10}>
                                                <Form.Item
                                                    name="exr_title"
                                                    label="Titre"
                                                >
                                                    <Input placeholder="Ex: Note de frais Janvier" />
                                                </Form.Item>
                                            </Col>
                                        </Row>

                                        <Form.Item
                                            name="exr_description"
                                            label="Description"
                                        >
                                            <TextArea
                                                rows={2}
                                                placeholder="Description ou commentaires (optionnel)"
                                            />
                                        </Form.Item>

                                        {!formDisabled && (
                                            <Form.Item>
                                                <Space>
                                                    <Button
                                                        type="primary"
                                                        htmlType="submit"
                                                        icon={<SaveOutlined />}
                                                        loading={saving}
                                                    >
                                                        {isNew ? "Creer la note de frais" : "Enregistrer"}
                                                    </Button>
                                                </Space>
                                            </Form.Item>
                                        )}
                                    </Form>
                                </Card>
                            </Col>

                            {/* Totaux */}

                            <Col span={6}
                                style={{ paddingLeft: 8, paddingRight: 8 }}>
                                {renderWorkflowButtons()}

                                {permissions.canDelete && !isNew && (
                                    <Popconfirm
                                        title="Supprimer cette note de frais ?"
                                        description="Cette action est irreversible"
                                        onConfirm={handleDelete}
                                        okButtonProps={{ danger: true }}
                                    >
                                        <Button
                                            danger
                                            size="default"
                                            style={{ width: '100%', margin: "4px" }}
                                            icon={<DeleteOutlined />}>
                                            Supprimer la note de frais
                                        </Button>
                                    </Popconfirm>
                                )}

                                <Card style={{ marginTop: 10, textAlign: 'center', paddingBottom: 10 }}>
                                    <strong style={{ fontSize: 18, }}>
                                        Total TTC :  {formatCurrency(totals.totalTTC)}
                                    </strong>
                                </Card>
                            </Col>
                        </Row>
                        {/* Liste des depenses */}
                        {!isNew && (
                            <>
                                <Card style={{ marginTop: 24 }}>
                                    <Tabs items={[
                                        {
                                            key: 'expenses',
                                            label: `Dépenses (${expenses.length})`,
                                            children: (
                                                <ExpensesList
                                                    expenses={expenses}
                                                    loading={loadingExpenses}
                                                    disabled={formDisabled}
                                                    onAdd={handleAddExpense}
                                                    onEdit={handleEditExpense}
                                                    onDelete={handleDeleteExpense}
                                                    onFileDrop={handleFileDrop}
                                                />
                                            ),
                                        },
                                        {
                                            key: 'mileage',
                                            label: `Frais kilométriques (${mileageExpenses.length})`,
                                            children: (
                                                <MileageExpensesList
                                                    expenses={mileageExpenses}
                                                    loading={loadingExpenses}
                                                    disabled={formDisabled}
                                                    onAdd={handleAddMileageExpense}
                                                    onEdit={handleEditMileageExpense}
                                                    onDelete={handleDeleteMileageExpense}
                                                />
                                            ),
                                        },
                                    ]} />
                                </Card>

                                {/* Onglet Paiements - visible uniquement pour les notes approuvées */}
                                {(status === EXPENSE_REPORT_STATUS.APPROVED || status === EXPENSE_REPORT_STATUS.ACCOUNTED) && (
                                    <CanAccess permission="payments.view">
                                        <Card title="Règlements" style={{ marginTop: 24 }}>
                                            <Suspense fallback={<ElementLoader />}>
                                                <PaymentsTab
                                                    parentId={expenseReportId}
                                                    parentStatus={status}
                                                    parentPaymentProgress={paymentProgress}
                                                    parentData={{
                                                        exr_number: number,
                                                        exr_total_amount_ttc: totals.totalTTC,
                                                        exr_amount_remaining: amountRemaining,
                                                        exr_approval_date: null,
                                                        usageInfo: { isUsed: false, usedBy: [] },
                                                    }}
                                                    config={PAYMENTS_TAB_CONFIG}
                                                    dialogConfig={PAYMENT_DIALOG_CONFIG}
                                                    onPaymentChange={reload}
                                                />
                                            </Suspense>
                                        </Card>
                                    </CanAccess>
                                )}
                            </>
                        )}
                        {/* Drawer pour depense */}
                        {expenseDrawerOpen && (
                            <Suspense fallback={<ElementLoader />}>
                                <ExpenseFormDrawer
                                    open={expenseDrawerOpen}
                                    onClose={() => {
                                        setExpenseDrawerOpen(false);
                                        setDroppedFile(null);
                                    }}
                                    expenseReportId={expenseReportId}
                                    expenseId={selectedExpenseId}
                                    disabled={formDisabled}
                                    onSuccess={handleExpenseSuccess}
                                    periodFrom={periodFrom}
                                    periodTo={periodTo}
                                    initialFile={droppedFile}
                                    expensesApi={expensesApi}
                                />
                            </Suspense>
                        )}

                        {/* Drawer pour frais kilométrique */}
                        {mileageDrawerOpen && (
                            <Suspense fallback={<ElementLoader />}>
                                <MileageExpenseFormDrawer
                                    open={mileageDrawerOpen}
                                    onClose={() => setMileageDrawerOpen(false)}
                                    expenseReportId={expenseReportId}
                                    mileageExpenseId={selectedMileageExpenseId}
                                    disabled={formDisabled}
                                    onSuccess={reloadExpenses}
                                    periodFrom={periodFrom}
                                    periodTo={periodTo}
                                    mileageExpensesApi={mileageExpensesApi}
                                />
                            </Suspense>
                        )}

                        {/* Modal de rejet */}
                        <Modal
                            title="Rejeter la note de frais"
                            open={rejectModalOpen}
                            onCancel={() => setRejectModalOpen(false)}
                            onOk={handleReject}
                            okText="Rejeter"
                            okButtonProps={{ danger: true }}
                        >
                            <p>Veuillez indiquer le motif du rejet :</p>
                            <TextArea
                                rows={4}
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Motif du rejet..."
                            />
                        </Modal>
                    </>
                )}
            </Spin>
        </PageContainer >
    );
}
