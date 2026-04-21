import { useState } from "react";
import { Drawer, Form, Input, Button, Space, Popconfirm, Alert, Spin, Statistic, Row, Col } from "antd";
import { message } from '../../utils/antdStatic';
import { DeleteOutlined, SaveOutlined, DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import { accountingBackupsApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";
import CanAccess from "../../components/common/CanAccess";

/**
 * Drawer pour créer/voir une sauvegarde comptable
 */
export default function AccountingBackup({ backupId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();
    const [restoring, setRestoring] = useState(false);

    const pageLabel = Form.useWatch('aba_label', form);

    /**
     * Hook CRUD
     */
    const { submit, remove, loading, entity } = useEntityForm({
        api: accountingBackupsApi,
        entityId: backupId,
        idField: 'aba_id',
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

    /**
     * Création d'une sauvegarde
     */
    const handleFormSubmit = async (values) => {
        await submit(values);
        form.resetFields();
    };

    /**
     * Suppression
     */
    const handleDelete = async () => {
        await remove();
    };

    /**
     * Téléchargement
     */
    const handleDownload = async () => {
        try {
            const response = await accountingBackupsApi.download(backupId);

            // response.data est déjà un Blob avec responseType: "blob"
            const url = window.URL.createObjectURL(response);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `backup_${backupId}.zip`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            message.success('Téléchargement lancé');
        } catch (error) {
            console.error('Erreur:', error);
            message.error('Erreur lors du téléchargement');
        }
    };

    /**
     * Restauration
     */
    const handleRestore = async () => {
        setRestoring(true);
        try {
            await accountingBackupsApi.restore(backupId);
            message.success('Restauration effectuée avec succès');
            onClose?.();
        } catch (error) {
            console.error('Erreur:', error);
            message.error('Erreur lors de la restauration');
        } finally {
            setRestoring(false);
        }
    };

    /**
     * Fermeture
     */
    const handleClose = () => {
        form.resetFields();
        if (onClose) {
            onClose();
        }
    };

    /**
     * Actions footer
     */
    const drawerActions = (
        <Space style={{ width: "100%", display: "flex", paddingRight: "15px", justifyContent: "flex-end" }}>
            {backupId && (
                <>
                    <CanAccess permission="accountings.delete">
                        <Popconfirm
                            title="Supprimer cette sauvegarde"
                            description="Êtes-vous sûr ? Cette action est irréversible."
                            onConfirm={handleDelete}
                            okText="Oui"
                            cancelText="Non"
                        >
                            <Button danger icon={<DeleteOutlined />}>
                                Supprimer
                            </Button>
                        </Popconfirm>
                    </CanAccess>
                </>
            )}

            <Button onClick={handleClose}>Fermer</Button>

            {!backupId && (
                <CanAccess permission="accountings.create">
                    <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        onClick={() => form.submit()}
                        loading={loading}
                    >
                        Créer la sauvegarde
                    </Button>
                </CanAccess>
            )}
        </Space>
    );

    return (
        <Drawer
            title={backupId ? (pageLabel || "Sauvegarde") : "Nouvelle sauvegarde"}
            placement="right"
            onClose={handleClose}
            open={open}
            size={drawerSize}
            footer={drawerActions}
            destroyOnHidden
            forceRender
        >
            <Spin spinning={loading || restoring} tip={restoring ? "Restauration en cours..." : "Chargement..."}>
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFormSubmit}
                >
                    <Form.Item name="aba_id" hidden>
                        <Input />
                    </Form.Item>

                    {!backupId && (
                        <>
                            <Alert
                                message="Création d'une sauvegarde"
                                description="Cette action va créer une archive ZIP contenant un fichier JSON par table comptable (comptes, journaux, écritures, rapprochements, etc.)"
                                type="info"
                                showIcon
                                style={{ marginBottom: 24 }}
                            />

                            <Form.Item
                                name="aba_label"
                                label="Description (optionnelle)"
                            >
                                <Input.TextArea
                                    rows={3}
                                    placeholder="Ex: Sauvegarde avant clôture exercice 2025"
                                />
                            </Form.Item>
                        </>
                    )}

                    {backupId && entity && (
                        <div className="box">


                            <Row gutter={16} style={{ marginBottom: 24 }}>
                                <Col span={12}>
                                    <Statistic
                                        title="Taille du fichier"
                                        value={entity.aba_size_human}
                                    />
                                </Col>
                                <Col span={12}>
                                    <Statistic
                                        title="Tables sauvegardées"
                                        value={entity.aba_tables_count}
                                    />
                                </Col>
                            </Row>

                            {entity.aba_rows_count && (
                                <Row gutter={16} style={{ marginBottom: 24 }}>
                                    <Col span={12}>
                                        <Statistic
                                            title="Lignes totales"
                                            value={entity.aba_rows_count.toLocaleString('fr-FR')}
                                        />
                                    </Col>
                                    <Col span={12}>
                                        <Statistic
                                            title="Créé le"
                                            value={new Date(entity.aba_created).toLocaleString('fr-FR')}
                                        />
                                    </Col>
                                </Row>
                            )}

                            {entity.aba_label && (
                                <div style={{ marginBottom: 24 }}>
                                    <strong>Description :</strong>
                                    <p style={{ marginTop: 8 }}>{entity.aba_label}</p>
                                </div>
                            )}

                            <Space orientation="vertical" style={{ width: '100%' }}>
                                <CanAccess permission="accountings.view">
                                    <Button
                                        type="default"
                                        icon={<DownloadOutlined />}
                                        onClick={handleDownload}
                                        block
                                        size="large"
                                    >
                                        Télécharger l'archive ZIP
                                    </Button>
                                </CanAccess>

                                <CanAccess permission="accountings.restore">
                                    <Popconfirm
                                        title="Restaurer cette sauvegarde"
                                        description="Toutes les données comptables seront écrasées. Confirmez-vous ?"
                                        onConfirm={handleRestore}
                                        okText="Oui, restaurer"
                                        cancelText="Annuler"
                                        okButtonProps={{ danger: true }}
                                    >
                                        <Button
                                            type="primary"
                                            danger
                                            icon={<ReloadOutlined />}
                                            block
                                            size="large"
                                        >
                                            Lancer la restauration
                                        </Button>
                                    </Popconfirm>
                                </CanAccess>
                            </Space>
                        </div>
                    )}
                </Form>
            </Spin>
        </Drawer>
    );
}
