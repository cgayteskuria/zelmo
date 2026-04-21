import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Modal, Form, Input, InputNumber, DatePicker, Table, Alert, Row, Col, Checkbox, Spin, Button, Popconfirm, Space } from 'antd';
import { message } from '../../utils/antdStatic';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import PaymentModeSelect from '../select/PaymentModeSelect';
import { createDateValidator } from '../../utils/writingPeriod';
import BankSelect from "../select/BankSelect";
import { getBanksByCompanyApi } from '../../services/api';

/**
 * Dialogue pour enregistrer un paiement sur une facture
 */
const PaymentDialog = ({ open, onClose, onSuccess, parentId, paymentId = null, config }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [parentData, setParentData] = useState(null);
    const [unpaidElements, setUnpaidElements] = useState([]);
    const [selectedAllocations, setSelectedAllocations] = useState({});
    const [unpaidLoading, setUnpaidLoading] = useState(false);
    const [paymentData, setPaymentData] = useState(null);

    // Ref pour éviter les chargements multiples
    const unpaidLoadedRef = useRef(false);

    // Refs pour la logique d'auto-ajustement des allocations
    const prevShowUnpaidTableRef = useRef(false);
    const userHasInteractedRef = useRef(false);

    // Surveiller le montant du paiement en temps réel
    const payAmount = Form.useWatch('pay_amount', form) || 0;

    // Vérifier si on affiche les crédits disponibles (pas pour les charges)
    const canShowCredits = config.showUnpayedInvoices;

    // Détecter le type de module
    const moduleType = useMemo(() => {
        if (config.parentField === 'fk_che_id') return 'charge';
        if (config.parentField === 'fk_exr_id') return 'expense-report';
        return 'invoice';
    }, [config.parentField]);

    const isChargeModule = moduleType === 'charge';
    const isExpenseReportModule = moduleType === 'expense-report';

    // Mode édition ou création
    const isEditMode = useMemo(() => paymentId !== null, [paymentId]);

    // Calculer si un trop versé sera créé (mémorisé)
    const creditCalculation = useMemo(() => {
        const totalAllocated = Math.round(
            Object.values(selectedAllocations).reduce((sum, val) => sum + (parseFloat(val) || 0), 0)
            * 100
        ) / 100;
        const remaining = Math.round((payAmount - totalAllocated) * 100) / 100;
        return {
            willCreateCredit: remaining > 0,
            creditAmount: remaining > 0 ? remaining : 0
        };
    }, [selectedAllocations, payAmount]);

    // Calculer le montant restant dû dynamique pour la facture principale
    const dynamicAmountRemaining = useMemo(() => {
        if (!parentData) return 0;

        // Montant alloué sur la facture principale (parentId)
        const allocatedOnParent = selectedAllocations[parentId] || 0;

        // Base = montant restant dû (pas le total TTC qui inclut les paiements déjà effectués)
        const baseRemaining = parentData.amountRemaining ?? parentData.totalTTC;
        return baseRemaining - allocatedOnParent;
    }, [parentData, selectedAllocations, parentId]);

    // Charger les factures/charges/notes de frais impayées
    const loadUnpaidElements = useCallback(async () => {
        if (!parentId || unpaidLoadedRef.current) return;

        try {
            setUnpaidLoading(true);
            let response;
            if (isChargeModule && config.api.getUnpaidCharges) {
                response = await config.api.getUnpaidCharges(parentId, paymentId);
            } else if (isExpenseReportModule && config.api.getUnpaidExpenseReports) {
                response = await config.api.getUnpaidExpenseReports(parentId, paymentId);
            } else if (config.api.getUnpaidInvoices) {
                response = await config.api.getUnpaidInvoices(parentId, paymentId);
            } else {
                return;
            }

            const elements = response.data || [];
            setUnpaidElements(elements);
            unpaidLoadedRef.current = true;
        } catch (error) {
            console.error('Erreur lors du chargement des éléments impayés:', error);
            message.error('Erreur lors du chargement des éléments impayés');
        } finally {
            setUnpaidLoading(false);
        }
    }, [parentId, paymentId, config, isChargeModule, isExpenseReportModule]);

    // Déterminer si on doit afficher le tableau
    const shouldShowUnpaidTable = useMemo(() => {
        if (!canShowCredits) return false;

        // Pour les charges : afficher si le montant de paiement est supérieur au montant dû
        if (isChargeModule) {
            return payAmount > parentData?.amountRemaining;
        }

        // Pour les notes de frais : afficher si le montant de paiement est supérieur au montant dû
        if (isExpenseReportModule) {
            return payAmount > parentData?.amountRemaining;
        }

        // Pour les factures : afficher si plus d'une facture impayée disponible OU si montant payé > montant dû
        return unpaidElements.length > 1 || payAmount > parentData?.amountRemaining;
    }, [canShowCredits, unpaidElements.length, isChargeModule, isExpenseReportModule, payAmount, parentData]);


    // Charger les données du formulaire au montage
    useEffect(() => {
        const loadFormData = async () => {
            if (!open || !parentId) {
                return;
            }

            try {
                setLoading(true);

                // Charger les données de la facture parente
                const parentResponse = await config.api.getParent(parentId);
                const parentData = config.extractParentData(parentResponse.data);
                setParentData(parentData);

                // Charger les factures impayées (pour détecter s'il y en a plusieurs)
                await loadUnpaidElements();

                let currentPaymentData;
                if (paymentId) {
                    // Mode édition : charger les données du paiement
                    const paymentResponse = await config.api.getPayment(paymentId);
                    currentPaymentData = paymentResponse.data;
                    setPaymentData(currentPaymentData);

                    // Pré-remplir le formulaire
                    form.setFieldsValue({
                        pay_date: dayjs(currentPaymentData.pay_date),
                        pay_amount: currentPaymentData.pay_amount,
                        fk_pam_id: currentPaymentData.fk_pam_id,
                        fk_bts_id: currentPaymentData.fk_bts_id,
                        pay_reference: currentPaymentData.pay_reference,
                    });

                    // Charger les allocations existantes
                    if (currentPaymentData.allocations) {
                        const allocations = {};
                        currentPaymentData.allocations.forEach(alloc => {
                            allocations[alloc[config.parentField]] = parseFloat(alloc.amount) || 0;
                        });
                        setSelectedAllocations(allocations);
                    }
                } else {
                    // Mode création : valeurs par défaut
                    // Utiliser le montant restant dû (ou totalTTC si amountRemaining n'est pas disponible)
                    const defaultAmount = parseFloat(parentData.amountRemaining || parentData.totalTTC) || 0;

                    form.setFieldsValue({
                        pay_date: dayjs(parentData.date),
                        pay_amount: defaultAmount,
                        fk_pam_id: parentData.paymentModeId,
                    });

                    // Pré-sélectionner l'allocation sur la facture/charge principale avec le montant par défaut
                    setSelectedAllocations({
                        [parentId]: defaultAmount
                    });
                }
            } catch (error) {
                console.error('Erreur lors du chargement des données:', error);
                message.error(error.response?.data?.message || 'Erreur lors du chargement des données');
            } finally {
                setLoading(false);
            }
        };

        loadFormData();
    }, [open, parentId, paymentId]); // Dépendances minimales

    // Gérer les changements de montant de paiement (ajustement automatique des allocations)
    useEffect(() => {
        if (!parentData || isEditMode) return;

        if (shouldShowUnpaidTable) {
            // Transition false→true : corriger l'allocation de la facture principale
            // (une valeur intermédiaire de saisie a pu l'écraser, ex: "2" avant "256")
            if (!prevShowUnpaidTableRef.current && !userHasInteractedRef.current) {
                setSelectedAllocations(prev => {
                    const maxForParent = parentData.amountRemaining ?? parentData.totalTTC;
                    // payAmount peut être 0 si Form.useWatch n'a pas encore reflété setFieldsValue
                    // Dans ce cas, conserver l'allocation existante ou utiliser maxForParent pour
                    // garantir que la ligne source est pré-sélectionnée à l'ouverture
                    const baseAmount = payAmount > 0 ? payAmount : (prev[parentId] > 0 ? prev[parentId] : maxForParent);
                    const correctAllocation = Math.min(maxForParent, baseAmount);
                    if ((prev[parentId] || 0) === correctAllocation) return prev;
                    return { ...prev, [parentId]: correctAllocation };
                });
            }
        } else {
            // Table cachée : synchroniser l'allocation principale avec payAmount
            userHasInteractedRef.current = false;
            // Guard payAmount > 0 : évite d'écraser l'allocation initiale si Form.useWatch
            // n'a pas encore reflété setFieldsValue (race condition React batching)
            if (payAmount > 0) {
                setSelectedAllocations(prev => {
                    const allocatedKeys = Object.keys(prev).filter(id => prev[id] > 0);
                    if (allocatedKeys.length <= 1) {
                        const currentAllocation = prev[parentId] || 0;
                        if (currentAllocation !== payAmount) {
                            return { [parentId]: payAmount };
                        }
                    }
                    return prev;
                });
            }
        }

        prevShowUnpaidTableRef.current = shouldShowUnpaidTable;
    }, [payAmount, shouldShowUnpaidTable, parentData, parentId, isEditMode]);

    // Gérer le changement d'allocation
    const handleAllocationChange = useCallback((invId, amount) => {
        setSelectedAllocations(prev => ({
            ...prev,
            [invId]: amount || 0
        }));
    }, []);

    // Gérer le changement de checkbox
    const handleCheckboxChange = useCallback((itemId, checked) => {
        userHasInteractedRef.current = true;
        if (checked) {
            const item = unpaidElements.find(element => element.id === itemId);

            if (item) {
                // Calculer le montant disponible (montant de paiement - total déjà alloué)
                const totalAllocated = Object.values(selectedAllocations).reduce((sum, val) => sum + (val || 0), 0);
                const availableAmount = payAmount - totalAllocated;

                // Le montant à allouer est le minimum entre le montant restant dû et le montant disponible
                const maxForThisItem = item.amount_remaining ?? item.totalttc;
                const amountToAllocate = Math.min(availableAmount, maxForThisItem);

                handleAllocationChange(itemId, amountToAllocate);
            }
        } else {
            handleAllocationChange(itemId, 0);
        }
    }, [unpaidElements, handleAllocationChange, selectedAllocations, payAmount, isChargeModule]);

    // Colonnes du tableau (mémorisées)
    const unpaidColumns = useMemo(() => {

        const titleLabel = isChargeModule ? 'Charge' : (isExpenseReportModule ? 'Note de frais' : 'Facture');

        return [
            {
                title: 'Sélection',
                dataIndex: 'id',
                key: 'select',
                width: 80,
                align: 'center',
                render: (itemId) => (
                    <Checkbox
                        checked={selectedAllocations[itemId] > 0}
                        onChange={(e) => handleCheckboxChange(itemId, e.target.checked)}
                    />
                ),
            },
            { title: `N° ${titleLabel}`, dataIndex: 'number', key: 'number', width: 120 },
            {
                title: 'Date',
                dataIndex: 'date',
                key: 'date',
                width: 110,
                render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : '-',
            },
            {
                title: 'Montant TTC',
                dataIndex: 'totalttc',
                key: 'totalttc',
                width: 120,
                align: 'right',
                render: (value) => value !== null && value !== undefined
                    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
                    : '-',
            },

            {
                title: 'Restant dû',
                dataIndex: 'id',
                key: 'remaining_after_allocation',
                width: 120,
                align: 'right',
                render: (itemId, record) => {
                    const allocatedAmount = selectedAllocations[itemId] || 0;
                    const remainingAfterAllocation = (record.amount_remaining ?? record.totalttc) - allocatedAmount;
                    return remainingAfterAllocation !== null && remainingAfterAllocation !== undefined
                        ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(remainingAfterAllocation)
                        : '-';
                },
            },
            {
                title: 'Montant à allouer',
                dataIndex: 'id',
                key: 'allocation',
                width: 150,
                render: (itemId, record) => (
                    <InputNumber
                        style={{ width: '100%' }}
                        value={selectedAllocations[itemId] || 0}
                        onChange={(value) => handleAllocationChange(itemId, value)}
                        min={0}
                        max={record.amount_remaining}
                        precision={2}
                        disabled={!selectedAllocations[itemId] || selectedAllocations[itemId] === 0}
                    />
                ),
            },
        ];
    }, [selectedAllocations, handleCheckboxChange, handleAllocationChange, isChargeModule, isExpenseReportModule]);

    // Soumettre le formulaire
    const handleSubmit = useCallback(async () => {
        if (!parentData) return;

        try {
            const values = await form.validateFields();
            setLoading(true);
            const payAmount = values['pay_amount'];

            // Préparer les allocations
            let allocations = [];
            if (!shouldShowUnpaidTable) {
                // Paiement simple sur la facture principale
                allocations = [{
                    [config.parentField]: parentId,
                    amount: payAmount
                }];
            } else {
                // Multi-allocations
                allocations = Object.entries(selectedAllocations)
                    .filter(([_, amount]) => amount > 0)
                    .map(([invId, amount]) => ({
                        [config.parentField]: parseInt(invId, 10),
                        amount: parseFloat(amount)
                    }));
            }

            // Validation: vérifier qu'il y a au moins une allocation
            if (allocations.length === 0) {
                message.warning('Veuillez allouer le montant à au moins un element');
                setLoading(false);
                return;
            }

            const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);

            // Validation: le total alloué ne doit pas dépasser le montant du paiement
            if (Number(totalAllocated) > Number(payAmount)) {
                message.error(`Le total alloué (${Number(totalAllocated).toFixed(2)} €) dépasse le montant du règlement (${Number(payAmount).toFixed(2)} €)`);
                setLoading(false);
                return;
            }

            // Préparer les données du paiement
            const extraData = config.paymentData(parentData);

            const paymentData = {
                pay_id: paymentId,
                pay_date: values['pay_date'].format('YYYY-MM-DD'),
                pay_amount: parseFloat(values['pay_amount']),
                fk_bts_id: values['fk_bts_id'],
                fk_pam_id: values['fk_pam_id'],
                pay_reference: values['pay_reference']?.trim() || null,
                allocations: allocations,
                ...extraData
            };

            // Appel API selon le mode
            if (isEditMode) {
                await config.api.updatePayment(paymentId, paymentData);
                message.success('Paiement modifié avec succès');
            } else {
                await config.api.savePayment(parentId, paymentData);
                message.success('Paiement enregistré avec succès');
            }

            // Appeler le callback de succès
            if (onSuccess) {
                await onSuccess();
            }

            handleClose();

        } catch (error) {
            if (error.errorFields) {
                message.error('Veuillez corriger les erreurs du formulaire');
            } else {
                console.error('Erreur lors de l\'enregistrement du paiement:', error);
                message.error(error.response?.data?.message || 'Erreur lors de l\'enregistrement du paiement');
            }
        } finally {
            setLoading(false);
        }
    }, [parentData, form, config, shouldShowUnpaidTable, selectedAllocations, parentId, isEditMode, paymentId, onSuccess]);

    // Supprimer le paiement
    const handleDelete = useCallback(async () => {
        if (!paymentId) return;

        try {
            setLoading(true);
            await config.api.deletePayment(paymentId);
            message.success('Paiement supprimé avec succès');

            if (onSuccess) {
                await onSuccess();
            }

            handleClose();
        } catch (error) {
            console.error('Erreur lors de la suppression du paiement:', error);
            message.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    }, [paymentId, config, onSuccess]);

    // Fermer le dialogue
    const handleClose = useCallback(() => {
        form.resetFields();
        setParentData(null);
        setUnpaidElements([]);
        setSelectedAllocations({});
        setLoading(false);

        setPaymentData(null);
        unpaidLoadedRef.current = false;
        prevShowUnpaidTableRef.current = false;
        userHasInteractedRef.current = false;

        if (onClose) {
            onClose();
        }
    }, [form, onClose]);

    // Vérifier si le paiement est figé (non modifiable)
    const isFrozen = useMemo(() => {
        if (!isEditMode || !paymentData) return false;
        return paymentData.pay_status === 2;
    }, [isEditMode, paymentData]);

    // Vérifier si le paiement peut être supprimé
    const canDelete = useMemo(() => {
        if (!isEditMode || !paymentData) return false;

        const isAccountingLocked = paymentData.pay_status === 2;
        const isDeposit = paymentData.fk_inv_id_deposit > 0;
        const isRefund = paymentData.fk_inv_id_refund > 0;

        return !isAccountingLocked && !isDeposit && !isRefund;
    }, [isEditMode, paymentData]);

    // Footer personnalisé du modal
    const modalFooter = useMemo(() => {
        return (
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                {canDelete ? (
                    <Popconfirm
                        title="Supprimer le paiement"
                        description="Êtes-vous sûr de vouloir supprimer ce paiement ?"
                        onConfirm={handleDelete}
                        okText="Oui"
                        cancelText="Non"
                        okButtonProps={{ danger: true }}
                    >
                        <Button danger icon={<DeleteOutlined />} loading={loading}>
                            Supprimer
                        </Button>
                    </Popconfirm>
                ) : (
                    <div />
                )}

                <Space>
                    <Button onClick={handleClose} disabled={loading}>
                        Annuler
                    </Button>
                    {!isFrozen && (
                        <Button type="primary" onClick={handleSubmit} loading={loading}>
                            Enregistrer
                        </Button>
                    )}
                </Space>
            </Space>
        );
    }, [canDelete, handleDelete, loading, handleClose, handleSubmit, isFrozen]);

    return (
        <Modal
            title={isEditMode ? "Modifier un paiement" : 'Enregistrer le paiement'}
            open={open}
            onCancel={handleClose}
            width={1000}
            centered
            destroyOnHidden
            maskClosable={false}
            footer={modalFooter}
        >
            {parentData && (
                <Form form={form} layout="vertical" disabled={loading || isFrozen}>
                    <Spin spinning={loading} tip="Chargement...">
                        <Alert
                            title={config.alerts.invoiceInfo(parentData.number, dynamicAmountRemaining)}
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                        />

                        <Row gutter={16}>
                            <Col span={5}>
                                <Form.Item
                                    label='Date de paiement'
                                    name='pay_date'
                                    rules={[
                                        { required: true, message: "La date est requise" },
                                        { validator: createDateValidator() }
                                    ]}
                                >
                                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                                </Form.Item>
                            </Col>
                            <Col span={13}></Col>
                            <Col span={6}>
                                <Form.Item
                                    label='Montant du règlement'
                                    name='pay_amount'
                                    rules={[
                                        { required: true, message: "Le montant est requis" },
                                        {
                                            validator: (_, value) => {
                                                if (value && value > 0) {
                                                    // Pour les factures avec crédits désactivés : pas de dépassement
                                                    if (!canShowCredits && !isChargeModule && parentData) {
                                                        const maxAmount = isEditMode
                                                            ? Number(parentData.totalTTC)
                                                            : Number(parentData.amountRemaining);
                                                        if (value > maxAmount) {
                                                            return Promise.reject(new Error(`Le montant ne peut pas dépasser ${maxAmount.toFixed(2)} €`));
                                                        }
                                                    }
                                                    return Promise.resolve();
                                                }
                                                return Promise.reject(new Error("Le montant doit être supérieur à 0"));
                                            }
                                        }
                                    ]}
                                    validateTrigger={['onBlur', 'onSubmit']}
                                >
                                    <InputNumber
                                        style={{ width: '100%' }}
                                        precision={2}
                                        min={0.01}
                                        max={!canShowCredits && !isChargeModule && parentData ? (isEditMode ? Number(parentData.totalTTC) : Number(parentData.amountRemaining)) : undefined}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col span={8}>
                                <Form.Item
                                    label='Compte à créditer'
                                    name='fk_bts_id'
                                    rules={[{ required: true, message: "Le compte est requis" }]}
                                >
                                    <BankSelect
                                        apiSource={() => getBanksByCompanyApi(1)}
                                        selectDefault={true}
                                        loadInitially={true}
                                        onDefaultSelected={(bankId) => {
                                            if (!isEditMode) {
                                                form.setFieldValue('fk_bts_id', bankId);
                                            }
                                        }}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    label='Mode de règlement'
                                    name='fk_pam_id'
                                    rules={[{ required: true, message: "Le mode est requis" }]}
                                >
                                    <PaymentModeSelect
                                        loadInitially={true}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item label='N° Chèque / Virement' name='pay_reference'>
                                    <Input placeholder='Référence' maxLength={50} />
                                </Form.Item>
                            </Col>
                        </Row>
                        {shouldShowUnpaidTable && (
                            <>
                                <Alert
                                    title={config.alerts.overpaymentWarning.title}
                                    description={config.alerts.overpaymentWarning.description}
                                    type="warning"
                                    showIcon
                                    style={{ marginTop: 16, marginBottom: 16 }}
                                />

                                <Spin spinning={unpaidLoading} tip={`Chargement des ${isChargeModule ? 'charges' : (isExpenseReportModule ? 'notes de frais' : 'factures')}...`}>
                                    <Table
                                        columns={unpaidColumns}
                                        dataSource={unpaidElements}
                                        rowKey="id"
                                        pagination={false}
                                        size="small"
                                        bordered
                                        scroll={{ y: 300 }}
                                    />
                                </Spin>

                            </>
                        )}

                        {creditCalculation.willCreateCredit && (
                            <Alert
                                title={isChargeModule
                                    ? config.alerts.unAllocatedConfirmMsg(creditCalculation.creditAmount)
                                    : config.alerts.unAllocatedConfirmMsg(creditCalculation.creditAmount, parentData.operation)
                                }
                                type="info"
                                showIcon
                                style={{ marginTop: 16 }}
                            />
                        )}
                    </Spin>
                </Form>
            )}
        </Modal>
    );
};

export default PaymentDialog;