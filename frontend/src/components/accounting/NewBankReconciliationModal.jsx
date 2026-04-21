import { Modal, Form, Input, DatePicker, InputNumber, Space } from "antd";
import { message } from '../../utils/antdStatic';
import { useState, useEffect } from "react";
import BankSelect from "../select/BankSelect";
import { accountBankReconciliationsApi } from "../../services/api";
import { getWritingPeriod } from "../../utils/writingPeriod";
import { getDefaultBank } from "../../utils/companyInfo";
import dayjs from "dayjs";


/**
 * Modal pour créer un nouveau rapprochement bancaire
 */
export default function NewBankReconciliationModal({ open, onCancel, onSuccess }) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [writingPeriod, setWritingPeriod] = useState(null);    
    const [hasLastReconciliation, setHasLastReconciliation] = useState(false);

    // Charger la période comptable et la banque par défaut à l'ouverture
    useEffect(() => {
        if (open) {
            loadInitialData();
        }
    }, [open]);

    const loadInitialData = async () => {
        try {
            const period = await getWritingPeriod();
            setWritingPeriod(period);

            // Charger la banque par défaut
            const defaultBank = await getDefaultBank();
       
            if (defaultBank && defaultBank.bts_id) {              
              
                form.setFieldsValue({
                    fk_bts_id: defaultBank.bts_id,
                });

                // Charger les données du dernier rapprochement pour cette banque
                await loadLastReconciliation(defaultBank.bts_id, period, defaultBank.bts_label);
            } else {
                // Pas de banque par défaut : dates par défaut
                const startDate = dayjs(period.startDate);
                const endDate = startDate.endOf('month');

                form.setFieldsValue({
                    abr_date_start: startDate,
                    abr_date_end: endDate,
                    abr_initial_balance: 0,
                });
            }
        } catch (error) {
            message.error('Erreur lors du chargement des données initiales');
        }
    };

    // Charger les données du dernier rapprochement
    const loadLastReconciliation = async (btsId, period, label = "") => {
        try {
            const response = await accountBankReconciliationsApi.getLastReconciliation(btsId);
          
            const lastData = response.data;

            if (lastData && lastData.date_end) {
                // Il existe un dernier rapprochement
                setHasLastReconciliation(true);

                // Date de début = lendemain du dernier rapprochement
                const newStartDate = dayjs(lastData.date_end).add(1, 'day');             
                const newEndDate = newStartDate.endOf('month');

                // Générer la référence avec le nom de la banque
                const bankPrefix = label.substring(0, 3).toUpperCase();
                const monthYear = newStartDate.format('YYYYMM');
                const generatedRef = `${bankPrefix}${monthYear}`;

                form.setFieldsValue({
                    abr_initial_balance: lastData.final_balance || 0,
                    abr_date_start: newStartDate,
                    abr_date_end: newEndDate,
                    abr_label: generatedRef,
                });
            } else {
                // Pas de dernier rapprochement
                setHasLastReconciliation(false);

                const startDate = dayjs(period.startDate);
                const endDate = startDate.endOf('month');

                // Générer la référence avec le nom de la banque
                const bankPrefix = label.substring(0, 3).toUpperCase();
                const monthYear = startDate.format('YYYYMM');
                const generatedRef = `${bankPrefix}${monthYear}`;

                form.setFieldsValue({
                    abr_initial_balance: 0,
                    abr_date_start: startDate,
                    abr_date_end: endDate,
                    abr_label: generatedRef,
                });
            }
        } catch (error) {
            message.error('Erreur lors du chargement des données du dernier rapprochement'+ error);
        }
    };

    // Gérer le changement de banque
    const handleBankChange = async (btsId, option) => {
      
        if (!btsId || !writingPeriod) return;
        const label = option?.children || "";     

        await loadLastReconciliation(btsId, writingPeriod, label);
    };

    const handleSubmit = async (values) => {
        setLoading(true);
        try {
            const response = await accountBankReconciliationsApi.create({
                abr_label: values.abr_label,
                fk_bts_id: values.fk_bts_id,
                abr_date_start: values.abr_date_start.format('YYYY-MM-DD'),
                abr_date_end: values.abr_date_end.format('YYYY-MM-DD'),
                abr_initial_balance: values.abr_initial_balance,
                abr_final_balance: values.abr_final_balance,
            });

            if (response.success) {
                message.success(response.message);
                form.resetFields();
              
                setHasLastReconciliation(false);
             
                onSuccess(response.data.abr_id);
            }
        } catch (error) {
            message.error(error.response?.data?.message || 'Erreur lors de la création du rapprochement');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
      
        setHasLastReconciliation(false);      
        onCancel();
    };

    if (!writingPeriod) {
        return null;
    }

    return (
        <Modal
            title="Nouveau rapprochement bancaire"
            open={open}
            onCancel={handleCancel}
            onOk={() => form.submit()}
            confirmLoading={loading}
            okText="Valider"
            cancelText="Annuler"
            width={600}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
            >
                <Form.Item
                    label="Banque"
                    name="fk_bts_id"
                    rules={[{ required: true, message: 'Banque requise' }]}
                >
                    <BankSelect
                        onChange={handleBankChange}                       
                    />
                </Form.Item>

                <Form.Item
                    label="Référence"
                    name="abr_label"
                    rules={[{ required: true, message: 'Référence requise' }]}
                >
                    <Input maxLength={50} placeholder="Référence du rapprochement" />
                </Form.Item>
                <Space>
                    <Form.Item
                        label="Période du"
                        name="abr_date_start"
                        rules={[{ required: true, message: 'Date de début requise' }]}
                    >
                        <DatePicker
                            format="DD/MM/YYYY"
                            minDate={dayjs(writingPeriod.startDate)}
                            maxDate={dayjs(writingPeriod.endDate)}
                            disabled={hasLastReconciliation}
                        />
                    </Form.Item>

                    <Form.Item
                        label="Au"
                        name="abr_date_end"
                        rules={[{ required: true, message: 'Date de fin requise' }]}
                    >
                        <DatePicker
                            format="DD/MM/YYYY"
                            minDate={dayjs(writingPeriod.startDate)}
                            maxDate={dayjs(writingPeriod.endDate)}
                        />
                    </Form.Item>
                </Space> <Space>
                    <Form.Item
                        label="Solde initial"
                        name="abr_initial_balance"
                        rules={[{ required: true, message: 'Solde initial requis' }]}
                    >
                        <InputNumber
                            style={{ width: '100%' }}
                            precision={2}
                            step={0.01}
                            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                            parser={value => value.replace(/\s?/g, '')}
                            disabled={hasLastReconciliation}
                        />
                    </Form.Item>

                    <Form.Item
                        label="Solde final"
                        name="abr_final_balance"
                        rules={[{ required: true, message: 'Solde final requis' }]}
                    >
                        <InputNumber
                            style={{ width: '100%' }}
                            precision={2}
                            step={0.01}
                            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                            parser={value => value.replace(/\s?/g, '')}
                        />
                    </Form.Item>
                </Space>
            </Form>
        </Modal>
    );
}