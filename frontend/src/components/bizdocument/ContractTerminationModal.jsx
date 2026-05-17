import { useEffect, useState, useCallback } from "react"
import { Modal, Form, Row, Col, DatePicker, Input, Tooltip, Radio, Alert } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import { message } from '../../utils/antdStatic';
import dayjs from "dayjs";
import { contractsGenericApi } from "../../services/api";

export default function ContractTerminationModal({
    open,
    contractId,
    onCancel
}) {
    const [terminationType, setTerminationType] = useState('notice');
    const [showNoticeAlert, setShowNoticeAlert] = useState(false);
    const [isInvoicingMgmt, setIsInvoicingMgmt] = useState(false);
    const [remainingPeriods, setRemainingPeriods] = useState(null);

    const [terminationInfo, setTerminationInfo] = useState({
        conEndCommitment: null,
        terminatedDateMin: null,
        terminatedDateMax: null,
        dateNotice: null,
    });

    const [terminateData, setTerminateData] = useState({
        terminatedDate: null,
        reason: ''
    });

    useEffect(() => {
        const loadData = async () => {
            try {
                if (!open) return;

                const response = await contractsGenericApi.getTerminationData(contractId);
                const data = response.data;

                setTerminationInfo({
                    conEndCommitment: data.con_end_commitment ? dayjs(data.con_end_commitment) : null,
                    terminatedDateMin: data.terminated_date_min,
                    terminatedDateMax: data.terminated_date_max,
                    dateNotice: data.date_notice ? dayjs(data.date_notice) : null,
                });

                setIsInvoicingMgmt(Boolean(data.con_is_invoicing_mgmt));
                setRemainingPeriods(data.remaining_periods ?? null);

                const defaultDate = data.con_terminated_date ? dayjs(data.con_terminated_date) : dayjs();
                setTerminateData({ terminatedDate: defaultDate, reason: '' });

                if (data.date_notice && defaultDate.isBefore(dayjs(data.date_notice))) {
                    setShowNoticeAlert(true);
                } else {
                    setShowNoticeAlert(false);
                }

                setTerminationType('notice');
            } catch (error) {
                console.error('Erreur lors du chargement des données de résiliation:', error);
                message.error('Erreur lors du chargement des données de résiliation');
            }
        };

        loadData();
    }, [open, contractId]);

    const handleTerminateSubmit = useCallback(async () => {
        if (!terminateData.terminatedDate) {
            message.error('Veuillez saisir une date de résiliation');
            return;
        }
        if (!terminateData.reason?.trim()) {
            message.error('Veuillez saisir un motif de résiliation');
            return;
        }

        // Validation : date ne doit pas être antérieure au minimum autorisé
        const minDate = terminationInfo.terminatedDateMin ? dayjs(terminationInfo.terminatedDateMin) : null;
        if (minDate && terminateData.terminatedDate.isBefore(minDate, 'day')) {
            message.error(`La date de résiliation ne peut pas être antérieure au ${minDate.format('DD/MM/YYYY')}`);
            return;
        }

        // Validation : facturation résiduelle impossible sans fin d'engagement
        if (terminationType === 'immediate_invoice' && !terminationInfo.conEndCommitment) {
            message.error("La date de fin d'engagement doit être renseignée pour facturer les mois restants dus");
            return;
        }

        try {
            await contractsGenericApi.terminate(
                contractId,
                terminateData.terminatedDate.format('YYYY-MM-DD'),
                terminateData.terminatedDate.format('YYYY-MM-DD'),
                terminateData.reason,
                terminationType === 'immediate_invoice',
                terminationType
            );
            message.success('Contrat résilié avec succès');
            onCancel();
            window.location.reload();
        } catch (error) {
            const msg = error?.response?.data?.message;
            message.error(msg || 'Erreur lors de la résiliation du contrat');
        }
    }, [contractId, terminateData, terminationType, terminationInfo]);

    const handleCancel = useCallback(() => {
        setShowNoticeAlert(false);
        onCancel();
    }, [onCancel]);

    const handleDateChange = (date) => {
        setTerminateData(prev => ({ ...prev, terminatedDate: date }));
        if (terminationType === 'notice' && terminationInfo.dateNotice && date && date.isBefore(terminationInfo.dateNotice)) {
            setShowNoticeAlert(true);
        } else {
            setShowNoticeAlert(false);
        }
    };

    const handleTypeChange = (e) => {
        const type = e.target.value;
        setTerminationType(type);
        setShowNoticeAlert(false);
        if (type === 'notice') {
            const defaultDate = terminationInfo.dateNotice ?? dayjs();
            setTerminateData(prev => ({ ...prev, terminatedDate: defaultDate }));
        } else {
            setTerminateData(prev => ({ ...prev, terminatedDate: dayjs() }));
        }
    };

    const periodLabel = remainingPeriods != null
        ? `${remainingPeriods} mois restant${remainingPeriods > 1 ? 's' : ''} jusqu'à la fin d'engagement`
        : "mois restants jusqu'à la fin d'engagement";

    return (
        <Form layout="vertical">
            <Modal
                title="Résilier le contrat"
                centered
                destroyOnHidden
                open={open}
                onOk={handleTerminateSubmit}
                onCancel={handleCancel}
                okText="Résilier"
                cancelText="Annuler"
                okButtonProps={{ danger: true }}
                width={820}
            >
                {/* Sélection du type de résiliation */}
                <Form.Item label="Type de résiliation" style={{ marginBottom: 20, marginTop: 12 }}>
                    <Radio.Group
                        value={terminationType}
                        onChange={handleTypeChange}
                        style={{ width: '100%' }}
                    >
                        <Row gutter={12}>
                            <Col span={isInvoicingMgmt ? 8 : 12}>
                                <Radio.Button
                                    value="notice"
                                    style={{ width: '100%', height: 'auto', padding: '10px 12px', whiteSpace: 'normal', textAlign: 'center' }}
                                >
                                    <div style={{ fontWeight: 600, marginBottom: 2 }}>Résiliation avec préavis</div>
                                    <div style={{ fontSize: 11, color: '#666', fontWeight: 400 }}>Facturation normale jusqu'à la date choisie</div>
                                </Radio.Button>
                            </Col>
                            {isInvoicingMgmt && (
                                <Col span={8}>
                                    <Radio.Button
                                        value="immediate_invoice"
                                        style={{ width: '100%', height: 'auto', padding: '10px 12px', whiteSpace: 'normal', textAlign: 'center' }}
                                    >
                                        <div style={{ fontWeight: 600, marginBottom: 2 }}>Résiliation immédiate</div>
                                        <div style={{ fontSize: 11, color: '#666', fontWeight: 400 }}>Avec solde des mois restants dus</div>
                                    </Radio.Button>
                                </Col>
                            )}
                            <Col span={isInvoicingMgmt ? 8 : 12}>
                                <Radio.Button
                                    value="immediate"
                                    style={{ width: '100%', height: 'auto', padding: '10px 12px', whiteSpace: 'normal', textAlign: 'center' }}
                                >
                                    <div style={{ fontWeight: 600, marginBottom: 2 }}>Résiliation immédiate</div>
                                    <div style={{ fontSize: 11, color: '#666', fontWeight: 400 }}>Sans facturation résiduelle</div>
                                </Radio.Button>
                            </Col>
                        </Row>
                    </Radio.Group>
                </Form.Item>

                {/* Champs dates selon le type */}
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item label="Fin d'engagement">
                            <DatePicker
                                format="DD/MM/YYYY"
                                value={terminationInfo.conEndCommitment}
                                disabled
                                style={{ width: '100%', backgroundColor: '#f5f5f5' }}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        {terminationType === 'notice' ? (
                            <Form.Item
                                label={
                                    <span>
                                        Date de résiliation&nbsp;
                                        <Tooltip title="Date officielle à laquelle la résiliation prend effet. Le contrat continue d'être facturé normalement jusqu'à cette date.">
                                            <InfoCircleOutlined style={{ color: '#1890ff', cursor: 'help' }} />
                                        </Tooltip>
                                    </span>
                                }
                                required
                            >
                                <DatePicker
                                    format="DD/MM/YYYY"
                                    value={terminateData.terminatedDate}
                                    minDate={terminationInfo.terminatedDateMin ? dayjs(terminationInfo.terminatedDateMin) : null}
                                    maxDate={terminationInfo.terminatedDateMax ? dayjs(terminationInfo.terminatedDateMax) : null}
                                    onChange={handleDateChange}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        ) : (
                            <Form.Item
                                label={
                                    <span>
                                        Date effective&nbsp;
                                        <Tooltip title="Date à laquelle le contrat prend fin. Par défaut aujourd'hui.">
                                            <InfoCircleOutlined style={{ color: '#1890ff', cursor: 'help' }} />
                                        </Tooltip>
                                    </span>
                                }
                                required
                            >
                                <DatePicker
                                    format="DD/MM/YYYY"
                                    value={terminateData.terminatedDate}
                                    minDate={terminationInfo.terminatedDateMin ? dayjs(terminationInfo.terminatedDateMin) : null}
                                    onChange={handleDateChange}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        )}
                    </Col>
                </Row>

                {/* Alerte préavis */}
                {showNoticeAlert && (
                    <Alert
                        type="warning"
                        showIcon
                        title="Cette date de résiliation ne respecte pas la période de préavis contractuelle."
                        style={{ marginBottom: 16 }}
                    />
                )}

                {/* Bandeaux informatifs selon le type */}
                {terminationType === 'notice' && (
                    <Alert
                        type="info"
                        showIcon
                        title="La facturation mensuelle continue normalement jusqu'à la date de résiliation."
                        style={{ marginBottom: 16 }}
                    />
                )}

                {terminationType === 'immediate_invoice' && (
                    <Alert
                        type="success"
                        showIcon
                        title={
                            <span>
                                Une facture unique sera générée pour <strong>{periodLabel}</strong>.
                                Les quantités seront multipliées par le nombre de périodes restantes.
                            </span>
                        }
                        style={{ marginBottom: 16 }}
                    />
                )}

                {terminationType === 'immediate' && (
                    <Alert
                        type="warning"
                        showIcon
                        title="Le contrat sera clôturé immédiatement sans facturation des mois restants."
                        style={{ marginBottom: 16 }}
                    />
                )}

                {/* Motif */}
                <Form.Item label="Motif de résiliation" required>
                    <Input
                        maxLength={255}
                        placeholder="Veuillez saisir le motif de résiliation"
                        value={terminateData.reason}
                        onChange={(e) => setTerminateData(prev => ({ ...prev, reason: e.target.value }))}
                    />
                </Form.Item>
            </Modal>
        </Form>
    );
}
