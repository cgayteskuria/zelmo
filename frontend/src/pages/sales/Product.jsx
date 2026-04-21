import { useEffect, useState, useMemo } from "react";
import CustomInputNumber from "../../components/common/CustomInputNumber";
import { Drawer, Form, Input, Button, Row, Col, Switch, Popconfirm, Tabs, Spin, Statistic, Card, Table, Space, Select } from "antd";
import { message } from '../../utils/antdStatic';
import { DeleteOutlined, SaveOutlined, PlusOutlined, ToolOutlined } from "@ant-design/icons";
import { productsApi } from "../../services/api";
import TaxSelect from "../../components/select/TaxSelect";
import AccountSelect from "../../components/select/AccountSelect";
import { useEntityForm } from "../../hooks/useEntityForm";
import RichTextEditor from "../../components/common/RichTextEditor";

export default function Product({ productId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();
    const [activeTab, setActiveTab] = useState('general');
    const [stockData, setStockData] = useState({
        total_physical: 0,
        total_virtual: 0,
        total_pending_delivery: 0,
        total_pending_reception: 0
    });
    const [warehouseStocks, setWarehouseStocks] = useState([]);
    const [loadingStock, setLoadingStock] = useState(false);

    const pageLabel = Form.useWatch('prt_label', form);
    const isPurchasable = Form.useWatch('prt_is_purchasable', form);
    const isSellable = Form.useWatch('prt_is_sellable', form);
    const prtType = Form.useWatch('prt_type', form);
    const prtStockable = Form.useWatch('prt_stockable', form);

    useEffect(() => {
        if (productId && open && prtStockable) {
            loadStockData();
        }
    }, [productId, open, prtStockable]);

    const loadStockData = async () => {
        if (!productId || !prtStockable) return;

        setLoadingStock(true);
        try {
            const response = await productsApi.getStockData(productId);
            if (response?.data) {
                setStockData({
                    total_physical: response.data.stock_total || 0,
                    total_virtual: response.data.stock_virtuel_total || 0,
                    total_pending_delivery: response.data.total_a_livrer || 0,
                    total_pending_reception: response.data.total_a_recevoir || 0
                });

                setWarehouseStocks(response.data.warehouse_stocks || []);
            }
        } catch (error) {
            console.error("Erreur lors du chargement des données de stock:", error);
            message.error("Impossible de charger les données de stock");
        } finally {
            setLoadingStock(false);
        }
    };

    const { submit, remove, loading, entity } = useEntityForm({
        api: productsApi,
        entityId: productId,
        idField: 'prt_id',
        form,
        open,

        onSuccess: ({ action, data }, closeDrawer = true) => {
            onSubmit?.({ action, data });
            if (closeDrawer) onClose?.();
        },

        onDelete: ({ id }) => {
            onSubmit?.({ action: 'delete', id });
            onClose?.();
        },
    });

    const handleFormSubmit = async (values) => {
        try {
            await submit(values);
            form.resetFields();
        } catch (error) {
            // Ici, on gère uniquement les erreurs venant de l'API (serveur)
            console.error("Erreur API:", error);
        }
    };
    const onFinishFailed = ({ errorFields }) => {
        if (errorFields.length > 0) {
            // Récupérer le nom du premier champ en erreur
            const firstErrorField = errorFields[0].name[0];

            // Mapper les champs aux onglets
            if (['prt_ref', 'prt_label'].includes(firstErrorField)) {
                setActiveTab('general');
            } else if (['prt_pricehtcost', 'fk_tax_id_purchase'].includes(firstErrorField)) {
                setActiveTab('purchasable');
            } else if (['prt_priceunitht', 'fk_tax_id_sale', 'prt_desc', 'prt_subscription'].includes(firstErrorField)) {
                setActiveTab('sellable');
            } else if (['fk_acc_id_sale', 'fk_acc_id_purchase'].includes(firstErrorField)) {
                setActiveTab('account');
            } else if (['prt_stock_alert_threshold'].includes(firstErrorField)) {
                setActiveTab('stock');
            }

            message.error("Veuillez remplir tous les champs obligatoires");
        }
    };
    const handleDelete = async () => {
        await remove();
    };

    const handleDuplicate = async () => {
        try {
            const values = form.getFieldsValue();
            const duplicatedValues = {
                ...values,
                prt_id: undefined,
                prt_label: `${values.prt_label}-copy`,
                prt_ref: `${values.prt_ref}-copy`,
            };

            const result = await submit(duplicatedValues, { closeDrawer: false });
            form.setFieldsValue(result.data);
        } catch (error) {
            console.error(error);
            message.error("Erreur lors de la duplication");
        }
    };


    const getVirtualStockColor = (value, physicalStock) => {
        if (value < 0) return '#ff4d4f';
        if (value > physicalStock) return '#52c41a';
        return '#1890ff';
    };

    const stockColumns = [
        { title: 'Entrepôt', dataIndex: 'whs_label', key: 'whs_label', },
        {
            title: 'Stock phy.', dataIndex: 'psk_qty_physical', key: 'psk_qty_physical', width: 110, align: 'right',
            render: (value) => (
                <span style={{ color: '#1890ff', fontWeight: 500 }}>
                    {new Intl.NumberFormat('fr-FR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    }).format(value || 0)}
                </span>
            ),
        },
        {
            title: 'À livrer', dataIndex: 'qty_pending_delivery', key: 'qty_pending_delivery', width: 110, align: 'right',
            render: (value) => (
                <span style={{ color: '#fa8c16' }}>
                    {new Intl.NumberFormat('fr-FR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    }).format(value || 0)}
                </span>
            ),
        },
        {
            title: 'À recevoir', dataIndex: 'qty_pending_reception', key: 'qty_pending_reception', width: 110, align: 'right',
            render: (value) => (
                <span style={{ color: '#52c41a' }}>
                    {new Intl.NumberFormat('fr-FR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    }).format(value || 0)}
                </span>
            ),
        },
        {
            title: 'Stock virtuel', dataIndex: 'psk_qty_virtual', key: 'psk_qty_virtual', width: 110, align: 'right',
            render: (value, record) => (
                <span style={{
                    color: getVirtualStockColor(value, record.psk_qty_physical),
                    fontWeight: 600
                }}>
                    {new Intl.NumberFormat('fr-FR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    }).format(value || 0)}
                </span>
            ),
        },
        { title: 'Dernier mvt', dataIndex: 'last_movement', key: 'last_movement', align: "center", width: 160, render: (value) => value || '', },
    ];

    const tabItems = useMemo(() => {
        const items = [
            {
                key: 'general',
                label: 'Général',
                forceRender: true,
                children: (
                    <div className="box">
                        <Row gutter={[16, 8]}>
                            <Col span={3}>
                                <Form.Item name="prt_is_active" label="Actif" valuePropName="checked" initialValue={true}>
                                    <Switch />
                                </Form.Item>
                            </Col>
                            <Col span={3}>
                                <Form.Item name="prt_is_purchasable" label="Achat" valuePropName="checked" initialValue={false}>
                                    <Switch />
                                </Form.Item>
                            </Col>
                            <Col span={3}>
                                <Form.Item name="prt_is_sellable" label="Vente" valuePropName="checked" initialValue={false}>
                                    <Switch />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="prt_type"
                                    label="Type"
                                    rules={[{ required: true, message: "Type requis" }]}

                                >
                                    <Select
                                        placeholder="Sélectionnez un type"
                                        disabled={productId}
                                        onChange={(val) => {
                                            if (val === 'service') form.setFieldValue('prt_stockable', false);
                                        }}
                                        options={[
                                            { value: 'conso', label: 'Consommation / Bien' },
                                            { value: 'service', label: 'Service / Prestation' },
                                        ]}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]}>
                            <Col span={8}>
                                <Form.Item name="prt_ref" label="Ref" rules={[{ required: true, message: "Réf requis" }]}>
                                    <Input placeholder="Référence" />
                                </Form.Item>
                            </Col>
                            <Col span={16}>
                                <Form.Item name="prt_label" label="Libelle" rules={[{ required: true, message: "Libelle requis" }]}>
                                    <Input placeholder="Libelle" />
                                </Form.Item>
                            </Col>
                        </Row>
                        {prtType === 'conso' && (
                            < Row gutter={[16, 8]}>
                                <Col span={16}>
                                    <Form.Item name="prt_stockable" label="Gérer le stock" >
                                        <Switch />
                                    </Form.Item>
                                </Col>
                            </Row>
                        )}

                    </div >
                )
            }
        ];

        if (isPurchasable) {
            items.push({
                key: 'purchasable',
                label: 'Achat',
                forceRender: true,
                children: (
                    <div className="box">
                        <Row gutter={[16, 8]}>
                            <Col span={8}>
                                <Form.Item name="prt_pricehtcost" label="Prix d'achat Unit.HT" rules={[{ required: true, message: " Prix d'achat requis" }]}>
                                    <CustomInputNumber />
                                </Form.Item>
                            </Col>
                            <Col span={16}>
                                <Form.Item
                                    name="fk_tax_id_purchase"
                                    label="TVA sur achat"
                                    rules={[{ required: true, message: "Tva Achat requis" }]}
                                >
                                    <TaxSelect
                                        filters={{ tax_use: 'purchase', tax_is_active: 1, ...(prtType ? { tax_scope: prtType } : {}) }} />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                )
            });
        }

        if (isSellable) {
            items.push({
                key: 'sellable',
                label: 'Vente',
                forceRender: true,
                children: (
                    <div className="box">
                        <Row gutter={[16, 8]}>
                            <Col span={8}>
                                <Form.Item
                                    name="prt_priceunitht" label="Prix de vente Unit.HT" rules={[{ required: true, message: "Prix de vente requis" }]}
                                >
                                    <CustomInputNumber />
                                </Form.Item>
                            </Col>
                            <Col span={16}>
                                <Form.Item
                                    name="fk_tax_id_sale"
                                    label="TVA sur vente"
                                    rules={[{ required: true, message: "Tva vente requis" }]}
                                >
                                    <TaxSelect filters={{ tax_use: 'sale', tax_is_active: 1, ...(prtType ? { tax_scope: prtType } : {}) }} />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item name="prt_desc" label="Description">
                                    <RichTextEditor
                                        height={200}
                                        placeholder="Saisir la description..."
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="prt_subscription" label="Vente par abonnement" valuePropName="checked" initialValue={false}
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                )
            });
        }

        if (isPurchasable || isSellable) {
            items.push({
                key: 'account',
                label: 'Comptabilité',
                forceRender: true,
                children: (
                    <div className="box">
                        <Row gutter={[16, 8]}>

                            <Col span={12}>
                                <Form.Item
                                    name="fk_acc_id_purchase" label="Compte achat"
                                >
                                    <AccountSelect
                                        filters={{ type: ['expense', 'expense_direct_cost'], isActive: true }}
                                        loadInitially={!productId ? true : false}
                                        initialData={entity?.account_purchase}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="fk_acc_id_sale" label="Compte vente" 
                                >
                                    <AccountSelect
                                        filters={{ type: ['income'], isActive: true }}
                                        loadInitially={!productId ? true : false}
                                        initialData={entity?.account_sale}

                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                )
            });
        }

        if (prtStockable) {
            items.push({
                key: 'stock',
                label: 'Stock',
                forceRender: true,
                children: (
                    <Spin spinning={loadingStock}>
                        <div>
                            {productId && (
                                <Row gutter={16} style={{ marginBottom: 24 }}>
                                    <Col span={6}>
                                        <Card size='small'>
                                            <Statistic
                                                title="Stock physique"
                                                value={stockData.total_physical}
                                                precision={2}
                                                styles={{
                                                    content:
                                                        { color: '#1890ff', fontSize: 24 }
                                                }}
                                            />
                                        </Card>
                                    </Col>
                                    <Col span={6}>
                                        <Card size='small'>
                                            <Statistic
                                                title="À livrer"
                                                value={stockData.total_pending_delivery}
                                                precision={2}
                                                styles={{
                                                    content:
                                                        { color: '#fa8c16', fontSize: 24 }
                                                }}
                                            />
                                        </Card>
                                    </Col>
                                    <Col span={6}>
                                        <Card size='small'>
                                            <Statistic
                                                title="À recevoir"
                                                value={stockData.total_pending_reception}
                                                precision={2}
                                                styles={{
                                                    content:
                                                        { color: '#52c41a', fontSize: 24 }
                                                }}
                                            />
                                        </Card>
                                    </Col>
                                    <Col span={6}>
                                        <Card size='small'>
                                            <Statistic
                                                title="Stock virtuel"
                                                value={stockData.total_virtual}
                                                precision={2}

                                                styles={{
                                                    content:
                                                    {
                                                        color: getVirtualStockColor(stockData.total_virtual, stockData.total_physical),
                                                        fontSize: 24,
                                                        fontWeight: 600,
                                                        width: 150
                                                    }
                                                }}
                                            />
                                        </Card>
                                    </Col>
                                </Row>
                            )}

                            <div className="box" style={{ padding: 16 }}>
                                <Row gutter={[16, 8]}>
                                    <Col span={8}>
                                        <Form.Item
                                            name="prt_stock_alert_threshold"
                                            label="Seuil alerte Limite stock"
                                            tooltip="Quantité minimale avant déclenchement d'une alerte"
                                        >
                                            <CustomInputNumber
                                                placeholder="Aucune alerte"
                                                min={0}
                                                step={0.01}
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </div>

                            {productId && (
                                <div style={{ marginTop: 24 }}>
                                    <Table
                                        columns={stockColumns}
                                        dataSource={warehouseStocks}
                                        rowKey="psk_id"
                                        pagination={false}
                                        size="middle"
                                        bordered
                                        loading={loadingStock}
                                        scroll={{ x: 'max-content' }}
                                        locale={{
                                            emptyText: 'Aucun stock disponible'
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </Spin>
                )
            });
        }
        return items;
    }, [isPurchasable, isSellable, prtStockable, prtType, productId, stockData, warehouseStocks, loadingStock]);

    const handleClose = () => {
        form.resetFields();
        setActiveTab('general');
        setStockData({
            total_physical: 0,
            total_virtual: 0,
            total_pending_delivery: 0,
            total_pending_reception: 0
        });
        setWarehouseStocks([]);
        if (onClose) {
            onClose();
        }
    };

    const drawerActions = (
        <Space style={{ width: "100%", display: "flex", paddingRight: "15px", justifyContent: "flex-end" }}>
            {productId && (
                <>
                    <Button
                        type="secondary"
                        style={{ marginLeft: 8 }}
                        icon={<PlusOutlined />}
                        onClick={handleDuplicate}
                    >
                        Dupliquer
                    </Button>
                    <div style={{ flex: 1 }}></div>
                    <Popconfirm
                        title="Supprimer ce produit"
                        description="Êtes-vous sûr de vouloir supprimer ce produit ?"
                        onConfirm={handleDelete}
                        okText="Oui"
                        cancelText="Non"
                    >
                        <Button danger icon={<DeleteOutlined />}>
                            Supprimer
                        </Button>
                    </Popconfirm>
                </>
            )}

            <Button onClick={handleClose}>Annuler</Button>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}
                onClick={() => form.submit()}>
                Enregistrer
            </Button>
        </Space>
    );

    return (
        <Drawer
            title={pageLabel ? `Édition - ${pageLabel}` : "Nouveau"}
            placement="right"
            onClose={handleClose}
            open={open}
            size={drawerSize}
            footer={drawerActions}
            forceRender
        >
            <Spin spinning={loading} tip="Chargement...">
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFormSubmit}
                    onFinishFailed={onFinishFailed} //
                    scrollToFirstError={{
                        behavior: 'smooth',
                        block: 'center'
                    }}

                >
                    <Form.Item name="prt_id" hidden>
                        <Input />
                    </Form.Item>

                    <Tabs
                        activeKey={activeTab}
                        onChange={setActiveTab}
                        items={tabItems}
                    />
                </Form>
            </Spin>
        </Drawer>
    );
}