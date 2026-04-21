import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { Table, Tag, Spin, Button, Select, Space, Row, Col, Popconfirm, Alert } from 'antd';
import { message } from '../../utils/antdStatic';
import { DollarOutlined, CreditCardOutlined, GiftOutlined, EditOutlined, DeleteOutlined, DisconnectOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

// Import lazy des composants lourds
const PaymentDialog = lazy(() => import('./PaymentDialog'));

// Composant de chargement pour les onglets
const TabLoader = () => (
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

/**
 * Composant générique pour afficher et gérer les paiements
 * @param {Object} props
 * @param {number} props.parentId - L'ID du document parent (facture, charge, etc.)
 * @param {number} props.parentStatus - Statut du document parent
 * @param {number} props.parentPaymentProgress - Progression du paiement (0-100)
 * @param {Object} props.parentData - Données complètes du parent (pour extraction de l'opération)
 * @param {Object} props.config - Configuration du module (PAYMENTS_TAB_CONFIG)
 * @param {Object} props.dialogConfig - Configuration du dialogue de paiement (PAYMENT_DIALOG_CONFIG)
 * @param {Function} props.onPaymentChange - Callback appelé après modification des paiements
 */
const PaymentsTab = ({ parentId, parentStatus, parentPaymentProgress, parentData, config, dialogConfig, onPaymentChange }) => {
    const [loading, setLoading] = useState(false);
    const [payments, setPayments] = useState([]);
    const [availableCredits, setAvailableCredits] = useState([]);
    const [selectedCredit, setSelectedCredit] = useState(null);
    // const [creditAmount, setCreditAmount] = useState(0);
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [editingPaymentId, setEditingPaymentId] = useState(null);
    // Récupérer les informations d'utilisation depuis parentData
    const usageInfo = parentData?.usageInfo || { isUsed: false, usedBy: [] };

    // Icônes et couleurs mémorisés
    const paymentIcons = useMemo(() => ({
        'Paiement': <DollarOutlined />,
        'Acompte': <CreditCardOutlined />,
        'Avoir': <GiftOutlined />,
    }), []);

    const paymentColors = useMemo(() => ({
        'Paiement': 'green',
        'Acompte': 'blue',
        'Avoir': 'orange',
    }), []);

    const paymentStatuses = useMemo(() => ({
        null: { text: 'Non', color: 'default' },
        0: { text: 'Non', color: 'default' },
        2: { text: 'Comptabilisé', color: 'green' },
    }), []);

    // Recharger les paiements (mémorisé avec useCallback)
    const reloadPayments = useCallback(async () => {
        if (!parentId) return;

        try {
            const response = await config.api.getPayments(parentId);
            setPayments(response.data || []);
        } catch (error) {
            console.error('Erreur lors du rechargement des paiements:', error);
            message.error('Erreur lors du rechargement des paiements');
        }
    }, [parentId, config]);

    // Chargement des paiements
    useEffect(() => {
        if (!parentId) {
            setPayments([]);
            return;
        }

        const fetchPayments = async () => {
            setLoading(true);
            try {
                const response = await config.api.getPayments(parentId);
                setPayments(response.data || []);
            } catch (error) {
                console.error('Erreur lors du chargement des paiements:', error);
                message.error('Erreur lors du chargement des paiements');
            } finally {
                setLoading(false);
            }
        };

        fetchPayments();
    }, [parentId, config]);

    // Rechargement automatique quand l'onglet redevient visible
    // (couvre le cas : Tab 2 transfère en compta → retour Tab 1 → boutons se mettent à jour)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                reloadPayments();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [reloadPayments]);

    // Chargement des acomptes/avoirs disponibles
    useEffect(() => {

        if (!parentId || parentPaymentProgress === '100.00') {
            setAvailableCredits([]);
            return;
        }

        // Utiliser la fonction de configuration pour déterminer si on charge les crédits
        if (!config.canShowAvailableCredits(parentData.operation)) {
            setAvailableCredits([]);
            return;
        }

        const fetchAvailableCredits = async () => {
            try {
                const response = await config.api.getAvailableCredits(parentId);
                setAvailableCredits(response.data || []);
            } catch (error) {
                console.error('Erreur lors du chargement des crédits disponibles:', error);
                // Ne pas afficher de message d'erreur pour ne pas perturber l'utilisateur
            }
        };

        fetchAvailableCredits();
    }, [parentId, config, parentData]);

    // Handler pour l'utilisation d'un acompte/avoir
    const handleUseCredit = useCallback(async () => {
        if (!selectedCredit) {
            message.warning('Veuillez sélectionner un crédit');
            return;
        }

        try {
            setLoading(true);

            // Appel API pour utiliser l'avoir/acompte
            const response = await config.api.useCredit(parentId, selectedCredit);

            if (response.success) {
                message.success(response.message || 'Crédit appliqué avec succès');
            }

            // Réinitialiser la sélection
            setSelectedCredit(null);

            // Recharger les données
            await reloadPayments();
            if (onPaymentChange) {
                onPaymentChange();
            }
        } catch (error) {
            console.error('Erreur lors de l\'utilisation du crédit:', error);
            message.error(error.message || 'Erreur lors de l\'utilisation du crédit');
        } finally {
            setLoading(false);
        }
    }, [selectedCredit, parentId, config, reloadPayments, onPaymentChange]);

    // Handler pour enregistrer un nouveau paiement
    const handleRegisterPayment = useCallback(() => {
        setEditingPaymentId(null);
        setPaymentDialogOpen(true);
    }, []);

    // Handler pour éditer un paiement
    const handleEditPayment = useCallback((paymentId) => {
        setEditingPaymentId(paymentId);
        setPaymentDialogOpen(true);
    }, []);

    // Handler pour supprimer un paiement
    const handleDeletePayment = useCallback(async (paymentId) => {
        try {
            setLoading(true);
            await config.api.deletePayment(paymentId);
            message.success('Paiement supprimé avec succès');

            // Recharger les données
            await reloadPayments();
            if (onPaymentChange) {
                onPaymentChange();
            }
        } catch (error) {
            console.error('Erreur lors de la suppression du paiement:', error);
            const msg = error?.response?.data?.message || error.message || 'Erreur lors de la suppression du paiement';
            message.error(msg);
            // Paiement entretemps transféré en compta → recharger pour masquer les boutons
            if (error?.response?.status === 422) {
                await reloadPayments();
            }
        } finally {
            setLoading(false);
        }
    }, [config, reloadPayments, onPaymentChange]);

    const handleUnlinkPayment = useCallback(async (payId) => {
        try {
            setLoading(true);
            await config.api.removeAllocation(parentId, payId);
            message.success('Règlement dissocié avec succès');
            await reloadPayments();
            if (onPaymentChange) {
                onPaymentChange();
            }
        } catch (error) {
            console.error('Erreur lors de la dissociation du règlement:', error);
            message.error(error?.response?.data?.message || 'Erreur lors de la dissociation');
        } finally {
            setLoading(false);
        }
    }, [config, parentId, reloadPayments, onPaymentChange]);

    // Handler de succès de la dialog (async maintenant)
    const handlePaymentSuccess = useCallback(async () => {
        await reloadPayments();
        if (onPaymentChange) {
            onPaymentChange();
        }
        setPaymentDialogOpen(false);
    }, [reloadPayments, onPaymentChange]);

    // Handler de fermeture de la dialog
    const handleCloseDialog = useCallback(() => {
        setPaymentDialogOpen(false);
        setEditingPaymentId(null);
    }, []);

    // Détecter si on est dans un module avec colonne trop versé (charges ou notes de frais)
    const hasOverpaymentColumn = useMemo(() => config.name === 'charges' || config.name === 'expense-reports', [config.name]);

    // Colonnes du tableau (mémorisées)
    const columns = useMemo(() => {
        const baseColumns = [
            {
                title: 'Réf',
                dataIndex: 'paynumber',
                key: 'paynumber',
                width: 120,
                render: (text) => text || '-',
            },
            {
                title: 'Type',
                dataIndex: 'payment_type',
                key: 'payment_type',
                width: 100,
                render: (type) => (
                    <Tag icon={paymentIcons[type]} color={paymentColors[type]} disabled={false}>
                        {type}
                    </Tag>
                ),
            },
            {
                title: 'Mode de règlement',
                dataIndex: 'payment_mode',
                key: 'payment_mode',
                ellipsis: true,
                render: (text) => text || '-',
            },
            {
                title: 'Banque',
                dataIndex: 'bank_label',
                key: 'bank_label',
                width: 150,
                ellipsis: true,
                render: (text) => text || '-',
            },
            {
                title: 'Date',
                dataIndex: 'pay_date',
                key: 'pay_date',
                width: 110,
                render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : '-',
            },
            {
                title: 'Montant',
                dataIndex: 'amount',
                key: 'amount',
                width: 120,
                align: 'right',
                render: (value) => {
                    if (value === null || value === undefined) return '-';
                    return new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                    }).format(value);
                },
            },
            {
                title: 'Montant alloué',
                dataIndex: 'pal_amount',
                key: 'pal_amount',
                width: 130,
                align: 'right',
                render: (value) => {
                    if (value === null || value === undefined) return '-';
                    return new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                    }).format(value);
                },
            },
        ];

        // Ajouter colonne "Trop versé" pour les charges et notes de frais
        /*  if (hasOverpaymentColumn) {
              baseColumns.push({
                  title: 'Trop versé',
                  key: 'overpayment',
                  width: 130,
                  align: 'right',
                  render: (_, record) => {
                      const overpayment = (record.amount || 0) - (record.pal_amount || 0);
                      if (overpayment <= 0) return '-';
                      return new Intl.NumberFormat('fr-FR', {
                          style: 'currency',
                          currency: 'EUR',
                      }).format(overpayment);
                  },
              });
          }*/

        baseColumns.push({
            title: 'Comptabilisé',
            dataIndex: 'pay_status',
            key: 'pay_status',
            width: 120,
            align: 'center',
            render: (status) => {
                const statusInfo = paymentStatuses[status] || { text: 'Inconnu', color: 'default' };
                return <Tag color={statusInfo.color} disabled={false}>{statusInfo.text}</Tag>;
            },
        });

        baseColumns.push({
            title: 'Actions',
            key: 'actions',
            width: 100,
            align: 'center',
            render: (_, record) => {
                const isAccountingLocked = record.pay_status === 2;
                const isDeposit = record.fk_inv_id_deposit > 0;
                const isRefund = record.fk_inv_id_refund > 0;
                const canEdit = !isAccountingLocked && !isDeposit && !isRefund && !usageInfo.isUsed;
                const canDelete = !isAccountingLocked && (isDeposit || isRefund) && !usageInfo.isUsed;
                const canUnlink = isAccountingLocked && !usageInfo.isUsed;

                return (
                    <Space size="small">
                        {canEdit && (
                            <Button
                                type="link"
                                icon={<EditOutlined />}
                                size="small"
                                onClick={() => handleEditPayment(record.pay_id)}
                                title='Modifier le paiement'
                                disabled={false}
                            />
                        )}
                        {canDelete && (
                            <Popconfirm
                                title="Supprimer le règlement"
                                description="Êtes-vous sûr de vouloir supprimer ce règlement ?"
                                onConfirm={() => handleDeletePayment(record.pay_id)}
                                okText="Oui, supprimer"
                                cancelText="Annuler"
                                okButtonProps={{ danger: true, disabled: false }}
                                cancelButtonProps={{ disabled: false }}
                            >
                                <Button
                                    type="link"
                                    icon={<DeleteOutlined />}
                                    size="small"
                                    danger
                                    title="Supprimer le règlement"
                                    disabled={false}
                                />
                            </Popconfirm>
                        )}
                        {canUnlink && (
                            <Popconfirm
                                title="Dissocier le règlement comptabilisé"
                                description={
                                    <span>
                                        Ce règlement est passé en comptabilité.<br />
                                        La dissociation ne corrigera <strong>pas</strong> l'écriture comptable.<br />
                                        Vous devrez corriger manuellement votre comptabilité.
                                    </span>
                                }
                                onConfirm={() => handleUnlinkPayment(record.pay_id)}
                                okText="Dissocier quand même"
                                cancelText="Annuler"
                                okButtonProps={{ danger: true , disabled: false}}
                                 cancelButtonProps={{ disabled: false }}
                                icon={<WarningOutlined style={{ color: 'orange' }} />}
                            >
                                <Button
                                    type="link"
                                    icon={<DisconnectOutlined />}
                                    size="small"
                                    style={{ color: 'orange' }}
                                    title="Dissocier ce règlement (comptabilisé)"
                                    disabled={false}
                                />
                            </Popconfirm>
                        )}
                    </Space>
                );
            },
        });

        return baseColumns;
    }, [paymentIcons, paymentColors, paymentStatuses, config, handleEditPayment, handleDeletePayment, handleUnlinkPayment, usageInfo.isUsed, hasOverpaymentColumn]);

    // Calculer les totaux (mémorisés)
    const { totalAmount, totalAllocated } = useMemo(() => ({
        totalAmount: payments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0),
        totalAllocated: payments.reduce((sum, payment) => sum + (parseFloat(payment.pal_amount) || 0), 0),
    }), [payments]);

    // Options du select de crédits (mémorisées)
    const creditOptions = useMemo(() =>       
        availableCredits.map(credit => ({
            value: credit.id,
            label: credit.label,
            balance: credit.balance,
        })
        ), [availableCredits]);

    // Max du crédit sélectionné (mémorisé)
    /*  const maxCreditAmount = useMemo(() =>
          availableCredits.find(c => c.id === selectedCredit)?.balance || 0,
          [availableCredits, selectedCredit]
      );*/

    // Handler de changement de crédit (mémorisé)
    const handleCreditChange = useCallback((value, option) => {

        setSelectedCredit(value);
    }, []);

    // Vérifier si on peut ajouter un paiement
    const canAddPayment = useMemo(() =>
        config.display.enablePaymentButtonStatuses.includes(parentStatus) &&
        Number(parentPaymentProgress) !== 100,
        [config, parentStatus, parentPaymentProgress]
    );

    // Vérifier si on affiche les crédits disponibles
    const showAvailableCredits = useMemo(() =>
        canAddPayment &&
        config.canShowAvailableCredits(parentData.operation) &&
        availableCredits.length > 0,
        [canAddPayment, config, parentData, availableCredits]
    );

    return (
        <Spin spinning={loading} tip="Chargement...">
            <div>
                {/* Alerte si l'avoir ou l'acompte est utilisé */}
                {usageInfo.isUsed && (
                    <Alert
                        title="Document utilisé"
                        description={`Ce document est utilisé par : ${usageInfo.usedBy.join(', ')}. Les modifications et suppressions des règlements sont bloquées.`}
                        type="warning"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                )}

                {/* Section pour ajouter un paiement */}
                {canAddPayment && (
                    <Row gutter={16} style={{ marginBottom: 16 }}>
                        <Col span={5}>
                            <Button
                                type="primary"
                                onClick={handleRegisterPayment}
                                disabled={false}
                                block
                            >
                                Enregistrer un paiement
                            </Button>
                        </Col>

                        {/* Section acomptes/avoirs disponibles */}
                        {showAvailableCredits && (
                            <>
                                <Col span={8} offset={7}>
                                    <Select
                                        placeholder="Utilisez un acompte, avoir ou trop versé disponible"
                                        style={{ width: '100%' }}
                                        value={selectedCredit}
                                        onChange={handleCreditChange}
                                        options={creditOptions}
                                        allowClear
                                        disabled={false}
                                    />
                                </Col>

                                <Col span={4}>
                                    <Button
                                        type="secondary"
                                        onClick={handleUseCredit}
                                        disabled={false}
                                        block
                                    >
                                        Valider
                                    </Button>
                                </Col>
                            </>
                        )}
                    </Row>
                )}

                {/* Tableau des paiements */}
                <Table
                    columns={columns}
                    dataSource={payments}
                    rowKey="pay_id"
                    pagination={false}
                    size="small"
                    style={{ marginTop: canAddPayment ? "0" : "20" }}
                    bordered
                    footer={() => (
                        <Row justify="end" gutter={24}>
                            <Col>
                            </Col>
                        </Row>
                    )}
                />

                {/* Dialogue de saisie de paiement */}
                {paymentDialogOpen && (
                    <Suspense fallback={<TabLoader />}>
                        <PaymentDialog
                            open={paymentDialogOpen}
                            onClose={handleCloseDialog}
                            onSuccess={handlePaymentSuccess}
                            parentId={parentId}
                            paymentId={editingPaymentId}
                            config={dialogConfig}
                        />
                    </Suspense>
                )}
            </div>
        </Spin>
    );
};

export default PaymentsTab;