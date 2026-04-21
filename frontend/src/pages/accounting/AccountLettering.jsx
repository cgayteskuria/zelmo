import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Table, Button, DatePicker, Input, Checkbox, App, Space, Row, Col, Statistic, Modal, Form, Alert, Spin, Radio } from 'antd';
import { LeftOutlined, RightOutlined, UndoOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import PageContainer from "../../components/common/PageContainer";
import PeriodSelector from "../../components/common/PeriodSelector";
import dayjs from 'dayjs';
import { accountLetteringApi } from '../../services/api';
import AccountSelect from "../../components/select/AccountSelect";
import { getWritingPeriod } from '../../utils/writingPeriod';

const AccountLettering = () => {
    const [form] = Form.useForm();
    const { message } = App.useApp();
    const [deleteForm] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [dateRange, setDateRange] = useState({ start: null, end: null });
    const [showLettered, setShowLettered] = useState(false);
    const [lines, setLines] = useState([]);
    const [selectedLines, setSelectedLines] = useState([]);
    const [letteringCode, setLetteringCode] = useState('');
    const [nextCode, setNextCode] = useState(''); // Code de lettrage depuis le backend
    const [writingPeriod, setWritingPeriod] = useState(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletteringMode, setDeletteringMode] = useState('period'); // 'code' ou 'period'
    const previousGapRef = useRef(null); // Pour éviter les déclenchements multiples

    // State pour gérer les tris du tableau (recalcul solde évolutif)
    const [tableParams, setTableParams] = useState({
        sortField: null,
        sortOrder: null,
    });

    // Charger la période comptable et les paramètres sauvegardés
    useEffect(() => {
        const initialize = async () => {
            try {
                const period = await getWritingPeriod();
                setWritingPeriod(period);

                // Tenter de charger les paramètres sauvegardés
                try {
                    const res = await accountLetteringApi.getSettings();
                    const s = res?.settings;
                    if (s?.acc_id) {
                        setSelectedAccount(s.acc_id);
                    }
                    if (s?.date_start && s?.date_end) {
                        setDateRange({ start: s.date_start, end: s.date_end });
                    } else {
                        setDateRange({ start: period.startDate, end: period.endDate });
                    }
                } catch {
                    setDateRange({ start: period.startDate, end: period.endDate });
                }
            } catch (error) {
                message.error('Erreur lors du chargement de la période comptable');
                console.error(error);
            }
        };

        initialize();
    }, []);

    // Gérer le chargement des comptes lettrables via AccountSelect
    const handleAccountsLoaded = useCallback((loadedAccounts) => {
        setAccounts(loadedAccounts);
        setSelectedAccount(prev => {
            if (!prev && loadedAccounts.length > 0) {
                return loadedAccounts[0].value;
            }
            // Fallback si le compte sauvegardé n'est plus dans la liste
            if (prev && loadedAccounts.length > 0 && !loadedAccounts.some(a => a.value === prev)) {
                return loadedAccounts[0].value;
            }
            return prev;
        });
    }, []);

    // Sauvegarder le compte et la période à chaque changement
    useEffect(() => {
        if (!selectedAccount || !dateRange.start || !dateRange.end) return;
        accountLetteringApi.saveSettings(selectedAccount, dateRange.start, dateRange.end).catch(() => { });
    }, [selectedAccount, dateRange]);

    // Charger les lignes comptables
    const loadLines = useCallback(async () => {
        if (!selectedAccount || !dateRange.start || !dateRange.end) return;

        setLoading(true);
        try {
            const response = await accountLetteringApi.getLines(
                selectedAccount,
                dateRange.start,
                dateRange.end,
                showLettered
            );

            if (response.success) {
                setLines(response.data);
                setNextCode(response.nextCode || ''); // Récupérer le code depuis le backend
                setSelectedLines([]);
                setLetteringCode('');
            }
        } catch (error) {
            message.error('Erreur lors du chargement des lignes');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [selectedAccount, dateRange, showLettered]);

    // Charger les lignes quand les filtres changent
    useEffect(() => {
        loadLines();
        previousGapRef.current = null; // Réinitialiser le suivi de l'écart lors du rechargement
    }, [loadLines]);

    // Définir le code de lettrage quand des lignes sont sélectionnées
    useEffect(() => {
        if (selectedLines.length > 0 && !letteringCode && nextCode) {
            setLetteringCode(nextCode);
        }
    }, [selectedLines, letteringCode, nextCode]);

    // Recalculer le solde évolutif quand l'ordre ou les lignes changent
    const linesWithBalance = useMemo(() => {
        if (!lines || lines.length === 0) return [];

        let sortedLines = [...lines];

        if (tableParams.sortField && tableParams.sortOrder) {
            const { sortField, sortOrder } = tableParams;
            sortedLines.sort((a, b) => {
                let aValue = a[sortField];
                let bValue = b[sortField];

                if (typeof aValue === 'string') aValue = aValue.toLowerCase();
                if (typeof bValue === 'string') bValue = bValue.toLowerCase();

                if (aValue > bValue) return sortOrder === 'ascend' ? 1 : -1;
                if (aValue < bValue) return sortOrder === 'ascend' ? -1 : 1;
                return 0;
            });
        }

        let runningBalance = 0;
        return sortedLines.map(line => {
            runningBalance += (parseFloat(line.aml_debit) || 0) - (parseFloat(line.aml_credit) || 0);
            return { ...line, solde: runningBalance };
        });
    }, [lines, tableParams]);

    // Totaux globaux
    const summary = useMemo(() => ({
        total_debit: lines.reduce((sum, l) => sum + parseFloat(l.aml_debit || 0), 0),
        total_credit: lines.reduce((sum, l) => sum + parseFloat(l.aml_credit || 0), 0),
        count: lines.length,
    }), [lines]);

    // Calculer les totaux des lignes sélectionnées
    const selectedTotals = useMemo(() => {
        const selected = lines.filter(line => selectedLines.includes(line.aml_id));
        const debit = selected.reduce((sum, line) => sum + parseFloat(line.aml_debit || 0), 0);
        const credit = selected.reduce((sum, line) => sum + parseFloat(line.aml_credit || 0), 0);
        const gap = debit - credit;

        return { debit, credit, gap };
    }, [lines, selectedLines]);

    // Appliquer le lettrage
    const handleApplyLettering = useCallback(async () => {
        Modal.confirm({
            title: 'Confirmer le lettrage',
            content: `Lettrage à l'équilibre (${selectedLines.length} lignes, ${selectedTotals.debit.toFixed(2)}€). Voulez-vous réaliser le lettrage avec le code "${letteringCode}" ?`,
            okText: 'Confirmer',
            cancelText: 'Annuler',
            onOk: async () => {
                await submitLettering();
            }
        });
    }, [selectedLines, selectedTotals, letteringCode]);


    // Déclencher automatiquement le modal quand l'écart devient 0
    useEffect(() => {
        const currentGap = Math.abs(selectedTotals.gap);
        const previousGap = previousGapRef.current;

        // Déclencher uniquement si :
        // 1. Au moins 2 lignes sélectionnées
        // 2. L'écart actuel est 0
        // 3. L'écart précédent était non-nul (pour éviter les déclenchements multiples)
        if (
            selectedLines.length >= 2 &&
            currentGap < 0.01 &&
            previousGap !== null &&
            previousGap >= 0.01
        ) {
            handleApplyLettering();
        }

        // Mémoriser l'écart actuel pour la prochaine fois
        previousGapRef.current = currentGap;
    }, [selectedTotals.gap, selectedLines.length, handleApplyLettering]);

    // Navigation entre comptes
    const navigateAccount = useCallback((direction) => {
        const currentIndex = accounts.findIndex(acc => acc.value === selectedAccount);
        let newIndex;

        if (direction === 'prev' && currentIndex > 0) {
            newIndex = currentIndex - 1;
        } else if (direction === 'next' && currentIndex < accounts.length - 1) {
            newIndex = currentIndex + 1;
        } else {
            return;
        }

        setSelectedAccount(accounts[newIndex].value);
        setLetteringCode('');
        setSelectedLines([]);
        previousGapRef.current = null; // Réinitialiser le suivi de l'écart
    }, [accounts, selectedAccount]);


    const submitLettering = async () => {
        setLoading(true);
        try {
            const response = await accountLetteringApi.apply(
                letteringCode,
                selectedAccount,
                selectedLines
            );

            if (response.success) {
                message.success(response.message);
                previousGapRef.current = null; // Réinitialiser le suivi de l'écart
                await loadLines();
            }
        } catch (error) {
            message.error(error.response?.data?.message || 'Erreur lors de l\'application du lettrage');
        } finally {
            setLoading(false);
        }
    };

    // Annuler la sélection
    const handleCancel = useCallback(() => {
        setSelectedLines([]);
        setLetteringCode('');
        previousGapRef.current = null; // Réinitialiser le suivi de l'écart
    }, []);

    // Ouvrir le modal de délettrage
    const handleOpenDeleteModal = useCallback(() => {
        setDeletteringMode('period'); // Mode par défaut
        deleteForm.setFieldsValue({
            date_start: dateRange.start ? dayjs(dateRange.start) : null,
            date_end: dateRange.end ? dayjs(dateRange.end) : null,
            lettering_code: '',
        });
        setDeleteModalOpen(true);
    }, [dateRange, deleteForm]);

    // Supprimer un lettrage
    const handleRemoveLettering = useCallback(async (values) => {
        setLoading(true);
        try {
            let dateStart, dateEnd, letteringCode;

            if (deletteringMode === 'code') {
                // Mode délettrage par code : utiliser toute la période d'écriture
                dateStart = null;
                dateEnd = null;
                letteringCode = values.lettering_code;
            } else {
                // Mode délettrage par période : utiliser les dates sélectionnées
                dateStart = values.date_start.format('YYYY-MM-DD');
                dateEnd = values.date_end.format('YYYY-MM-DD');
                letteringCode = null; // Tous les codes dans la période
            }

            const response = await accountLetteringApi.remove(
                selectedAccount,
                dateStart,
                dateEnd,
                letteringCode
            );

            if (response.success) {
                message.success(response.message);
                setDeleteModalOpen(false);
                await loadLines();
            }
        } catch (error) {
            message.error(error.response?.data?.message || 'Erreur lors du délettrage');
        } finally {
            setLoading(false);
        }
    }, [selectedAccount, loadLines, deletteringMode, writingPeriod]);

    // Colonnes du tableau
    const columns = useMemo(() => [
        {
            title: 'Écrit.',
            dataIndex: 'fk_amo_id',
            key: 'fk_amo_id',
            width: 100,
            sorter: (a, b) => (a.fk_amo_id || 0) - (b.fk_amo_id || 0),
            render: (id) => id
                ? <a href={`/account-moves/${id}`} target="_blank" rel="noopener noreferrer">{id}</a>
                : '-',
        },
        {
            title: 'JOURNAL',
            dataIndex: 'ajl_code',
            key: 'ajl_code',
            width: 120,
            sorter: (a, b) => (a.ajl_code || '').localeCompare(b.ajl_code || ''),
        },
        {
            title: 'Date',
            dataIndex: 'aml_date',
            key: 'aml_date',
            width: 110,
            defaultSortOrder: 'ascend',
            sorter: (a, b) => (a.aml_date || '').localeCompare(b.aml_date || ''),
            render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : '-',
        },
        {
            title: 'Libellé',
            dataIndex: 'aml_label_entry',
            key: 'aml_label_entry',
            ellipsis: true,
            sorter: (a, b) => (a.aml_label_entry || '').localeCompare(b.aml_label_entry || ''),
        },
        {
            title: 'Réf',
            dataIndex: 'aml_ref',
            key: 'aml_ref',
            width: 120,
            sorter: (a, b) => (a.aml_ref || '').localeCompare(b.aml_ref || ''),
        },
        {
            title: 'Débit',
            dataIndex: 'aml_debit',
            key: 'aml_debit',
            width: 110,
            align: 'right',
            sorter: (a, b) => parseFloat(a.aml_debit || 0) - parseFloat(b.aml_debit || 0),
            render: (value) => value && parseFloat(value) !== 0
                ? <span style={{ color: '#1677ff' }}>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)}</span>
                : '-',
        },
        {
            title: 'Crédit',
            dataIndex: 'aml_credit',
            key: 'aml_credit',
            width: 110,
            align: 'right',
            sorter: (a, b) => parseFloat(a.aml_credit || 0) - parseFloat(b.aml_credit || 0),
            render: (value) => value && parseFloat(value) !== 0
                ? <span style={{ color: '#fa8c16' }}>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)}</span>
                : '-',
        },
        {
            title: 'Solde évolutif',
            dataIndex: 'solde',
            key: 'solde',
            width: 120,
            align: 'right',
            render: (value) => {
                if (value === undefined || value === null) return '-';
                const num = parseFloat(value);
                if (num === 0) return '-';
                const color = num > 0 ? '#52c41a' : '#f5222d';
                return <span style={{ color }}>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(num)}</span>;
            },
        },
        {
            title: 'Lett.',
            dataIndex: 'aml_lettering_code',
            key: 'aml_lettering_code',
            width: 110,
            align: 'center',
            sorter: (a, b) => (a.aml_lettering_code || '').localeCompare(b.aml_lettering_code || ''),
            render: (code, record) => {
                // Si ligne sélectionnée, afficher le code en cours
                if (selectedLines.includes(record.aml_id)) {
                    return <strong>{letteringCode}</strong>;
                }
                return code || '-';
            },
        },
        {
            title: 'Date lett.',
            dataIndex: 'aml_lettering_date',
            key: 'aml_lettering_date',
            width: 120,
            align: 'center',
            sorter: (a, b) => (a.aml_lettering_date || '').localeCompare(b.aml_lettering_date || ''),
            render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : '-',
        },
    ], [selectedLines, letteringCode]);

    // Row selection
    const rowSelection = {
        selectedRowKeys: selectedLines,
        onChange: (selectedRowKeys) => {
            setSelectedLines(selectedRowKeys);
        },
        getCheckboxProps: (record) => ({
            disabled: record.aml_lettering_code && record.aml_lettering_date, // Désactiver si déjà lettré
        }),
    };

    if (!writingPeriod) {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                L'exercice n'est  pas ouvert
                <Spin size="large" />
            </div>
        );
    }

    return (

        <PageContainer
            title="Lettrage des comptes"
        >
            <Form
                layout="vertical"
            >

                {/* Filtres */}
                <Row gutter={16}
                    style={{ paddingLeft: 10, paddingRight: 10 }}
                >
                    <Col span={24}
                        className="box"
                        style={{ backgroundColor: "var(--layout-body-bg)", paddingLeft: '16px', paddingRight: '16px' }}
                    >
                        <Row gutter={16} >
                            <Col span={8}>
                                <Form.Item
                                    label="Compte comptable"
                                >
                                    <AccountSelect
                                        filters={{ "isLetterable": 1, isActive: true }}
                                        value={selectedAccount}
                                        onChange={setSelectedAccount}
                                        onOptionsLoaded={handleAccountsLoaded}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={2}>

                                <Space style={{ marginTop: 28 }}>
                                    <Button
                                        icon={<LeftOutlined />}
                                        onClick={() => navigateAccount('prev')}
                                        disabled={!accounts.length || accounts.findIndex(a => a.value === selectedAccount) === 0}
                                    />
                                    <Button
                                        icon={<RightOutlined />}
                                        onClick={() => navigateAccount('next')}
                                        disabled={!accounts.length || accounts.findIndex(a => a.value === selectedAccount) === accounts.length - 1}
                                    />
                                </Space>

                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    label="Periode"
                                >
                                    <PeriodSelector
                                        value={dateRange}
                                        onChange={setDateRange}
                                        minDate={writingPeriod ? dayjs(writingPeriod.startDate) : undefined}
                                        maxDate={writingPeriod ? dayjs(writingPeriod.endDate) : undefined}
                                        disabled={!writingPeriod}
                                        presets={true}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={6}>

                                <Form.Item
                                    name="view_is_lettered"
                                    label="Afficher les mouvements lettrés"
                                >
                                    <Checkbox
                                        checked={showLettered}
                                        onChange={(e) => setShowLettered(e.target.checked)}
                                    >

                                    </Checkbox>
                                </Form.Item>
                            </Col>
                        </Row>


                        {/* Totaux et actions */}
                        <Row gutter={16} align="middle">
                            <Col span={3}>
                                <label>Lettre</label>
                                <Input
                                    value={letteringCode}
                                    onChange={(e) => setLetteringCode(e.target.value.toUpperCase())}
                                    style={{ marginTop: 8 }}
                                    readOnly
                                />
                            </Col>
                            <Col span={3}>
                                <Statistic
                                    title="Débit"
                                    value={selectedTotals.debit}
                                    precision={2}
                                    suffix="€"
                                />
                            </Col>
                            <Col span={3}>
                                <Statistic
                                    title="Crédit"
                                    value={selectedTotals.credit}
                                    precision={2}
                                    suffix="€"
                                />
                            </Col>
                            <Col span={3}>
                                <Statistic
                                    title="Écart"
                                    value={selectedTotals.gap}
                                    precision={2}
                                    suffix="€"
                                    styles={{
                                        value: {
                                            color: Math.abs(selectedTotals.gap) < 0.01 ? '#3f8600' : '#cf1322'
                                        }
                                    }}
                                />
                            </Col>
                            <Col span={12} style={{ textAlign: 'right' }}>
                                <Space>
                                    <Button
                                        type='secondary'
                                        icon={<UndoOutlined />}
                                        onClick={handleOpenDeleteModal}
                                    >
                                        Délettrer
                                    </Button>
                                    <Button
                                        onClick={handleCancel}
                                    >
                                        Annuler
                                    </Button>
                                    <Button
                                        type="primary"
                                        icon={<SaveOutlined />}
                                        onClick={handleApplyLettering}
                                        disabled={selectedLines.length < 2 || Math.abs(selectedTotals.gap) >= 0.01}
                                    >
                                        Valider le lettrage
                                    </Button>
                                </Space>
                            </Col>
                        </Row>
                    </Col>
                </Row>

                {/* Tableau des lignes */}

                <Table
                    columns={columns}
                    dataSource={linesWithBalance}
                    rowKey="aml_id"
                    loading={loading}
                    rowSelection={rowSelection}
                    pagination={{
                        pageSize: 100,
                        showSizeChanger: true,
                        showTotal: (total) => `Total: ${total} lignes`,
                    }}
                    size="small"
                    bordered
                    scroll={{ y: 'calc(100vh - 415px)' }}
                    style={{ marginTop: '20px' }}
                    onChange={(_pagination, _filters, sorter) => {
                        setTableParams({
                            sortField: sorter.field,
                            sortOrder: sorter.order,
                        });
                    }}
                    summary={() => {
                        const solde = summary.total_debit - summary.total_credit;
                        const soldeColor = solde > 0 ? '#52c41a' : solde < 0 ? '#f5222d' : undefined;
                        return (
                            <Table.Summary fixed>
                                <Table.Summary.Row style={{ fontWeight: 'bold', backgroundColor: '#fafafa' }}>
                                    <Table.Summary.Cell index={0} colSpan={2} />
                                    <Table.Summary.Cell index={1} colSpan={4} align="right">
                                        TOTAUX ({summary.count} lignes)
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={2} align="right">
                                        <span style={{ color: '#1677ff' }}>
                                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(summary.total_debit)}
                                        </span>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={3} align="right">
                                        <span style={{ color: '#fa8c16' }}>
                                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(summary.total_credit)}
                                        </span>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={4} align="right">
                                        <span style={{ color: soldeColor }}>
                                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(solde)}
                                        </span>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={5} />
                                    <Table.Summary.Cell index={6} />
                                </Table.Summary.Row>
                            </Table.Summary>
                        );
                    }}
                />

            </Form>
            {/* Modal de délettrage */}
            <Modal
                title="Délettrer"
                open={deleteModalOpen}
                onCancel={() => setDeleteModalOpen(false)}
                footer={null}
                width={600}
            >
                <Form
                    form={deleteForm}
                    layout="vertical"
                    onFinish={handleRemoveLettering}
                >
                    <Alert
                        message="Attention"
                        description="Cette opération supprimera les codes de lettrage des lignes correspondantes."
                        type="warning"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />

                    <Form.Item label="Mode de délettrage">
                        <Radio.Group
                            value={deletteringMode}
                            onChange={(e) => setDeletteringMode(e.target.value)}
                        >
                            <Radio.Button value="period">Par période</Radio.Button>
                            <Radio.Button value="code">Par code de lettrage</Radio.Button>
                        </Radio.Group>
                    </Form.Item>

                    {deletteringMode === 'code' && (
                        <Form.Item
                            label="Code à délettrer"
                            name="lettering_code"
                            rules={[{ required: true, message: 'Code de lettrage requis' }]}
                        >
                            <Input placeholder="AA, AB, etc." maxLength={50} />
                        </Form.Item>
                    )}

                    {deletteringMode === 'period' && (
                        <>
                            <Form.Item
                                label="Période du"
                                name="date_start"
                                rules={[{ required: true, message: 'Date de début requise' }]}
                            >
                                <DatePicker
                                    format="DD/MM/YYYY"
                                    style={{ width: '100%' }}
                                    minDate={writingPeriod ? dayjs(writingPeriod.startDate) : undefined}
                                    maxDate={writingPeriod ? dayjs(writingPeriod.endDate) : undefined}
                                />
                            </Form.Item>

                            <Form.Item
                                label="Au"
                                name="date_end"
                                rules={[{ required: true, message: 'Date de fin requise' }]}
                            >
                                <DatePicker
                                    format="DD/MM/YYYY"
                                    style={{ width: '100%' }}
                                    minDate={writingPeriod ? dayjs(writingPeriod.startDate) : undefined}
                                    maxDate={writingPeriod ? dayjs(writingPeriod.endDate) : undefined}
                                />
                            </Form.Item>
                        </>
                    )}

                    <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                        <Space>
                            <Button onClick={() => setDeleteModalOpen(false)}>
                                Annuler
                            </Button>
                            <Button type="primary" htmlType="submit" loading={loading}>
                                Valider
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </PageContainer>

    );
};

export default AccountLettering;
