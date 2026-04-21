import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Modal, Form, Input, InputNumber, DatePicker, Table, Alert, Row, Col, Checkbox, Spin, Button, Space } from 'antd';
import { message } from '../../utils/antdStatic';
import dayjs from 'dayjs';
import PaymentModeSelect from '../select/PaymentModeSelect';
import BankSelect from '../select/BankSelect';
import PartnerSelect from '../select/PartnerSelect';
import { createDateValidator } from '../../utils/writingPeriod';
import { getBanksByCompanyApi, paymentsApi } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';

/**
 * Dialogue de saisie d'un règlement autonome (sans document parent obligatoire).
 * Permet de saisir un règlement client ou fournisseur avec pointage optionnel
 * sur des factures impayées.
 *
 * Props:
 *   open         {boolean}  - Visibilité du modal
 *   onClose      {function} - Callback fermeture
 *   onSuccess    {function} - Callback après sauvegarde réussie
 *   paymentType  {string}   - 'customer' | 'supplier'
 */
const StandalonePaymentDialog = ({ open, onClose, onSuccess, paymentType }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    // Partenaire sélectionné
    const [selectedPartnerId, setSelectedPartnerId] = useState(null);

    // Factures impayées du partenaire
    const [unpaidInvoices, setUnpaidInvoices] = useState([]);
    const [invoicesLoading, setInvoicesLoading] = useState(false);

    // Allocations sélectionnées : { inv_id: amount }
    const [selectedAllocations, setSelectedAllocations] = useState({});

    // Ref pour éviter les doubles chargements
    const lastLoadedPartner = useRef(null);

    // inv_operation selon le type de paiement
    const invOperation = useMemo(() => {
        return paymentType === 'customer' ? 1 : 3; // 1=client, 3=fournisseur
    }, [paymentType]);

    // Filtre pour le sélecteur de partenaire
    const partnerFilters = useMemo(() => {
        return paymentType === 'customer' ? { is_customer: 1 } : { is_supplier: 1 };
    }, [paymentType]);

    // Montant de règlement surveillé en temps réel
    const payAmount = Form.useWatch('pay_amount', form) || 0;

    // Calcul du total alloué
    const totalAllocated = useMemo(() => {
        return Object.values(selectedAllocations).reduce((sum, v) => sum + (v || 0), 0);
    }, [selectedAllocations]);

    // Montant non alloué (trop-perçu)
    const unallocatedAmount = useMemo(() => {
        const diff = payAmount - totalAllocated;
        return diff > 0 ? diff : 0;
    }, [payAmount, totalAllocated]);

    // Charger les factures impayées quand le partenaire change
    const loadUnpaidInvoices = useCallback(async (ptrId) => {
        if (!ptrId) {
            setUnpaidInvoices([]);
            setSelectedAllocations({});
            lastLoadedPartner.current = null;
            return;
        }
        if (lastLoadedPartner.current === ptrId) return;

        try {
            setInvoicesLoading(true);
            const res = await paymentsApi.getUnpaidInvoices(ptrId, invOperation);
            setUnpaidInvoices(res.data || []);
            setSelectedAllocations({});
            lastLoadedPartner.current = ptrId;
        } catch (err) {
            message.error('Erreur lors du chargement des factures');
        } finally {
            setInvoicesLoading(false);
        }
    }, [invOperation]);

    // Réinitialiser quand le dialog se ferme
    useEffect(() => {
        if (!open) {
            form.resetFields();
            setSelectedPartnerId(null);
            setUnpaidInvoices([]);
            setSelectedAllocations({});
            lastLoadedPartner.current = null;
        }
    }, [open, form]);

    // Charger les factures dès que le partenaire change
    useEffect(() => {
        if (open && selectedPartnerId) {
            loadUnpaidInvoices(selectedPartnerId);
        }
    }, [open, selectedPartnerId, loadUnpaidInvoices]);

    // Gestion du changement de partenaire
    const handlePartnerChange = useCallback((ptrId) => {
        setSelectedPartnerId(ptrId || null);
        if (ptrId !== lastLoadedPartner.current) {
            setUnpaidInvoices([]);
            setSelectedAllocations({});
            lastLoadedPartner.current = null;
        }
    }, []);

    // Gestion des checkboxes
    const handleCheckboxChange = useCallback((invId, checked) => {
        if (!checked) {
            setSelectedAllocations(prev => ({ ...prev, [invId]: 0 }));
            return;
        }
        const item = unpaidInvoices.find(i => i.id === invId);
        if (!item) return;
        const available = payAmount - Object.values(selectedAllocations).reduce((s, v) => s + (v || 0), 0);
        const toAllocate = Math.min(available, item.amount_remaining);
        setSelectedAllocations(prev => ({ ...prev, [invId]: toAllocate }));
    }, [unpaidInvoices, selectedAllocations, payAmount]);

    // Gestion du montant d'une allocation
    const handleAllocationChange = useCallback((invId, amount) => {
        setSelectedAllocations(prev => ({ ...prev, [invId]: amount || 0 }));
    }, []);

    // Colonnes du tableau des factures impayées
    const columns = useMemo(() => [
        {
            title: '',
            dataIndex: 'id',
            key: 'select',
            width: 50,
            align: 'center',
            render: (id) => (
                <Checkbox
                    checked={(selectedAllocations[id] || 0) > 0}
                    onChange={(e) => handleCheckboxChange(id, e.target.checked)}
                />
            ),
        },
        { title: 'N° Facture', dataIndex: 'number', key: 'number', width: 130 },
        {
            title: 'Date',
            dataIndex: 'date',
            key: 'date',
            width: 100,
            render: (v) => formatDate(v),
        },
        {
            title: 'Montant TTC',
            dataIndex: 'totalttc',
            key: 'totalttc',
            width: 120,
            align: 'right',
            render: (v) => formatCurrency(v),
        },
        {
            title: 'Restant dû',
            dataIndex: 'amount_remaining',
            key: 'amount_remaining',
            width: 120,
            align: 'right',
            render: (v) => formatCurrency(v),
        },
        {
            title: 'À allouer',
            dataIndex: 'id',
            key: 'allocation',
            width: 130,
            render: (id, record) => (
                <InputNumber
                    style={{ width: '100%' }}
                    value={selectedAllocations[id] || 0}
                    onChange={(val) => handleAllocationChange(id, val)}
                    min={0}
                    max={record.amount_remaining}
                    precision={2}
                    disabled={!(selectedAllocations[id] > 0)}
                />
            ),
        },
    ], [selectedAllocations, handleCheckboxChange, handleAllocationChange]);

    // Soumission
    const handleSubmit = useCallback(async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            // Préparer les allocations (filtrer les nulles/zéro)
            const allocations = Object.entries(selectedAllocations)
                .filter(([, amount]) => amount > 0)
                .map(([invId, amount]) => ({
                    fk_inv_id: parseInt(invId, 10),
                    amount: parseFloat(amount),
                }));

            // Vérifier que le total alloué ne dépasse pas le montant
            const total = allocations.reduce((s, a) => s + a.amount, 0);
            if (total > values.pay_amount) {
                message.error(
                    `Le total alloué (${formatCurrency(total)}) dépasse le montant du règlement (${formatCurrency(values.pay_amount)})`
                );
                setLoading(false);
                return;
            }

            await paymentsApi.savePayment({
                pay_date: values.pay_date.format('YYYY-MM-DD'),
                pay_amount: parseFloat(values.pay_amount),
                fk_bts_id: values.fk_bts_id,
                fk_pam_id: values.fk_pam_id,
                pay_reference: values.pay_reference?.trim() || null,
                fk_ptr_id: selectedPartnerId,
                inv_operation: invOperation,
                allocations,
            });

            message.success('Règlement enregistré avec succès');
            if (onSuccess) await onSuccess();
            if (onClose) onClose();
        } catch (err) {
            if (err.errorFields) {
                message.error('Veuillez corriger les erreurs du formulaire');
            } else {
                message.error(err?.response?.data?.message || 'Erreur lors de l\'enregistrement');
            }
        } finally {
            setLoading(false);
        }
    }, [form, selectedAllocations, selectedPartnerId, invOperation, onSuccess, onClose]);

    const title = paymentType === 'customer' ? 'Saisir un règlement client' : 'Saisir un règlement fournisseur';

    return (
        <Modal
            title={title}
            open={open}
            onCancel={onClose}
            width={1000}
            centered
            destroyOnHidden
            maskClosable={false}
            footer={
                <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                    <Button onClick={onClose} disabled={loading}>Annuler</Button>
                    <Button type="primary" onClick={handleSubmit} loading={loading}>
                        Enregistrer
                    </Button>
                </Space>
            }
        >
            <Form form={form} layout="vertical" disabled={loading}>
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label={paymentType === 'customer' ? 'Client' : 'Fournisseur'}
                            name="fk_ptr_id"
                            rules={[{ required: true, message: 'Le tiers est requis' }]}
                        >
                            <PartnerSelect
                                filters={partnerFilters}
                                loadInitially={false}
                                onChange={handlePartnerChange}
                                allowClear
                            />
                        </Form.Item>
                    </Col>
                    <Col span={5}>
                        <Form.Item
                            label="Date de paiement"
                            name="pay_date"
                            initialValue={dayjs()}
                            rules={[
                                { required: true, message: 'La date est requise' },
                                { validator: createDateValidator() },
                            ]}
                        >
                            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                        </Form.Item>
                    </Col>
                    <Col span={7}>
                        <Form.Item
                            label="Montant du règlement"
                            name="pay_amount"
                            rules={[{ required: true, message: 'Le montant est requis' }]}
                        >
                            <InputNumber style={{ width: '100%' }} precision={2} min={0.01} />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item
                            label="Compte à créditer"
                            name="fk_bts_id"
                            rules={[{ required: true, message: 'Le compte est requis' }]}
                        >
                            <BankSelect
                                apiSource={() => getBanksByCompanyApi(1)}
                                selectDefault={true}
                                loadInitially={true}
                                onDefaultSelected={(bankId) => form.setFieldValue('fk_bts_id', bankId)}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item
                            label="Mode de règlement"
                            name="fk_pam_id"
                            rules={[{ required: true, message: 'Le mode est requis' }]}
                        >
                            <PaymentModeSelect loadInitially={true} />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item label="N° Chèque / Virement" name="pay_reference">
                            <Input placeholder="Référence" maxLength={50} />
                        </Form.Item>
                    </Col>
                </Row>

                {selectedPartnerId && (
                    <>
                        <Alert
                            description="Sélectionnez les factures à pointer avec ce règlement (optionnel)."
                            type="info"
                            showIcon
                            style={{ marginBottom: 12 }}
                        />
                        <Spin spinning={invoicesLoading} tip="Chargement des factures...">
                            {unpaidInvoices.length === 0 && !invoicesLoading ? (
                                <Alert
                                    description="Aucune facture impayée pour ce tiers."
                                    type="warning"
                                    showIcon
                                    style={{ marginBottom: 12 }}
                                />
                            ) : (
                                <Table
                                    columns={columns}
                                    dataSource={unpaidInvoices}
                                    rowKey="id"
                                    pagination={false}
                                    size="small"
                                    bordered
                                    scroll={{ y: 260 }}
                                    style={{ marginBottom: 12 }}
                                />
                            )}
                        </Spin>
                    </>
                )}

                {unallocatedAmount > 0.005 && (
                    <Alert
                        description={`Un trop-perçu de ${formatCurrency(unallocatedAmount)} sera automatiquement créé.`}
                        type="info"
                        showIcon
                    />
                )}
            </Form>
        </Modal>
    );
};

export default StandalonePaymentDialog;
