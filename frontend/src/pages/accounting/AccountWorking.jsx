import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Table, Button, Input, Space, Row, Col, Form, Spin } from 'antd';
import { message } from '../../utils/antdStatic';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import PageContainer from "../../components/common/PageContainer";
import PeriodSelector from "../../components/common/PeriodSelector";
import dayjs from 'dayjs';
import { accountWorkingApi } from '../../services/apiAccounts';
import AccountSelect from "../../components/select/AccountSelect";
import { getWritingPeriod } from '../../utils/writingPeriod';


const AccountWorking = () => {
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [dateRange, setDateRange] = useState({ start: null, end: null });

    const [lines, setLines] = useState([]);
    const [isLetterable, setIsLetterable] = useState(0); // Nouveau state pour gérer l'affichage des colonnes lettrage
    const [isPointable, setIsPointable] = useState(0);
    const [summary, setSummary] = useState({ total_debit: 0, total_credit: 0, count: 0 }); // Nouveau state pour les totaux

    const [writingPeriod, setWritingPeriod] = useState(null);

    const previousGapRef = useRef(null); // Pour éviter les déclenchements multiples

    // Initialisation : période comptable + paramètres sauvegardés
    useEffect(() => {
        const initialize = async () => {
            try {
                const period = await getWritingPeriod();
                setWritingPeriod(period);

                try {
                    const res = await accountWorkingApi.getSettings();
                    const s = res?.settings;
                    if (s?.acc_id) setSelectedAccount(s.acc_id);
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

    // Gérer le chargement des comptes via AccountSelect
    const handleAccountsLoaded = useCallback((loadedAccounts) => {
        setAccounts(loadedAccounts);
        setSelectedAccount(prev => {
            if (!prev && loadedAccounts.length > 0) return loadedAccounts[0].value;
            // Fallback si le compte sauvegardé n'est plus dans la liste
            if (prev && loadedAccounts.length > 0 && !loadedAccounts.some(a => a.value === prev)) {
                return loadedAccounts[0].value;
            }
            return prev;
        });
    }, []);

    // Sauvegarder les paramètres à chaque changement de compte ou de période
    useEffect(() => {
        if (!selectedAccount || !dateRange.start || !dateRange.end) return;
        accountWorkingApi.saveSettings(selectedAccount, dateRange.start, dateRange.end).catch(() => { });
    }, [selectedAccount, dateRange]);

    // State pour gérer les filtres et tris du tableau
    const [tableParams, setTableParams] = useState({
        sortField: null,
        sortOrder: null,
        filters: {},
    });

    // Recalculer le solde évolutif quand l'ordre ou les filtres changent
    const linesWithBalance = useMemo(() => {
        if (!lines || lines.length === 0) return [];

        // Copier les lignes
        let sortedLines = [...lines];

        // Trier selon le tri actuel dans la table
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

        // Calculer le solde évolutif
        let runningBalance = 0;
        return sortedLines.map(line => {
            runningBalance += (line.aml_debit || 0) - (line.aml_credit || 0);
            return { ...line, solde: runningBalance };
        });
    }, [lines, tableParams]);

    // Charger les lignes comptables
    const loadLines = useCallback(async () => {
        if (!selectedAccount || !dateRange.start || !dateRange.end) return;

        setLoading(true);
        try {
            const response = await accountWorkingApi.getLines(
                selectedAccount,
                dateRange.start,
                dateRange.end,
            );

            if (response.success) {
                // Stocker les lignes brutes
                setLines(response.data);

                // Gérer l'indicateur lettrable
                setIsLetterable(response.account?.acc_is_letterable || 0);
                // Gérer l'indicateur pointable
                setIsPointable(response.account?.acc_code?.startsWith('512') ? 1 : 0);

                // Stocker les totaux
                setSummary(response.summary || { total_debit: 0, total_credit: 0, count: 0 });

            }
        } catch (error) {
            message.error('Erreur lors du chargement des lignes');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [selectedAccount, dateRange]);

    // Charger les lignes quand les filtres changent
    useEffect(() => {
        loadLines();
        previousGapRef.current = null; // Réinitialiser le suivi de l'écart lors du rechargement
    }, [loadLines]);


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

        previousGapRef.current = null; // Réinitialiser le suivi de l'écart
    }, [accounts, selectedAccount]);



    // Colonnes du tableau - dynamiques selon isLetterable
    const columns = useMemo(() => {
        const baseColumns = [
            {
                title: 'Écrit.',
                dataIndex: 'fk_amo_id',
                key: 'fk_amo_id',
                width: 100,
                render: (id) => id ? (
                    <a
                        href={`/account-moves/${id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#1890ff', textDecoration: 'underline', cursor: 'pointer' }}
                    >
                        {id}
                    </a>
                ) : '',
                sorter: (a, b) => (a.fk_amo_id || 0) - (b.fk_amo_id || 0),
                filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
                    <div style={{ padding: 8 }}>
                        <Input
                            placeholder="Rechercher une écriture"
                            value={selectedKeys[0]}
                            onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                            onPressEnter={() => confirm()}
                            style={{ width: 188, marginBottom: 8, display: 'block' }}
                        />
                        <Space>
                            <Button
                                type="primary"
                                onClick={() => confirm()}
                                size="small"
                                style={{ width: 90 }}
                            >
                                Filtrer
                            </Button>
                            <Button onClick={() => clearFilters()} size="small" style={{ width: 90 }}>
                                Réinitialiser
                            </Button>
                        </Space>
                    </div>
                ),
                onFilter: (value, record) =>
                    record.fk_amo_id?.toString().includes(value),
            },
            {
                title: 'Journal',
                dataIndex: 'ajl_code',
                key: 'ajl_code',
                width: 120,
                sorter: (a, b) => (a.ajl_code || '').localeCompare(b.ajl_code || ''),
                filters: [...new Set(lines.map(line => line.ajl_code).filter(Boolean))].map(code => ({
                    text: code,
                    value: code,
                })),
                onFilter: (value, record) => record.ajl_code === value,
            },
            {
                title: 'Date',
                dataIndex: 'aml_date',
                key: 'aml_date',
                width: 115,
                render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : '',
                sorter: (a, b) => {
                    const dateA = a.aml_date ? dayjs(a.aml_date).valueOf() : 0;
                    const dateB = b.aml_date ? dayjs(b.aml_date).valueOf() : 0;
                    return dateA - dateB;
                },
            },
            {
                title: 'Libellé',
                dataIndex: 'aml_label_entry',
                key: 'aml_label_entry',
                ellipsis: true,
                sorter: (a, b) => (a.aml_label_entry || '').localeCompare(b.aml_label_entry || ''),
                filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
                    <div style={{ padding: 8 }}>
                        <Input
                            placeholder="Rechercher"
                            value={selectedKeys[0]}
                            onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                            onPressEnter={() => confirm()}
                            style={{ width: 188, marginBottom: 8, display: 'block' }}
                        />
                        <Space>
                            <Button
                                type="primary"
                                onClick={() => confirm()}
                                size="small"
                                style={{ width: 90 }}
                            >
                                Filtrer
                            </Button>
                            <Button onClick={() => clearFilters()} size="small" style={{ width: 90 }}>
                                Réinitialiser
                            </Button>
                        </Space>
                    </div>
                ),
                onFilter: (value, record) =>
                    record.aml_label_entry?.toLowerCase().includes(value.toLowerCase()),
            },
            {
                title: 'Réf',
                dataIndex: 'aml_ref',
                key: 'aml_ref',
                width: 120,
                sorter: (a, b) => (a.aml_ref || '').localeCompare(b.aml_ref || ''),
                filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
                    <div style={{ padding: 8 }}>
                        <Input
                            placeholder="Rechercher"
                            value={selectedKeys[0]}
                            onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                            onPressEnter={() => confirm()}
                            style={{ width: 188, marginBottom: 8, display: 'block' }}
                        />
                        <Space>
                            <Button
                                type="primary"
                                onClick={() => confirm()}
                                size="small"
                                style={{ width: 90 }}
                            >
                                Filtrer
                            </Button>
                            <Button onClick={() => clearFilters()} size="small" style={{ width: 90 }}>
                                Réinitialiser
                            </Button>
                        </Space>
                    </div>
                ),
                onFilter: (value, record) =>
                    record.aml_ref?.toLowerCase().includes(value.toLowerCase()),
            },
            {
                title: 'Débit',
                dataIndex: 'aml_debit',
                key: 'aml_debit',
                width: 120,
                align: 'right',
                render: (value) => parseFloat(value) !== 0
                    ? <span style={{ color: '#1677ff' }}>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)}</span>
                    : '-',
                sorter: (a, b) => (a.aml_debit || 0) - (b.aml_debit || 0),
            },
            {
                title: 'Crédit',
                dataIndex: 'aml_credit',
                key: 'aml_credit',
                width: 120,
                align: 'right',
                render: (value) => parseFloat(value) !== 0
                    ? <span style={{ color: '#fa8c16' }}>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)}</span>
                    : '-',
                sorter: (a, b) => (a.aml_credit || 0) - (b.aml_credit || 0),
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
        ];

        // Ajouter les colonnes de lettrage si le compte est lettrable
        if (isLetterable === 1) {
            baseColumns.push(
                {
                    title: 'Lett.',
                    dataIndex: 'aml_lettering_code',
                    key: 'aml_lettering_code',
                    width: 110,
                    align: 'center',
                    sorter: (a, b) => (a.aml_lettering_code || '').localeCompare(b.aml_lettering_code || ''),
                    filters: [...new Set(lines.map(line => line.aml_lettering_code).filter(Boolean))].map(code => ({
                        text: code,
                        value: code,
                    })),
                    onFilter: (value, record) => record.aml_lettering_code === value,
                },
                {
                    title: 'Date lett.',
                    dataIndex: 'aml_lettering_date',
                    key: 'aml_lettering_date',
                    width: 120,
                    align: 'center',
                    render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : '',
                    sorter: (a, b) => {
                        const dateA = a.aml_lettering_date ? dayjs(a.aml_lettering_date).valueOf() : 0;
                        const dateB = b.aml_lettering_date ? dayjs(b.aml_lettering_date).valueOf() : 0;
                        return dateA - dateB;
                    },
                }
            );
        }

        if (isPointable === 1) {
            // Ajouter les colonnes de pointage
            baseColumns.push(
                {
                    title: 'Réf point.',
                    dataIndex: 'aml_abr_code',
                    key: 'aml_abr_code',
                    width: 110,
                    align: 'center',
                    sorter: (a, b) => (a.aml_abr_code || '').localeCompare(b.aml_abr_code || ''),
                    filters: [...new Set(lines.map(line => line.aml_abr_code).filter(Boolean))].map(code => ({
                        text: code,
                        value: code,
                    })),
                    onFilter: (value, record) => record.aml_abr_code === value,
                },
                {
                    title: 'Date point.',
                    dataIndex: 'aml_abr_date',
                    key: 'aml_abr_date',
                    width: 120,
                    align: 'center',
                    render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : '',
                    sorter: (a, b) => {
                        const dateA = a.aml_abr_date ? dayjs(a.aml_abr_date).valueOf() : 0;
                        const dateB = b.aml_abr_date ? dayjs(b.aml_abr_date).valueOf() : 0;
                        return dateA - dateB;
                    },
                }
            );
        }

        return baseColumns;
    }, [isLetterable, isPointable, lines]);


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
            title="Travail sur un compte"
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
                                        filters={{ isActive: true }}
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
                                        // minDate={writingPeriod ? dayjs(writingPeriod.startDate) : undefined}
                                        // maxDate={writingPeriod ? dayjs(writingPeriod.endDate) : undefined}
                                        disabled={!writingPeriod}
                                        presets={true}
                                    />
                                </Form.Item>
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
                    pagination={{
                        pageSize: 100,
                        showSizeChanger: false,
                        showTotal: (total) => `Total: ${total} lignes`,
                    }}
                    size="small"
                    bordered
                    scroll={{ y: 'calc(100vh - 415px)' }}
                    style={{ marginTop: '20px' }}
                    onChange={(pagination, filters, sorter) => {
                        // Mettre à jour les paramètres de tri et filtre
                        setTableParams({
                            sortField: sorter.field,
                            sortOrder: sorter.order,
                            filters: filters,
                        });
                    }}
                    summary={() => {
                        const solde = (summary.total_debit || 0) - (summary.total_credit || 0);
                        const soldeColor = solde > 0 ? '#52c41a' : solde < 0 ? '#f5222d' : undefined;
                        return (
                            <Table.Summary fixed>
                                <Table.Summary.Row style={{ fontWeight: 'bold', backgroundColor: '#fafafa' }}>
                                    <Table.Summary.Cell index={0} colSpan={5} align="right">
                                        TOTAUX ({summary.count} lignes)
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={1} align="right">
                                        <span style={{ color: '#1677ff' }}>
                                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(summary.total_debit || 0)}
                                        </span>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={2} align="right">
                                        <span style={{ color: '#fa8c16' }}>
                                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(summary.total_credit || 0)}
                                        </span>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={3} align="right">
                                        <span style={{ color: soldeColor }}>
                                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(solde)}
                                        </span>
                                    </Table.Summary.Cell>
                                    {isLetterable === 1 && (
                                        <>
                                            <Table.Summary.Cell index={4} />
                                            <Table.Summary.Cell index={5} />
                                        </>
                                    )}
                                    {isPointable === 1 && (
                                        <>
                                            <Table.Summary.Cell index={6} />
                                            <Table.Summary.Cell index={7} />
                                        </>
                                    )}
                                </Table.Summary.Row>
                            </Table.Summary>
                        );
                    }}
                />
            </Form>
        </PageContainer>

    );
};

export default AccountWorking;