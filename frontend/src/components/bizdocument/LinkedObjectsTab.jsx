import React, { useState, useEffect } from 'react';
import { Table, Card, Tag, Spin } from 'antd';
import { message } from '../../utils/antdStatic';
import { FileTextOutlined, ShoppingCartOutlined, FileDoneOutlined, FileProtectOutlined, TruckOutlined, InboxOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import './LinkedObjectsTab.css';

/**
 * Composant réutilisable pour afficher les objets liés à un enregistrement
 * @param {Object} props
 * @param {string} props.module - Le module courant (ex: 'sale-orders')
 * @param {number} props.recordId - L'ID de l'enregistrement
 * @param {Function} props.apiFunction - Fonction API pour récupérer les objets liés
 * @param {number} props.refreshTrigger - Incrémenter pour forcer le rechargement
 */
const LinkedObjectsTab = ({ module, recordId, apiFunction, refreshTrigger = 0 }) => {
    const [loading, setLoading] = useState(false);
    const [linkedObjects, setLinkedObjects] = useState([]);
    const [expandedRowKeys, setExpandedRowKeys] = useState([]);

    // Icônes par type d'objet
    const objectIcons = {
        'purchaseorder': <ShoppingCartOutlined />,
        'custdeliverynote': <TruckOutlined />,
        'suppreceptionnote': <InboxOutlined />,
        'custinvoice': <FileTextOutlined />,
        'custrefund': <FileDoneOutlined />,
        'custcontract': <FileProtectOutlined />,
    };

    // Couleurs des tags par type
    const objectColors = {
        'purchaseorder': 'orange',
        'custdeliverynote': 'cyan',
        'suppreceptionnote': 'blue',
        'custinvoice': 'green',
        'custrefund': 'red',
        'custcontract': 'purple',
    };

    // Mapping des types d'objets vers les URLs
    const objectUrls = {
        'purchaseorder': (id) => `/purchaseorders/${id}`,
        'custdeliverynote': (id) => `/customer-delivery-notes/${id}`,
        'suppreceptionnote': (id) => `/supplier-reception-notes/${id}`,
        'customerinvoices': (id) => `/customer-invoices/${id}`,
        'custinvoice': (id) => `/customer-invoices/${id}`,
        'custrefund': (id) => `/customer-invoices/${id}`,
        'custcontract': (id) => `/customercontracts/${id}`,
        'customercontracts': (id) => `/customercontracts/${id}`,
        'saleorder': (id) => `/saleorders/${id}`,
        'suppinvoice': (id) => `/supplier-invoices/${id}`,
    };

    // Chargement des objets liés
    useEffect(() => {
        if (!recordId) return;

        const fetchLinkedObjects = async () => {
            setLoading(true);
            try {
                const response = await apiFunction(recordId);
                const objects = response.data || [];
                setLinkedObjects(objects);

                // Grouper par type et définir les clés expandables (toutes par défaut)
                const types = [...new Set(objects.map(obj => obj.type))];
                setExpandedRowKeys(types);
            } catch (error) {
                console.error('Erreur lors du chargement des objets liés:', error);
                message.error('Erreur lors du chargement des objets liés');
            } finally {
                setLoading(false);
            }
        };

        fetchLinkedObjects();
    }, [recordId, apiFunction, refreshTrigger]);

    // Grouper les objets par type
    const groupedObjects = linkedObjects.reduce((acc, obj) => {
        const type = obj.type || 'Autre';
        if (!acc[type]) {
            acc[type] = [];
        }
        acc[type].push(obj);
        return acc;
    }, {});

    // Préparer les données pour le tableau avec lignes expandables
    const dataSource = Object.entries(groupedObjects).map(([type, objects]) => {
        // Récupérer le premier objet pour avoir le type d'objet (purchaseorder, custinvoice, etc.)
        const firstObj = objects[0];       
        return {
            key: type,
            type: type,
            object: firstObj.object,
            count: objects.length,
            isGroup: true,
            children: objects.map(obj => ({
                ...obj,
                key: `${obj.object}-${obj.id}`,
                isGroup: false,
            })),
        };
    });

    // Colonnes du tableau
    const columns = [
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type',
            width: 250,
            render: (text, record) => {
                if (record.isGroup) {
                    return (
                        <Tag icon={objectIcons[record.object]} color={objectColors[record.object]} disabled={false}>
                            {text} ({record.count})
                        </Tag>
                    );
                }
                return null;
            },
        },
        {
            title: 'Numéro',
            dataIndex: 'number',
            key: 'number',
            width: 150,
            render: (text, record) => {
                if (record.isGroup) return null;
                const urlFn = objectUrls[record.object];
                const href = urlFn ? urlFn(record.id) : `/${record.object}/${record.id}`;
                return (
                    <a
                        href={href}
                        target="_blank"
                    >
                        {text}
                    </a>
                );
            },
        },
        {
            title: 'Date',
            dataIndex: 'date',
            key: 'date',
            width: 120,
            render: (date, record) => {
                if (record.isGroup) return null;
                return date ? dayjs(date).format('DD/MM/YYYY') : '-';
            },
        },
        {
            title: 'Partenaire',
            dataIndex: 'ptr_name',
            key: 'ptr_name',
            ellipsis: true,
            render: (text, record) => {
                if (record.isGroup) return null;
                return text;
            },
        },
        {
            title: 'Total HT',
            dataIndex: 'totalht',
            key: 'totalht',
            width: 120,
            align: 'right',
            render: (value, record) => {
                if (record.isGroup) return null;
                if (value === null || value === undefined || value === '') return '-';
                return new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: 'EUR',
                }).format(value);
            },
        },
    ];

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
            </div>
        );
    }

    if (linkedObjects.length === 0) {
        return (
            <Card>
                <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                    Aucun objet lié à cet enregistrement
                </p>
            </Card>
        );
    }

    return (

        <Table
            columns={columns}
            dataSource={dataSource}
            rowKey="key"
            pagination={false}
            size="small"
            bordered
            expandable={{
                defaultExpandAllRows: true,
                expandedRowKeys: expandedRowKeys,
                onExpandedRowsChange: (keys) => setExpandedRowKeys(keys),
                childrenColumnName: 'children',
            }}
            rowClassName={(record) => record.isGroup ? 'group-row' : 'child-row'}
        />

    );
};

export default LinkedObjectsTab;
