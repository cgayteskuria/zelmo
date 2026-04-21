import { useEffect } from "react";
import { Card, Form, Input, Button, Row, Col, Divider, Avatar, Typography } from "antd";
import { SaveOutlined, LockOutlined, UserOutlined } from "@ant-design/icons";
import { message } from "../../utils/antdStatic";
import PageContainer from "../../components/common/PageContainer";
import { profileApi } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

const { Title, Text } = Typography;

function getInitials(user) {
    const first = user?.firstname?.[0] ?? "";
    const last = user?.lastname?.[0] ?? "";
    return (first + last).toUpperCase() || "?";
}

export default function MyProfile() {
    const { user, updateUser } = useAuth();
    const [infoForm] = Form.useForm();
    const [pwdForm] = Form.useForm();

    useEffect(() => {
        if (user) {
            infoForm.setFieldsValue({
                firstname: user.firstname,
                lastname:  user.lastname,
                email:     user.email ?? user.login,
                tel:       user.tel,
                mobile:    user.mobile,
                jobtitle:  user.jobtitle,
            });
        }
    }, [user, infoForm]);

    const handleUpdateInfo = async (values) => {
        try {
            const res = await profileApi.update(values);
            updateUser(res.user);
            message.success("Profil mis à jour.");
        } catch (err) {
            message.error(err?.message ?? "Erreur lors de la mise à jour.");
        }
    };

    const handleChangePassword = async (values) => {
        try {
            await profileApi.changePassword(values);
            message.success("Mot de passe modifié avec succès.");
            pwdForm.resetFields();
        } catch (err) {
            message.error(err?.message ?? "Erreur lors du changement de mot de passe.");
        }
    };

    return (
        <PageContainer title="Mon profil">
            {/* En-tête avatar */}
            <Card style={{ borderRadius: "var(--radius-card)", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    <Avatar size={64} style={{ background: "#7c3aed", color: "#fff", fontSize: 24, fontWeight: 700, flexShrink: 0, userSelect: "none" }}>
                        {getInitials(user)}
                    </Avatar>
                    <div>
                        <Title level={4} style={{ margin: 0 }}>
                            {user?.firstname} {user?.lastname}
                        </Title>
                        <Text type="secondary">{user?.email ?? user?.login}</Text>
                        {user?.jobtitle && <><br /><Text type="secondary" style={{ fontSize: 13 }}>{user.jobtitle}</Text></>}
                    </div>
                </div>
            </Card>

            <Row gutter={16}>
                {/* Informations personnelles */}
                <Col xs={24} lg={14}>
                    <Card
                        title={<><UserOutlined style={{ marginRight: 8 }} />Informations personnelles</>}
                        style={{ borderRadius: "var(--radius-card)" }}
                    >
                        <Form form={infoForm} layout="vertical" onFinish={handleUpdateInfo}>
                            <Row gutter={12}>
                                <Col span={12}>
                                    <Form.Item name="firstname" label="Prénom" rules={[{ required: true, message: "Requis" }]}>
                                        <Input />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="lastname" label="Nom" rules={[{ required: true, message: "Requis" }]}>
                                        <Input />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Form.Item name="email" label="Adresse e-mail (login)" extra="L'adresse e-mail ne peut pas être modifiée ici.">
                                <Input disabled style={{ color: "var(--color-muted)", background: "var(--bg-subtle)", cursor: "not-allowed" }} />
                            </Form.Item>
                            <Form.Item name="jobtitle" label="Fonction / Poste">
                                <Input placeholder="Ex : Développeur, Comptable…" />
                            </Form.Item>
                            <Row gutter={12}>
                                <Col span={12}>
                                    <Form.Item name="tel" label="Téléphone fixe">
                                        <Input placeholder="+33 1 23 45 67 89" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="mobile" label="Téléphone mobile">
                                        <Input placeholder="+33 6 12 34 56 78" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Form.Item style={{ marginBottom: 0 }}>
                                <Button type="primary" icon={<SaveOutlined />} htmlType="submit">
                                    Enregistrer
                                </Button>
                            </Form.Item>
                        </Form>
                    </Card>
                </Col>

                {/* Changement de mot de passe */}
                <Col xs={24} lg={10}>
                    <Card
                        title={<><LockOutlined style={{ marginRight: 8 }} />Changer le mot de passe</>}
                        style={{ borderRadius: "var(--radius-card)" }}
                    >
                        <Form form={pwdForm} layout="vertical" onFinish={handleChangePassword}>
                            <Form.Item
                                name="current_password"
                                label="Mot de passe actuel"
                                rules={[{ required: true, message: "Requis" }]}
                            >
                                <Input.Password />
                            </Form.Item>
                            <Divider style={{ margin: "12px 0" }} />
                            <Form.Item
                                name="new_password"
                                label="Nouveau mot de passe"
                                rules={[
                                    { required: true, message: "Requis" },
                                    { min: 8, message: "8 caractères minimum" },
                                ]}
                            >
                                <Input.Password />
                            </Form.Item>
                            <Form.Item
                                name="new_password_confirmation"
                                label="Confirmer le nouveau mot de passe"
                                dependencies={["new_password"]}
                                rules={[
                                    { required: true, message: "Requis" },
                                    ({ getFieldValue }) => ({
                                        validator(_, value) {
                                            if (!value || getFieldValue("new_password") === value) {
                                                return Promise.resolve();
                                            }
                                            return Promise.reject("Les mots de passe ne correspondent pas.");
                                        },
                                    }),
                                ]}
                            >
                                <Input.Password />
                            </Form.Item>
                            <Form.Item style={{ marginBottom: 0 }}>
                                <Button type="primary" icon={<LockOutlined />} htmlType="submit">
                                    Modifier le mot de passe
                                </Button>
                            </Form.Item>
                        </Form>
                    </Card>
                </Col>
            </Row>
        </PageContainer>
    );
}
