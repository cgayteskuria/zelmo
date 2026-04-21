import { useState, useEffect, useCallback } from "react";
import { Drawer, Form, Input, Button, Row, Col, Switch, Popconfirm, Divider, Tag, Space, Tabs, App, Checkbox, Collapse, Spin } from "antd";
import { DeleteOutlined, SaveOutlined, UserOutlined, MailOutlined, PhoneOutlined, KeyOutlined, LockOutlined } from "@ant-design/icons";
import { usersApi, rolesApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";
import CanAccess from "../../components/common/CanAccess";
import RoleSelect from "../../components/select/RoleSelect";
import AccountSelect from "../../components/select/AccountSelect";
import UserSelect from "../../components/select/UserSelect";
import VehiclesTab from "../../components/user/VehiclesTab";

const { Panel } = Collapse;

/**
 * Composant User
 * Formulaire d'édition/création d'un utilisateur dans un Drawer
 */
export default function User({ userId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();
    const { message } = App.useApp();

    const [allPermissions, setAllPermissions] = useState({});
    const [selectedRoles, setSelectedRoles] = useState([]);
    const [selectedDirectPermissions, setSelectedDirectPermissions] = useState([]);

    const [activeTab, setActiveTab] = useState('1');
    const pageLabel = Form.useWatch('usr_login', form);
    const isEmployee = Form.useWatch('usr_is_employee', form);


    const onDataLoadedCallback = useCallback(async (data) => {
        // Charger les permissions de l'utilisateur si édition   
        if (data.usr_id) {
            try {

                setSelectedRoles(data.roles?.map(r => r.id) || []);
                // Charger toutes les permissions
                const permsResponse = await rolesApi.getAllPermissions();
                setAllPermissions(permsResponse.data || {});

                const perms = await usersApi.getPermissions(userId);
                setSelectedDirectPermissions(perms.data.direct_permissions || []);

            } catch (error) {
                console.error("Erreur lors du chargement des rôles et  permissions:", error);
            }
        }

    }, []);
    /**
     * Fonctions CRUD
     */
    const { submit, remove, loading, loadError, reload, entity } = useEntityForm({
        api: usersApi,
        entityId: userId,
        idField: 'usr_id',
        form,
        open,
        onDataLoaded: onDataLoadedCallback,
        onSuccess: async ({ action, data }, closeDrawer = true) => {
            // Sauvegarder les rôles et permissions si édition
            if (userId && action === 'update') {
                try {
                    // Synchroniser les rôles             
                    await usersApi.syncRoles(userId, selectedRoles);

                    // Synchroniser les permissions directes
                    await usersApi.syncPermissions(userId, selectedDirectPermissions);
                } catch (error) {
                    message.error('Erreur lors de la mise à jour des rôles/permissions');
                }
            }

            onSubmit?.({ action, data });
            if (closeDrawer) onClose?.();
        },

        onDelete: ({ id }) => {
            onSubmit?.({ action: 'delete', id });
            onClose?.();
        },
    });

    const onFinishFailed = ({ errorFields }) => {
        if (errorFields.length > 0) {
            const firstErrorField = errorFields[0].name[0];

            // Mapper les champs aux onglets
            if (['usr_login', 'usr_password', 'usr_password_confirmation', 'usr_firstname', 'usr_lastname', 'usr_tel', 'usr_mobile', 'usr_jobtitle', 'fk_acc_id_employe', 'fk_usr_id_manager'].includes(firstErrorField)) {
                setActiveTab('1');
            }

            message.error("Veuillez remplir tous les champs obligatoires");
        }
    };

    const handleFormSubmit = async (values) => {
        // Ne pas envoyer le mot de passe s'il est vide (lors d'un update)
        const submitData = { ...values };

        if (userId) {
            // Si c'est une mise à jour et que le mot de passe est vide, on le retire
            if (!submitData.usr_password || submitData.usr_password.trim() === '') {
                delete submitData.usr_password;
                delete submitData.usr_password_confirmation;
            }
        }
        await submit(values);
    };

    const handleDelete = async () => {
        await remove();
    };

    /**
     * Gérer la sélection/désélection d'une permission directe
     */
    const handleDirectPermissionChange = (permissionName, checked) => {
        setSelectedDirectPermissions(prev => {
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
        setSelectedDirectPermissions(prev => {
            if (checked) {
                return [...new Set([...prev, ...modulePermissions])];
            } else {
                return prev.filter(p => !modulePermissions.includes(p));
            }
        });
    };

    /**
     * Vérifier si toutes les permissions d'un module sont sélectionnées
     */
    const isModuleFullySelected = (permissions) => {
        return permissions.every(p => selectedDirectPermissions.includes(p.name));
    };

    /**
     * Vérifier si au moins une permission d'un module est sélectionnée
     */
    const isModulePartiallySelected = (permissions) => {
        return permissions.some(p => selectedDirectPermissions.includes(p.name)) &&
            !isModuleFullySelected(permissions);
    };

    /**
 * Trie les permissions en regroupant par groupe et en suivant un ordre d'actions spécifique.
 * @param {Array} permissions - Liste des permissions { name: string }
 * @param {Array} actionOrder - Ordre des actions pour les sous-permissions (ex: ["view","create","delete"])
 * @returns {Array} Liste triée de permissions
 */
    function sortPermissions(permissions, actionOrder = ["view", "create", "delete"]) {
        const simplePermissions = [];
        const subPermissions = [];

        permissions.forEach((perm) => {
            const parts = perm.name.split('.');
            if (parts.length === 2) {
                // permission simple: accountings.create
                simplePermissions.push(perm);
            } else {
                // sous-permission: accountings.documents.create
                subPermissions.push(perm);
            }
        });

        // Trier simples selon actionOrder
        simplePermissions.sort((a, b) => {
            const actionA = a.name.split('.').pop(); // dernière partie
            const actionB = b.name.split('.').pop();
            return actionOrder.indexOf(actionA) - actionOrder.indexOf(actionB);
        });

        // Trier sous-permissions selon groupe puis actionOrder
        subPermissions.sort((a, b) => {
            const partsA = a.name.split('.');
            const partsB = b.name.split('.');

            // Comparer le groupe secondaire (tous les éléments entre le 1er et l’avant-dernier)
            const groupA = partsA.slice(1, -1).join('.');
            const groupB = partsB.slice(1, -1).join('.');
            if (groupA < groupB) return -1;
            if (groupA > groupB) return 1;

            // Comparer l'action finale selon actionOrder
            const actionA = partsA[partsA.length - 1];
            const actionB = partsB[partsB.length - 1];
            return actionOrder.indexOf(actionA) - actionOrder.indexOf(actionB);
        });

        return [...simplePermissions, ...subPermissions];
    }
    /**
     * Actions du drawer (footer)
     */
    const drawerActions = (

        <Space style={{ width: "100%", display: "flex", paddingRight: "15px", justifyContent: "flex-end" }}>
            {userId && (
                <CanAccess permission="users.delete">
                    <Popconfirm
                        title="Êtes-vous sûr de vouloir supprimer cet utilisateur ?"
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

            <CanAccess permission={userId ? "users.edit" : "users.create"}>
                <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={() => form.submit()}
                    loading={loading}
                >
                    {userId ? "Enregistrer" : "Créer"}
                </Button>
            </CanAccess>
        </Space>

    );

    /**
     * Onglets du formulaire
     */
    const tabItems = [
        {
            key: '1',
            label: 'Informations',
            children: (
                <>
                    {/* Informations de connexion */}
                    <div className="box">
                        <Row gutter={16}>
                            <Col span={24}>
                                <Form.Item
                                    name="usr_login"
                                    label="Email (Login)"
                                    rules={[
                                        { required: true, message: "L'email est obligatoire" },
                                        { type: "email", message: "Email invalide" },
                                    ]}
                                >
                                    <Input
                                        prefix={<MailOutlined />}
                                        placeholder="Email de connexion"
                                        autoComplete="username"
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    name="usr_password"
                                    label="Mot de passe"
                                    rules={userId ? [] : [
                                        { required: true, message: "Le mot de passe est obligatoire" },
                                        { min: 6, message: "Le mot de passe doit contenir au moins 6 caractères" },
                                    ]}
                                >
                                    <Input.Password
                                        placeholder={userId ? "Laisser vide pour ne pas changer" : "Mot de passe"}
                                        autoComplete="new-password"
                                    />
                                </Form.Item>
                            </Col>

                            <Col span={12}>
                                <Form.Item
                                    name="usr_password_confirmation"
                                    label="Confirmer le mot de passe"
                                    dependencies={['usr_password']}
                                    rules={[
                                        ({ getFieldValue }) => ({
                                            validator(_, value) {
                                                const password = getFieldValue('usr_password');
                                                if (!password || !value || password === value) {
                                                    return Promise.resolve();
                                                }
                                                return Promise.reject(new Error('Les mots de passe ne correspondent pas'));
                                            },
                                        }),
                                    ]}
                                >
                                    <Input.Password
                                        placeholder="Confirmer le mot de passe"
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                    {/* Informations personnelles */}
                    <div className="box" style={{ marginTop: "15px" }}>
                        <Divider titlePlacement="left" style={{ fontWeight: "600", marginTop: "0px" }}>
                            <UserOutlined /> Informations personnelles
                        </Divider>

                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    name="usr_firstname"
                                    label="Prénom"
                                    rules={[{ required: true, message: "Le prénom est obligatoire" }]}
                                >
                                    <Input placeholder="Prénom" />
                                </Form.Item>
                            </Col>

                            <Col span={12}>
                                <Form.Item
                                    name="usr_lastname"
                                    label="Nom"
                                    rules={[{ required: true, message: "Le nom est obligatoire" }]}
                                >
                                    <Input placeholder="Nom" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    name="usr_tel"
                                    label="Téléphone"
                                >
                                    <Input
                                        prefix={<PhoneOutlined />}
                                        placeholder="Téléphone fixe"
                                    />
                                </Form.Item>
                            </Col>

                            <Col span={12}>
                                <Form.Item
                                    name="usr_mobile"
                                    label="Mobile"
                                >
                                    <Input
                                        prefix={<PhoneOutlined />}
                                        placeholder="Téléphone mobile"
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col span={24}>
                                <Form.Item
                                    name="usr_jobtitle"
                                    label="Fonction"
                                >
                                    <Input placeholder="Fonction / Poste" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                    {/* Paramètres */}

                    <div className="box" style={{ marginTop: "15px" }}>
                        <Divider titlePlacement="left" style={{ fontWeight: "600", marginTop: "0px" }}>Paramètres</Divider>
                        <Row gutter={16}>
                            <Col span={4}>
                                <Form.Item
                                    name="usr_is_active"
                                    label="Actif"
                                    valuePropName="checked"
                                    initialValue={true}
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>

                            <Col span={4}>
                                <Form.Item
                                    name="usr_is_seller"
                                    label="Commercial"
                                    valuePropName="checked"
                                    initialValue={false}
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>

                            <Col span={4}>
                                <Form.Item
                                    name="usr_is_technician"
                                    label="Technicien"
                                    valuePropName="checked"
                                    initialValue={false}
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>

                            <Col span={4}>
                                <Form.Item
                                    name="usr_is_employee"
                                    label="Salarié"
                                    valuePropName="checked"
                                    initialValue={false}
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                        </Row>

                        {/* Compte comptable salarié - visible uniquement si usr_is_employee */}
                        {isEmployee && (
                            <Row gutter={16} style={{ marginTop: 16 }}>
                                <Col span={12}>
                                    <Form.Item
                                        name="fk_acc_id_employe"
                                        label="Compte comptable salarié"
                                        rules={[{ required: true, message: "Le compte comptable est obligatoire pour un salarié" }]}
                                    >
                                        <AccountSelect
                                            filters={{ type: ['liability_current'],isActive: true }}
                                            placeholder="Sélectionner un compte 421..."
                                            loadInitially={!entity?.fk_acc_id_employe}
                                            initialData={entity?.account}
                                        />
                                    </Form.Item>
                                </Col>

                                <Col span={12}>
                                    <Form.Item
                                        name="fk_usr_id_manager"
                                        label="Manager / Responsable"
                                    >
                                        <UserSelect
                                            filters={{ usr_is_active: true, excluded_ids: entity.usr_id }}
                                            placeholder="Sélectionner un responsable..."
                                            allowClear
                                            loadInitially={!entity?.fk_usr_id_manager}
                                            initialData={entity?.manager}
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                        )}


                    </div>
                </>
            ),
        },
        ...(userId ? [
            {
                key: '2',
                label: `Rôles (${selectedRoles.length})`,
                children: (
                    <>
                        <Divider titlePlacement="left">
                            <LockOutlined /> Attribution des rôles
                        </Divider>

                        <p style={{ marginBottom: 16, color: '#666' }}>
                            Les rôles permettent d'attribuer un ensemble de permissions prédéfinies à l'utilisateur.
                        </p>

                        <RoleSelect
                            mode="multiple"
                            initialData={entity?.roles}
                            style={{ width: '100%' }}
                            value={selectedRoles}
                            onChange={setSelectedRoles}
                        />
                    </>
                ),
            },
            {
                key: '3',
                label: `Permissions directes (${selectedDirectPermissions.length})`,
                children: (
                    <>
                        <Divider titlePlacement="left">
                            <LockOutlined /> Affiner les permissions
                        </Divider>

                        <p style={{ marginBottom: 16, color: '#666' }}>
                            Les permissions directes complètent ou remplacent les permissions héritées des rôles.
                        </p>

                        <Collapse accordion>
                            {Object.entries(allPermissions).map(([module, permissions]) => {
                                // Trier les permissions de ce module
                                const sortedPermissions = sortPermissions(permissions, ["view", "create", "delete"]);
                                return (
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
                                            {sortedPermissions.map((permission) => (
                                                <Col span={12} key={permission.name}>
                                                    <Checkbox
                                                        checked={selectedDirectPermissions.includes(permission.name)}
                                                        onChange={(e) => handleDirectPermissionChange(permission.name, e.target.checked)}
                                                    >

                                                        {permission.name.includes('.')
                                                            ? permission.name.split('.').slice(1).join(' ')
                                                            : permission.name}
                                                    </Checkbox>
                                                </Col>
                                            ))}
                                        </Row>
                                    </Panel>
                                );
                            })}
                        </Collapse>

                    </>
                ),
            },
        ] : []),
        ...(userId && isEmployee ? [{
            key: '4',
            label: `Vehicules${entity?.vehicles_count != null ? ` (${entity.vehicles_count})` : ''}`,
            children: (
                <VehiclesTab userId={userId} />
            ),
        }] : []),
    ];

    return (
        <Drawer
            title={userId ? `Modifier ${pageLabel || "l'utilisateur"}` : "Nouvel utilisateur"}
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
                    onFinishFailed={onFinishFailed}
                    autoComplete="off"
                >
                    <Form.Item name="usr_id" hidden>
                        <Input />
                    </Form.Item>
                    <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
                </Form>
            </Spin>
        </Drawer>
    );
}
