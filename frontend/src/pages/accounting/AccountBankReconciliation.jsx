import { useState, useEffect, useCallback, useMemo, lazy, Suspense, useRef } from 'react';
import { Table, Button, Checkbox, Space, Row, Col, Card, Statistic, Spin, Tag, Tabs } from 'antd';
import { message, modal } from '../../utils/antdStatic';
import { SaveOutlined, DeleteOutlined, ArrowLeftOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import PageContainer from "../../components/common/PageContainer";
import { useParams, useNavigate } from "react-router-dom";
import { useListNavigation } from "../../hooks/useListNavigation";
import dayjs from 'dayjs';
import { accountBankReconciliationsApi } from '../../services/api';

// Import lazy du composant FilesTab
const FilesTab = lazy(() => import('../../components/bizdocument/FilesTab'));

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

export default function AccountBankReconciliation() {
    const { id } = useParams();
    const navigate = useNavigate();

    const { hasNav, hasPrev, hasNext, goToPrev, goToNext, position } = useListNavigation();

    const [loading, setLoading] = useState(false);
    const [reconciliation, setReconciliation] = useState(null);
    const [lines, setLines] = useState([]);
    const [selectedLines, setSelectedLines] = useState([]);
    const [showPointed, setShowPointed] = useState(false);
    const [documentsCount, setDocumentsCount] = useState(undefined);
    const modalOpenedRef = useRef(false);


    // Charger le rapprochement
    const loadReconciliation = useCallback(async () => {
        if (!id) return;

        try {
            const response = await accountBankReconciliationsApi.get(id);

            setDocumentsCount(response.data.documents_count ?? 0);
            setReconciliation(response.data);
        } catch (error) {
            message.error('Erreur lors du chargement du rapprochement');
            console.error(error);
        }
    }, [id]);

    // Charger au montage et quand les filtres changent
    useEffect(() => {
        loadReconciliation();
    }, [loadReconciliation]);


    // Charger les lignes
    const loadLines = useCallback(async () => {
        if (!id) return;

        setLoading(true);
        try {
            const response = await accountBankReconciliationsApi.getLines(id, showPointed);

            if (response.success) {
                setLines(response.data);

                // Pré-sélectionner les lignes déjà pointées sur ce rapprochement
                const pointed = response.data
                    .filter(line => line.reconciliation_id === parseInt(id))
                    .map(line => line.aml_id);
                setSelectedLines(pointed);
            }
        } catch (error) {
            message.error('Erreur lors du chargement des lignes');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [id, showPointed]);


    useEffect(() => {
        loadLines();
    }, [loadLines]);

    const computeTotalsFromKeys = useCallback((keys) => {

        const selected = lines.filter(line =>
            keys.includes(line.aml_id)
        );

        const totalDebit = selected.reduce(
            (sum, line) => sum + Number(line.aml_debit || 0), 0
        );

        const totalCredit = selected.reduce(
            (sum, line) => sum + Number(line.aml_credit || 0), 0
        );

        const initial = Number(reconciliation?.abr_initial_balance || 0);
        const final = Number(reconciliation?.abr_final_balance || 0);

        const gap =
            Math.round((final - initial - totalDebit + totalCredit) * 100) / 100;

        return { totalDebit, totalCredit, gap };

    }, [lines, reconciliation]);

    // Calculer les totaux et l'écart
    const { totalDebit, totalCredit, gap } = useMemo(() => {
        return computeTotalsFromKeys(selectedLines);
    }, [selectedLines, computeTotalsFromKeys]);

    const formatStatus = (status) => {
        if (status === 0 || status === null) {
            return <Tag color="blue" variant='outlined'>En cours</Tag>;
        } else if (status === 1) {
            return <Tag color="green" variant='outlined'>Finalisé</Tag>;
        }
    };

    // forcedGap / forcedKeys : valeurs calculées hors closure pour éviter les captures périmées depuis setTimeout
    const handleSave = async (forcedGap, forcedKeys) => {
        const currentGap  = forcedGap !== undefined ? forcedGap  : gap;
        const currentKeys = forcedKeys !== undefined ? forcedKeys : selectedLines;
        const isBalanced  = Math.abs(currentGap) < 0.01;

        if (!isBalanced) {
            modal.confirm({
                title: 'Rapprochement non équilibré',
                content: `Le rapprochement bancaire n'est pas équilibré (écart de ${currentGap.toFixed(2)} €). Confirmez-vous l'enregistrement ?`,
                okText: 'Confirmer',
                cancelText: 'Annuler',
                onOk: () => submitSave(currentKeys),
            });
        } else {
            modal.confirm({
                title: 'Rapprochement équilibré',
                content: 'Le rapprochement est équilibré. Confirmez-vous l\'enregistrement ?',
                okText: 'Confirmer',
                cancelText: 'Annuler',
                onOk: () => submitSave(currentKeys),
            });
        }
    };

    const submitSave = async (forcedKeys) => {
        const keysToSave = forcedKeys !== undefined ? forcedKeys : selectedLines;
        setLoading(true);
        try {
            const response = await accountBankReconciliationsApi.updatePointing(id, keysToSave);

            if (response.success) {
                message.success(response.message);
                await loadLines();
            }
        } catch (error) {
            message.error(error.response?.message || 'Erreur lors de la sauvegarde');
        } finally {
            setLoading(false);
        }
    };

    // Supprimer le rapprochement
    const handleDelete = () => {
        modal.confirm({
            title: 'Supprimer le rapprochement',
            content: 'Êtes-vous sûr de vouloir supprimer ce rapprochement ? Cette action est irréversible.',
            okText: 'Supprimer',
            okType: 'danger',
            cancelText: 'Annuler',
            onOk: async () => {
                try {
                    const response = await accountBankReconciliationsApi.delete(id);
                    if (response.success) {
                        message.success(response.message);
                        navigate('/account-bank-reconciliations');
                    }
                } catch (error) {
                    message.error(error.response?.message || 'Erreur lors de la suppression');
                }
            },
        });
    };

    // Colonnes du tableau
    const columns = [
        {
            title: 'N° Mvt', dataIndex: 'fk_amo_id', key: 'fk_amo_id', width: 100,
            render: (amoId) => amoId
                ? <a href={`/account-moves/${amoId}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{amoId}</a>
                : '-',
        },
        { title: 'Journal', dataIndex: 'ajl_code', key: 'ajl_code', width: 100, },
        {
            title: 'Date', dataIndex: 'aml_date', key: 'aml_date', width: 110,
            render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : '-',
        },
        { title: 'Libellé', dataIndex: 'aml_label_entry', key: 'aml_label_entry', ellipsis: true, },
        { title: 'Réf', dataIndex: 'aml_ref', key: 'aml_ref', width: 120, },
        {
            title: 'Débit', dataIndex: 'aml_debit', key: 'aml_debit', width: 120, align: 'right',
            render: (value) => (value && value != 0) ? new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'EUR'
            }).format(value) : '',
        },
        {
            title: 'Crédit', dataIndex: 'aml_credit', key: 'aml_credit', width: 120, align: 'right',
            render: (value) => (value && value != 0) ? new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'EUR'
            }).format(value) : '',
        },
        {
            title: 'Réf de pointage', dataIndex: 'reconciliation_label', key: 'reconciliation_label', width: 150, align: 'center',
            render: (label) => label || '-',
        },
    ];

    const selectableCount = useMemo(() => {
        return lines.filter(
            l => !l.reconciliation_id || l.reconciliation_id === parseInt(id)
        ).length;
    }, [lines, id]);
    // Row selection
    const rowSelection = useMemo(() => ({
        selectedRowKeys: selectedLines,
        onChange: (selectedRowKeys) => {
            setSelectedLines(selectedRowKeys);

            const { gap: computedGap } = computeTotalsFromKeys(selectedRowKeys);

            const allSelected = selectableCount === selectedRowKeys.length;
            const isBalanced = Math.abs(computedGap) < 0.01;

            // reset si on revient en arrière
            if (!allSelected) {
                modalOpenedRef.current = false;
                return;
            }

            // ouvre UNE seule fois — passe computedGap + selectedRowKeys pour éviter les stale closures
            if (allSelected && isBalanced && !modalOpenedRef.current) {
                modalOpenedRef.current = true;
                // petit délai = laisse React finir le render
                setTimeout(() => {
                    handleSave(computedGap, selectedRowKeys);
                }, 0);
            }
        },
        getCheckboxProps: (record) => {
            // Désactiver si pointé sur un autre rapprochement
            const isPointedElsewhere = record.reconciliation_id && record.reconciliation_id !== parseInt(id);
            return {
                disabled: isPointedElsewhere || reconciliation?.abr_status === 1,
            };
        },
    }), [
        selectedLines,
        lines,
        reconciliation,
        id,
        computeTotalsFromKeys

    ]);

    const isFrozen = reconciliation?.abr_status === 1;



    // Construction des onglets
    const tabItems = useMemo(() => {
        if (!reconciliation) return [];
        const items = [
            {
                key: 'pointage',
                label: 'Pointage',
                children: (
                    <Card>
                        <Row gutter={16}
                            style={{ paddingLeft: 10, paddingRight: 10 }} >
                            <Col span={24}
                                className="box"
                                style={{ backgroundColor: "var(--layout-body-bg)", paddingLeft: 16, paddingRight: 16 }}
                            >

                                <Row gutter={16} style={{ marginBottom: 16 }}>
                                    <Col span={4}>
                                        <label>Période du</label>
                                        <div>{dayjs(reconciliation.abr_date_start).format('DD/MM/YYYY')}</div>
                                    </Col>
                                    <Col span={4}>
                                        <label>au</label>
                                        <div>{dayjs(reconciliation.abr_date_end).format('DD/MM/YYYY')}</div>
                                    </Col>
                                </Row>

                                <Row gutter={16} style={{ marginBottom: 16 }} align="middle">
                                    <Col span={4}>
                                        <Statistic
                                            title="Solde initial"
                                            value={reconciliation.abr_initial_balance}
                                            precision={2}
                                            suffix="€"
                                        />
                                    </Col>
                                    <Col span={4}>
                                        <Statistic
                                            title="Solde final"
                                            value={reconciliation.abr_final_balance}
                                            groupSeparator=" "
                                            precision={2}
                                            suffix="€"
                                        />
                                    </Col>
                                    <Col span={4}>
                                        <Statistic
                                            title="Écart"
                                            value={gap}
                                            groupSeparator=" "
                                            precision={2}
                                            suffix="€"
                                            styles={{
                                                content: {
                                                    color: Math.abs(gap) == 0.00 ? '#3f8600' : '#cf1322'
                                                }
                                            }}
                                        />
                                    </Col>
                                    {!isFrozen && (
                                        <Col span={6}>
                                            <Checkbox
                                                checked={showPointed}
                                                onChange={(e) => setShowPointed(e.target.checked)}
                                            >
                                                Afficher les mouvements pointés
                                            </Checkbox>
                                        </Col>
                                    )}
                                    <Col span={6} style={{ textAlign: 'right' }}>
                                        {!isFrozen && (
                                            <Space>
                                                <Button
                                                    danger
                                                    icon={<DeleteOutlined />}
                                                    onClick={handleDelete}
                                                >
                                                    Supprimer
                                                </Button>
                                                <Button
                                                    type="primary"
                                                    icon={<SaveOutlined />}
                                                    onClick={() => handleSave()}
                                                    loading={loading}
                                                >
                                                    Enregistrer
                                                </Button>
                                            </Space>
                                        )}
                                    </Col>
                                </Row>
                            </Col>
                        </Row>
                        <Table
                            columns={columns}
                            dataSource={lines}
                            rowKey="aml_id"
                            loading={loading}
                            rowSelection={isFrozen ? null : rowSelection}
                            pagination={{
                                pageSize: 100,
                                showSizeChanger: true,
                                showTotal: (total) => `Total: ${total} lignes`,
                            }}
                            style={{ marginTop: '16px' }}
                            size="small"
                            bordered
                            scroll={{ y: 'calc(100vh)' }}
                            rowClassName={(record) => {
                                const isPointedElsewhere = record.reconciliation_id && record.reconciliation_id !== parseInt(id);
                                if (isPointedElsewhere) {
                                    return 'row-disabled';
                                }
                                if (record.reconciliation_id === parseInt(id)) {
                                    return 'row-success';
                                }
                                return '';
                            }}
                            summary={() => (
                                <Table.Summary fixed>
                                    <Table.Summary.Row>
                                        <Table.Summary.Cell index={0} colSpan={isFrozen ? 5 : 6} align="right">
                                            <strong>Total sélectionné:</strong>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={5} align="right">
                                            <strong>{new Intl.NumberFormat('fr-FR', {
                                                style: 'currency',
                                                currency: 'EUR'
                                            }).format(totalDebit)}</strong>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={6} align="right">
                                            <strong>{new Intl.NumberFormat('fr-FR', {
                                                style: 'currency',
                                                currency: 'EUR'
                                            }).format(totalCredit)}</strong>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={7} />
                                    </Table.Summary.Row>
                                </Table.Summary>
                            )}
                        />
                    </Card>
                )
            }
        ];

        // Ajouter l'onglet Documents
        items.push({
            key: 'files',
            label: `Documents${documentsCount !== undefined ? ` (${documentsCount})` : ''}`,
            children: (
                <Suspense fallback={<TabLoader />}>
                    <FilesTab
                        module="account-bank-reconciliations"
                        recordId={parseInt(id)}
                        getDocumentsApi={accountBankReconciliationsApi.getDocuments}
                        uploadDocumentsApi={accountBankReconciliationsApi.uploadDocuments}
                        onCountChange={setDocumentsCount}
                    />
                </Suspense>
            )
        });

        return items;
    }, [id, lines, loading, isFrozen, rowSelection, columns, totalDebit, totalCredit, gap, reconciliation, showPointed, handleDelete, handleSave]);

    if (!reconciliation) {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <PageContainer
            title={`Rapprochement bancaire : ${reconciliation.abr_label} - ${reconciliation.bank_account}`}
            headerStyle={{
                center: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                        <Space>
                            {formatStatus(reconciliation.abr_status)}
                        </Space>
                    </div>
                )
            }}
            actions={
                <Space>
                    {hasNav && (
                        <>
                            <Button icon={<LeftOutlined />} onClick={goToPrev} disabled={!hasPrev} title="Précédent" />
                            <span style={{ fontSize: 12, color: '#888' }}>{position}</span>
                            <Button icon={<RightOutlined />} onClick={goToNext} disabled={!hasNext} title="Suivant" />
                        </>
                    )}
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate('/account-bank-reconciliations')}
                    >
                        Retour
                    </Button>
                </Space>
            }
        >
            <Tabs
                items={tabItems}
                defaultActiveKey="pointage"
                style={{ marginTop: 16 }}
            />

            <style>{`
                .row-disabled {
                    opacity: 0.6;
                    pointer-events: none;
                    background-color: #f5f5f5;
                }
                .row-success {
                    background-color: #f6ffed;
                }
            `}</style>
        </PageContainer>
    );
}
