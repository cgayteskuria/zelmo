import { useState, useEffect } from "react";
import { Drawer, Form, Input, Select, DatePicker, InputNumber, Switch, Row, Col, Button, Spin, Space, Popconfirm } from "antd";
import { SaveOutlined, DeleteOutlined } from "@ant-design/icons";
import { getUser } from "../../services/auth";
import dayjs from "dayjs";
import { prospectActivitiesApi } from "../../services/apiProspect";
import { useEntityForm } from "../../hooks/useEntityForm";
import UserSelect from "../select/UserSelect";
import PartnerSelect from "../select/PartnerSelect";
import OpportunitySelect from "../select/OpportunitySelect";
import CanAccess from "../common/CanAccess";
import { ACTIVITY_TYPE_OPTIONS, getDefaultActivityType } from "../../configs/OpportunityConfig";

export default function ActivityFormModal({
    open,
    onClose,
    onSubmit,
    activityId = null,
    defaultValues = {},
}) {
    const [form] = Form.useForm();

    const fkOppId = Form.useWatch('fk_opp_id', form);
    const fkPtrId = Form.useWatch('fk_ptr_id', form);
    // const pageLabel = Form.useWatch("pac_subject", form);
    const [pageLabel, setPageLabel] = useState("Nouvelle activité");
    const [partnerInitialData, setPartnerInitialData] = useState(null);


    const [defaultSeller] = useState(() => {
        const currentUser = getUser();
        if (currentUser?.id) {
            return {
                usr_id: currentUser.id,
                usr_firstname: currentUser.firstname,
                usr_lastname: currentUser.lastname,
            };
        }
        return null;
    });



    const { submit, remove, loading, entity } = useEntityForm({
        api: prospectActivitiesApi,
        entityId: activityId,
        idField: "pac_id",
        form,
        open,
        transformData: (data) => ({
            ...data,
            pac_date: data.pac_date ? dayjs(data.pac_date) : dayjs(),
            pac_due_date: data.pac_due_date ? dayjs(data.pac_due_date) : null,
            pac_is_done: !!data.pac_is_done,
        }),
        onDataLoaded: (data) => {
            if (data.partner) {
                setPartnerInitialData(data.partner);
            }
            setPageLabel(`Activité - ${data.pac_subject}`);

        },
        onSuccess: ({ action, data }) => {
            onSubmit?.({ action, data });
            onClose?.();
        },
        onDelete: ({ id }) => {
            onSubmit?.({ action: "delete", id });
            onClose?.();
        },
    });

    // Set default values when creating
    useEffect(() => {
        if (!open || activityId) return;
        form.resetFields();
        form.setFieldsValue({
            pac_date: dayjs(),
            pac_is_done: false,
            pac_type: getDefaultActivityType(),
            ...defaultValues,
        });
        setPartnerInitialData(null);
        if (defaultValues.partnerInitialData) {
            setPartnerInitialData(defaultValues.partnerInitialData);
        }


        const currentUser = getUser();
        if (currentUser?.id) {
            form.setFieldValue('fk_usr_id_seller', currentUser.id);
        }

    }, [open, activityId, form, defaultValues, partnerInitialData]);

    const handleOpportunitySelect = (val, option) => {
        if (option?.fk_ptr_id) {
            form.setFieldValue('fk_ptr_id', option.fk_ptr_id);
            setPartnerInitialData({ ptr_id: option.fk_ptr_id, ptr_name: option.ptr_name });
        }
        if (!val) {
            setPartnerInitialData(null);
        }
    };

    const handlePartnerChange = (val) => {
        form.setFieldValue('fk_opp_id', undefined);
        if (!val) setPartnerInitialData(null);
    };

    const handleFormSubmit = async (values) => {
        const payload = {
            ...values,
            pac_date: values.pac_date?.format("YYYY-MM-DD HH:mm:ss"),
            pac_due_date: values.pac_due_date?.format("YYYY-MM-DD HH:mm:ss") || null,
            pac_is_done: values.pac_is_done ? 1 : 0,
        };
        await submit(payload);
    };

    const handleDelete = async () => {
        await remove();
    };

    const handleClose = () => {
        form.resetFields();
        onClose?.();
    };



    const drawerActions = (
        <Space style={{ width: "100%", display: "flex", paddingRight: "15px", justifyContent: "flex-end" }}>
            {activityId && (
                <>
                    <CanAccess permission="opportunities.delete">
                        <Popconfirm title="Supprimer cette activité ?" onConfirm={handleDelete} okText="Oui" cancelText="Non">
                            <Button danger icon={<DeleteOutlined />}>Supprimer</Button>
                        </Popconfirm>
                    </CanAccess>
                    <div style={{ flex: 1 }} />
                </>
            )}
            <Button onClick={handleClose}>Annuler</Button>
            <CanAccess permission={activityId ? "opportunities.edit" : "opportunities.create"}>
                <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()} loading={loading}>
                    {activityId ? "Enregistrer" : "Créer"}
                </Button>
            </CanAccess>
        </Space>
    );

    return (
        <Drawer
            title={pageLabel}
            placement="right"
            onClose={handleClose}
            open={open}
            size="large"
            footer={drawerActions}
            destroyOnHidden
            forceRender

        >
            <Spin spinning={loading} tip="Chargement...">
                <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
                    <Form.Item name="pac_id" hidden><Input /></Form.Item>
                    <Row gutter={[16, 8]}>
                        <Col span={12}>
                            <Form.Item name="pac_type" label="Type" rules={[{ required: true, message: "Le type est requis" }]}>
                                <Select options={ACTIVITY_TYPE_OPTIONS} placeholder="Type d'activité" />
                            </Form.Item>
                        </Col>

                        <Col span={12}>
                            <Form.Item name="fk_usr_id_seller" label="Commercial" rules={[{ required: true }]}>
                                <UserSelect
                                    initialData={entity?.seller ?? defaultSeller}
                                    filters={{ is_seller: 1 }}
                                />
                            </Form.Item>
                        </Col> 
                         <Col span={12}>
                            <Form.Item name="fk_ptr_id" label="Prospect" rules={[{ required: true, message: "Le prospect est requis" }]}>
                                <PartnerSelect
                                    initialData={partnerInitialData ?? entity?.partner}
                                    filters={{ is_prospect: 1 }}
                                    disabled={!!fkOppId}
                                    onChange={handlePartnerChange}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="fk_opp_id" label="Opportunité">
                                <OpportunitySelect
                                    key={fkPtrId ?? 'no-partner'}
                                    initialData={!fkPtrId || fkPtrId === entity?.opportunity?.fk_ptr_id ? entity?.opportunity : null}
                                    onSelect={handleOpportunitySelect}
                                    filters={fkPtrId ? { fk_ptr_id: fkPtrId } : {}}
                                />
                            </Form.Item>
                        </Col>
                      
                        <Col span={24}>
                            <Form.Item name="pac_subject" label="Sujet" rules={[{ required: true, message: "Le sujet est requis" }]}>
                                <Input placeholder="Sujet de l'activité" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="pac_date" label="Date" rules={[{ required: true }]}>
                                <DatePicker showTime style={{ width: "100%" }} format="DD/MM/YYYY HH:mm" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="pac_due_date" label="Échéance">
                                <DatePicker showTime style={{ width: "100%" }} format="DD/MM/YYYY HH:mm" />
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item name="pac_duration" label="Durée (min)">
                                <InputNumber style={{ width: "100%" }} min={0} />
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item name="pac_is_done" label="Terminé" valuePropName="checked">
                                <Switch />
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item name="pac_description" label="Description">
                                <Input.TextArea rows={3} placeholder="Description détaillée" />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Spin>
        </Drawer>
    );
}
