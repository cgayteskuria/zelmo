import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { Form, Input, Button, Row, Col, DatePicker, Popconfirm, Space, Spin, Table, InputNumber, Alert, Tabs, Tag } from "antd";
import { message } from '../../utils/antdStatic';
import { DeleteOutlined, SaveOutlined, CheckOutlined, ArrowLeftOutlined, CheckCircleOutlined, EditOutlined, PrinterOutlined, InboxOutlined, ToolOutlined } from "@ant-design/icons";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { customerDeliveryNotesApi, supplierReceptionNotesApi } from "../../services/api";
import { handleBizPrint } from "../../utils/BizDocumentUtils.js";
import { useEntityForm } from "../../hooks/useEntityForm";
import PageContainer from "../../components/common/PageContainer";
import CanAccess from "../../components/common/CanAccess";
import PartnerSelect from "../../components/select/PartnerSelect";
import ContactSelect from "../../components/select/ContactSelect";
import WarehouseSelect from "../../components/select/WarehouseSelect";
import dayjs from 'dayjs';

const FilesTab = lazy(() => import('../../components/bizdocument/FilesTab'));
const LinkedObjectsTab = lazy(() => import('../../components/bizdocument/LinkedObjectsTab'));

const { TextArea } = Input;

/**
 * Page de bon de livraison/réception (pleine page)
 */
export default function DeliveryNote() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const isCustomer = location.pathname.includes('customer');
    const noteId = id === 'new' ? null : parseInt(id, 10);
    const basePath = isCustomer ? '/customer-delivery-notes' : '/supplier-reception-notes';

    const [form] = Form.useForm();
    const [lineForm] = Form.useForm();
    const [lines, setLines] = useState([]);
  
    const [isValidated, setIsValidated] = useState(false);
    const [parentBeingEdited, setParentBeingEdited] = useState(false);
    const [documentsCount, setDocumentsCount] = useState(undefined);
    const modifiedLinesRef = useRef({});

    const api = isCustomer ? customerDeliveryNotesApi : supplierReceptionNotesApi;
    const partnerId = Form.useWatch('fk_ptr_id', form);
    const [pageLabel, setPageLabel] = useState('');

    const loadLines = useCallback(async () => {
        if (noteId) {
            try {
                const response = await api.getLines(noteId);
                setLines(response.data || []);
            } catch (error) {
                console.error("Erreur chargement lignes:", error);
            }
        }
    }, [noteId, api]);

    const transformData = useCallback((data) => ({
        ...data,
        dln_date: data.dln_date ? dayjs(data.dln_date) : null,
        dln_expected_date: data.dln_expected_date ? dayjs(data.dln_expected_date) : null,
    }), []);

    const onDataLoadedCallback = useCallback((data) => {
        if (data.dln_number) {
            setPageLabel(data.dln_number);
        }
            // Toujours mettre à jour documentsCount, même si c'est 0
        setDocumentsCount(data.documents_count ?? 0);
        setIsValidated(data.dln_status === 1);
        setParentBeingEdited(!!data.parent_being_edited);
        loadLines();
    }, [loadLines]);

    const onSuccessCallback = useCallback(({ action, data }) => {
        if (action === 'create' && data?.id) {
            navigate(`${basePath}/${data.id}`, { replace: true });
        } else if (action === 'delete') {
            navigate(basePath);
        }
    }, [navigate, basePath]);

    const onDeleteCallback = useCallback(() => {
        navigate(basePath);
    }, [navigate, basePath]);

    const { submit, remove, loading, loadError, entity } = useEntityForm({
        api,
        entityId: noteId,
        idField: 'dln_id',
        form,
        open: true,
        transformData,
        onDataLoaded: onDataLoadedCallback,
        onSuccess: onSuccessCallback,
        onDelete: onDeleteCallback,
    });

    useEffect(() => {
        if (loadError && noteId) {
            message.error("Le bon demandé n'existe pas ou vous n'avez pas les droits pour y accéder");
            navigate(basePath);
        }
    }, [loadError, noteId, navigate, basePath]);

    const saveModifiedLines = useCallback(async () => {
        const modified = modifiedLinesRef.current;
        const lineIds = Object.keys(modified);
        if (lineIds.length === 0) return;

        const promises = lineIds.map((lineId) => {
            const lineData = lines.find(l => String(l.id) === String(lineId));
            if (!lineData) return Promise.resolve();
            const changes = modified[lineId];
            return api.saveLine(noteId, {
                dnl_id: lineData.id,
                dnl_qty: changes.dnl_qty ?? lineData.dnl_qty,
                dnl_lot_number: changes.dnl_lot_number ?? lineData.dnl_lot_number,
                dnl_serial_number: changes.dnl_serial_number ?? lineData.dnl_serial_number,
            });
        });

        await Promise.all(promises);
        modifiedLinesRef.current = {};
        await loadLines();
    }, [api, noteId, lines, loadLines]);

    const handleFormSubmit = useCallback(async (values) => {
        const submitData = {
            ...values,
            dln_date: values.dln_date ? values.dln_date.format('YYYY-MM-DD') : null,
            dln_expected_date: values.dln_expected_date ? values.dln_expected_date.format('YYYY-MM-DD') : null,
        };
        await submit(submitData);
        await saveModifiedLines();
    }, [submit, saveModifiedLines]);

    const handleDelete = useCallback(async () => {
        await remove();
    }, [remove]);

    const handleValidate = useCallback(async () => {
        if (lines.length === 0) {
            message.error("Le bon doit contenir au moins une ligne");
            return;
        }

        try {
            await saveModifiedLines();
            const response = await api.validate(noteId);
            if (response.data?.remainder_note) {
                message.success("Bon marqué comme réalisé. Un nouveau bon brouillon a été créé pour le reliquat.", 5);
            } else {
                message.success("Bon marqué comme réalisé avec succès");
            }
            navigate(basePath);
        } catch (error) {
            message.error(error.response?.data?.message || "Erreur lors de la validation");
        }
    }, [lines, api, noteId, navigate, basePath]);


    const handleBack = useCallback(() => {
        navigate(basePath);
    }, [navigate, basePath]);

    const handleLineFieldChange = useCallback((recordId, field, value) => {
        modifiedLinesRef.current[recordId] = {
            ...modifiedLinesRef.current[recordId],
            [field]: value,
        };
    }, []);



    const handlePrint = useCallback(async () => {
        await handleBizPrint(
            api.printPdf,
            noteId,
            "Veuillez enregistrer le bon avant de l'imprimer"
        );
    }, [api, noteId]);

    // Construire les colonnes du tableau
    const lineColumns = useMemo(() => {
        const hasReliquat = lines.some(l => {
            const remaining = (l.qty_ordered || 0) - (l.qty_already_delivered || 0) - (l.dnl_qty || 0);
            return (l.fk_orl_id || l.fk_pol_id) && remaining > 0;
        });

        const cols = [
            // Type (stockable / service)
            {
                title: 'Type',
                dataIndex: 'prt_type',
                key: 'prt_type',
                width: 90,
                align: 'center',
                render: (value) => {
                    if (value === 0) return <Tag icon={<InboxOutlined />} color="blue" disabled={false}>Produit</Tag>;
                    if (value === 1) return <Tag icon={<ToolOutlined />} color="default" disabled={false}>Service</Tag>;
                    return null;
                }
            },
            // Produit/Service
            {
                title: 'Produit / Service',
                dataIndex: "dnl_prtlib",
                key: "dnl_prtlib",
                ellipsis: true,
                render: (_, record) => (
                    <div style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: '1.5em',
                    }}>
                        <div style={{ fontWeight: '600' }}>{record.dnl_prtlib}</div>
                        {record.prt_ref && <span style={{ fontSize: '0.85em', color: '#999' }}>{record.prt_ref}</span>}
                    </div>
                )
            },
            {
                title: 'N° Série',
                dataIndex: 'dnl_serial_number',
                key: 'dnl_serial_number',
                width: 200,
                // align: 'right',
                render: (value, record) => {
                    if (isValidated) return value || '';
                    return (
                        <Input
                            size="small"
                            defaultValue={value}
                            style={{ width: '100%' }}
                            onChange={(e) => handleLineFieldChange(record.id, 'dnl_serial_number', e.target.value)}
                        />
                    );
                }
            },
            {
                title: 'N° de lot',
                dataIndex: 'dnl_lot_number',
                key: 'dnl_lot_number',
                width: 200,
                // align: 'right',
                render: (value, record) => {
                    if (isValidated) return value || '';
                    return (
                        <Input
                            size="small"
                            defaultValue={value}
                            style={{ width: '100%' }}
                            onChange={(e) => handleLineFieldChange(record.id, 'dnl_lot_number', e.target.value)}
                        />
                    );
                }
            },
            // Qté commandée
            {
                title: 'Qté cdé',
                dataIndex: 'qty_ordered',
                key: 'qty_ordered',
                width: 90,
                align: 'right',
                render: (value) => value > 0 ? value : '',
            },
        ];
        // Qté déjà réalisée
        if (!isValidated) {
            cols.push({
                title: isCustomer ? 'Déjà réalisé' : 'Déjà reçu',
                dataIndex: 'qty_already_delivered',
                key: 'qty_already_delivered',
                width: 90,
                align: 'right',
                render: (value) => value > 0 ? value : '',
            });
        }
        // Qté (modifiable)
        cols.push({
            title: 'Qté à livrer',
            dataIndex: 'dnl_qty',
            key: 'dnl_qty',
            width: 120,
            align: 'right',
            render: (value, record) => {
                if (isValidated) return value || '';
                return (
                    <InputNumber
                        size="small"
                        min={0}
                        step={1}
                        defaultValue={value}
                        style={{ width: '100%' }}
                        onChange={(val) => handleLineFieldChange(record.id, 'dnl_qty', val)}
                    />
                );
            }
        });
        // Colonne reliquat (conditionnelle)
        if (hasReliquat) {
            cols.push({
                title: 'Reliquat',
                key: 'qty_remaining',
                width: 90,
                align: 'right',
                render: (_, record) => {
                    if (!record.fk_orl_id && !record.fk_pol_id) return '-';
                    const remaining = (record.qty_ordered || 0) - (record.qty_already_delivered || 0) - (record.dnl_qty || 0);
                    if (remaining <= 0) return <span style={{ color: '#52c41a' }}>0</span>;
                    return <span style={{ color: '#fa8c16', fontWeight: '600' }}>{remaining}</span>;
                }
            });
        }

        return cols;
    }, [lines, isValidated, isCustomer, handleLineFieldChange]);


    const formatStatus = (status) => {
        if (status === 0) return <Tag icon={<EditOutlined variant='outlined' />} color="default">Brouillon</Tag>;
        if (status === 1) return <Tag icon={<CheckCircleOutlined variant='outlined' />} color="success">Réalisé</Tag>;
        return null;
    };

    const tabItems = useMemo(() => {
        const items = [
            {
                key: 'fiche',
                label: 'Fiche',
                children: (
                    <>
                        <Row gutter={[0, 8]}>
                            <Col span={18} className="box" style={{
                                backgroundColor: "var(--layout-body-bg)",
                                paddingLeft: '16px',
                                paddingRight: '16px',
                            }}>
                                <Row gutter={[16, 8]}>
                                    <Col span={4}>
                                        <Form.Item
                                            name="dln_date"
                                            label="Date"
                                            rules={[{ required: true, message: "La date est obligatoire" }]}
                                        >
                                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={4}>
                                        <Form.Item name="dln_expected_date" label={isCustomer ? "Date livraison prévue" : "Date réception prévue"}>
                                            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="dln_externalreference" label="Réf. externe">
                                            <Input maxLength={100} />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={[16, 8]}>
                                    <Col span={8}>
                                        <Form.Item
                                            name="fk_ptr_id"
                                            label={isCustomer ? "Client" : "Fournisseur"}
                                            rules={[{ required: true, message: `Le ${isCustomer ? 'client' : 'fournisseur'} est obligatoire` }]}
                                        >
                                            <PartnerSelect
                                                filters={isCustomer ? { ptr_is_customer: 1 } : { ptr_is_supplier: 1 }}
                                                loadInitially={!noteId ? true : false}
                                                initialData={entity?.partner}
                                                disabled={!!noteId}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="fk_ctc_id" label="Contact">
                                            <ContactSelect
                                                filters={{ fk_ptr_id: partnerId }}
                                                initialData={entity?.contact}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item
                                            name="fk_whs_id"
                                            label="Entrepôt"
                                            rules={[{ required: true, message: "L'entrepôt est obligatoire" }]}
                                        >
                                            <WarehouseSelect
                                                loadInitially={!noteId ? true : false}
                                                initialData={entity?.warehouse}
                                                selectDefault={true}
                                                disabled={!!noteId}
                                                onDefaultSelected={(id) => {
                                                    if (!noteId) {
                                                        form.setFieldValue('fk_whs_id', id);
                                                    }
                                                }}
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={[16, 8]}>
                                    <Col span={8}>
                                        <Form.Item name="dln_carrier" label="Transporteur">
                                            <Input maxLength={100} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="dln_tracking_number" label="N° de suivi">
                                            <Input maxLength={100} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="dln_note" label="Notes">
                                            <TextArea rows={2} />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </Col>

                            {/* Colonne boutons d'action */}
                            <Col span={6} style={{ paddingLeft: '8px', paddingRight: '8px' }}>
                                <Row gutter={8}>
                                    {!isValidated && (
                                        <Col span={24}>
                                            <CanAccess permission={noteId ? "stocks.edit" : "stocks.create"}>
                                                <Button
                                                    color="green"
                                                    variant="solid"
                                                    size="default"
                                                    icon={<SaveOutlined />}
                                                    onClick={() => form.submit()}
                                                    loading={loading}
                                                    style={{ width: '100%', margin: '4px' }}
                                                >
                                                    {noteId ? "Enregistrer" : "Créer"}
                                                </Button>
                                            </CanAccess>
                                        </Col>
                                    )}
                                    {noteId && !isValidated && (
                                        <Col span={24}>
                                            <CanAccess permission="stocks.edit">
                                                <Popconfirm
                                                    title="Marquer comme réalisé ?"
                                                    description="Cette action créera les mouvements de stock et ne peut pas être annulée."
                                                    onConfirm={handleValidate}
                                                    okText="Confirmer"
                                                    cancelText="Annuler"
                                                    disabled={parentBeingEdited}
                                                >
                                                    <Button
                                                        type="primary"
                                                        icon={<CheckOutlined />}
                                                        style={{ width: '100%', margin: '4px' }}
                                                        size="default"
                                                        disabled={parentBeingEdited}
                                                    >
                                                        Marquer comme réalisé
                                                    </Button>
                                                </Popconfirm>
                                            </CanAccess>
                                        </Col>
                                    )}
                                </Row>
                                {noteId && (
                                    <Row gutter={8}>
                                        <Col span={24}>
                                            <Button
                                                type="default"
                                                icon={<PrinterOutlined />}
                                                onClick={handlePrint}
                                                style={{ width: '100%', margin: '4px' }}
                                                size="default"
                                                disabled={false}
                                            >
                                                Imprimer
                                            </Button>
                                        </Col>
                                    </Row>
                                )}
                                {parentBeingEdited && !isValidated && (
                                    <Alert
                                        message="Commande en cours de modification"
                                        description="La commande liée est en cours d'édition. La validation du bon est bloquée jusqu'à la fin de la modification."
                                        type="warning"
                                        showIcon
                                        style={{ margin: '16px 0px 0' }}
                                    />
                                )}
                                {isValidated && (
                                    <Alert
                                        message="Bon réalisé"
                                        description="Ce bon a été réalisé et ne peut plus être modifié. Les mouvements de stock ont été créés."
                                        type="success"
                                        showIcon
                                        style={{ margin: '16px 0px 0' }}
                                    />
                                )}
                            </Col>
                        </Row>

                        {/* Section lignes */}
                        {noteId && (
                            <div style={{ marginTop: '24px' }}>
                                <Table
                                    dataSource={lines}
                                    columns={lineColumns}
                                    rowKey="id"
                                    size="small"
                                    pagination={false}
                                    locale={{ emptyText: "Aucune ligne" }}
                                    rowClassName={(record) => record.prt_type === 'service' ? 'row-service' : ''}
                                />
                                <style>{`.row-service td { background-color: #fafafa !important; color: #888; }`}</style>
                            </div>
                        )}
                    </>
                )
            }
        ];

        if (noteId) {
            items.push({
                key: 'linked-objects',
                label: 'Objets Liés',
                children: (
                    <Suspense fallback={<Spin size="large" spinning={true}><div style={{ minHeight: '200px' }} /></Spin>}>
                        <LinkedObjectsTab
                            module={isCustomer ? "customer-delivery-notes" : "supplier-reception-notes"}
                            recordId={noteId}
                            apiFunction={api.getLinkedObjects}
                        />
                    </Suspense>
                )
            });
            items.push({
                key: 'files',
                label: `Documents${documentsCount !== undefined ? ` (${documentsCount})` : ''}`,
                children: (
                    <Suspense fallback={<Spin size="large" spinning={true}><div style={{ minHeight: '200px' }} /></Spin>}>
                        <FilesTab
                            module={isCustomer ? "customer-delivery-notes" : "supplier-reception-notes"}
                            recordId={noteId}
                            getDocumentsApi={api.getDocuments}
                            uploadDocumentsApi={api.uploadDocuments}
                            onCountChange={setDocumentsCount}
                        />
                    </Suspense>
                )
            });
        }

        return items;
    }, [noteId, isCustomer, isValidated, parentBeingEdited, partnerId, lines, lineColumns, loading, documentsCount, api, form, lineForm, handleValidate, handleDelete]);

    const title = isCustomer
        ? (noteId ? `Bon de livraison - ${pageLabel}` : "Nouveau bon de livraison")
        : (noteId ? `Bon de réception - ${pageLabel}` : "Nouveau bon de réception");

    return (
        <PageContainer
            title={<Space>{title}</Space>}
            headerStyle={{
                center: noteId ? (
                    <Space>
                        {formatStatus(isValidated ? 1 : 0)}
                    </Space>
                ) : null
            }}
            actions={
                <Space>
                    <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
                        Retour
                    </Button>
                </Space>
            }
        >
            <Spin spinning={loading} tip="Chargement...">
                <div style={{
                    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)",
                    borderRadius: "8px",
                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
                }}>

                    <Form
                        disabled={isValidated}
                        component={false}
                        form={form}
                        layout="vertical"
                        onFinish={handleFormSubmit}
                        initialValues={{
                            dln_date: dayjs(),
                        }}
                    >
                        <Form.Item name="dln_id" hidden>
                            <Input />
                        </Form.Item>
                        <Tabs
                            items={tabItems}
                            styles={{
                                content: { padding: 8 },
                            }}
                        />
                    </Form>
                </div>
            </Spin>
        </PageContainer>
    );
}
