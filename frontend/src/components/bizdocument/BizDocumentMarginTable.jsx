import React, { useMemo } from 'react';
import { Table } from 'antd';
import { formatCurrency } from "../../utils/formatters";

/**
 * Calcule les marges par type de produit (produit, service, total)
 *
 * @param {Object} margins - Objet contenant les données brutes de marges
 * @param {number} margins.productPR - Prix de revient produits
 * @param {number} margins.productPV - Prix de vente produits
 * @param {number} margins.servicePR - Prix de revient services
 * @param {number} margins.servicePV - Prix de vente services
 * @returns {Array} Tableau formaté avec les marges calculées
 */
export const calculateMargins = (margins) => {
    if (!margins) return [];

    const productPR = parseFloat(margins.productPR) || 0;
    const productPV = parseFloat(margins.productPV) || 0;
    const servicePR = parseFloat(margins.servicePR) || 0;
    const servicePV = parseFloat(margins.servicePV) || 0;

    const productMarge = productPV - productPR;
    const productMargePercent = productPR > 0 ? (productMarge / productPR) * 100 : 0;

    const serviceMarge = servicePV - servicePR;
    const serviceMargePercent = servicePR > 0 ? (serviceMarge / servicePR) * 100 : 0;

    const totalPR = productPR + servicePR;
    const totalPV = productPV + servicePV;
    const totalMarge = totalPV - totalPR;
    const totalMargePercent = totalPR > 0 ? (totalMarge / totalPR) * 100 : 0;

    return [
        {
            key: 'product',
            type: 'Produit',
            pxRevient: productPR,
            pxVente: productPV,
            marge: productMarge,
            margePercent: productMargePercent,
        },
        {
            key: 'service',
            type: 'Service',
            pxRevient: servicePR,
            pxVente: servicePV,
            marge: serviceMarge,
            margePercent: serviceMargePercent,
        },
        {
            key: 'total',
            type: 'Total',
            pxRevient: totalPR,
            pxVente: totalPV,
            marge: totalMarge,
            margePercent: totalMargePercent,
        },
    ];
};

/**
 * Composant générique de tableau de marges
 *
 * @param {Object} props
 * @param {Array} props.dataSource - Les données de marge (produit, service, total)
 * @param {boolean} props.loading - État de chargement
 */
export default function BizDocumentMarginTable({ dataSource = [], loading = false }) {
    // Colonnes du tableau de marges
    const columns = useMemo(() => [
        {
            title: '',
            dataIndex: 'type',
            key: 'type',
            width: 100,
            render: (text, record) => (
                <strong style={{ fontWeight: record.key === 'total' ? 'bold' : '600' }}>
                    {text}
                </strong>
            ),
        },
        {
            title: 'Px Revient',
            dataIndex: 'pxRevient',
            key: 'pxRevient',
            align: 'right',
            render: (value) => formatCurrency(value),
        },
        {
            title: 'Px Vente',
            dataIndex: 'pxVente',
            key: 'pxVente',
            align: 'right',
            render: (value) => formatCurrency(value),
        },
        {
            title: 'Marge',
            dataIndex: 'marge',
            key: 'marge',
            align: 'right',
            render: (value) => (
                <span style={{ color: value >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: '600' }}>
                    {formatCurrency(value)}
                </span>
            ),
        },
        {
            title: 'Marge %',
            dataIndex: 'margePercent',
            key: 'margePercent',
            align: 'right',
            render: (value) => {
                const color = value >= 40 ? '#52c41a' : value >= 20 ? '#faad14' : '#ff4d4f';
                return (
                    <span style={{ color, fontWeight: 'bold' }}>
                        {value.toFixed(2)} %
                    </span>
                );
            },
        },
    ], []);

    return (
        <Table
            columns={columns}
            dataSource={dataSource}
            pagination={false}
            size="small"
            classNames={{
                header: 'margin-table-header'
            }}
            bordered
            loading={loading}
            rowClassName={(record) => record.key === 'total' ? 'margin-total-row' : ''}
        />
    );
}
