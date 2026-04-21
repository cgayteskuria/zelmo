import { Drawer, Form, Input, Button, Space, Popconfirm, Spin } from "antd";
import { DeleteOutlined, SaveOutlined } from "@ant-design/icons";
import { accountJournalsApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";
import CanAccess from "../../components/common/CanAccess";

/**
 * Composant AccountJournal
 * Formulaire d'édition/création d'un journal comptable dans un Drawer
 */
export default function AccountJournal({ journalId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();

    const { submit, remove, loading } = useEntityForm({
        api: accountJournalsApi,
        entityId: journalId,
        idField: 'id',
        form,
        open,

        onSuccess: ({ action, data }) => {
            onSubmit?.({ action, data });
            onClose?.();
        },

        onDelete: ({ id }) => {
            onSubmit?.({ action: 'delete', id });
            onClose?.();
        },
    });

    const drawerActions = (
        <Space>
            {journalId && (
                <CanAccess permission="accountings.edit">
                    <Popconfirm
                        title="Êtes-vous sûr de vouloir supprimer ce journal ?"
                        description="Cette action est irréversible."
                        onConfirm={remove}
                        okText="Supprimer"
                        cancelText="Annuler"
                        okButtonProps={{ danger: true }}
                    >
                        <Button danger icon={<DeleteOutlined />} loading={loading}>
                            Supprimer
                        </Button>
                    </Popconfirm>
                </CanAccess>
            )}
            <Button onClick={onClose}>Annuler</Button>
            <CanAccess permission={journalId ? "accountings.edit" : "accountings.create"}>
                <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()} loading={loading}>
                    {journalId ? "Enregistrer" : "Créer"}
                </Button>
            </CanAccess>
        </Space>
    );

    return (
        <Drawer
            title={journalId ? "Modifier le journal" : "Nouveau journal"}
            open={open}
            onClose={onClose}
            size={drawerSize}
            footer={drawerActions}
            destroyOnHidden
        >
            <Spin spinning={loading} tip="Chargement...">
                <Form form={form} layout="vertical" onFinish={submit} autoComplete="off">
                    <Form.Item name="id" hidden><Input /></Form.Item>
                    <Form.Item name="ajl_code" label="Code" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="ajl_label" label="Libellé" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="ajl_type" label="Type">
                        <Input />
                    </Form.Item>
                </Form>
            </Spin>
        </Drawer>
    );
}
