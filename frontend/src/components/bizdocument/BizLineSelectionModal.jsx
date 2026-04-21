import { useState, useEffect, useMemo } from 'react';
import { Modal, Table, InputNumber } from 'antd';
import { message } from '../../utils/antdStatic';
import { formatCurrency } from "../../utils/formatters";

/**
 * Modal pour sélectionner des lignes de commande avec modification des quantités
 * Utilisé pour la génération de factures depuis une commande
 *
 * @param {Object} props
 * @param {boolean} props.open - État d'ouverture de la modal
 * @param {Function} props.onCancel - Callback pour fermer la modal
 * @param {Function} props.onOk - Callback pour valider la sélection (reçoit les lignes avec quantités)
 * @param {string} props.title - Titre de la modal
 * @param {string} props.okText - Texte du bouton de validation
 * @param {Array} props.dataSource - Lignes à afficher
 * @param {number} props.modalHeight - Hauteur de la modal (défaut: 600)
 * @param {number} props.tableHeight - Hauteur du tableau scrollable (défaut: 500)
 */
export default function BizLineSelectionModal({
    open,
    onCancel,
    onOk,
    title = "Sélectionner les lignes",
    okText = "Valider",
    dataSource = [],
    modalHeight = 600,
    tableHeight = 500,
}) {
    const [selectedLinesWithQty, setSelectedLinesWithQty] = useState({});

    // Inclure toutes les lignes (normales, titres et sous-totaux)
    const allLines = useMemo(() => {
        return dataSource;
    }, [dataSource]);

    // Initialiser les quantités à la quantité restante à facturer
    useEffect(() => {
        if (open && allLines.length > 0) {
            const initial = {};
            allLines.forEach(line => {
                // Pour les lignes normales (type 0), utiliser la quantité restante
                // Pour les autres types (titre 1, sous-total 2), quantité fixe à 1
                const isNormalLine = line.lineType === 0;
                const qtyInvoiced = line.qtyInvoiced || 0;
                const qtyAvailable = isNormalLine ? (line.qty - qtyInvoiced) : 1;

                // Inclure uniquement les lignes avec quantité disponible > 0
                if (qtyAvailable > 0 || !isNormalLine) {
                    initial[line.lineId] = {
                        qty: qtyAvailable,
                        maxQty: qtyAvailable,
                        priceUnitHt: line.priceUnitHt || 0,
                        discount: line.discount || 0,
                        lineType: line.lineType,
                    };
                }
            });
            setSelectedLinesWithQty(initial);
        }
    }, [open, allLines]);

    const handleQtyChange = (lineId, newQty) => {
        const line = allLines.find(l => l.lineId === lineId);
        if (!line) return;

        // Les lignes titre et sous-total ne peuvent pas avoir leur quantité modifiée
        if (line.lineType !== 0) {
            return;
        }

        // Calculer la quantité disponible (quantité commandée - quantité déjà facturée)
        const qtyInvoiced = line.qtyInvoiced || 0;
        const maxQty = line.qty - qtyInvoiced;

        // Valider que la quantité ne dépasse pas le maximum disponible
        if (newQty > maxQty) {
            message.warning(`La quantité ne peut pas dépasser ${maxQty.toFixed(2)} (quantité disponible)`);
            return;
        }

        if (newQty < 0) {
            message.warning('La quantité ne peut pas être négative');
            return;
        }

        setSelectedLinesWithQty(prev => {
            if (newQty === 0 || newQty === null) {
                // Supprimer la ligne si quantité = 0
                const { [lineId]: removed, ...rest } = prev;
                return rest;
            } else {
                // Mettre à jour la quantité
                return {
                    ...prev,
                    [lineId]: {
                        ...prev[lineId],
                        qty: newQty,
                    },
                };
            }
        });
    };

    const handleOk = () => {
        // Vérifier qu'au moins une ligne normale (type 0) est sélectionnée
        const normalLinesSelected = Object.entries(selectedLinesWithQty).filter(
            ([, data]) => data.lineType === 0
        );

        if (normalLinesSelected.length === 0) {
            message.error('Veuillez sélectionner au moins une ligne');
            return;
        }

        // Vérifier que toutes les quantités des lignes normales sont valides
        for (const [lineId, data] of normalLinesSelected) {
            if (!data.qty || data.qty <= 0) {
                message.error('Toutes les quantités doivent être supérieures à 0');
                return;
            }
        }

        // Récupérer les IDs des lignes normales sélectionnées
        /*const selectedNormalLineIds = new Set(
            normalLinesSelected.map(([lineId]) => parseInt(lineId))
        );*/

        // Ajouter automatiquement les lignes titre et sous-total
       // const additionalLines = new Set();

       /* allLines.forEach((line, index) => {
            // Si c'est une ligne normale sélectionnée
            if (line.lineType === 0 && selectedNormalLineIds.has(line.lineId)) {
                // Chercher la ligne titre précédente (type 1)
                for (let i = index - 1; i >= 0; i--) {
                    const prevLine = allLines[i];
                    if (prevLine.lineType === 1) {
                        additionalLines.add(prevLine.lineId);
                        break; // On s'arrête au premier titre trouvé
                    }
                    if (prevLine.lineType === 0) {
                        break; // On s'arrête si on trouve une autre ligne normale
                    }
                }

                // Chercher la ligne sous-total suivante (type 2)
                for (let i = index + 1; i < allLines.length; i++) {
                    const nextLine = allLines[i];
                    if (nextLine.lineType === 2) {
                        additionalLines.add(nextLine.lineId);
                        break; // On s'arrête au premier sous-total trouvé
                    }
                    if (nextLine.lineType === 0) {
                        break; // On s'arrête si on trouve une autre ligne normale
                    }
                }
            }
        });*/

        // Préparer les données pour l'API avec le type de ligne
        const lines = [];

        // Ajouter les lignes normales sélectionnées
        normalLinesSelected.forEach(([lineId, data]) => {
            lines.push({
                line_id: parseInt(lineId),
                qty: data.qty,
                line_type: data.lineType,
            });
        });

        // Ajouter les lignes titre et sous-total
       /* additionalLines.forEach(lineId => {
            const line = allLines.find(l => l.lineId === lineId);
            if (line) {
                lines.push({
                    line_id: lineId,
                    qty: 1,
                    line_type: line.lineType,
                });
            }
        });*/

        // Trier les lignes par leur ordre d'apparition dans le tableau original
        lines.sort((a, b) => {
            const indexA = allLines.findIndex(l => l.lineId === a.line_id);
            const indexB = allLines.findIndex(l => l.lineId === b.line_id);
            return indexA - indexB;
        });

        onOk(lines);
    };

    const columns = [
        {
            title: 'Produit / Service',
            key: 'article',
            render: (_, record) => (
                <div
                    style={{
                        width: '45ch',
                        display: '-webkit-box',
                        WebkitLineClamp: 5,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: '1.5em',
                        maxHeight: '6.5em',
                        textOverflow: 'ellipsis',
                    }}
                >
                    <div style={{ fontWeight: '600' }}>{record["prtLib"]}</div>
                    {record['prtDesc'] && (
                        <div style={{ fontSize: '0.9em', color: '#666' }}>
                            {record['prtDesc']}
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Qté commandée',
            dataIndex: 'qty',
            align: 'right',
            width: 110,
            render: (v, line) => {
                // Ne pas afficher de quantité pour les titres et sous-totaux
                if (line.lineType !== 0) return null;
                return v?.toFixed(2);
            },
        },
        {
            title: 'Qté facturée',
            dataIndex: 'qtyInvoiced',
            align: 'right',
            width: 110,
            render: (v, line) => {
                // Ne pas afficher de quantité pour les titres et sous-totaux
                if (line.lineType !== 0) return null;
                const qtyInvoiced = v || 0;
                return (
                    <span style={{ color: qtyInvoiced > 0 ? '#1890ff' : '#999' }}>
                        {qtyInvoiced.toFixed(2)}
                    </span>
                );
            },
        },
       /* {
            title: 'Qté disponible',
            key: 'qtyAvailable',
            align: 'right',
            width: 110,
            render: (_, line) => {
                // Ne pas afficher de quantité pour les titres et sous-totaux
                if (line.lineType !== 0) return null;
                const qtyInvoiced = line.qtyInvoiced || 0;
                const qtyAvailable = line.qty - qtyInvoiced;
                return (
                    <span style={{
                        fontWeight: '600',
                        color: qtyAvailable > 0 ? '#52c41a' : '#ff4d4f'
                    }}>
                        {qtyAvailable.toFixed(2)}
                    </span>
                );
            },
        },*/
        {
            title: 'Qté à facturer',
            key: 'qtyToInvoice',
            align: 'right',
            width: 120,
            render: (_, line) => {
                // Ne pas afficher d'input pour les lignes titre et sous-total
                if (line.lineType !== 0) return null;

                const qtyInvoiced = line.qtyInvoiced || 0;
                const maxQty = line.qty - qtyInvoiced;

                // Désactiver l'input si plus de quantité disponible
                if (maxQty <= 0) {
                    return <span style={{ color: '#999' }}>-</span>;
                }

                return (
                    <InputNumber
                        min={0}
                        max={maxQty}
                        step={0.01}
                        precision={2}
                        value={selectedLinesWithQty[line.lineId]?.qty || 0}
                        onChange={(value) => handleQtyChange(line.lineId, value)}
                        style={{ width: '100%' }}
                    />
                );
            },
        },
        {
            title: 'Prix U. HT',
            dataIndex: 'priceUnitHt',
            align: 'right',
            width: 100,
            render: (v, line) => {
                // Ne pas afficher de prix pour les titres et sous-totaux
                if (line.lineType !== 0) return null;
                return formatCurrency(v);
            },
        },
        {
            title: 'Total HT',
            key: 'totalHt',
            align: 'right',
            width: 100,
            render: (_, line) => {
                // Ne pas afficher de prix pour les titres et sous-totaux
                if (line.lineType !== 0) return null;
                // Afficher le montant pour les sous-totaux (lineType 2)
                // if (line.lineType === 2) {
                //    return formatCurrency(line.priceUnitHt || 0);
                // }
                // Ne pas afficher de total pour les titres
                // if (line.lineType === 1) return null;

                // Ligne normale
                const qty = selectedLinesWithQty[line.lineId]?.qty || 0;
                const discount = line.discount || 0;
                const total = line.priceUnitHt * qty * (1 - discount / 100);
                return formatCurrency(total);
            },
        },
    ];

    // Calculer le total général
    const grandTotal = useMemo(() => {
        return Object.entries(selectedLinesWithQty).reduce((sum, [lineId, data]) => {
            // Trouver la ligne correspondante
            const line = allLines.find(l => l.lineId === parseInt(lineId));
            if (!line || line.lineType !== 0) return sum; // Ignorer les titres et sous-totaux

            const discount = line.discount || 0;
            const lineTotal = line.priceUnitHt * data.qty * (1 - discount / 100);
            return sum + lineTotal;
        }, 0);
    }, [selectedLinesWithQty, allLines]);

    // Compter uniquement les lignes normales (type 0) sélectionnées
    const selectedCount = useMemo(() => {
        return Object.entries(selectedLinesWithQty).filter(
            ([, data]) => data.lineType === 0
        ).length;
    }, [selectedLinesWithQty]);

    // Déterminer la classe CSS selon le type de ligne
    const getRowClassName = (record) => {
        if (record["lineType"] === 1) return 'row-title';
        if (record["lineType"] === 2) return 'row-subtotal';
        return 'row-normal';
    };


    return (
        <Modal
            title={title}
            centered={true}
            destroyOnHidden={true}
            open={open}
            onOk={handleOk}
            onCancel={onCancel}
            okText={okText}
            cancelText="Annuler"
            width={1000}
            styles={{
                body: {
                    maxHeight: modalHeight,
                    overflowY: 'auto',
                }
            }}
        >
            <div style={{ marginTop: '20px' }}>
                <Table
                    size="small"
                    pagination={false}
                    rowKey="lineId"
                    dataSource={allLines}
                    columns={columns}
                    scroll={{ y: tableHeight }}
                    rowClassName={getRowClassName}
                    footer={() => (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                            <span>{selectedCount} ligne(s) sélectionnée(s)</span>
                            <span>Total HT : {formatCurrency(grandTotal)}</span>
                        </div>
                    )}

                />
            </div>
        </Modal>
    );
}
