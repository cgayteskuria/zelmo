import { Form, Input, Button, Card, Typography, Alert } from "antd";
import { message } from '../../utils/antdStatic';
import { MailOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { forgotPasswordApi } from "../../services/api";

export default function ForgotPassword() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    const onFinish = async (values) => {
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            // Appel API pour demander la réinitialisation
            await forgotPasswordApi(values.email);

            setSuccess(true);
            message.success("Email de réinitialisation envoyé !", 3);

            // Redirection vers la page de connexion après 3 secondes
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
                title="Mot de passe oublié"
                className="login-card"
            >
                {!success ? (
                    <>
                        <Typography.Paragraph style={{ marginBottom: 24, }}>
                            Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
                        </Typography.Paragraph>

                        <Form layout="vertical" onFinish={onFinish}>
                            <Form.Item
                                label="Email"
                                name="email"
                                rules={[
                                    { required: true, message: "Champ obligatoire" },
                                    { type: "email", message: "Email invalide" },
                                ]}
                            >
                                <Input
                                    prefix={<MailOutlined />}
                                    placeholder="Votre email"
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
                                    style={{
                                        marginTop: '15px',
                                        borderRadius: '8px',
                                        height: '44px',
                                        fontWeight: 500,
                                        fontSize: '16px'
                                    }}
                                >
                                    Envoyer le lien
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
                                    Retour à la connexion
                                </Button>
                            </div>
                        </Form>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <Alert
                            message="Email envoyé avec succès !"
                            description="Vérifiez votre boîte de réception et suivez les instructions pour réinitialiser votre mot de passe."
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