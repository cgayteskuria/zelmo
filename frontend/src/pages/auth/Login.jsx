import { Form, Input, Button, Checkbox, Alert } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from '../../contexts/AuthContext';
import { loginApi } from "../../services/api";
import axios from "axios";
import { getApiBaseUrl } from "../../utils/config";

export default function Login() {
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [branding, setBranding] = useState({ name: "Zelmo", logo: null });
    const navigate = useNavigate();

    useEffect(() => {
        axios.get(`${getApiBaseUrl()}/company/public-branding`)
            .then(res => { if (res.data) setBranding(res.data); })
            .catch(() => { });
    }, []);

    const onFinish = async (values) => {
        setLoading(true);
        setError(null);
        try {
            const data = await loginApi(values.email, values.password, values.remember || false);
            login(data.user, data.token);
            sessionStorage.setItem('menu_needs_refresh', '1');
            navigate("/dashboard");
        } catch (err) {
            const msg = typeof err === 'string' ? err : (err?.message || "Identifiants invalides. Veuillez réessayer.");
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-outer"
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
            }}>

            {/* ── Gauche : message fort ── */}
            <div style={{ flex: 1, maxWidth: 480 }} className="login-tagline">
                {/* Logo en petit en haut */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48 }}>
                    {branding.logo_square ? (
                        <img src={branding.logo_square} alt={branding.name}
                            style={{ height: 60, maxWidth: 140, objectFit: "contain" }} />
                    ) : (
                        <>
                            <div style={{
                                width: 40, height: 40, borderRadius: 12,
                                background: "#7c3aed",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 20, fontWeight: 700, color: "#fff", flexShrink: 0,
                            }}>
                                {branding.name?.[0]?.toUpperCase() ?? "S"}
                            </div>
                            <span style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>
                                {branding.name}
                            </span>
                        </>
                    )}
                </div>

                {/* Tagline principale */}
                <h1 style={{
                    fontSize: "clamp(28px, 3.5vw, 46px)",
                    fontWeight: 800,
                    lineHeight: 1.15,
                    color: "#111827",
                    margin: "0 0 20px",
                    letterSpacing: "-1px",
                }}>
                    Gérez votre activité.<br />
                    <span style={{ color: "#7c3aed" }}>En toute simplicité.</span>
                </h1>

                <p style={{
                    fontSize: 16,
                    color: "#6b7280",
                    lineHeight: 1.7,
                    margin: 0,
                    maxWidth: 380,
                }}>
                    Clients, facturation, suivi du temps, comptabilité et assistance — tout en un seul endroit.
                </p>
            </div>

            {/* ── Droite : card login ── */}
            <div className="login-card" style={{
                background: "#fff",
                borderRadius: 24,
                boxShadow: "0 8px 48px rgba(0,0,0,0.10)",
                padding: "40px 44px 44px",
                width: 420,
                flexShrink: 0,
            }}>
                {/* Logo dans la card */}
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center", // Centre horizontalement tous les enfants
                    marginBottom: 32
                }}>


                    {/* 2. Logo carré ou Nom de l'entreprise */}
                    {branding.logo_square ? (
                        <img src={branding.logo_square} alt={branding.name}
                            style={{ height: 80, maxWidth: 80, }} />
                    ) : (
                        <div style={{
                            width: 60, height: 60, borderRadius: 18,
                            background: "#7c3aed",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 28, fontWeight: 700, color: "#fff",
                        }}>
                            {branding.name?.[0]?.toUpperCase() ?? "S"}
                        </div>
                    )}

                    {/* 3. Texte d'accroche */}
                    <div style={{ marginTop: 6, fontSize: 13, color: "#9ca3af" }}>
                        Connectez-vous à votre espace
                    </div>
                </div>

                {error && (
                    <Alert
                        description={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: 20, borderRadius: 10 }}
                    />
                )}

                <Form layout="vertical" onFinish={onFinish} size="large">
                    <Form.Item
                        label={<span style={{ fontWeight: 500, fontSize: 13, color: "#374151" }}>Adresse e-mail</span>}
                        name="email"
                        rules={[
                            { required: true, message: "Champ obligatoire" },
                            { type: "email", message: "Email invalide" },
                        ]}
                    >
                        <Input
                            prefix={<UserOutlined style={{ color: "#d1d5db" }} />}
                            placeholder="prenom.nom@exemple.com"
                            style={{ borderRadius: 10, background: "#f9fafb" }}
                        />
                    </Form.Item>

                    <Form.Item
                        label={<span style={{ fontWeight: 500, fontSize: 13, color: "#374151" }}>Mot de passe</span>}
                        name="password"
                        rules={[{ required: true, message: "Champ obligatoire" }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined style={{ color: "#d1d5db" }} />}
                            placeholder="Votre mot de passe"
                            style={{ borderRadius: 10, background: "#f9fafb" }}
                        />
                    </Form.Item>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                        <Form.Item name="remember" valuePropName="checked" style={{ margin: 0 }}>
                            <Checkbox style={{ fontSize: 13 }}>Se souvenir de moi</Checkbox>
                        </Form.Item>
                        <Link to="/forgot-password" style={{ fontSize: 13, color: "#7c3aed", fontWeight: 500 }}>
                            Mot de passe oublié ?
                        </Link>
                    </div>

                    <Button
                        type="primary"
                        htmlType="submit"
                        block
                        loading={loading}
                        style={{
                            borderRadius: 50,
                            height: 50,
                            fontWeight: 600,
                            fontSize: 15,
                            background: "#7c3aed",
                            borderColor: "#7c3aed",
                            boxShadow: "0 4px 16px rgba(124,58,237,0.35)",
                        }}
                    >
                        Se connecter
                    </Button>
                </Form>
            </div>

            {/* Footer */}
            <div style={{
                position: "absolute",
                bottom: 20,
                left: "8%",
                fontSize: 12,
                color: "#9ca3af",
            }}>
                <a href="https://skuria.fr" target="_blank" rel="noopener noreferrer">
                    © {new Date().getFullYear()} skuria.fr
                </a>
            </div>

            {/* Responsive */}
            <style>{`
                @media (max-width: 820px) {
                    .login-tagline { display: none !important; }
                }
                @media (max-width: 520px) {
                    .login-outer {
                        justify-content: center !important;
                        padding: 24px 16px !important;
                        align-items: flex-start !important;
                    }
                    .login-card {
                        width: 100% !important;
                        max-width: 100% !important;
                        border-radius: 16px !important;
                        padding: 28px 20px 32px !important;
                        box-sizing: border-box !important;
                    }
                }
            `}</style>
        </div>
    );
}
