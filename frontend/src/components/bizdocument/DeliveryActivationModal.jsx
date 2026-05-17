import { useState, useEffect, useMemo } from 'react';
import { Modal, Table, InputNumber, Checkbox, Tag, Typography, Divider } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { message } from '../../utils/antdStatic';
import { saleOrdersGenericApi } from '../../services/apiBizDocument';

const { Text } = Typography;

/**
 * Modal pour livrer/réaliser des lignes produit/service et activer des lignes d'abonnement.
 *
 * Deux sections :
 *  1. Lignes produit/service (orl_is_subscription = 0) → livraison/exécution avec quantité
 *  2. Lignes abonnement (orl_is_subscription = 1)      → activation (checkbox)
 */
export default function DeliveryActivationModal({ open, saleOrderId, orderLines, onClose, onSuccess }) {
    // { [orl_id]: float } — quantité à livrer pour les lignes produit/service
    const [deliveryQty, setDeliveryQty] = useState({});
    // Set<orl_id> — lignes abonnement à activer
    const [activateIds, setActivateIds] = useState(new Set());
    const [loading, setLoading] = useState(false);

    // Lignes produit/service non-abonnement (type normal)
    const deliveryLines = useMemo(
        () => (orderLines || []).filter(l => l.lineType === 0 && !l.isSubscription),
        [orderLines]
    );

    // Lignes abonnement (type normal)
    const subscriptionLines = useMemo(
        () => (orderLines || []).filter(l => l.lineType === 0 && l.isSubscription),
        [orderLines]
    );

    // Initialiser les quantités à livrer
    useEffect(() => {
        if (open) {
            const init = {};
            deliveryLines.forEach(l => {
                const ordered = parseFloat(l.qty) || 0;
                const delivered = parseFloat(l.deliveredQty) || 0;
                const remaining = Math.max(0, ordered - delivered);
                init[l.lineId] = remaining;
            });
            setDeliveryQty(init);
            setActivateIds(new Set());
        }
    }, [open, deliveryLines]);

    const toggleActivate = (lineId) => {
        setActivateIds(prev => {
            const next = new Set(prev);
            if (next.has(lineId)) next.delete(lineId);
            else next.add(lineId);
            return next;
        });
    };

    const handleOk = async () => {
        const lines = [];

        for (const l of deliveryLines) {
            const qty = deliveryQty[l.lineId] ?? 0;
            if (qty <= 0) continue;

            const ordered   = parseFloat(l.qty) || 0;
            const delivered = parseFloat(l.deliveredQty) || 0;
            const remaining = Math.max(0, ordered - delivered);

            if (qty > remaining) {
                message.error(`"${l.prtLib}" : la quantité saisie (${qty}) dépasse la quantité restante à livrer (${remaining}).`);
                return;
            }

            const action = l.prtType === 'service' ? 'execute' : 'deliver';
            lines.push({ orl_id: l.lineId, qty, action });
        }

        activateIds.forEach(id => {
            lines.push({ orl_id: id, action: 'activate' });
        });

        if (lines.length === 0) {
            message.warning('Aucune action sélectionnée');
            return;
        }

        setLoading(true);
        try {
            await saleOrdersGenericApi.deliverLines(saleOrderId, lines);
            message.success('Mise à jour effectuée avec succès');
            onSuccess?.();
        } catch (err) {
            message.error(err?.message || 'Erreur lors de la mise à jour');
        } finally {
            setLoading(false);
        }
    };

    const deliveryColumns = [
        {
            title: 'Désignation',
            dataIndex: 'prtLib',
            key: 'prtLib',
            render: (v, row) => (
                <span>
                    {v}
                    {row.prtType === 'service'
                        ? <Tag color="blue" style={{ marginLeft: 6 }}>Service</Tag>
                        : <Tag color="default" style={{ marginLeft: 6 }}>Produit</Tag>}
                </span>
            ),
        },
        {
            title: 'Qté commandée',
            dataIndex: 'qty',
            key: 'qty',
            width: 130,
            align: 'right',
            render: v => parseFloat(v) || 0,
        },
        {
            title: 'Qté livrée',
            dataIndex: 'deliveredQty',
            key: 'deliveredQty',
            width: 110,
            align: 'right',
            render: v => parseFloat(v) || 0,
        },
        {
            title: row => row.prtType === 'service' ? 'Qté à exécuter' : 'Qté à livrer',
            key: 'toDeliver',
            width: 140,
            align: 'right',
            render: (_, row) => {
                const ordered = parseFloat(row.qty) || 0;
                const delivered = parseFloat(row.deliveredQty) || 0;
                const max = Math.max(0, ordered - delivered);
                return (
                    <InputNumber
                        min={0}
                        max={max}
                        value={deliveryQty[row.lineId] ?? max}
                        onChange={v => setDeliveryQty(prev => ({ ...prev, [row.lineId]: v ?? 0 }))}
                        style={{ width: 90 }}
                        size="small"
                    />
                );
            },
        },
    ];

    const subscriptionColumns = [
        {
            title: 'Désignation',
            dataIndex: 'prtLib',
            key: 'prtLib',
        },
        {
            title: 'Statut',
            key: 'status',
            width: 180,
            render: (_, row) => {
                const isActive = row.contractLineStatus === 1;
                return isActive
                    ? <Tag icon={<CheckCircleOutlined />} color="success">Actif</Tag>
                    : <Tag icon={<ClockCircleOutlined />} color="warning">En attente d'activation</Tag>;
            },
        },
        {
            title: 'Activer',
            key: 'activate',
            width: 80,
            align: 'center',
            render: (_, row) => {
                const isAlreadyActive = row.contractLineStatus === 1;
                return (
                    <Checkbox
                        checked={activateIds.has(row.lineId) || isAlreadyActive}
                        disabled={isAlreadyActive}
                        onChange={() => toggleActivate(row.lineId)}
                    />
                );
            },
        },
    ];

    const hasDeliveryLines = deliveryLines.length > 0;
    const hasSubscriptionLines = subscriptionLines.length > 0;

    return (
        <Modal
            title="Livrer / Réaliser / Activer"
            open={open}
            onCancel={onClose}
            onOk={handleOk}
            okText="Valider"
            cancelText="Annuler"
            confirmLoading={loading}
            width={800}
            destroyOnHidden
        >
            {hasDeliveryLines && (
                <>
                    <Text strong>Livraison / Réalisation</Text>
                    <Table
                        rowKey="lineId"
                        dataSource={deliveryLines}
                        columns={deliveryColumns}
                        pagination={false}
                        size="small"
                        style={{ marginTop: 8, marginBottom: 16 }}
                    />
                </>
            )}

            {hasDeliveryLines && hasSubscriptionLines && <Divider />}

            {hasSubscriptionLines && (
                <>
                    <Text strong>Activation des abonnements</Text>
                    <Table
                        rowKey="lineId"
                        dataSource={subscriptionLines}
                        columns={subscriptionColumns}
                        pagination={false}
                        size="small"
                        style={{ marginTop: 8 }}
                    />
                </>
            )}

            {!hasDeliveryLines && !hasSubscriptionLines && (
                <Text type="secondary">Aucune ligne à traiter.</Text>
            )}
        </Modal>
    );
}
