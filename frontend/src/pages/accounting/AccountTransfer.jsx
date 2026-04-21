import { useState, useEffect } from "react";
import { Form, DatePicker, Button, Steps, Card, Table, App, Alert, Typography, Space, Spin, Tag, Checkbox } from "antd";
import { SearchOutlined, CheckCircleOutlined, SaveOutlined, LeftOutlined, ArrowLeftOutlined, ExclamationCircleOutlined, SettingOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import PageContainer from "../../components/common/PageContainer";
import { accountTransfersApi } from "../../services/api";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";

import { createDateValidator, getWritingPeriod } from "../../utils/writingPeriod";

const { RangePicker } = DatePicker;
const { Text } = Typography;

/**
 * Formulaire complet de transfert comptable avec preview
 */
export default function AccountTransfer() {
    const [form] = Form.useForm();
    const { message } = App.useApp();
    const navigate = useNavigate();
    const { id } = useParams();
    const [writingPeriod, setWritingPeriod] = useState(null);

    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [movements, setMovements] = useState([]);
    const [errors, setErrors] = useState([]);
    const [transferResult, setTransferResult] = useState(null);
    const [transferError, setTransferError] = useState(null); // erreur bloquante TVA
    const [viewMode, setViewMode] = useState(false);
    const [includeAccounted, setIncludeAccounted] = useState(false);

    const dateValidator = createDateValidator();

    // Charge un transfert existant pour consultation
    const loadTransfer = async (transferId) => {
        setLoading(true);
        try {
            const response = await accountTransfersApi.get(transferId);
            setTransferResult(response.data);
            setCurrentStep(2); // Aller directement à l'étape de confirmation
        } catch (error) {
            message.error('Erreur lors du chargement du transfert');
            navigate('/account-transfers');
        } finally {
            setLoading(false);
        }
    };


    // Mode visualisation : charger le transfert existant
    useEffect(() => {
        if (id && id !== 'new') {
            setViewMode(true);
            loadTransfer(id);
        } else {
            const loadWritingPeriod = async () => {
                const period = await getWritingPeriod();
                setWritingPeriod(period);
                const dates = [dayjs(period.startDate), dayjs(period.endDate)];
                form.setFieldsValue({ period: dates });
                // Lancer automatiquement l'extraction
                handlePreview({ period: dates });
            };

            loadWritingPeriod();

        }
    }, [id]);



    /**
     * Etape 1 : Extraction et preview des mouvements
     */
    const handlePreview = async (values) => {
        const [startDate, endDate] = values?.period || form.getFieldValue('period');

        setLoading(true);
        setTransferError(null);
        try {
            const response = await accountTransfersApi.preview(
                startDate.format('YYYY-MM-DD'),
                endDate.format('YYYY-MM-DD'),
                includeAccounted
            );

            if (response.count === 0 && response.errorsCount === 0) {
                message.warning('Aucun mouvement à transférer pour cette période');
                setMovements([]);
                setErrors([]);
                setCurrentStep(0);
                return;
            }

            setMovements(response.movements || []);
            setErrors(response.errors || []);
            setCurrentStep(1);

            if (response.errorsCount > 0) {
                message.warning(`${response.count} mouvements extraits avec ${response.errorsCount} erreur(s)`);
            } else {
                message.success(`${response.count} mouvements extraits`);
            }
        } catch (error) {
            const rawMessage = error.response?.data?.message || 'Erreur lors de l\'extraction des mouvements';
            setTransferError(rawMessage);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Etape 2 : Validation et exécution du transfert
     */
    const handleTransfer = async () => {
        const [startDate, endDate] = form.getFieldValue('period');

        setTransferError(null);
        setLoading(true);
        try {
            const response = await accountTransfersApi.transfer(
                startDate.format('YYYY-MM-DD'),
                endDate.format('YYYY-MM-DD'),
                movements
            );

            setTransferResult(response.data);
            setCurrentStep(2);
            message.success(response.message);
        } catch (error) {
            const rawMessage = error.response?.data?.message || 'Erreur lors du transfert comptable';           
            // Erreur bloquante TVA : affichée comme Alert structurée (contient des sauts de ligne)

            setTransferError(rawMessage);
            message.error(rawMessage);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Configuration des colonnes du tableau de preview
     */
    const previewColumns = [
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type',
            width: 80,
            render: (type) => {
                const config = {
                    inv: { color: 'blue', label: 'FAC' },
                    pay: { color: 'green', label: 'PAY' },
                    exr: { color: 'orange', label: 'NDF' },
                };
                const { color, label } = config[type] || { color: 'default', label: type };
                return <Tag color={color}>{label}</Tag>;
            },
        },
        { title: 'Journal', dataIndex: 'journal_code', key: 'journal_code', width: 80, },
        { title: 'N°', dataIndex: 'number', key: 'number', width: 120, },
        { title: 'Date', dataIndex: 'date', key: 'date', width: 100, render: (date) => dayjs(date).format('DD/MM/YYYY'), },
        { title: 'Libellé', dataIndex: 'move_label', key: 'move_label', ellipsis: true, },
        { title: 'Compte', dataIndex: 'account_code', key: 'account_code', width: 100, },
        {
            title: 'Débit', dataIndex: 'debit', key: 'debit', width: 120, align: 'right',
            render: (val) => val > 0 ? new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'EUR'
            }).format(val) : '',
        },
        {
            title: 'Crédit', dataIndex: 'credit', key: 'credit', width: 120, align: 'right',
            render: (val) => val > 0 ? new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'EUR'
            }).format(val) : '',
        },
    ];

    /**
     * Configuration des colonnes du tableau d'erreurs
     */
    const errorColumns = [
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type',
            width: 100,
            render: (type) => {
                const config = {
                    invoice: 'Facture',
                    payment: 'Paiement',
                    expense_report: 'Note de frais',
                };
                return <Tag color="red">{config[type] || type}</Tag>;
            },
        },
        { title: 'Référence', dataIndex: 'reference', key: 'reference', width: 150, },
        { title: 'Erreur', dataIndex: 'message', key: 'message', },];

    /**
     * Rendu des étapes
     */
    const steps = [
        {
            title: 'Sélection période',
            icon: <SearchOutlined />,
        },
        {
            title: 'Vérification',
            icon: <CheckCircleOutlined />,
        },
        {
            title: 'Confirmation',
            icon: <SaveOutlined />,
        },
    ];

    return (
        <PageContainer
            title={viewMode ? "Détail du transfert comptable" : "Nouveau transfert comptable"}
            onBack={() => navigate('/account-transfers')}
            actions={
                <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/account-transfers')}
                >
                    Retour à la liste
                </Button>
            }
        >
            <Card>
                {!viewMode && <Steps current={currentStep} items={steps} style={{ marginBottom: 32 }} />}

                <Spin spinning={loading}>
                    {/* ETAPE 0 : Sélection de la période */}
                    {currentStep === 0 && !viewMode && (
                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={handlePreview}
                        >
                            <Alert
                                title="Information"
                                description="Sélectionnez la période pour laquelle vous souhaitez transférer les factures et paiements validés en comptabilité."
                                type="info"
                                showIcon
                                style={{ marginBottom: 24 }}
                            />

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <Space size='large'>
                                    <Form.Item
                                        name="period"
                                        label="Période de transfert"
                                        rules={[
                                            { required: true, message: 'Veuillez sélectionner une période' },
                                            {
                                                validator: async (_, value) => {
                                                    if (!value || value.length !== 2) {
                                                        return Promise.resolve();
                                                    }
                                                    // Valider la date de début
                                                    await dateValidator(_, value[0]);
                                                    // Valider la date de fin
                                                    await dateValidator(_, value[1]);
                                                }
                                            }
                                        ]}
                                    >
                                        <RangePicker
                                            format="DD/MM/YYYY"
                                            placeholder={['Date de début', 'Date de fin']}
                                            disabled={!writingPeriod}
                                            minDate={writingPeriod ? dayjs(writingPeriod.startDate) : undefined}
                                            maxDate={writingPeriod ? dayjs(writingPeriod.endDate) : undefined}
                                        />
                                    </Form.Item>

                                    <Form.Item style={{ paddingTop: '15px' }}>
                                        <Button
                                            type="primary"
                                            htmlType="submit"
                                            icon={<SearchOutlined />}
                                            size="large"
                                        >
                                            Extraire les mouvements
                                        </Button>
                                    </Form.Item>
                                </Space>

                                <Form.Item>
                                    <Checkbox
                                        checked={includeAccounted}
                                        onChange={(e) => setIncludeAccounted(e.target.checked)}
                                    >
                                        Inclure les écritures déjà transférées
                                    </Checkbox>
                                </Form.Item>
                            </div>
                        </Form>
                    )}

                    {/* Erreur bloquante TVA à l'étape 0 (levée lors du preview automatique) */}
                    {currentStep === 0 && !viewMode && transferError && (
                        <Alert
                            type="error"
                            showIcon
                            style={{ marginTop: 24 }}
                            title="Export comptable bloqué — configuration TVA incomplète"
                            description={
                                <div>
                                    <ul style={{ margin: '8px 0 12px', paddingLeft: 20 }}>
                                        {transferError
                                            .split('\n')
                                            .filter(line => line.trim().startsWith('•'))
                                            .map((line, i) => (
                                                <li key={i} style={{ marginBottom: 4 }}>
                                                    {line.replace(/^\s*•\s*/, '')}
                                                </li>
                                            ))
                                        }
                                    </ul>
                                    <Link to="/settings/taxes">
                                        <SettingOutlined style={{ marginRight: 6 }} />
                                        Configurer les ventilations dans Paramètres › Taxes
                                    </Link>
                                </div>
                            }
                        />
                    )}

                    {/* ETAPE 1 : Preview et vérification */}
                    {currentStep === 1 && !viewMode && (
                        <div>
                            <Alert
                                title="Vérification des mouvements"
                                description={`${movements.length} ligne(s) d'écriture comptable prête(s) à être transférée(s). Vérifiez les détails ci-dessous avant de valider.`}
                                type={"warning"}
                                showIcon
                                style={{ marginBottom: 24 }}
                            />

                            {errors.length > 0 && (
                                <>
                                    <Alert
                                        description={`${errors.length} erreur(s) détectée(s) - Les éléments suivants n'ont pas pu être extraits`}
                                        type="error"
                                        showIcon
                                        icon={<ExclamationCircleOutlined />}
                                        style={{ marginBottom: 24 }}
                                    />
                                    <Card title="Erreurs" style={{ marginBottom: 24 }}>
                                        <Table
                                            columns={errorColumns}
                                            dataSource={errors}
                                            rowKey={(record) => `error-${record.type}-${record.reference}`}
                                            pagination={false}
                                            size="small"
                                        />
                                    </Card>
                                </>
                            )}

                            <Table
                                columns={previewColumns}
                                dataSource={movements}
                                rowKey={(record, idx) => `${record.type}-${record.move_id}-${record.account_code}-${idx}`}
                                pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (total) => `${total} lignes` }}
                                scroll={{ x: 'max-content' }}
                                style={{ marginBottom: 24 }}
                                size="small"
                            />

                            {transferError && (
                                <Alert
                                    type="error"
                                    showIcon
                                    style={{ marginBottom: 24 }}
                                    title="Export comptable bloqué — configuration TVA incomplète"
                                    description={
                                        <div>
                                            <ul style={{ margin: '8px 0 12px', paddingLeft: 20 }}>
                                                {transferError
                                                    .split('\n')
                                                    .filter(line => line.trim().startsWith('•'))
                                                    .map((line, i) => (
                                                        <li key={i} style={{ marginBottom: 4 }}>
                                                            {line.replace(/^\s*•\s*/, '')}
                                                        </li>
                                                    ))
                                                }
                                            </ul>
                                            <Link to="/settings/taxes">
                                                <SettingOutlined style={{ marginRight: 6 }} />
                                                Configurer les ventilations dans Paramètres › Taxes
                                            </Link>
                                        </div>
                                    }
                                />
                            )}

                            <Space>
                                <Button
                                    onClick={() => { setCurrentStep(0); setTransferError(null); }}
                                    icon={<LeftOutlined />}
                                >
                                    Retour
                                </Button>
                                <Button
                                    type="primary"
                                    onClick={handleTransfer}
                                    icon={<SaveOutlined />}
                                    size="large"
                                    disabled={movements.length === 0}
                                >
                                    Valider le transfert
                                </Button>
                            </Space>
                        </div>
                    )}

                    {/* ETAPE 2 : Confirmation */}
                    {currentStep === 2 && transferResult && (
                        <div>
                            <Alert
                                title={viewMode ? "Transfert effectué" : "Transfert réussi"}
                                description={`${viewMode ? "Ce transfert a été effectué avec succès." : "Le transfert comptable a été effectué avec succès."} ${transferResult.atr_moves_number} mouvement(s) transféré(s).`}
                                type="success"
                                showIcon
                                style={{ marginBottom: 24 }}
                            />

                            <Card style={{ marginBottom: 24 }}>
                                <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                                    <div>
                                        <Text strong>Période : </Text>
                                        <Text>
                                            {dayjs(transferResult.atr_transfer_start).format('DD/MM/YYYY')}
                                            {' au '}
                                            {dayjs(transferResult.atr_transfer_end).format('DD/MM/YYYY')}
                                        </Text>
                                    </div>
                                    <div>
                                        <Text strong>Mouvements transférés : </Text>
                                        <Text>{transferResult.atr_moves_number}</Text>
                                    </div>
                                    {transferResult.atr_created && (
                                        <div>
                                            <Text strong>Date du transfert : </Text>
                                            <Text>{dayjs(transferResult.atr_created).format('DD/MM/YYYY HH:mm')}</Text>
                                        </div>
                                    )}
                                </Space>
                            </Card>

                            <Table
                                columns={previewColumns}
                                dataSource={typeof transferResult.atr_moves === 'string' ? JSON.parse(transferResult.atr_moves) : transferResult.atr_moves}
                                rowKey={(record) => `${record.type}-${record.move_id}-${record.account_code}-${record.date}`}
                                pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (total) => `${total} lignes` }}
                                scroll={{ x: 'max-content' }}
                                size="small"
                                style={{ marginBottom: 24 }}
                            />

                            <div style={{ marginTop: 24 }}>
                                <Button
                                    type="primary"
                                    onClick={() => navigate('/account-transfers')}
                                >
                                    Retour à la liste
                                </Button>
                            </div>
                        </div>
                    )}
                </Spin>
            </Card>
        </PageContainer>
    );
}
