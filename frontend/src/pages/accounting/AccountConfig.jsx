import { useState, useRef } from "react";
import { Drawer, Form, Input, Button, Row, Col, Spin, Space, Tabs, DatePicker, InputNumber, Alert, Switch, Select as AntSelect, Divider } from "antd";
import { message } from '../../utils/antdStatic';
import { SaveOutlined } from "@ant-design/icons";
import { accountConfigApi } from "../../services/api";
import CanAccess from "../../components/common/CanAccess";
import AccountSelect from "../../components/select/AccountSelect";
import AccountJournalSelect from "../../components/select/AccountJournalSelect";
import TaxSelect from "../../components/select/TaxSelect";
import { useEntityForm } from "../../hooks/useEntityForm";
import dayjs from "dayjs";
import "dayjs/locale/fr";

dayjs.locale("fr");

/**
 * Composant AccountConfig
 * Formulaire de configuration comptable dans un Drawer
 */
export default function AccountConfig({ open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();
    const vatRegime = Form.useWatch('aco_vat_regime', form);
    const vatSystem = Form.useWatch('aco_vat_system', form);
    const [frozen, setFrozen] = useState(false);
    const [nextExercise, setNextExercise] = useState({ startDate: '', endDate: '' });
    // Ref pour stocker les données supplémentaires retournées par l'API
    const extraDataRef = useRef({});


    // Transformer les données pour le formulaire (dates en objets dayjs)
    const transformData = (data) => ({
        ...data,
        aco_first_exercise_start_date: data.aco_first_exercise_start_date ? dayjs(data.aco_first_exercise_start_date) : null,
        aco_first_exercise_end_date: data.aco_first_exercise_end_date ? dayjs(data.aco_first_exercise_end_date) : null,
    });

    // Callback appelé après le chargement des données
    const onDataLoadedCallback = async (data) => {

        setFrozen(data.frozen || false);

        const curEx = data.curExercise || { startDate: '', endDate: '' };
        const nextEx = data.nextExercise || { startDate: '', endDate: '' }

        form?.setFieldsValue({
            aco_cur_exercise_start_date: curEx.startDate ? dayjs(curEx.startDate) : '',
            aco_cur_exercise_end_date: curEx.endDate ? dayjs(curEx.endDate) : ''
        });

        // Formater les dates en DD/MM/YYYY pour l'affichage
        setNextExercise({
            startDate: nextEx.startDate ? dayjs(nextEx.startDate).format('DD/MM/YYYY') : '',
            endDate: nextEx.endDate ? dayjs(nextEx.endDate).format('DD/MM/YYYY') : ''
        });
    };

    // Utilisation du hook useEntityForm
    const { loading, submit, reload, entity } = useEntityForm({
        api: accountConfigApi,
        form,
        open,
        entityId: 1, // Configuration unique avec ID=1
        idField: 'aco_id',
        transformData,
        onDataLoaded: onDataLoadedCallback,
        beforeSubmit: (values) => {
            // Convertir les dates dayjs en strings pour l'API
            const dataToSubmit = {
                ...values,
                aco_first_exercise_start_date: values.aco_first_exercise_start_date?.format('YYYY-MM-DD'),
                aco_first_exercise_end_date: values.aco_first_exercise_end_date?.format('YYYY-MM-DD'),
                aco_cur_exercise_start_date: values.aco_cur_exercise_start_date?.format('YYYY-MM-DD'),
                aco_cur_exercise_end_date: values.aco_cur_exercise_end_date?.format('YYYY-MM-DD'),
            };

            // 2. Si c'est gelé (frozen), on supprime les champs sensibles
            // Note : assurez-vous que la variable 'frozen' est accessible ici
            if (frozen) {
                delete dataToSubmit.aco_first_exercise_start_date;
                delete dataToSubmit.aco_first_exercise_end_date;
                delete dataToSubmit.aco_cur_exercise_start_date;
                delete dataToSubmit.aco_cur_exercise_end_date;
            }
            // Remplacer les valeurs par les données transformées
            // Il est préférable de vider les anciennes clés pour éviter les résidus
            Object.keys(values).forEach(key => delete values[key]);
            Object.assign(values, dataToSubmit);
            return true;
        },
        afterSubmit: async () => {
            message.success('Configuration comptable mise à jour avec succès');
            onSubmit?.();
            // Recharger pour avoir les exercices mis à jour
            await reload(false);
        },
        messages: {
            update: 'Configuration comptable mise à jour avec succès',
            loadError: 'Erreur lors du chargement de la configuration',
            saveError: 'Erreur lors de la mise à jour',
        },
    });

    // Calculer les exercices courant et suivant
    const updateExerciseDates = () => {
        const firstStart = form.getFieldValue('aco_first_exercise_start_date');
        const firstEnd = form.getFieldValue('aco_first_exercise_end_date');

        if (!firstStart || !firstEnd) {
            return;
        }

        const startDate = firstStart.toDate();
        const endDate = firstEnd.toDate();

        // Vérifier que la date de fin est supérieure à la date de départ
        if (endDate <= startDate) {
            message.error("La date de fin doit être supérieure à la date de départ pour le premier exercice.");
            form.setFieldValue('aco_first_exercise_end_date', null);
            return;
        }

        // Vérifier que l'exercice ne dépasse pas 24 mois
        const diffMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
        if (diffMonths > 24 || (diffMonths === 24 && endDate.getDate() >= startDate.getDate())) {
            message.error("Le premier exercice ne peut pas dépasser 24 mois.");
            form.setFieldValue('aco_first_exercise_end_date', null);
            return;
        }

        // Exercice courant = même que le premier exercice       
        form?.setFieldsValue({
            aco_cur_exercise_start_date: firstStart,
            aco_cur_exercise_end_date: firstEnd
        });
        // Exercice suivant
        const nextStart = dayjs(endDate).add(1, 'day');
        const nextEnd = nextStart.add(1, 'year').subtract(1, 'day');

        setNextExercise({
            startDate: nextStart.format('DD/MM/YYYY'),
            endDate: nextEnd.format('DD/MM/YYYY')
        });
    };

    const handleFormSubmit = async (values) => {
        await submit(values, { closeDrawer: false });
    };

    const handleClose = () => {
        form.resetFields();
        if (onClose) {
            onClose();
        }
    };

    const drawerActions = (
        <Space
            style={{
                width: "100%",
                display: "flex",
                paddingRight: "15px",
                justifyContent: "flex-end"
            }}
        >
            <Button onClick={handleClose}>Annuler</Button>
            <CanAccess permission="accountings.edit">
                <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    onClick={() => form.submit()}
                    loading={loading}
                >
                    Enregistrer
                </Button>
            </CanAccess>
        </Space>
    );

    const tabItems = [
        {
            key: '1',
            label: 'Exercice',
            children: (
                <div className="box" style={{ marginBottom: 24 }}>

                    <Row gutter={[16, 8]}>
                        <Col span={6} style={{ paddingTop: "30px" }}>
                            <h4 style={{ fontWeight: 'bold' }}>Premier exercice</h4>
                        </Col>
                        <Col span={6}>
                            <Form.Item
                                name="aco_first_exercise_start_date"
                                label="Du"
                                rules={[{ required: true, message: "La date de début est requise" }]}
                            >
                                <DatePicker
                                    format="DD/MM/YYYY"
                                    disabled={frozen}
                                    onChange={updateExerciseDates}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item
                                name="aco_first_exercise_end_date"
                                label="Au"
                                rules={[{ required: true, message: "La date de fin est requise" }]}
                            >
                                <DatePicker
                                    format="DD/MM/YYYY"
                                    disabled={frozen}
                                    onChange={updateExerciseDates}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={[16, 8]}>
                        <Col span={6} style={{ paddingTop: "30px" }}>
                            <h4 style={{ fontWeight: 'bold' }}>Exercice courant</h4>
                        </Col>
                        <Col span={6}>
                            <Form.Item
                                label="Du"
                                name="aco_cur_exercise_start_date"
                            >
                                <DatePicker
                                    //value={curExercise.startDate}
                                    format="DD/MM/YYYY"
                                    disabled={frozen}
                                //  onChange={updateExerciseDates}
                                />


                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item
                                label="Au"
                                name="aco_cur_exercise_end_date"
                            >
                                <DatePicker
                                    // value={curExercise.endDate}
                                    format="DD/MM/YYYY"
                                    disabled={frozen}
                                // onChange={updateExerciseDates}
                                />
                            </Form.Item>
                        </Col>
                    </Row>


                    <Row gutter={[16, 8]}>
                        <Col span={6} style={{ paddingTop: "30px" }}>
                            <h4 style={{ fontWeight: 'bold' }}>Exercice n+1</h4>
                        </Col>
                        <Col span={6}>
                            <Form.Item label="Du">
                                <Input value={nextExercise.startDate} disabled style={{ backgroundColor: '#f5f5f5' }} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label="Au">
                                <Input value={nextExercise.endDate} disabled style={{ backgroundColor: '#f5f5f5' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    {frozen && (
                        <Alert
                            title="Des écritures comptables existent déjà"
                            description="Les dates d'exercice ne peuvent plus être modifiées car des mouvements comptables ont déjà été enregistrés."
                            type="warning"
                            showIcon
                            style={{ marginBottom: 16, marginTop: 25 }}
                        />
                    )}
                </div>
            ),
        },
        {
            key: '2',
            label: 'Comptes',
            children: (
                <>
                    <div className="box" style={{ marginBottom: 24 }}>
                        <Row gutter={[16, 8]}>
                            <Col span={6}>
                                <Form.Item
                                    name="aco_account_length"
                                    label="Longueur des comptes"
                                    rules={[{ required: true, message: "La longueur est requise" }]}
                                >
                                    <InputNumber min={6} max={8} style={{ width: '100%' }} />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    <div className="box" style={{ marginBottom: 24 }}>
                        <h4 style={{ fontWeight: 'bold', marginBottom: 16 }}>Compte par défaut : Produit & Service</h4>
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item name="fk_acc_id_sale" label="Compte vente" rules={[{ required: true }]}>
                                    <AccountSelect 
                                    filters={{ type: ['income', 'income_other'], isActive: true }} loadInitially={false} initialData={entity?.sale_account} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="fk_acc_id_purchase" label="Compte achat" rules={[{ required: true }]}>
                                    <AccountSelect filters={{ type: ['expense', 'expense_direct_cost'], isActive: true }} loadInitially={false} initialData={entity?.purchase_account} />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item name="fk_acc_id_sale_intra" label="Compte vente intra-communautaire" rules={[{ required: true }]}>
                                    <AccountSelect filters={{ type: ['income', 'income_other'], isActive: true }} loadInitially={false} initialData={entity?.sale_intra_account} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="fk_acc_id_purchase_intra" label="Compte achat intra-communautaire" rules={[{ required: true }]}>
                                    <AccountSelect filters={{ type: ['expense', 'expense_direct_cost'], isActive: true }} loadInitially={false} initialData={entity?.purchase_intra_account} />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item name="fk_acc_id_sale_export" label="Compte vente export" rules={[{ required: true }]}>
                                    <AccountSelect filters={{ type: ['income', 'income_other'], isActive: true }} loadInitially={false} initialData={entity?.sale_export_account} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="fk_acc_id_purchase_import" label="Compte achat import" rules={[{ required: true }]}>
                                    <AccountSelect filters={{ type: ['expense', 'expense_direct_cost'], isActive: true }} loadInitially={false} initialData={entity?.purchase_import_account} />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    <div className="box" style={{ marginBottom: 24 }}>
                        <h4 style={{ fontWeight: 'bold', marginBottom: 16 }}>Compte par défaut : Tiers</h4>
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item name="fk_acc_id_customer" label="Client" rules={[{ required: true }]}>
                                    <AccountSelect filters={{ type: ['asset_receivable'], isActive: true }} loadInitially={false} initialData={entity?.customer_account} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="fk_acc_id_supplier" label="Fournisseur" rules={[{ required: true }]}>
                                    <AccountSelect filters={{ type: ['liability_payable'], isActive: true }} loadInitially={false} initialData={entity?.supplier_account} />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item name="fk_acc_id_employee" label="Salarié" rules={[{ required: true }]}>
                                    <AccountSelect filters={{ type: ['liability_current'], isActive: true }} loadInitially={false} initialData={entity?.employee_account} />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item name="fk_acc_id_sale_advance" label="Acompte clients" rules={[{ required: true }]}>
                                    <AccountSelect filters={{ type: ['asset_current'], isActive: true }} loadInitially={false} initialData={entity?.sale_deposit_account} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="fk_acc_id_purchase_advance" label="Acompte fournisseur" rules={[{ required: true }]}>
                                    <AccountSelect filters={{ type: ['asset_current'], isActive: true }} loadInitially={false} initialData={entity?.purchase_deposit_account} />
                                </Form.Item>
                            </Col>
                        </Row>

                    </div>

                    <div className="box" style={{ marginBottom: 24 }}>
                        <h4 style={{ fontWeight: 'bold', marginBottom: 16 }}>Compte par défaut : Autres</h4>
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item name="fk_acc_id_bank" label="Banque" rules={[{ required: true }]}>
                                    <AccountSelect filters={{ type: ['asset_cash'], isActive: true }} loadInitially={false} initialData={entity?.bank_account} />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item name="fk_acc_id_profit" label="Résultat de l'exercice (bénéfice)" rules={[{ required: true }]}>
                                    <AccountSelect filters={{ type: ['equity'], isActive: true }} loadInitially={false} initialData={entity?.profit_account} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="fk_acc_id_loss" label="Résultat de l'exercice (perte)" rules={[{ required: true }]}>
                                    <AccountSelect filters={{ type: ['equity'], isActive: true }} loadInitially={false} initialData={entity?.loss_account} />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item name="fk_acc_id_carry_forward" label="Report à nouveau" rules={[{ required: true }]}>
                                    <AccountSelect filters={{ type: ['equity'], isActive: true }} loadInitially={false} initialData={entity?.carry_forward_account} />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item name="fk_acc_id_mileage_expense" label="Frais kilometrique" rules={[{ required: true }]}>
                                    <AccountSelect filters={{ type: ['expense', 'expense_direct_cost'], isActive: true }} loadInitially={false} initialData={entity?.mileage_expense_account} />
                                </Form.Item>
                            </Col></Row>
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item name="fk_tax_id_product_sale" label="TVA produit" rules={[{ required: true }]}>
                                    <TaxSelect tax_use="purchase" />
                                </Form.Item>
                            </Col>

                        </Row>
                    </div>
                </>
            ),
        },
        {
            key: '3',
            label: 'Journaux',
            children: (
                <div className="box" style={{ marginBottom: 24 }}>
                    <Row gutter={[16, 8]}>
                        <Col span={12}>
                            <Form.Item name="fk_ajl_id_sale" label="Vente" rules={[{ required: true }]}>
                                <AccountJournalSelect
                                    loadInitially={true}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="fk_ajl_id_purchase" label="Achat" rules={[{ required: true }]}>
                                <AccountJournalSelect
                                    loadInitially={true} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={[16, 8]}>
                        <Col span={12}>
                            <Form.Item name="fk_ajl_id_bank" label="Banque" rules={[{ required: true }]}>
                                <AccountJournalSelect
                                    loadInitially={true} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="fk_ajl_id_an" label="A Nouveau" rules={[{ required: true }]}>
                                <AccountJournalSelect
                                    loadInitially={true} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={[16, 8]}>
                        <Col span={12}>
                            <Form.Item name="fk_ajl_id_od" label="Opérations diverses" rules={[{ required: true }]}>
                                <AccountJournalSelect
                                    loadInitially={true} />
                            </Form.Item>
                        </Col>
                    </Row>
                </div>
            ),
        },
        {
            key: '4',
            label: 'TVA',
            children: (
                <div className="box" style={{ marginBottom: 24 }}>

                    {/* ── Régime & Périodicité ─────────────────────────────── */}
                    <Row gutter={[16, 8]}>
                        <Col span={12}>
                            <Form.Item name="aco_vat_system" label="Régime TVA" rules={[{ required: true }]}>
                                <AntSelect
                                    options={[
                                        { label: 'Réel Normal', value: 'reel' },
                                        { label: 'Simplifié', value: 'simplifie' },
                                    ]}
                                    placeholder="Sélectionner un régime"
                                    allowClear={false}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="aco_vat_periodicity" label="Périodicité CA3" rules={[{ required: true }]}>
                                <AntSelect
                                    options={[
                                        { label: 'Mensuelle', value: 'monthly' },
                                        { label: 'Trimestrielle', value: 'quarterly' },
                                        { label: 'Mini-réel', value: 'mini_reel' },
                                    ]}
                                    placeholder="Sélectionner une périodicité"
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={[16, 8]}>
                        <Col span={12}>
                            <Form.Item name="aco_vat_regime" label="Mode de déclaration" rules={[{ required: true }]}>
                                <AntSelect
                                    options={[
                                        { label: 'Sur les débits', value: 'debits' },
                                        { label: 'Sur les encaissements', value: 'encaissements' },
                                    ]}
                                    placeholder="Sélectionner un mode"

                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* ── Comptes TVA ──────────────────────────────────────── */}
                    <Divider orientation="left" style={{ marginTop: 8 }}>Comptes TVA</Divider>

                    {vatRegime === 'encaissements' && (
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item
                                    name="fk_acc_id_sale_vat_waiting"
                                    label="TVA Attente collecté"
                                    rules={[{ required: true, message: 'Le compte TVA en attente vente est obligatoire en régime encaissements' }]}
                                >
                                    <AccountSelect filters={{ type: ['liability_current'], isActive: true }} loadInitially={false} initialData={entity?.sale_vat_waiting_account} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="fk_acc_id_purchase_vat_waiting"
                                    label="TVA attente déductible"
                                    rules={[{ required: true, message: 'Le compte TVA en attente achat est obligatoire en régime encaissements' }]}
                                >
                                    <AccountSelect filters={{ type: ['liability_current'], isActive: true }} loadInitially={false} initialData={entity?.purchase_vat_waiting_account} />
                                </Form.Item>
                            </Col>
                        </Row>
                    )}
                    {vatSystem === 'simplifie' && (
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item
                                    name="fk_acc_id_vat_advance"
                                    label="Compte acompte TVA (44581)"
                                    rules={[{ required: true, message: 'Le compte acompte TVA est obligatoire en régime simplifié' }]}
                                >
                                    <AccountSelect filters={{ type: ['liability_current'], isActive: true }} loadInitially={false} initialData={entity?.vat_advance_account} />
                                </Form.Item>
                            </Col>
                        </Row>
                    )}
                    <Row gutter={[16, 8]}>
                        <Col span={12}>
                            <Form.Item name="fk_acc_id_vat_payable" label="Compte TVA à payer (44551)" rules={[{ required: true }]}>
                                <AccountSelect filters={{ type: ['liability_current'], isActive: true }} loadInitially={false} initialData={entity?.vat_payable_account} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="fk_acc_id_vat_credit" label="Compte crédit de TVA (44567)" rules={[{ required: true }]}>
                                <AccountSelect filters={{ type: ['liability_current'], isActive: true }} loadInitially={false} initialData={entity?.vat_credit_account} />
                            </Form.Item>
                        </Col>
                    </Row>


                    <Row gutter={[16, 8]}>
                        <Col span={12}>
                            <Form.Item name="fk_acc_id_vat_regularisation" label="Compte TVA à régulariser (4458x)">
                                <AccountSelect filters={{ type: ['liability_current'], isActive: true }} loadInitially={false} initialData={entity?.vat_regularisation_account} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="fk_acc_id_vat_refund" label="Compte remboursement TVA (44583)" rules={[{ required: true }]}>
                                <AccountSelect filters={{ type: ['liability_current'], isActive: true }} loadInitially={false} initialData={entity?.vat_refund_account} />
                            </Form.Item>
                        </Col>
                    </Row>


                    {/* ── Alertes d'échéance ───────────────────────────────── */}
                    <Divider orientation="left" style={{ marginTop: 8 }}>Alertes d'échéance</Divider>
                    <Row gutter={[16, 8]}>
                        <Col span={24}>
                            <Form.Item name="aco_vat_alert_enabled" label="Alertes d'échéance TVA" valuePropName="checked">
                                <Switch checkedChildren="Activées" unCheckedChildren="Désactivées" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={[16, 8]}>
                        <Col span={8}>
                            <Form.Item name="aco_vat_alert_days" label="Délai d'alerte (jours avant échéance)">
                                <InputNumber min={1} max={60} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={16}>
                            <Form.Item name="aco_vat_alert_emails" label="Adresses e-mail destinataires">
                                <AntSelect
                                    mode="tags"
                                    tokenSeparators={[',', ';', ' ']}
                                    placeholder="Saisir les adresses e-mail et appuyer sur Entrée"
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={[16, 8]}>
                        <Col span={12}>
                            <Form.Item name="fk_emt_id_vat_alert" label="Modèle d'e-mail d'alerte">
                                <AntSelect
                                    options={[{ label: 'Alerte TVA — Échéance à venir', value: 30 }]}
                                    placeholder="Sélectionner un modèle"
                                    allowClear
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </div>
            ),
        },
    ];

    return (
        <Drawer
            title="Configuration comptable"
            placement="right"
            onClose={handleClose}
            open={open}
            size={drawerSize}
            footer={drawerActions}
            forceRender
        >
            <Spin spinning={loading} tip="Chargement...">
                <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
                    <Form.Item name="aco_id" hidden>
                        <Input />
                    </Form.Item>

                    <Tabs defaultActiveKey="1" items={tabItems} />
                </Form>
            </Spin>
        </Drawer>
    );
}
