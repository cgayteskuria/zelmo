import { useState, useEffect, useCallback, useRef } from "react";
import { Card, Row, Col, Form, Button, Select, Space } from "antd";
import { message } from '../../utils/antdStatic';
import { FilePdfOutlined } from "@ant-design/icons";
import PageContainer from "../../components/common/PageContainer";
import AccountSelect from "../../components/select/AccountSelect";
import AccountJournalSelect from "../../components/select/AccountJournalSelect";
import PeriodSelector from "../../components/common/PeriodSelector";
import { accountingEditionsApi } from "../../services/api";
import dayjs from "dayjs";
import { getWritingPeriod } from '../../utils/writingPeriod';

const STORAGE_KEY = "accounting_editions_settings";

export default function AccountingEditions() {
    const [form] = Form.useForm();
    const [writingPeriod, setWritingPeriod] = useState(null);
    const [loading, setLoading] = useState(false);
    const [editionType, setEditionType] = useState("balance");
    const [dateRange, setDateRange] = useState({ start: null, end: null });
    const dateRangeRef = useRef(dateRange);

    useEffect(() => { dateRangeRef.current = dateRange; }, [dateRange]);

    // Charger la période d'écriture et restaurer les sélections au montage
    useEffect(() => {
        loadInitialState();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const saveToStorage = useCallback((range, formValues) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ dateRange: range, ...formValues }));
        } catch { }
    }, []);

    const loadInitialState = async () => {
        // Tenter de restaurer depuis localStorage
        let restored = null;
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) restored = JSON.parse(saved);
        } catch { }

        // Charger la période d'écriture (pour minDate/maxDate)
        try {
            const period = await getWritingPeriod();
            setWritingPeriod(period);

            if (restored?.dateRange?.start) {
                setDateRange(restored.dateRange);
                const edType = restored.edition_type || "balance";
                setEditionType(edType);
                form.setFieldsValue({
                    edition_type: edType,
                    account_from_id: restored.account_from_id ?? undefined,
                    account_to_id: restored.account_to_id ?? undefined,
                    journal_id: restored.journal_id ?? undefined,
                });
            } else {
                setDateRange({ start: period.startDate, end: period.endDate });
            }
        } catch (error) {
            console.error("Erreur lors du chargement de la période d'écriture:", error);
            message.error("Erreur lors du chargement de la période d'écriture");
        }
    };

    const handlePeriodChange = useCallback((newRange) => {
        setDateRange(newRange);
        saveToStorage(newRange, form.getFieldsValue());
    }, [form, saveToStorage]);

    const handleValuesChange = useCallback((_, allValues) => {
        saveToStorage(dateRangeRef.current, allValues);
    }, [saveToStorage]);

    const handleEditionTypeChange = (value) => {
        setEditionType(value);
        if (value === "journaux" || value === "journaux_centralisateur") {
            form.setFieldsValue({
                account_from_id: undefined,
                account_to_id: undefined,
            });
        }
    };

    const generatePDF = async (values) => {
        if (!dateRange.start || !dateRange.end) {
            message.error("Veuillez sélectionner une période");
            return;
        }
        setLoading(true);
        try {
            // Construire les filtres
            const filters = {
                start_date: dateRange.start,
                end_date: dateRange.end,
            };

            // Ajouter les filtres supplémentaires selon le type d'édition
            if (editionType === "balance" || editionType === "grand_livre") {
                if (values.account_from_id) {
                    filters.account_from_id = values.account_from_id;
                    filters.account_to_id = values.account_to_id || values.account_from_id;
                }
                if (values.journal_id) {
                    filters.journal_id = values.journal_id;
                }
            } else if (editionType === "journaux" || editionType === "journaux_centralisateur") {
                if (values.journal_id) {
                    filters.journal_id = values.journal_id;
                }
            }

            // Appeler l'API PDF selon le type d'édition
            let response;

            switch (editionType) {
                case "balance":
                    response = await accountingEditionsApi.balancePdf(filters);
                    break;
                case "grand_livre":
                    response = await accountingEditionsApi.grandLivrePdf(filters);
                    break;
                case "journaux":
                    response = await accountingEditionsApi.journauxPdf(filters);
                    break;
                case "journaux_centralisateur":
                    response = await accountingEditionsApi.journauxCentralisateurPdf(filters);
                    break;
                case "bilan":
                    response = await accountingEditionsApi.bilanPdf(filters);
                    break;
                default:
                    throw new Error("Type d'édition non reconnu");
            }

            // Décoder le PDF base64 et le télécharger
            const pdfBase64 = response.pdf;
            const fileName = response.filename;

            // Convertir base64 en blob
            const byteCharacters = atob(pdfBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });

            // Télécharger le PDF
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            link.click();
            URL.revokeObjectURL(url);

            message.success("PDF généré avec succès");
        } catch (error) {
            console.error("Erreur lors de la génération du PDF:", error);
            message.error(
                error.message || "Erreur lors de la génération du PDF"
            );
        } finally {
            setLoading(false);
        }
    };

    const editionOptions = [
        { label: "Balance", value: "balance" },
        { label: "Grand Livre", value: "grand_livre" },
        { label: "Journaux", value: "journaux" },
        { label: "Journaux Centralisateur", value: "journaux_centralisateur" },
        { label: "Bilan", value: "bilan" },
    ];

    // Vérifier si les filtres compte/journal sont affichés selon le type d'édition
    const showAccountFilter = editionType === "balance" || editionType === "grand_livre";
    const showJournalFilter =
        editionType === "balance" ||
        editionType === "grand_livre" ||
        editionType === "journaux" ||
        editionType === "journaux_centralisateur";

    return (
        <PageContainer title="Éditions Comptables">
            <Card>
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={generatePDF}
                    onValuesChange={handleValuesChange}
                    initialValues={{
                        edition_type: "balance",
                    }}
                >
                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item
                                label="Type d'édition"
                                name="edition_type"
                                rules={[
                                    {
                                        required: true,
                                        message: "Veuillez sélectionner un type d'édition",
                                    },
                                ]}
                            >
                                <Select
                                    options={editionOptions}
                                    onChange={handleEditionTypeChange}
                                    size="large"
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item label="Période">
                                <PeriodSelector
                                    value={dateRange}
                                    onChange={handlePeriodChange}
                                    presets={true}
                                    minDate={writingPeriod ? dayjs(writingPeriod.startDate) : undefined}
                                    maxDate={writingPeriod ? dayjs(writingPeriod.endDate) : undefined}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    {showAccountFilter && (
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item label="Compte de début" name="account_from_id">
                                    <AccountSelect
                                        size="large" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item label="Compte de fin" name="account_to_id">
                                    <AccountSelect
                                        size="large" />
                                </Form.Item>
                            </Col>
                        </Row>
                    )}

                    {showJournalFilter && (
                        <Row gutter={16}>
                            <Col span={24}>
                                <Form.Item label="Journal" name="journal_id">
                                    <AccountJournalSelect size="large" />
                                </Form.Item>
                            </Col>
                        </Row>
                    )}

                    <Row>
                        <Col span={24} align="center">
                            <Space style={{ marginTop: 15 }} >
                                <Form.Item>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        icon={<FilePdfOutlined />}
                                        size="large"
                                        loading={loading}
                                    >
                                        Générer le PDF
                                    </Button>
                                </Form.Item>
                            </Space>
                        </Col>
                    </Row>
                </Form>
            </Card>
        </PageContainer>
    );
}
