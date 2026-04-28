import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Modal, Form, Input, InputNumber, Checkbox, Row, Col, App, Radio } from "antd";
import { productsApi, taxsApi } from "../../services/api";
import TaxSelect from "../select/TaxSelect";
import ProductSelect from "../select/ProductSelect";
import RichTextEditor from "../common/RichTextEditor";
import { useAuth } from "../../contexts/AuthContext";

/**
 * Modal générique d'édition/création d'une ligne de document
 * Réutilisable pour SaleOrder, PurchaseOrder, Invoice, Contract
 *
 * @param {object} props
 * @param {boolean} props.open - Modal ouvert/fermé
 * @param {function} props.onClose - Callback fermeture
 * @param {function} props.onSave - Callback sauvegarde
 * @param {object} props.lineData - Données de la ligne à éditer (null pour création)
 * @param {number} props.parentId - ID du document parent
 * @param {object} props.config - Configuration du module (depuis saleOrderConfig, purchaseOrderConfig, etc.)
 */
export default function BizDocumentLineModal({ open, onClose, onSave, lineData, parentId, config }) {
    const [form] = Form.useForm();
    const { message } = App.useApp();
    const { acoVatRegime } = useAuth();
    const [loading, setLoading] = useState(false);
    const [lineType, setLineType] = useState();
    const [selectedPrtType, setSelectedPrtType] = useState(null);

    const taxFilters = useMemo(() => {
        // Log interne pour vérifier quand le calcul se déclenche     

        const baseFilters = {
            ...config.taxType,
            fk_tap_id: config.fkTapId,
            tax_is_active: 1,
        };

        if (selectedPrtType === 'conso') {
            return { ...baseFilters, tax_scope: 'conso', tax_exigibility: 'on_invoice' };
        }

        if (selectedPrtType === 'service' || selectedPrtType === 'all') {
            return {
                ...baseFilters,
                tax_scope: selectedPrtType === 'all' ? undefined : 'service',
                tax_exigibility: acoVatRegime === 'encaissements' ? 'on_payment' : 'on_invoice'
            };
        }

        return baseFilters;
    }, [config.taxType, config.fkTapId, selectedPrtType, acoVatRegime]);

    const [totals, setTotals] = useState({
        totalHT: 0,
        totalTVA: 0,
        totalTTC: 0,
        margeTotal: 0,
        margePercent: 0,
    });

    // Taux effectif calculé depuis les TRL (non réactif → ref pour éviter les stale closures)
    const taxRateRef = useRef(0);

    // Calculer les totaux (utilise taxRateRef pour le taux TVA effectif)
    const calculateTotals = useCallback(() => {
        const values = form.getFieldsValue();
        const qty = parseFloat(values.qty) || 0;
        const priceUnitHt = parseFloat(values.priceUnitHt) || 0;
        const discount = parseFloat(values.discount) || 0;

        let totalHT = qty * priceUnitHt;
        totalHT -= (discount / 100) * totalHT;

        const totalTVA = totalHT * taxRateRef.current / 100;
        const totalTTC = totalHT + totalTVA;

        let margeTotal = 0;
        let margePercent = 0;
        if (config.features.showPurchasePrice) {
            const purchasePriceUnitHt = parseFloat(values.purchasePriceUnitHt) || 0;
            const totalPurchase = qty * purchasePriceUnitHt;
            margeTotal = totalHT - totalPurchase;
            margePercent = totalPurchase > 0 ? (margeTotal / totalPurchase) * 100 : 0;
        }

        setTotals({ totalHT, totalTVA, totalTTC, margeTotal, margePercent });
        form.setFieldValue('mtht', totalHT);
    }, [form, config.features.showPurchasePrice]);

    // Résoudre le taux effectif depuis les TRL, puis recalculer
    const fetchEffectiveTaxRate = useCallback(async (taxId) => {
        if (!taxId) {
            taxRateRef.current = 0;
            calculateTotals();
            return;
        }
        try {
            const res = await taxsApi.getRepartitionLines(taxId);          
            const rate = parseFloat(res.tax_rate) ?? 0;
            const docType = config.taxType?.tax_use === 'purchase' ? 'in_invoice' : 'out_invoice';
            const trlLines = (res.data ?? []).filter(l =>
                l.trl_repartition_type === 'tax' && l.trl_document_type === docType
            );
           
            if (trlLines.length > 0) {
                const netFactor = trlLines.reduce((sum, l) => sum + parseFloat(l.trl_factor_percent ?? 100), 0);
                taxRateRef.current = rate * netFactor / 100;
            } else {
                taxRateRef.current = rate;
            }
        } catch {
            taxRateRef.current = 0;
        }
        calculateTotals();
    }, [calculateTotals, config.taxType?.tax_use]);

    // Initialiser le formulaire avec les données de la ligne quand le modal s'ouvre
    useEffect(() => {
        if (!open) return;
        //Vide le contenu en cache
        form.resetFields();

        const currentLineType = lineData?.lineType;
        setLineType(currentLineType);

        form.setFieldsValue({
            qty: 1,
            priceUnitHt: 0,
            discount: 0,
            mtht: 0,
            ...lineData,
        });

        // Charger le prt_type du produit existant pour filtrer la TVA
        if (lineData?.fk_prt_id) {
            productsApi.get(lineData.fk_prt_id)
                .then(res => setSelectedPrtType(res.data?.prt_type ?? null))
                .catch(() => setSelectedPrtType(null));
        } else {
            setSelectedPrtType(null);
        }

        if (currentLineType === 0 || currentLineType === undefined) {
            if (lineData?.fk_tax_id) {
                fetchEffectiveTaxRate(lineData.fk_tax_id);
            } else {
                taxRateRef.current = 0;
                calculateTotals();
            }
        }
    }, [open, lineData, form, calculateTotals, fetchEffectiveTaxRate]);


    // Charger les données du produit sélectionné
    const handleProductChange = async (productId) => {
        if (!productId) return;

        try {
            const product = await productsApi.get(productId);

            // Utiliser le bon champ de taxe selon l'usage du document
            // tax_use === 'sale'     => fk_tax_id_sale
            // tax_use === 'purchase' => fk_tax_id_purchase
            const taxFieldName = config.taxType?.tax_use === 'sale' ? 'fk_tax_id_sale' : 'fk_tax_id_purchase';

            const taxId = product.data[taxFieldName];
          
            setSelectedPrtType(product.data.prt_type ?? null);
            form.setFieldsValue({
                prtLib: product.data.prt_label,
                prtDesc: product.data.prt_desc || '',
                priceUnitHt: product.data.prt_priceunitht || 0,
                fk_tax_id: taxId,
            });

            // Champs optionnels selon les config.features
            if (config.features.showPurchasePrice) {
                form.setFieldValue('purchasePriceUnitHt', product.data.prt_pricehtcost || 0);
            }

            if (config.features.showSubscription) {
                form.setFieldValue('isSubscription', product.data.prt_is_subscription === 1);
            }

            // Résoudre le taux effectif depuis les TRL puis recalculer
            await fetchEffectiveTaxRate(taxId);
        } catch (error) {
            message.error("Erreur lors du chargement du produit");
        }
    };

    // Liste des champs qui impactent les calculs
    const calculableFields = useMemo(() => ['qty', 'priceUnitHt', 'discount', 'purchasePriceUnitHt'], []);

    // Gestionnaire optimisé pour les changements de valeurs
    const handleValuesChange = useCallback((changedValues) => {
        // Recalculer seulement si un champ impactant les calculs a changé
        const changedFieldNames = Object.keys(changedValues);
        const shouldRecalculate = changedFieldNames.some(field =>
            calculableFields.includes(field)
        );

        if (shouldRecalculate) {
            calculateTotals();
        }
    }, [calculableFields, calculateTotals]);

    const handleSave = async () => {
        try {
            await form.validateFields();
            const values = form.getFieldsValue();

            setLoading(true);

            const lineDataToSave = {
                ...values,
                parentId: parentId,
                lineType: lineType,
                lineOrder: lineData.lineOrder,
                prtType: selectedPrtType,
            };

            // Conversion des champs boolean si nécessaire
            if (config.features.showSubscription && values.isSubscription !== undefined) {
                lineDataToSave.isSubscription = values.isSubscription ? 1 : 0;
            }
            await onSave(lineDataToSave);
            onClose();
        } catch (error) {
            console.error("Erreur validation:", error);
            message.error("Erreur validation");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={lineData ? "Modifier la ligne" : "Ajouter une ligne"}
            open={open}
            onCancel={onClose}
            onOk={handleSave}
            confirmLoading={loading}
            width={800}
            okText="Enregistrer"
            cancelText="Annuler"
            centered={true}
            destroyOnHidden={true}
            zIndex={1200}
        >
            <Form
                form={form}
                layout="vertical"
                onValuesChange={handleValuesChange}
            >
                <Form.Item name="lineId" hidden>
                    <Input />
                </Form.Item>


                {(lineType === 1 || lineType === 2) ? (
                    // Ligne titre ou sous-total : seulement le libellé
                    <div className="box">
                        <Form.Item
                            label={lineType === 1 ? "Titre" : "Sous-total"}
                            name="prtLib"
                            rules={[{ required: true, message: "Description requise" }]}
                        >
                            <Input placeholder="Description" />
                        </Form.Item>
                    </div>
                ) : (
                    // Ligne normale : formulaire complet

                    <>
                        <div className="box">
                            <Form.Item
                                label="Produit"
                                name="fk_prt_id"
                                rules={[{ required: true, message: "Veuillez sélectionner un produit" }]}
                            >
                                <ProductSelect
                                    loadInitially={true}
                                    initialData={true}
                                    filters={config.productFilter}
                                    onChange={handleProductChange}
                                />
                            </Form.Item>

                            <Form.Item name="prtLib" hidden>
                                <Input />
                            </Form.Item>

                            <Form.Item
                                label="Description"
                                name="prtDesc"
                                getValueFromEvent={(content) => content}
                            >
                                <RichTextEditor
                                    height={100}
                                    placeholder="Description détaillée du produit/service"
                                />
                            </Form.Item>

                            <Row gutter={16}>
                                <Col span={6}>
                                    <Form.Item
                                        label="TVA"
                                        name="fk_tax_id"
                                        rules={[{ required: true, message: "TVA requise" }]}
                                    >
                                        <TaxSelect
                                            key={selectedPrtType ?? '__no_product__'}
                                            filters={taxFilters}
                                            loadInitially={true}
                                            onChange={(taxId) => fetchEffectiveTaxRate(taxId)}
                                        />
                                    </Form.Item>
                                </Col>

                            </Row>

                            <Row gutter={16}>
                                <Col span={6}>
                                    <Form.Item
                                        label="Quantité"
                                        name="qty"
                                        rules={[{ required: true, message: "Quantité requise" }]}
                                    >
                                        <InputNumber
                                            min={0}
                                            step={1}
                                            style={{ width: '100%' }}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={6}>
                                    <Form.Item
                                        label="Prix Unit. HT"
                                        name="priceUnitHt"
                                        rules={[{ required: true, message: "Prix requis" }]}
                                    >
                                        <InputNumber
                                            min={0}
                                            step={0.01}
                                            style={{ width: '100%' }}
                                            formatter={(value, info) => {
                                                if (info?.userTyping || value === undefined || value === null || value === '') return value;
                                                const num = parseFloat(value);
                                                if (isNaN(num)) return value;
                                                const thirdDecimal = Math.round(Math.abs(num) * 1000) % 10;
                                                return thirdDecimal !== 0 ? num.toFixed(3) : num.toFixed(2);
                                            }}
                                            parser={(value) => value?.replace(/[^\d.-]/g, '')}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={6}>
                                    <Form.Item
                                        label="Remise %"
                                        name="discount"
                                    >
                                        <InputNumber
                                            min={0}
                                            max={100}
                                            step={0.01}
                                            style={{ width: '100%' }}
                                            precision={2}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={6}>
                                    <Form.Item label="Total HT">
                                        <Input
                                            value={totals.totalHT.toFixed(2)}
                                            disabled
                                            suffix="€"
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={6}>
                                    <Form.Item label="TVA">
                                        <Input
                                            value={totals.totalTVA.toFixed(2)}
                                            disabled
                                            suffix="€"
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={6}>
                                    <Form.Item label="Total TTC">
                                        <Input
                                            value={totals.totalTTC.toFixed(2)}
                                            disabled
                                            suffix="€"
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                            {/* Abonnement (si feature activée) */}
                            {config.features.showSubscription && (
                                <Form.Item name="isSubscription" valuePropName="checked">
                                    <Checkbox>Abonnement</Checkbox>
                                </Form.Item>
                            )}
                        </div>
                        {/* Marge */}
                        {config.features.showPurchasePrice && (
                            <div style={{
                                background: '#f5f5f5',
                                padding: '16px',
                                borderRadius: '8px',
                                marginTop: '16px'
                            }}>
                                <h4 style={{ marginBottom: '12px' }}>Marge</h4>

                                <Row gutter={16}>

                                    <Col span={8}>
                                        <Form.Item
                                            label="Prix Revient Unit. HT"
                                            name="purchasePriceUnitHt"
                                        >
                                            <InputNumber
                                                min={0}
                                                step={0.01}
                                                style={{ width: '100%' }}
                                                precision={2}
                                            />
                                        </Form.Item>
                                    </Col>

                                    <Col span={8}>
                                        <Form.Item label="Total Marge">
                                            <Input
                                                value={totals.margeTotal.toFixed(2)}
                                                disabled
                                                suffix="€"
                                                style={{
                                                    color: totals.margeTotal >= 0 ? '#52c41a' : '#ff4d4f',
                                                    fontWeight: 'bold'
                                                }}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item label="% Marge">
                                            <Input
                                                value={totals.margePercent.toFixed(2)}
                                                disabled
                                                suffix="%"
                                                style={{
                                                    color: totals.margePercent >= 40 ? '#52c41a' :
                                                        totals.margePercent >= 20 ? '#faad14' : '#ff4d4f',
                                                    fontWeight: 'bold'
                                                }}
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </div>
                        )}
                    </>
                )}
            </Form>
        </Modal>
    );
}
