import { useState, useEffect, useCallback, lazy, Suspense, useMemo } from "react";
import { Form, Input, Button, DatePicker, Card, Space, Modal, Spin, FloatButton, Empty, ConfigProvider, Collapse, Tabs } from "antd";
import { message } from '../../../utils/antdStatic';
import { DeleteOutlined, SaveOutlined, ArrowLeftOutlined, SendOutlined, CheckOutlined, CloseOutlined, PlusOutlined, EditOutlined, FileTextOutlined, CameraOutlined, SettingOutlined, CarOutlined } from "@ant-design/icons";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import dayjs from "dayjs";
import PageContainer from "../../../components/common/PageContainer";
import { expenseReportsApi, myExpenseReportsApi, createExpensesApi, createMileageExpensesApi } from "../../../services/api";
import { useEntityForm } from "../../../hooks/useEntityForm";
import { getWritingPeriod } from "../../../utils/writingPeriod";
import { formatCurrency } from "../../../utils/formatters";
import { formatStatus, canSubmit, canApprove, canUnapprove, EXPENSE_REPORT_STATUS } from "../../../configs/ExpenseConfig";
import CanAccess from "../../../components/common/CanAccess";
import UserSelect from "../../../components/select/UserSelect";


const ExpenseFormDrawerMobile = lazy(() => import('../../../components/expense/ExpenseFormDrawerMobile.jsx'));
const MileageExpenseFormDrawerMobile = lazy(() => import('../../../components/expense/MileageExpenseFormDrawerMobile'));

const { TextArea } = Input;

const ElementLoader = () => (
    <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px',
        padding: '40px'
    }}>
        <Spin size="large">
            <div style={{ marginTop: 16 }}>Chargement...</div>
        </Spin>
    </div>
);

export default function ExpenseReportMobile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const location = useLocation();

    const isNew = id === "new";
    const expenseReportId = isNew ? null : parseInt(id, 10);

    const isMyExpenseReports = location.pathname.split('/')[1] === "my-expense-reports";
    const basePath = isMyExpenseReports ? "my-expense-reports" : "expense-reports";
    const api = isMyExpenseReports ? myExpenseReportsApi : expenseReportsApi;

    // Mémoïser l'API des dépenses pour éviter de la recréer à chaque render
    const expensesApi = useMemo(() =>
        expenseReportId ? createExpensesApi(basePath, expenseReportId) : null,
        [basePath, expenseReportId]
    );
    const mileageExpensesApi = useMemo(() =>
        expenseReportId ? createMileageExpensesApi(basePath, expenseReportId) : null,
        [basePath, expenseReportId]
    );

    const [saving, setSaving] = useState(false);
    const [expenses, setExpenses] = useState([]);
    const [loadingExpenses, setLoadingExpenses] = useState(false);
    const [status, setStatus] = useState(EXPENSE_REPORT_STATUS.DRAFT);
    const [number, setNumber] = useState("");
    const [title, setTitle] = useState("");
    const [totals, setTotals] = useState({ totalHT: 0, totalTVA: 0, totalTTC: 0 });
    const [rejectionReason, setRejectionReason] = useState(null);
    const [userName, setUserName] = useState(null);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [periodFrom, setPeriodFrom] = useState(null);
    const [periodTo, setPeriodTo] = useState(null);
    const [writingPeriod, setWritingPeriod] = useState(null);

    const [permissions, setPermissions] = useState({
        canEdit: false,
        canDelete: false,
        canApprove: false,
        isOwner: false,
        canApproveAll: false,
    });

    const [expenseDrawerOpen, setExpenseDrawerOpen] = useState(false);
    const [selectedExpenseId, setSelectedExpenseId] = useState(null);
    const [autoCapture, setAutoCapture] = useState(false);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);

    // Frais kilométriques
    const [mileageExpenses, setMileageExpenses] = useState([]);
    const [mileageDrawerOpen, setMileageDrawerOpen] = useState(false);
    const [selectedMileageExpenseId, setSelectedMileageExpenseId] = useState(null);

    useEffect(() => {
        getWritingPeriod()
            .then(period => setWritingPeriod(period))
            .catch(() => setWritingPeriod(null));
    }, []);

    // Fonction pour mettre à jour l'état depuis les données chargées
    const updateStateFromData = useCallback((data) => {
        setStatus(data.exr_status);
        setTitle(data.exr_title);
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

        setPermissions({
            canEdit: data.can_edit ?? false,
            canDelete: data.can_delete ?? false,
            canApprove: data.can_approve ?? false,
            isOwner: data.is_owner ?? false,
            canApproveAll: data.can_approve_all ?? false,
        });
    }, []);

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
        onDataLoaded: updateStateFromData,
    });

    const isPeriodOutsideWritingPeriod = useCallback(() => {
        if (!writingPeriod?.startDate || !writingPeriod?.endDate) return false;
        if (!periodFrom || !periodTo) return false;

        const wpStart = dayjs(writingPeriod.startDate);
        const wpEnd = dayjs(writingPeriod.endDate);

        if (periodFrom.isAfter(periodTo, "day")) return true;
        if (periodFrom.isBefore(wpStart, "day")) return true;
        if (periodTo.isAfter(wpEnd, "day")) return true;

        return false;
    }, [writingPeriod, periodFrom, periodTo]);

    const formDisabled = isNew ? false : !permissions.canEdit;

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

    // Fonction de rechargement des dépenses uniquement (sans recharger toute l'entité)
    const reloadExpenses = useCallback(async () => {
        if (!expenseReportId) return;

        setLoadingExpenses(true);
        try {
            const response = await api.get(expenseReportId);
            const data = response.data;

            // Ne mettre à jour que les dépenses et totaux, pas toute l'entité
            setExpenses(data.expenses || []);
            setMileageExpenses(data.mileage_expenses || []);
            setTotals({
                totalHT: parseFloat(data.exr_total_amount_ht) || 0,
                totalTVA: parseFloat(data.exr_total_tva) || 0,
                totalTTC: parseFloat(data.exr_total_amount_ttc) || 0,
            });
        } catch (error) {
            message.error("Erreur lors du rechargement");
        } finally {
            setLoadingExpenses(false);
        }
    }, [expenseReportId, api]);

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
                if (selectedUserId) {
                    data.fk_usr_id = selectedUserId;
                }
                const response = await api.create(data);
                message.success("Note de frais créée");
                navigate(`/${location.pathname.split('/')[1]}/${response.data.id}`);
            } else {
                await api.update(expenseReportId, data);
                message.success("Note de frais mise à jour");
                // Pas besoin de reload() ici car les données du formulaire sont déjà à jour
            }
        } catch (error) {
            const errorMsg = error.response?.data?.message || "Erreur lors de la sauvegarde";
            message.error(errorMsg);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        try {
            await api.delete(expenseReportId);
            message.success("Note de frais supprimée");
            navigate(`/${location.pathname.split('/')[1]}`);
        } catch (error) {
            message.error("Erreur lors de la suppression");
        }
    };

    const handleSubmit = async () => {
        if (isPeriodOutsideWritingPeriod()) {
            message.error("La période est hors période d'écriture comptable");
            return;
        }
        try {
            await api.submit(expenseReportId);
            message.success("Note de frais soumise");
            await reload();
        } catch (error) {
            message.error(error.response?.data?.message || "Erreur lors de la soumission");
        }
    };

    const handleApprove = async () => {
        if (isPeriodOutsideWritingPeriod()) {
            message.error("La période est hors période d'écriture comptable");
            return;
        }
        try {
            await api.approve(expenseReportId);
            message.success("Note de frais approuvée");
            await reload();
        } catch (error) {
            message.error(error.response?.data?.message || "Erreur lors de l'approbation");
        }
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) {
            message.error("Veuillez indiquer un motif");
            return;
        }
        try {
            await api.reject(expenseReportId, rejectReason);
            message.success("Note de frais rejetée");
            setRejectModalOpen(false);
            setRejectReason("");
            await reload();
        } catch (error) {
            message.error(error.response?.data?.message || "Erreur lors du rejet");
        }
    };

    const handleUnapprove = async () => {
        try {
            await api.unapprove(expenseReportId);
            message.success("Note de frais désapprouvée");
            await reload();
        } catch (error) {
            message.error(error.response?.data?.message || "Erreur");
        }
    };

    const handleAddExpense = () => {
        setSelectedExpenseId(null);
        setAutoCapture(false);
        setExpenseDrawerOpen(true);
    };

    const handleAddCaptureExpense = () => {
        setSelectedExpenseId(null);
        setAutoCapture(true);
        setExpenseDrawerOpen(true);
    };

    const handleEditExpense = (expense) => {
        setSelectedExpenseId(expense.id);
        setAutoCapture(false);
        setExpenseDrawerOpen(true);
    };

    const handleExpenseSuccess = () => {
        // Utiliser reloadExpenses au lieu de reload pour éviter un GET complet
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

    return (
        <div style={{
            minHeight: '100vh',
            background: '#f5f5f5',
            paddingBottom: 80
        }}>
            {/* Header fixe */}
            <div style={{
                position: 'sticky',
                top: 0,
                zIndex: 100,
                background: '#fff',
                borderBottom: '1px solid #f0f0f0',
                padding: '12px 16px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <Button
                        type="text"
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate(`/${location.pathname.split('/')[1]}`)}
                    />
                    <div
                        style={{
                            flex: 1,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}
                    >
                        <div style={{ fontWeight: 600, fontSize: 16 }}>
                            {isNew
                                ? "Nouvelle note de frais"
                                : title
                                    ? `${title} (${number})`
                                    : number || "Note de frais"
                            }
                        </div>
                        {!isNew && !forbidden && (
                            <div style={{ fontSize: 12, marginTop: 2 }}>
                                {formatStatus(status)}
                            </div>
                        )}
                    </div>
                </div>

                {/* Total */}
                {!isNew && (
                    <div style={{
                        padding: '8px 12px',
                        background: '#f0f9ff',
                        borderRadius: 6,
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
                            Total TTC
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 600, color: '#1890ff' }}>
                            {formatCurrency(totals.totalTTC)}
                        </div>
                    </div>
                )}
            </div>

            <Spin spinning={loading}>
                {forbidden ? (
                    <Card style={{ margin: 16 }}>
                        <Empty description="Permission refusée" />
                    </Card>
                ) : (
                    <div style={{ padding: '12px 16px' }}>
                        {/* Alerte rejet */}
                        {status === EXPENSE_REPORT_STATUS.REJECTED && rejectionReason && (
                            <Card
                                style={{
                                    marginBottom: 16,
                                    borderColor: '#ff4d4f',
                                    background: '#fff2f0'
                                }}
                            >
                                <div style={{ color: '#cf1322' }}>
                                    <strong>Rejetée :</strong> {rejectionReason}
                                </div>
                            </Card>
                        )}

                        {/* Formulaire */}
                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={handleSave}
                            disabled={formDisabled}
                        >
                            {isNew ? (
                                <Card style={{ marginBottom: 16 }}>
                                    <Form.Item
                                        name="exr_period_from"
                                        label="Période du"
                                    >
                                        <DatePicker
                                            format="DD/MM/YYYY"
                                            placeholder="Date début"
                                            onChange={(date) => setPeriodFrom(date)}
                                            style={{ width: '100%' }}
                                            size="large"
                                        />
                                    </Form.Item>

                                    <Form.Item
                                        name="exr_period_to"
                                        label="Au"
                                    >
                                        <DatePicker
                                            format="DD/MM/YYYY"
                                            placeholder="Date fin"
                                            onChange={(date) => setPeriodTo(date)}
                                            style={{ width: '100%' }}
                                            size="large"
                                        />
                                    </Form.Item>

                                    {!isMyExpenseReports && (
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
                                                    placeholder="Sélectionner"
                                                    filters={{ usr_is_employee: true, usr_is_active: true }}
                                                    size="large"
                                                />
                                            </Form.Item>
                                        </CanAccess>
                                    )}

                                    <Form.Item
                                        name="exr_title"
                                        label="Titre"
                                    >
                                        <Input
                                            placeholder="Ex: Note de frais Janvier"
                                            size="large"
                                        />
                                    </Form.Item>

                                    <Form.Item
                                        name="exr_description"
                                        label="Description"
                                    >
                                        <TextArea
                                            rows={3}
                                            placeholder="Description (optionnel)"
                                            size="large"
                                        />
                                    </Form.Item>

                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        icon={<SaveOutlined />}
                                        loading={saving}
                                        block
                                        size="large"
                                    >
                                        Créer
                                    </Button>
                                </Card>
                            ) : (
                                <Collapse
                                    style={{ marginBottom: 16 }}
                                    items={[{
                                        key: 'details',
                                        label: (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <SettingOutlined />
                                                <span style={{ fontWeight: 500 }}>Détails</span>
                                                <span style={{ color: '#888', fontSize: 12, marginLeft: 'auto' }}>
                                                    {periodFrom && periodTo
                                                        ? `${periodFrom.format('DD/MM/YYYY')} - ${periodTo.format('DD/MM/YYYY')}`
                                                        : 'Période non définie'}
                                                </span>
                                            </div>
                                        ),
                                        children: (
                                            <>
                                                <Form.Item
                                                    name="exr_period_from"
                                                    label="Période du"
                                                >
                                                    <DatePicker
                                                        format="DD/MM/YYYY"
                                                        placeholder="Date début"
                                                        onChange={(date) => setPeriodFrom(date)}
                                                        style={{ width: '100%' }}
                                                        size="large"
                                                    />
                                                </Form.Item>

                                                <Form.Item
                                                    name="exr_period_to"
                                                    label="Au"
                                                >
                                                    <DatePicker
                                                        format="DD/MM/YYYY"
                                                        placeholder="Date fin"
                                                        onChange={(date) => setPeriodTo(date)}
                                                        style={{ width: '100%' }}
                                                        size="large"
                                                    />
                                                </Form.Item>

                                                {userName && (
                                                    <Form.Item label="Salarié">
                                                        <Input
                                                            value={userName}
                                                            readOnly
                                                            size="large"
                                                        />
                                                    </Form.Item>
                                                )}

                                                <Form.Item
                                                    name="exr_title"
                                                    label="Titre"
                                                >
                                                    <Input
                                                        placeholder="Ex: Note de frais Janvier"
                                                        size="large"
                                                    />
                                                </Form.Item>

                                                <Form.Item
                                                    name="exr_description"
                                                    label="Description"
                                                >
                                                    <TextArea
                                                        rows={3}
                                                        placeholder="Description (optionnel)"
                                                        size="large"
                                                    />
                                                </Form.Item>

                                                {!formDisabled && (
                                                    <Button
                                                        type="primary"
                                                        htmlType="submit"
                                                        icon={<SaveOutlined />}
                                                        loading={saving}
                                                        block
                                                        size="large"
                                                    >
                                                        Enregistrer
                                                    </Button>
                                                )}
                                            </>
                                        )
                                    }]}
                                />
                            )}
                        </Form>

                        {/* Dépenses et Frais kilométriques */}
                        {!isNew && (
                            <Card style={{ marginBottom: 16 }}>
                                <Tabs items={[
                                    {
                                        key: 'expenses',
                                        label: `Dépenses (${expenses.length})`,
                                        children: (
                                            <Spin spinning={loadingExpenses}>
                                                {!formDisabled && (
                                                    <div style={{ marginBottom: 12 }}>
                                                        <Button
                                                            type="primary"
                                                            icon={<PlusOutlined />}
                                                            onClick={handleAddExpense}
                                                        >
                                                            Ajouter
                                                        </Button>
                                                    </div>
                                                )}
                                                {expenses.length === 0 ? (
                                                    <Empty
                                                        description="Aucune dépense"
                                                        image={<FileTextOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
                                                    />
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        {expenses.map((expense, index) => (
                                                            <div
                                                                key={expense.id || index}
                                                                onClick={() => !formDisabled && handleEditExpense(expense)}
                                                                style={{
                                                                    cursor: formDisabled ? 'default' : 'pointer',
                                                                    padding: '16px 0',
                                                                    borderBottom: index !== expenses.length - 1 ? '1px solid #f0f0f0' : 'none'
                                                                }}
                                                            >
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                                    <span style={{ fontWeight: 500 }}>{expense.exp_merchant}</span>
                                                                    <strong style={{ color: '#1890ff' }}>
                                                                        {formatCurrency(expense.exp_total_amount_ttc)}
                                                                    </strong>
                                                                </div>
                                                                <div style={{ fontSize: 12, color: '#666' }}>
                                                                    {dayjs(expense.exp_date).format('DD/MM/YYYY')}
                                                                    {' • '}
                                                                    {expense.category?.exc_name}
                                                                </div>
                                                                {expense.exp_notes && (
                                                                    <div style={{
                                                                        fontSize: 12,
                                                                        color: '#999',
                                                                        marginTop: 4,
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        whiteSpace: 'nowrap'
                                                                    }}>
                                                                        {expense.exp_notes}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </Spin>
                                        ),
                                    },
                                    {
                                        key: 'mileage',
                                        label: `Frais km (${mileageExpenses.length})`,
                                        children: (
                                            <Spin spinning={loadingExpenses}>
                                                {!formDisabled && (
                                                    <div style={{ marginBottom: 12 }}>
                                                        <Button
                                                            type="primary"
                                                            icon={<CarOutlined />}
                                                            onClick={handleAddMileageExpense}
                                                        >
                                                            Ajouter
                                                        </Button>
                                                    </div>
                                                )}
                                                {mileageExpenses.length === 0 ? (
                                                    <Empty
                                                        description="Aucun frais kilometrique"
                                                        image={<CarOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
                                                    />
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        {mileageExpenses.map((expense, index) => (
                                                            <div
                                                                key={expense.id || index}
                                                                onClick={() => !formDisabled && handleEditMileageExpense(expense)}
                                                                style={{
                                                                    cursor: formDisabled ? 'default' : 'pointer',
                                                                    padding: '16px 0',
                                                                    borderBottom: index !== mileageExpenses.length - 1 ? '1px solid #f0f0f0' : 'none'
                                                                }}
                                                            >
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                                    <span style={{ fontWeight: 500 }}>
                                                                        {expense.mex_departure} → {expense.mex_destination}
                                                                    </span>
                                                                    <strong style={{ color: '#52c41a' }}>
                                                                        {formatCurrency(expense.mex_calculated_amount)}
                                                                    </strong>
                                                                </div>
                                                                <div style={{ fontSize: 12, color: '#666' }}>
                                                                    {dayjs(expense.mex_date).format('DD/MM/YYYY')}
                                                                    {' • '}
                                                                    {expense.mex_distance_km} km
                                                                    {expense.mex_is_round_trip ? ' (A/R)' : ''}
                                                                    {expense.vehicle && ` • ${expense.vehicle.vhc_name}`}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </Spin>
                                        ),
                                    },
                                ]} />
                            </Card>
                        )}

                        {/* Actions workflow */}
                        {!isNew && (
                            <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                                {canSubmit(status, expenses.length, mileageExpenses.length) && (permissions.isOwner || permissions.canApproveAll) && (
                                    <Button
                                        type="primary"
                                        icon={<SendOutlined />}
                                        onClick={handleSubmit}
                                        block
                                        size="large"
                                    >
                                        Soumettre pour approbation
                                    </Button>
                                )}

                                {canApprove(status) && permissions.canApprove && (
                                    <>
                                        <Button
                                            type="primary"
                                            icon={<CheckOutlined />}
                                            onClick={handleApprove}
                                            block
                                            size="large"
                                        >
                                            Approuver
                                        </Button>
                                        <Button
                                            danger
                                            icon={<CloseOutlined />}
                                            onClick={() => setRejectModalOpen(true)}
                                            block
                                            size="large"
                                        >
                                            Rejeter
                                        </Button>
                                    </>
                                )}

                                {canUnapprove(status, 0) && permissions.canApprove && (
                                    <Button
                                        danger
                                        icon={<CloseOutlined />}
                                        onClick={handleUnapprove}
                                        block
                                        size="large"
                                    >
                                        Désapprouver
                                    </Button>
                                )}

                                {permissions.canDelete && (
                                    <Button
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={() => setDeleteModalOpen(true)}
                                        block
                                        size="large"
                                    >
                                        Supprimer la note de frais
                                    </Button>
                                )}
                            </Space>
                        )}
                    </div>
                )}
            </Spin>

            {/* FloatButton pour ajouter une dépense */}
            {!isNew && !formDisabled && (
                <ConfigProvider
                    theme={{
                        components: {
                            FloatButton: {
                                controlHeightLG: 60,
                            },
                        },
                    }}
                >
                    <FloatButton
                        icon={<CameraOutlined />}
                        type="primary"
                        onClick={handleAddCaptureExpense}
                        style={{ right: 24, bottom: 24 }}
                        tooltip="Ajouter une dépense"
                    />
                </ConfigProvider>
            )}

            {/* Drawer dépense */}
            {expenseDrawerOpen && (
                <Suspense fallback={<ElementLoader />}>
                    <ExpenseFormDrawerMobile
                        open={expenseDrawerOpen}
                        onClose={() => {
                            setExpenseDrawerOpen(false);
                            setAutoCapture(false);
                        }}
                        expenseReportId={expenseReportId}
                        expenseId={selectedExpenseId}
                        disabled={formDisabled}
                        onSuccess={handleExpenseSuccess}
                        periodFrom={periodFrom}
                        periodTo={periodTo}
                        expensesApi={expensesApi}
                        autoCapture={autoCapture}
                    />
                </Suspense>
            )}

            {/* Drawer frais kilométrique */}
            {mileageDrawerOpen && (
                <Suspense fallback={<ElementLoader />}>
                    <MileageExpenseFormDrawerMobile
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

            {/* Modal rejet */}
            <Modal
                title="Rejeter la note"
                open={rejectModalOpen}
                onCancel={() => setRejectModalOpen(false)}
                onOk={handleReject}
                okText="Rejeter"
                okButtonProps={{ danger: true }}
            >
                <p>Motif du rejet :</p>
                <TextArea
                    rows={4}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Indiquez le motif..."
                    autoFocus
                />
            </Modal>

            {/* Modal suppression */}
            <Modal
                title="Supprimer la note de frais ?"
                open={deleteModalOpen}
                onCancel={() => setDeleteModalOpen(false)}
                onOk={handleDelete}
                okText="Supprimer"
                okButtonProps={{ danger: true }}
            >
                <p>Cette action est irréversible.</p>
            </Modal>
        </div>
    );
}
