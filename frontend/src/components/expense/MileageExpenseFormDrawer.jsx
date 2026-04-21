import { useState, useEffect, useCallback, useRef } from "react";
import { Drawer, Form, Input, InputNumber, Button, Row, Col, Switch, DatePicker, Space, Spin, Statistic, Card, Alert, App, Descriptions, Divider } from "antd";
import { SaveOutlined, CarOutlined, InfoCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import VehicleSelect from "../select/VehicleSelect";
import { mileageCalculatePreview } from "../../services/api";

const { TextArea } = Input;

export default function MileageExpenseFormDrawer({
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

    // Charger les donnees en mode edition
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
                fiscal_power: data.mex_fiscal_power,
            });
        } catch (error) {
            message.error("Erreur lors du chargement du frais kilometrique");
        } finally {
            setLoading(false);
        }
    };

    // Calculer la previsualisation
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

    // Debounce la previsualisation
    const triggerPreview = useCallback(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(fetchPreview, 400);
    }, [fetchPreview]);

    // Nettoyage du debounce
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
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
        <Space style={{ width: "100%", display: "flex", paddingRight: "15px", justifyContent: "flex-end" }}>
            <Button onClick={onClose}>Annuler</Button>
            {!disabled && (
                <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={saving}
                    onClick={() => form.submit()}
                    disabled={!!previewError}
                >
                    {isNew ? "Creer" : "Enregistrer"}
                </Button>
            )}
        </Space>
    );

    return (
        <Drawer
            title={isNew ? "Nouveau frais kilometrique" : "Modifier le frais kilometrique"}
            placement="right"
            onClose={onClose}
            open={open}
            styles={{
                wrapper: { width: 760 },
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
                >
                    <Row gutter={16}>
                        <Col span={16}>
                            <Form.Item
                                name="fk_vhc_id"
                                label="Vehicule"
                                rules={[{ required: true, message: "Le vehicule est obligatoire" }]}
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
                        </Col>
                        <Col span={8}>
                            <Form.Item
                                name="mex_date"
                                label="Date"
                                rules={[{ required: true, message: "La date est obligatoire" }]}
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
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item
                                name="mex_departure"
                                label="Depart"
                                rules={[{ required: true, message: "Le lieu de depart est obligatoire" }]}
                            >
                                <Input placeholder="Ex: Siege social" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item
                                name="mex_destination"
                                label="Destination"
                                rules={[{ required: true, message: "La destination est obligatoire" }]}
                            >
                                <Input placeholder="Ex: Client ABC, Paris" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="mex_distance_km"
                                label="Distance (km)"
                                rules={[
                                    { required: true, message: "La distance est obligatoire" },
                                    { type: "number", min: 0.1, message: "La distance doit etre superieure a 0" },
                                ]}
                            >
                                <InputNumber
                                    inputMode='decimal'
                                    style={{ width: "100%" }}
                                    precision={1}
                                    min={0.1}
                                    placeholder="Ex: 1"
                                    suffix="km"
                                    onChange={triggerPreview}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="mex_is_round_trip"
                                label="Aller-retour"
                                valuePropName="checked"
                            >
                                <Switch
                                    checkedChildren="A/R"
                                    unCheckedChildren="Aller simple"
                                    onChange={triggerPreview}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="mex_notes" label="Notes">
                        <TextArea rows={2} placeholder="Notes optionnelles..." />
                    </Form.Item>

                    {/* Zone de previsualisation du calcul */}
                    <Card
                        size="small"
                        title={
                            <Space>
                                <CarOutlined />
                                <span>Calcul du remboursement</span>
                            </Space>
                        }
                        style={{ marginTop: 8 }}
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
                                    {/* Informations principales */}
                                    <Row gutter={16}>
                                        <Col span={8}>
                                            <Statistic
                                                title="Distance trajet"
                                                value={preview.trip_distance || preview.effective_distance}
                                                suffix="km"
                                                styles={{
                                                    content: { fontSize: 18 }
                                                }}
                                            />
                                        </Col>
                                        <Col span={8}>
                                            <Statistic
                                                title="Distance effective"
                                                value={preview.effective_distance}
                                                suffix="km"
                                                styles={{
                                                    content: { fontSize: 18 }
                                                }}
                                            />
                                        </Col>
                                        <Col span={8}>
                                            <Statistic
                                                title="Montant à rembourser"
                                                value={preview.amount_to_reimburse || preview.calculated_amount}
                                                suffix="€"
                                                precision={2}
                                                styles={{
                                                    content: {
                                                        fontSize: 20,
                                                        fontWeight: 700,
                                                        color: "#52c41a"
                                                    }
                                                }}
                                            />
                                        </Col>
                                    </Row>

                                    {/* Détails de régularisation - seulement si les données sont présentes */}
                                    {preview.previous_annual_km !== undefined && (
                                        <>
                                            <Divider style={{ margin: '16px 0' }} />
                                            <Alert
                                                type="info"
                                                showIcon
                                                icon={<InfoCircleOutlined />}
                                                title="Détail du calcul (régularisation progressive)"
                                                description={
                                                    <Descriptions size="small" column={1} style={{ marginTop: 8 }}>
                                                        <Descriptions.Item label="Kilométrage annuel avant ce trajet">
                                                            {preview.previous_annual_km?.toLocaleString('fr-FR')} km
                                                        </Descriptions.Item>
                                                        <Descriptions.Item label="Kilométrage annuel après ce trajet">
                                                            {preview.new_annual_total_km?.toLocaleString('fr-FR')} km
                                                        </Descriptions.Item>
                                                        <Descriptions.Item label="Déjà remboursé sur l'année">
                                                            {preview.already_paid?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                                        </Descriptions.Item>
                                                        <Descriptions.Item label="Total dû pour le cumul annuel">
                                                            {preview.total_due?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                                        </Descriptions.Item>
                                                        <Descriptions.Item label="Barème appliqué">
                                                            {preview.rate_label || `Coef: ${preview.rate_coefficient} + Const: ${preview.rate_constant || 0}`}
                                                        </Descriptions.Item>
                                                    </Descriptions>
                                                }
                                                style={{ marginTop: 8 }}
                                            />
                                        </>
                                    )}

                                    {/* Barème simple si pas de détails de régularisation */}
                                    {preview.previous_annual_km === undefined && (
                                        <>
                                            <Divider style={{ margin: '16px 0' }} />
                                            <Row gutter={16}>
                                                <Col span={24}>
                                                    <Statistic
                                                        title="Barème"
                                                        value={preview.rate_coefficient}
                                                        suffix={preview.rate_constant > 0 ? ` + ${preview.rate_constant}` : ""}
                                                        precision={4}
                                                        styles={{
                                                            content: { fontSize: 16 }
                                                        }}
                                                    />
                                                </Col>
                                            </Row>
                                        </>
                                    )}
                                </>
                            ) : (
                                <Alert
                                    type="info"
                                    showIcon
                                    title="Selectionnez un vehicule et saisissez la distance pour voir le calcul"
                                />
                            )}
                        </Spin>
                    </Card>
                </Form>
            </Spin>
        </Drawer >
    );
}
