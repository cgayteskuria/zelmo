import { useState, useEffect } from "react";
import { Drawer, Form, Input, Button, Space, Popconfirm, Divider, Checkbox, Row, Col, Collapse, Spin } from "antd";
import { message } from '../../utils/antdStatic';
import { DeleteOutlined, SaveOutlined, LockOutlined } from "@ant-design/icons";
import { rolesApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";
import CanAccess from "../../components/common/CanAccess";

const { Panel } = Collapse;

/**
 * Composant Role
 * Formulaire d'édition/création d'un rôle dans un Drawer
 */
export default function Role({ roleId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();
    const [allPermissions, setAllPermissions] = useState({});
    const [selectedPermissions, setSelectedPermissions] = useState([]);

    const pageLabel = Form.useWatch('name', form);

    /**
     * Charger toutes les permissions disponibles groupées par module
     */
    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                const response = await rolesApi.getAllPermissions();
                setAllPermissions(response.data || {});
            } catch (error) {
                message.error("Erreur lors du chargement des permissions");
            }
        };

        fetchPermissions();
    }, []);

    /**
     * Fonctions CRUD
     */
    const { submit, remove, loading } = useEntityForm({
        api: rolesApi,
        entityId: roleId,
        idField: 'id',
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

        onDataLoaded: async (data) => {           
            // Charger les permissions du rôle
            if (data.permissions) {
                setSelectedPermissions(data.permissions);
                form.setFieldValue('permissions', data.permissions);
            }
        },
    });

    const handleFormSubmit = async (values) => {
        await submit({
            ...values,
            permissions: selectedPermissions,
        });
    };

    const handleDelete = async () => {
        await remove();
    };

    /**
     * Gérer la sélection/désélection d'une permission
     */
    const handlePermissionChange = (permissionName, checked) => {
        setSelectedPermissions(prev => {
            if (checked) {
                return [...prev, permissionName];
            } else {
                return prev.filter(p => p !== permissionName);
            }
        });
    };

    /**
     * Sélectionner/désélectionner toutes les permissions d'un module
     */
    const handleModuleSelectAll = (module, permissions, checked) => {
        const modulePermissions = permissions.map(p => p.name);
        setSelectedPermissions(prev => {
            if (checked) {
                // Ajouter toutes les permissions du module
                return [...new Set([...prev, ...modulePermissions])];
            } else {
                // Retirer toutes les permissions du module
                return prev.filter(p => !modulePermissions.includes(p));
            }
        });
    };

    /**
     * Vérifier si toutes les permissions d'un module sont sélectionnées
     */
    const isModuleFullySelected = (permissions) => {
        return permissions.every(p => selectedPermissions.includes(p.name));
    };

    /**
     * Vérifier si au moins une permission d'un module est sélectionnée
     */
    const isModulePartiallySelected = (permissions) => {
        return permissions.some(p => selectedPermissions.includes(p.name)) &&
            !isModuleFullySelected(permissions);
    };

    /**
     * Actions du drawer (footer)
     */
    const drawerActions = (
        <Space>
            {roleId && (
                <CanAccess permission="users.delete">
                    <Popconfirm
                        title="Êtes-vous sûr de vouloir supprimer ce rôle ?"
                        description="Cette action est irréversible."
                        onConfirm={handleDelete}
                        okText="Supprimer"
                        cancelText="Annuler"
                        okButtonProps={{ danger: true }}
                    >
                        <Button
                            danger
                            icon={<DeleteOutlined />}
                            loading={loading}
                        >
                            Supprimer
                        </Button>
                    </Popconfirm>
                </CanAccess>
            )}

            <Button onClick={onClose}>
                Annuler
            </Button>

            <CanAccess permission={roleId ? "users.edit" : "users.create"}>
                <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={() => form.submit()}
                    loading={loading}
                >
                    {roleId ? "Enregistrer" : "Créer"}
                </Button>
            </CanAccess>
        </Space>
    );

    return (
        <Drawer
            title={roleId ? `Modifier le rôle "${pageLabel}"` : "Nouveau rôle"}
            open={open}
            onClose={onClose}
            size={drawerSize}
            footer={drawerActions}
            destroyOnHidden
        >
            <Spin spinning={loading} tip="Chargement...">
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFormSubmit}
                    autoComplete="off"
                >
                                        <Form.Item name="id" hidden>
                        <Input />
                    </Form.Item>

                    {/* Informations du rôle */}
                    <Divider titlePlacement="left">
                        <LockOutlined /> Informations du rôle
                    </Divider>

                    <Form.Item
                        name="name"
                        label="Nom du rôle"
                        rules={[
                            { required: true, message: "Le nom du rôle est obligatoire" },
                        ]}
                    >
                        <Input placeholder="Ex: Administrateur, Manager, Vendeur..." />
                    </Form.Item>

                    {/* Permissions */}
                    <Divider titlePlacement="left">Permissions ({selectedPermissions.length} sélectionnées)</Divider>

                    <Collapse accordion>
                        {Object.entries(allPermissions).map(([module, permissions]) => (
                            <Panel
                                key={module}
                                header={
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>
                                            {module.replace('-', ' ')}
                                        </span>
                                        <Checkbox
                                            checked={isModuleFullySelected(permissions)}
                                            indeterminate={isModulePartiallySelected(permissions)}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => handleModuleSelectAll(module, permissions, e.target.checked)}
                                        >
                                            Tout sélectionner
                                        </Checkbox>
                                    </div>
                                }
                            >
                                <Row gutter={[16, 16]}>
                                    {permissions.map((permission) => {
                                        const parts = permission.name.split('.');
                                        let label;

                                        // Si la permission a 3 parties (ex: sale-orders.documents.view)
                                        if (parts.length === 3) {
                                            const actionLabels = {
                                                'view': 'Consulter',
                                                'create': 'Ajouter',
                                                'delete': 'Supprimer',
                                                'edit': 'Modifier'
                                            };
                                            label = `${parts[1]} - ${actionLabels[parts[2]] || parts[2]}`;
                                        } else {
                                            // Permission standard avec 2 parties (ex: partners.view)
                                            const actionLabels = {
                                                'view': 'Consulter',
                                                'create': 'Créer',
                                                'delete': 'Supprimer',
                                                'edit': 'Modifier',
                                                'validate': 'Valider',
                                                'print': 'Imprimer',
                                                'reconcile': 'Rapprocher'
                                            };
                                            label = actionLabels[parts[1]] || parts[1];
                                        }

                                        return (
                                            <Col span={12} key={permission.name}>
                                                <Checkbox
                                                    checked={selectedPermissions.includes(permission.name)}
                                                    onChange={(e) => handlePermissionChange(permission.name, e.target.checked)}
                                                >
                                                    {label}
                                                </Checkbox>
                                            </Col>
                                        );
                                    })}
                                </Row>
                            </Panel>
                        ))}
                    </Collapse>
                </Form>
            </Spin>
        </Drawer>
    );
}
