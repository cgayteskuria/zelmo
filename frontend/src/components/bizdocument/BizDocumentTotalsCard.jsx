import React from 'react';
import { Card, Space, Divider } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';

/**
 * Composant générique de carte de totaux
 *
 * @param {Object} props
 * @param {Object} props.totals - Les totaux à afficher
 * @param {Object} props.config - Configuration des totaux à afficher
 * @param {Object} props.labels - Labels personnalisés pour chaque total
 */
export default function BizDocumentTotalsCard({
    totals = {},
    config = {},
}) {
    // Configuration par défaut
    const defaultConfig = {
        showSubscription: false,
        showOneTime: false,
        showPayment: false,
        showRemaining: false,
    };

    // Labels par défaut
    const finalLabels = {
        subscription: 'Abonnement',
        oneTime: 'Mise en service',
        tax: 'TVA',
        totalTTC: 'Total TTC',
        payment: 'Règlement',
        remaining: 'Reste à payer',
    };

    const finalConfig = { ...defaultConfig, ...config };


    // Extraire les valeurs des totaux
    const {
        totalhtsub = 0,
        totalhtcomm = 0,
        totalTVA = 0,
        totalTTC = 0,
        isSub = 0,
        totalPaid = 0,
        amountRemaining = 0,
    } = totals;

    // Déterminer le label pour "Mise en service" / "Total HT" selon isSub
    const oneTimeLabel = isSub > 0 ? finalLabels.oneTime : 'Total HT';

    return (
        <Card
            style={{
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                background: "#f5f5f5",
            }}
        >
            <Space orientation="vertical" style={{ width: '100%' }} size="small">
                {/* Abonnement (si activé et présent) */}
                {finalConfig.showSubscription && isSub > 0 && (
                    <div style={{
                        background: '#fff',
                        padding: '12px 20px',
                        borderRadius: '12px',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '1.1em', opacity: 0.95 }}>{finalLabels.subscription}</span>
                            <span style={{ fontSize: '1.1em', fontWeight: '600' }}>
                                {(Number(totalhtsub) || 0).toFixed(2)} €
                            </span>
                        </div>
                    </div>
                )}

                {/* Mise en service / One-time (si activé) */}
                {finalConfig.showOneTime && (
                    <div style={{
                        background: '#fff',
                        padding: '12px 20px',
                        borderRadius: '12px',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '1.1em', opacity: 0.95 }}>{oneTimeLabel}</span>
                            <span style={{ fontSize: '1.1em', fontWeight: '600' }}>
                                {(Number(totalhtcomm) || 0).toFixed(2)} €
                            </span>
                        </div>
                    </div>
                )}

                <div style={{
                    background: '#fff',
                    padding: '12px 20px',
                    borderRadius: '12px',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                            fontSize: '1.1em', opacity: '0.95'
                        }}>{finalLabels.tax}</span>
                        <span style={{ fontSize: '1.1em', fontWeight: '600' }}>
                            {(Number(totalTVA) || 0).toFixed(2)} €
                        </span>
                    </div>
                </div>


                <Divider style={{ borderColor: 'rgba(255,255,255,0.3)', margin: '0' }} />


                <div style={{
                    background: '#fff',
                    padding: '12px 20px',
                    borderRadius: '12px',
                    backdropFilter: 'blur(10px)',
                    border: '2px solid #c30079',
                    boxShadow: '0 0 20px rgba(195, 0, 121, 0.3)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCircleOutlined style={{ fontSize: '20px' }} />
                            <span style={{ fontSize: '1.2em', fontWeight: '500' }}>{finalLabels.totalTTC}</span>
                        </div>
                        <span style={{ fontWeight: 'bold', fontSize: '1.2em', letterSpacing: '0.5px' }}>
                            {(Number(totalTTC) || 0).toFixed(2)} €
                        </span>
                    </div>
                </div>


                {/* Règlement (si activé) */}
                {finalConfig.showPayment && (
                    <div style={{
                        background: '#fff',
                        padding: '12px 20px',
                        borderRadius: '12px',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '1.1em', opacity: 0.95 }}>{finalLabels.payment}</span>
                            <span style={{ fontSize: '1.1em', fontWeight: '600' }}>
                                {(Number(totalPaid) || 0).toFixed(2)} €
                            </span>
                        </div>
                    </div>
                )}

                {/* Reste à payer (si activé) */}
                {finalConfig.showRemaining && (
                    <div style={{
                        background: '#fff',
                        padding: '12px 20px',
                        borderRadius: '12px',
                        backdropFilter: 'blur(10px)',
                        border: amountRemaining > 0 ? '2px solid #ff9800' : '2px solid #4caf50',
                        boxShadow: amountRemaining > 0 ? '0 0 20px rgba(255, 152, 0, 0.3)' : '0 0 20px rgba(76, 175, 80, 0.3)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '1.1em', fontWeight: '500' }}>{finalLabels.remaining}</span>
                            <span style={{
                                fontSize: '1.1em',
                                fontWeight: 'bold',
                                color: amountRemaining > 0 ? '#ff9800' : '#4caf50'
                            }}>
                                {(Number(amountRemaining) || 0).toFixed(2)} €
                            </span>
                        </div>
                    </div>
                )}
            </Space>
        </Card >
    );
}
