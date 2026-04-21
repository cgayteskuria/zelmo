import { useState } from "react";
import { Drawer, Form, Input, Button, Row, Col, DatePicker, InputNumber, Space } from "antd";
import { message } from '../../utils/antdStatic';
import { SaveOutlined, SwapOutlined } from "@ant-design/icons";
import ProductSelect from "../../components/select/ProductSelect";
import WarehouseSelect from "../../components/select/WarehouseSelect";
import { stockMovementsApi } from "../../services/api";
import dayjs from 'dayjs';

/**
 * Drawer de transfert inter-entrepôts
 */
export default function StockTransfer({ open, onClose, onSubmit }) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (values) => {
        setLoading(true);
        try {
            const submitData = {
                ...values,
                stm_date: values.stm_date ? values.stm_date.format('YYYY-MM-DD') : null,
            };
            await stockMovementsApi.transfer(submitData);
            message.success("Transfert inter-entrepôts créé avec succès");
            form.resetFields();
            onSubmit?.();
            onClose?.();
        } catch (error) {
            message.error(error.response?.data?.message || "Erreur lors du transfert");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Drawer
            title="Transfert inter-entrepôts"
            open={open}
            onClose={onClose}
            width={600}
            destroyOnHidden
            footer={
                <Space style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
                    <Button onClick={onClose}>Annuler</Button>
                    <Button
                        type="primary"
                        icon={<SwapOutlined />}
                        onClick={() => form.submit()}
                        loading={loading}
                    >
                        Transférer
                    </Button>
                </Space>
            }
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={{
                    stm_date: dayjs(),
                }}
            >
                <Row gutter={16}>
                    <Col span={24}>
                        <Form.Item
                            name="fk_prt_id"
                            label="Produit"
                            rules={[{ required: true, message: "Le produit est obligatoire" }]}
                        >
                            <ProductSelect filters={{ prt_type: 'conso' }} />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name="fk_whs_id"
                            label="Entrepôt source"
                            rules={[{ required: true, message: "L'entrepôt source est obligatoire" }]}
                        >
                            <WarehouseSelect />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="fk_whs_dest_id"
                            label="Entrepôt destination"
                            rules={[{ required: true, message: "L'entrepôt destination est obligatoire" }]}
                        >
                            <WarehouseSelect />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item
                            name="stm_qty"
                            label="Quantité"
                            rules={[{ required: true, message: "La quantité est obligatoire" }]}
                        >
                            <InputNumber style={{ width: '100%' }} min={0.01} step={1} decimalSeparator="," />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item
                            name="stm_date"
                            label="Date"
                            rules={[{ required: true, message: "La date est obligatoire" }]}
                        >
                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="stm_lot_number" label="N° de lot">
                            <Input maxLength={100} />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={24}>
                        <Form.Item
                            name="stm_label"
                            label="Libellé"
                            rules={[{ required: true, message: "Le libellé est obligatoire" }]}
                        >
                            <Input maxLength={255} placeholder="Ex: Transfert de stock" />
                        </Form.Item>
                    </Col>
                </Row>
            </Form>
        </Drawer>
    );
}
