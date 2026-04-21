import { useState, useEffect, useCallback, useRef } from "react";
import { Drawer, Form, Input, InputNumber, Button, Switch, DatePicker, Space, Spin, Statistic, Card, Alert, App,  Divider } from "antd";
import { SaveOutlined, CarOutlined, InfoCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import VehicleSelect from "../select/VehicleSelect";
import { mileageCalculatePreview } from "../../services/api";

const { TextArea } = Input;

export default function MileageExpenseFormDrawerMobile({
    open,
    onClose,
    expenseReportId,
    mileageExpenseId = null,
    disabled = false,
    onSuccess,
    periodFrom,
    periodTo,
    mileageExpensesApi,
    userId = null,
}) {
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [preview, setPreview] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState(null);
    const [dateOutOfPeriod, setDateOutOfPeriod] = useState(false);
    const debounceRef = useRef(null);

    const isNew = !mileageExpenseId;

    // Vérifier si la date est dans la période
    const checkDateInPeriod = useCallback((date) => {
        if (!date || (!periodFrom && !periodTo)) {
            setDateOutOfPeriod(false);
            return;
        }
        const isOutside = (periodFrom && date.isBefore(periodFrom, 'day')) ||
            (periodTo && date.isAfter(periodTo, 'day'));
        setDateOutOfPeriod(isOutside);
    }, [periodFrom, periodTo]);

    useEffect(() => {
        if (open && mileageExpenseId && mileageExpensesApi) {
            loadExpense();
        } else if (open && isNew) {
            form.resetFields();
            form.setFieldsValue({
                mex_is_round_trip: false,
                mex_date: periodFrom ? dayjs(periodFrom) : dayjs(),
            });
            setPreview(null);
        }
    }, [open, mileageExpenseId]);

    const loadExpense = async () => {
        setLoading(true);
        try {
            const response = await mileageExpensesApi.get(mileageExpenseId);
            const data = response.data;
            form.setFieldsValue({
                fk_vhc_id: data.fk_vhc_id,
                mex_date: data.mex_date ? dayjs(data.mex_date) : null,
                mex_departure: data.mex_departure,
                mex_destination: data.mex_destination,
                mex_distance_km: data.mex_distance_km,
                mex_is_round_trip: data.mex_is_round_trip,
                mex_notes: data.mex_notes,
            });
            setPreview({
                effective_distance: data.mex_is_round_trip ? data.mex_distance_km * 2 : data.mex_distance_km,
                rate_coefficient: data.mex_rate_coefficient,
                rate_constant: data.mex_rate_constant,
                calculated_amount: data.mex_calculated_amount,
            });
        } catch (error) {
            message.error("Erreur lors du chargement");
        } finally {
            setLoading(false);
        }
    };

    const fetchPreview = useCallback(async () => {
        const values = form.getFieldsValue();
        const { fk_vhc_id, mex_distance_km, mex_is_round_trip, mex_date } = values;

        if (!fk_vhc_id || !mex_distance_km || mex_distance_km <= 0) {
            setPreview(null);
            setPreviewError(null);
            return;
        }

        setPreviewLoading(true);
        try {
            const response = await mileageCalculatePreview({
                fk_vhc_id,
                mex_distance_km,
                mex_is_round_trip: mex_is_round_trip || false,
                mex_date: mex_date ? mex_date.format("YYYY-MM-DD") : null,
                mex_id: mileageExpenseId || undefined,

            });
            // Vérifier si la réponse indique un échec
            if (response.success === false) {
                setPreview(null);
                setPreviewError(response.message);
            } else {
                setPreview(response.data);
                setPreviewError(null);
            }
        } catch (error) {
            setPreview(null);
            setPreviewError(error.message || "Erreur lors du calcul");
        } finally {
            setPreviewLoading(false);
        }
    }, [form, mileageExpenseId]);

    const triggerPreview = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(fetchPreview, 400);
    }, [fetchPreview]);

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    const handleSave = async (values) => {
        if (!mileageExpensesApi) return;
        setSaving(true);
        try {
            const data = {
                ...values,
                mex_date: values.mex_date ? values.mex_date.format("YYYY-MM-DD") : null,
                mex_is_round_trip: values.mex_is_round_trip || false,
            };

            if (isNew) {
                await mileageExpensesApi.create(data);
                message.success("Frais kilometrique cree");
            } else {
                await mileageExpensesApi.update(mileageExpenseId, data);
                message.success("Frais kilometrique mis a jour");
            }

            onSuccess?.();
            onClose?.();
        } catch (error) {
            message.error(error.data?.message || "Erreur lors de la sauvegarde");
        } finally {
            setSaving(false);
        }
    };

    const drawerActions = (
        <Space style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={onClose}>Annuler</Button>
            {!disabled && (
                <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={saving}
                    onClick={() => form.submit()}
                    size="large"
                >
                    {isNew ? "Creer" : "Enregistrer"}
                </Button>
            )}
        </Space>
    );

    return (
        <Drawer
            title={isNew ? "Frais kilometrique" : "Modifier frais km"}
            placement="bottom"
            onClose={onClose}
            open={open}
            styles={{
                wrapper: { height: '100vh' },
                body: { padding: '12px' },
            }}
            footer={drawerActions}
            destroyOnHidden
        >
            <Spin spinning={loading} tip="Chargement...">
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSave}
                    disabled={disabled}
                    size="large"
                >
                    <Form.Item
                        name="fk_vhc_id"
                        label="Vehicule"
                        rules={[{ required: true, message: "Obligatoire" }]}
                    >
                        <VehicleSelect
                            userId={userId}
                            selectDefault={isNew}
                            onDefaultSelected={(id) => {
                                form.setFieldValue('fk_vhc_id', id);
                                triggerPreview();
                            }}
                            onChange={triggerPreview}
                        />
                    </Form.Item>

                    <Form.Item
                        name="mex_date"
                        label="Date"
                        rules={[{ required: true, message: "Obligatoire" }]}
                        help={dateOutOfPeriod && (
                            <span style={{ color: '#faad14' }}>
                                Date hors période de la note de frais
                            </span>
                        )}
                    >
                        <DatePicker
                            format="DD/MM/YYYY"
                            style={{ width: "100%" }}
                            status={dateOutOfPeriod ? 'warning' : undefined}
                            onChange={(date) => {
                                checkDateInPeriod(date);
                                triggerPreview();
                            }}
                        />
                    </Form.Item>

                    <Form.Item
                        name="mex_departure"
                        label="Depart"
                        rules={[{ required: true, message: "Obligatoire" }]}
                    >
                        <Input placeholder="Lieu de depart" />
                    </Form.Item>

                    <Form.Item
                        name="mex_destination"
                        label="Destination"
                        rules={[{ required: true, message: "Obligatoire" }]}
                    >
                        <Input placeholder="Destination" />
                    </Form.Item>

                    <Space style={{ width: "100%" }} size="large" align="start">
                        <Form.Item
                            name="mex_distance_km"
                            label="Distance (km)"
                            rules={[
                                { required: true, message: "Obligatoire" },
                                { type: "number", min: 0.1, message: "Min 0.1" },
                            ]}
                        >
                            <InputNumber
                                inputMode='decimal'
                                style={{ width: 160 }}
                                precision={1}
                                min={0.1}
                                placeholder="10"
                                suffix="km"
                                onChange={triggerPreview}
                            />
                        </Form.Item>

                        <Form.Item
                            name="mex_is_round_trip"
                            label="Aller-retour"
                            valuePropName="checked"
                        >
                            <Switch
                                checkedChildren="A/R"
                                unCheckedChildren="Aller"
                                onChange={triggerPreview}
                            />
                        </Form.Item>
                    </Space>

                    <Form.Item name="mex_notes" label="Notes">
                        <TextArea rows={2} placeholder="Notes..." />
                    </Form.Item>

                    {/* Previsualisation */}
                    <Card
                        size="small"
                        title={<Space><CarOutlined /><span>Remboursement</span></Space>}
                    >
                        <Spin spinning={previewLoading} size="small">
                            {previewError ? (
                                <Alert
                                    type="error"
                                    showIcon
                                    message={previewError}
                                />
                            ) : preview ? (
                                <>
                                    {/* Montant principal */}
                                    <div style={{ textAlign: "center", marginBottom: 16 }}>
                                        <Statistic
                                            value={preview.amount_to_reimburse || preview.calculated_amount}
                                            suffix="€"
                                            precision={2}
                                            valueStyle={{
                                                fontSize: 28,
                                                fontWeight: "bold",
                                                color: "#52c41a"
                                            }}
                                        />
                                        <div style={{ marginTop: 4, color: "#999", fontSize: 12 }}>
                                            Distance effective : {preview.effective_distance} km
                                        </div>
                                    </div>

                                    {/* Détails de régularisation */}
                                    {preview.previous_annual_km !== undefined && (
                                        <>
                                            <Divider style={{ margin: '12px 0' }} />
                                            <Alert
                                                type="info"
                                                showIcon
                                                icon={<InfoCircleOutlined />}
                                                message="Régularisation"
                                                description={
                                                    <div style={{ fontSize: 12 }}>
                                                        <div style={{ marginBottom: 4 }}>
                                                            <strong>Km annuel :</strong> {preview.previous_annual_km?.toLocaleString('fr-FR')} → {preview.new_annual_total_km?.toLocaleString('fr-FR')} km
                                                        </div>
                                                        <div style={{ marginBottom: 4 }}>
                                                            <strong>Déjà remboursé :</strong> {preview.already_paid?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                                        </div>
                                                        <div style={{ marginBottom: 4 }}>
                                                            <strong>Total dû :</strong> {preview.total_due?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                                        </div>
                                                        {preview.rate_label && (
                                                            <div style={{ marginTop: 8, fontSize: 11, color: '#666' }}>
                                                                Barème : {preview.rate_label}
                                                            </div>
                                                        )}
                                                    </div>
                                                }
                                            />
                                        </>
                                    )}

                                    {/* Barème simple si pas de détails */}
                                    {preview.previous_annual_km === undefined && (
                                        <div style={{ marginTop: 8, textAlign: "center", color: "#666", fontSize: 12 }}>
                                            {preview.effective_distance} km × {preview.rate_coefficient}
                                            {preview.rate_constant > 0 && ` + ${preview.rate_constant}`}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <Alert
                                    type="info"
                                    showIcon
                                    message="Selectionnez un vehicule et la distance"
                                />
                            )}
                        </Spin>
                    </Card>
                </Form>
            </Spin>
        </Drawer>
    );
}
