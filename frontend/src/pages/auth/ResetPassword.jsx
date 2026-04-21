import { Form, Input, Button, Card, Typography, Alert } from "antd";
import { message } from '../../utils/antdStatic';
import { LockOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resetPasswordApi } from "../../services/api";

export default function ResetPassword() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const token = searchParams.get("token");

    useEffect(() => {
        if (!token) {
            setError("Lien de reinitialisation invalide. Veuillez demander un nouveau lien.");
        }
    }, [token]);

    const onFinish = async (values) => {
        if (!token) {
            setError("Token de reinitialisation manquant.");
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            await resetPasswordApi(token, values.password, values.password_confirmation);

            setSuccess(true);
            message.success("Mot de passe reinitialise avec succes !", 3);

            // Redirection vers la page de connexion apres 3 secondes
            setTimeout(() => {
                navigate("/login");
            }, 3000);
        } catch (err) {
            const errorMessage = typeof err === 'string' ? err : (err?.message || "Une erreur est survenue");
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="login-outer"
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "40px 8%",
                background: "linear-gradient(135deg, #fce4ec 0%, #e8eaf6 40%, #e0f2fe 100%)",
                gap: 40,
                position: "relative",
                boxSizing: "border-box",
            }}
        >
            <Card
                title="Reinitialiser le mot de passe"
                className="login-card"

            >
                {!success ? (
                    <>
                        <Typography.Paragraph style={{ marginBottom: 24, }}>
                            Entrez votre nouveau mot de passe.
                        </Typography.Paragraph>

                        <Form layout="vertical" onFinish={onFinish}>
                            <Form.Item
                                label="Nouveau mot de passe"
                                name="password"
                                rules={[
                                    { required: true, message: "Champ obligatoire" },
                                    { min: 8, message: "Le mot de passe doit contenir au moins 8 caracteres" },
                                ]}
                            >
                                <Input.Password
                                    prefix={<LockOutlined />}
                                    placeholder="Nouveau mot de passe"
                                    size="large"
                                />
                            </Form.Item>

                            <Form.Item
                                label="Confirmer le mot de passe"
                                name="password_confirmation"
                                dependencies={['password']}
                                rules={[
                                    { required: true, message: "Champ obligatoire" },
                                    ({ getFieldValue }) => ({
                                        validator(_, value) {
                                            if (!value || getFieldValue('password') === value) {
                                                return Promise.resolve();
                                            }
                                            return Promise.reject(new Error('Les mots de passe ne correspondent pas'));
                                        },
                                    }),
                                ]}
                            >
                                <Input.Password
                                    prefix={<LockOutlined />}
                                    placeholder="Confirmer le mot de passe"
                                    size="large"
                                />
                            </Form.Item>

                            {/* Message d'erreur */}
                            {error && (
                                <Alert
                                    description={error}
                                    type="error"
                                    showIcon
                                    style={{ marginBottom: 16 }}
                                />
                            )}

                            <Form.Item>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    block
                                    size="large"
                                    loading={loading}
                                    disabled={!token}
                                    style={{
                                        marginTop: '15px',
                                        borderRadius: '8px',
                                        height: '44px',
                                        fontWeight: 500,
                                        fontSize: '16px'
                                    }}
                                >
                                    Reinitialiser le mot de passe
                                </Button>
                            </Form.Item>

                            <div style={{ textAlign: "center", marginTop: '20px' }}>
                                <Button
                                    type="link"
                                    icon={<ArrowLeftOutlined />}
                                    onClick={() => navigate("/login")}
                                    style={{
                                        color: 'white',
                                        fontSize: 14,
                                        padding: 0
                                    }}
                                >
                                    Retour a la connexion
                                </Button>
                            </div>
                        </Form>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <Alert
                            message="Mot de passe reinitialise !"
                            description="Votre mot de passe a ete reinitialise avec succes. Vous allez etre redirige vers la page de connexion."
                            type="success"
                            showIcon
                            style={{ marginBottom: 20 }}
                        />
                        <Typography.Paragraph style={{ color: 'rgba(255,255,255,0.85)' }}>
                            Redirection vers la page de connexion...
                        </Typography.Paragraph>
                    </div>
                )}
            </Card>

            <style>{`
                @media (max-width: 520px) {
                    .login-outer {
                        padding: 24px 16px !important;
                        align-items: flex-start !important;
                    }
                    .login-card {
                        width: 100% !important;
                        max-width: 100% !important;
                        box-sizing: border-box !important;
                    }
                }
            `}</style>
        </div>
    );
}
