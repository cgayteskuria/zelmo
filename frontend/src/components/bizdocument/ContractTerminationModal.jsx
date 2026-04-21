import { useEffect, useState, useMemo, useCallback, lazy, Suspense, useRef } from "react"
import { Modal, Form, Row, Col, DatePicker, Input } from "antd";
import { message } from '../../utils/antdStatic';
import dayjs from "dayjs";
import { contractsGenericApi } from "../../services/api";

/**
 * Modale de résiliation de contrat
 *
 * @param {boolean} open - État d'ouverture de la modale
 * @param {function} onOk - Callback de validation
 * @param {function} onCancel - Callback d'annulation
 * @param {object} terminateData - Données de résiliation
 * @param {function} setTerminateData - Fonction pour mettre à jour les données
 * @param {object} terminationInfo - Informations de résiliation (dates min/max, préavis)
 * @param {boolean} showNoticeAlert - Afficher l'alerte de préavis
 * @param {function} setShowNoticeAlert - Fonction pour afficher/masquer l'alerte
 */
export default function ContractTerminationModal({
    open,
    contractId,
    onCancel
}) {

    const [showNoticeAlert, setShowNoticeAlert] = useState(false);
    const [terminationInfo, setTerminationInfo] = useState({
        conEndCommitment: null,
        terminatedDateMin: null,
        terminatedDateMax: null,
        dateNotice: null,
    });

    const [terminateData, setTerminateData] = useState({
        terminatedDate: null,
        terminatedInvoiceDate: null,
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

                // Initialiser les dates par défaut
                const defaultDate = data.con_terminated_date ? dayjs(data.con_terminated_date) : dayjs();
                setTerminateData({
                    terminatedDate: defaultDate,
                    terminatedInvoiceDate: defaultDate,
                    reason: ''
                });

                // Vérifier si la date par défaut respecte le préavis
                if (data.date_notice && defaultDate.isBefore(dayjs(data.date_notice))) {
                    setShowNoticeAlert(true);
                } else {
                    setShowNoticeAlert(false);
                }
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
        if (!terminateData.terminatedInvoiceDate) {
            message.error('Veuillez saisir une date de fin');
            return;
        }
        if (!terminateData.reason?.trim()) {
            message.error('Veuillez saisir une raison de résiliation');
            return;
        }

        try {
            await contractsGenericApi.terminate(
                contractId,
                terminateData.terminatedDate.format('YYYY-MM-DD'),
                terminateData.terminatedInvoiceDate.format('YYYY-MM-DD'),
                terminateData.reason
            );
            message.success('Contrat résilié avec succès');
            onCancel();
            // Recharger les données
            window.location.reload();
        } catch (error) {
            console.error('Erreur lors de la résiliation:', error);
            message.error('Erreur lors de la résiliation du contrat');
        }
    }, [contractId, terminateData]);

    const handleCancel = useCallback(async () => {
        setShowNoticeAlert(false);
        onCancel();
    }, [onCancel]);

    return (
        <Form layout="vertical">
            <Modal
                title="Résilier le contrat"
                centered={true}
                destroyOnHidden={true}
                open={open}
                onOk={handleTerminateSubmit}
                onCancel={handleCancel}
                okText="Résilier"
                cancelText="Annuler"
                okButtonProps={{ danger: true }}
                width={700}
            >
                <Row gutter={16} style={{ marginTop: '20px' }}>
                    <Col span={8}>
                        <Form.Item label="Fin d'engagement">
                            <DatePicker
                                format="DD/MM/YYYY"
                                value={terminationInfo.conEndCommitment}
                                disabled
                                style={{ width: '100%', backgroundColor: '#f5f5f5' }}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item label="Date de résiliation" required>
                            <DatePicker
                                format="DD/MM/YYYY"
                                value={terminateData.terminatedDate}
                                minDate={terminationInfo.terminatedDateMin ? dayjs(terminationInfo.terminatedDateMin) : null}
                                maxDate={terminationInfo.terminatedDateMax ? dayjs(terminationInfo.terminatedDateMax) : null}
                                onChange={(date) => {
                                    setTerminateData({ ...terminateData, terminatedDate: date });
                                    // Vérifier si la date respecte le préavis
                                    if (terminationInfo.dateNotice && date && date.isBefore(terminationInfo.dateNotice)) {
                                        setShowNoticeAlert(true);
                                    } else {
                                        setShowNoticeAlert(false);
                                    }
                                }}
                                style={{ width: '100%' }}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item label="Date de fin" required>
                            <DatePicker
                                format="DD/MM/YYYY"
                                value={terminateData.terminatedInvoiceDate}
                                minDate={terminationInfo.terminatedDateMin ? dayjs(terminationInfo.terminatedDateMin) : null}
                                maxDate={terminationInfo.terminatedDateMax ? dayjs(terminationInfo.terminatedDateMax) : null}
                                onChange={(date) => {
                                    setTerminateData({ ...terminateData, terminatedInvoiceDate: date });
                                }}
                                style={{ width: '100%' }}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                {showNoticeAlert && (
                    <Row style={{ marginBottom: '16px' }}>
                        <Col span={24}>
                            <div style={{
                                color: '#ff8c00',
                                padding: '8px 12px',
                                backgroundColor: '#fff7e6',
                                border: '1px solid #ffd591',
                                borderRadius: '4px'
                            }}>
                                <strong>⚠️ Attention : Cette date de résiliation ne respecte pas la période de préavis</strong>
                            </div>
                        </Col>
                    </Row>
                )}

                <Row gutter={16}>
                    <Col span={24}>
                        <Form.Item label="Motif de résiliation" required>
                            <Input
                                maxLength={255}
                                placeholder="Veuillez saisir le motif de résiliation"
                                value={terminateData.reason}
                                onChange={(e) => setTerminateData({ ...terminateData, reason: e.target.value })}
                            />
                        </Form.Item>
                    </Col>
                </Row>
            </Modal>
        </Form>
    );
}
