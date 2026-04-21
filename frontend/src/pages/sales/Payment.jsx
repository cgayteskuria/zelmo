import { useState, useCallback, useMemo } from "react";
import { useEntityForm } from "../../hooks/useEntityForm";
import { Drawer, Spin, Table, Card, Row, Col, Form, Input, DatePicker, Button, Popconfirm, Space, Tag } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { formatCurrency,formatDate } from "../../utils/formatters";
import { paymentsApi } from "../../services/api";
import { message } from "../../utils/antdStatic";
import PaymentModeSelect from "../../components/select/PaymentModeSelect";
import BankSelect from "../../components/select/BankSelect";
import CustomInputNumber from "../../components/common/CustomInputNumber";

/**
 * Composant Payment
 * Affiche le détail d'un paiement dans un Drawer (lecture seule)
 */
export default function Payment({ paymentId, open, onClose, onSubmit, paymentType = 'customer' }) {
    const [form] = Form.useForm();
    const [pageLabel, setPageLabel] = useState();
    const [allocations, setAllocations] = useState();
    const [deleting, setDeleting] = useState(false);

    // Mémoriser les callbacks pour éviter les re-renders inutiles
    const transformData = useCallback((data) => ({
        ...data,
        pay_date: data.pay_date ? dayjs(data.pay_date) : null,
    }), []);

    const onDataLoadedCallback = useCallback((data) => {
        if (data.pay_number) {
            setPageLabel(data.pay_number);
        }
        console
        if (data.allocations) {
            setAllocations(data.allocations);
        }
    }, []);

    /**
     * Instance du formulaire CRUD
     */
    const { loading, entity } = useEntityForm({
        api: paymentsApi,
        entityId: paymentId,
        idField: 'pay_id',
        form,
        open,
        transformData,
        onDataLoaded: onDataLoadedCallback,
    });

    // Watch form values pour affichage
    const creditInvoice = Form.useWatch('credit_invoice', form);

    // Un paiement comptabilisé (pay_status === 2) ne peut pas être supprimé
    const canDelete = useMemo(() => entity?.pay_status !== 2, [entity]);

    const paymentStatusTag = useMemo(() => {
        if (!entity) return null;
        if (entity.pay_status === 2) return <Tag color="green" variant='outlined' disabled={false}>Comptabilisé</Tag>;
        return <Tag color="default" variant='outlined' disabled={false}>Non comptabilisé</Tag>;
    }, [entity]);

    const handleDelete = useCallback(async () => {
        try {
            setDeleting(true);
            await paymentsApi.deletePayment(paymentId);
            message.success('Paiement supprimé avec succès');
            form.resetFields();
            setPageLabel(null);
            if (onSubmit) await onSubmit();
            if (onClose) onClose();
        } catch (err) {
            message.error(err?.response?.data?.message || 'Erreur lors de la suppression');
        } finally {
            setDeleting(false);
        }
    }, [paymentId, form, onSubmit, onClose]);

    /**
     * Fermeture du drawer
     */
    const handleClose = () => {
        form.resetFields();
        setPageLabel(null);
        if (onClose) {
            onClose();
        }
    };

    // Colonnes du tableau des allocations
    const allocationsColumns = {
        customer: [
            { title: 'N° Facture', dataIndex: 'inv_number', key: 'inv_number', width: 120, },
            { title: 'Date', dataIndex: 'inv_date', key: 'inv_date', width: 110, align: 'center', render: (value) => value ? formatDate(value) : '', },
            { title: 'Tiers', dataIndex: 'ptr_name', key: 'ptr_name', width: 150, },
            { title: 'Total facture', dataIndex: 'inv_totalttc', key: 'inv_totalttc', width: 120, align: 'right', render: (value) => value ? formatCurrency(value) : '', },
            { title: 'Montant alloué', dataIndex: 'amount', key: 'amount', width: 130, align: 'right', render: (value) => formatCurrency(value), },
        ],
        supplier: [
            { title: 'N° Facture', dataIndex: 'inv_number', key: 'inv_number', width: 120, },
            { title: 'Date', dataIndex: 'inv_date', key: 'inv_date', width: 110, align: 'center', render: (value) => value ? formatDate(value) : '', },
            { title: 'Tiers', dataIndex: 'ptr_name', key: 'ptr_name', width: 150, },
            { title: 'Total facture', dataIndex: 'inv_totalttc', key: 'inv_totalttc', width: 120, align: 'right', render: (value) => value ? formatCurrency(value) : '', },
            { title: 'Montant alloué', dataIndex: 'amount', key: 'amount', width: 130, align: 'right', render: (value) => formatCurrency(value), },
        ],
        expense: [
            { title: 'N° NDF', dataIndex: 'exr_number', key: 'exr_number', width: 120, },
            { title: 'Approuvée', dataIndex: 'exr_approval_date', key: 'exr_approval_date', width: 110, align: 'center', render: (value) => value ? formatDate(value) : '', },
            { title: 'Salarié', dataIndex: 'employee', key: 'employee', width: 150, },
            { title: 'Total facture', dataIndex: 'exr_total_amount_ttc', key: 'exr_total_amount_ttc', width: 120, align: 'right', render: (value) => value ? formatCurrency(value) : '', },
            { title: 'Montant alloué', dataIndex: 'amount', key: 'amount', width: 130, align: 'right', render: (value) => formatCurrency(value), },
        ],
        charge: [
            { title: 'N° Charge', dataIndex: 'che_number', key: 'che_number', width: 120, },
            { title: 'Date', dataIndex: 'che_date', key: 'che_date', width: 110, align: 'center', render: (value) => value ? formatDate(value) : '', },
            // { title: 'Tiers', dataIndex: 'ptr_name', key: 'ptr_name', width: 150, },
            { title: 'Total facture', dataIndex: 'che_totalttc', key: 'che_totalttc', width: 120, align: 'right', render: (value) => value ? formatCurrency(value) : '', },
            { title: 'Montant alloué', dataIndex: 'amount', key: 'amount', width: 130, align: 'right', render: (value) => formatCurrency(value), },
        ]
    };

    const drawerFooter = canDelete ? (
        <Space>
            <Popconfirm
                title="Supprimer le paiement"
                description="Êtes-vous sûr de vouloir supprimer ce paiement ?"
                onConfirm={handleDelete}
                okText="Oui"
                cancelText="Non"
                okButtonProps={{ danger: true }}
            >
                <Button danger icon={<DeleteOutlined />} loading={deleting}>
                    Supprimer
                </Button>
            </Popconfirm>
        </Space>
    ) : null;

    return (
        <Drawer
            title={`Paiement ${pageLabel}`}
            placement="right"
            onClose={handleClose}
            open={open}
            size="large"
            footer={drawerFooter}
        >
            <Spin spinning={loading} tip="Chargement...">
                <Form
                    form={form}
                    disabled={true}
                    layout="vertical"
                >
                    {/* Informations principales */}
                    <Card
                        title="Informations générales"
                        extra={paymentStatusTag}
                        style={{ marginBottom: 16 }}
                    >
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="pay_number" label="N° Paiement">
                                    <Input />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="pay_date" label="Date">
                                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="pay_amount" label="Montant">
                                    <CustomInputNumber />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="pay_reference" label="Référence">
                                    <Input />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    name="fk_pam_id"
                                    label="Mode de paiement"
                                >
                                    <PaymentModeSelect
                                        loadInitially={false}
                                        initialData={entity?.payment_mode}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="fk_bts_id"
                                    label="Banque"
                                >
                                    <BankSelect
                                        loadInitially={false}
                                        initialData={entity?.bank}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Card>

                    {/* Allocations */}
                    {allocations && allocations.length > 0 && (
                        <Card title="Utilisation du règlement" style={{ marginBottom: 16 }}>
                            <Table
                                columns={allocationsColumns[paymentType]}
                                dataSource={allocations}
                                rowKey={(record) => record.pal_id || record.fk_inv_id}
                                pagination={false}
                                size="small"
                                scroll={{ x: 'max-content' }}
                                bordered
                            />
                        </Card>
                    )}

                    {/* Avoir généré */}
                    {creditInvoice && (
                        <Card title="Avoir généré" style={{ marginBottom: 16 }}>
                            <Row gutter={16}>
                                <Col span={24}>
                                    <Form.Item label="N° Facture">
                                        <Input value={creditInvoice.inv_number} disabled />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item label="Montant de l'avoir">
                                        <Input value={formatCurrency(creditInvoice.credit_amount)} disabled />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item label="Montant restant">
                                        <Input value={formatCurrency(creditInvoice.credit_remaining)} disabled />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>
                    )}
                </Form>
            </Spin>
        </Drawer >
    );
}
