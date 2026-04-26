import { useState, useEffect, lazy, Suspense } from "react";
import { Drawer, Form, Input, Button, Row, Col, Divider, Space, Tabs, Upload, Image, Select, Spin } from "antd";
import { message } from '../../utils/antdStatic';
import { SaveOutlined, BuildOutlined, BankOutlined, PictureOutlined, MailOutlined, UploadOutlined, FileImageOutlined, ScanOutlined } from "@ant-design/icons";
import { companyApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";
import CanAccess from "../../components/common/CanAccess";
import MessageTemplateSelect from "../../components/select/MessageTemplateSelect"
import MessageEmailAccountSelect from "../../components/select/MessageEmailAccountSelect"
import CountrySelect from "../../components/select/CountrySelect"
import RichTextEditor from "../../components/common/RichTextEditor";

// Import lazy du composant BankTab
const BankTab = lazy(() => import('../../components/bizdocument/BankTab'));

/**
 * Composant Company
 * Formulaire d'édition de la société dans un Drawer
 */
export default function Company({ companyId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();
    const [logoUrls, setLogoUrls] = useState({
        large: null,
        square: null,
        printable: null
    });

    const pageLabel = Form.useWatch('cop_label', form);

    /**
     * Charger les données de la société
     */
    const onDataLoadedCallback = async (data) => {
        if (data.cop_id) {
            try {
                // Charger les logos en base64
                const loadLogo = async (logoType, docData) => {
                    if (docData?.doc_id) {
                        try {
                            const response = await companyApi.getLogo(data.cop_id, logoType);
                            if (response.success && response.data?.base64) {
                                setLogoUrls(prev => ({
                                    ...prev,
                                    [logoType]: response.data.base64
                                }));
                            }
                        } catch (error) {
                            console.error(`Erreur lors du chargement du logo ${logoType}:`, error);
                        }
                    }
                };

                // Charger les 3 logos en parallèle
                await Promise.all([
                    loadLogo('large', data.logo_large),
                    loadLogo('square', data.logo_square),
                    loadLogo('printable', data.logo_printable)
                ]);
            } catch (error) {
                console.error("Erreur lors du chargement des données:", error);
            }
        }
    };

    /**
     * Fonctions CRUD
     */
    const { submit, loading, loadError, reload, entity } = useEntityForm({
        api: companyApi,
        entityId: companyId,
        idField: 'cop_id',
        form,
        open,
        onDataLoaded: onDataLoadedCallback,
        onSuccess: async ({ action, data }, closeDrawer = true) => {
            message.success('Société mise à jour avec succès');
            onSubmit?.({ action, data });
            if (closeDrawer) onClose?.();
        }
    });

    const handleFormSubmit = async (values) => {
        await submit(values);
    };

    /**
     * Upload de logo
     */
    const handleLogoUpload = async (file, logoType) => {
        const formData = new FormData();
        formData.append('logo', file);
        formData.append('logo_type', logoType);

        try {
            const result = await companyApi.uploadLogo(companyId, formData);

            if (result.data && result.success) {
                message.success('Logo uploadé avec succès');
                reload(); // Recharger les données
            } else {
                message.error(result.message || 'Erreur lors de l\'upload');
            }
        } catch (error) {
            message.error('Erreur lors de l\'upload du logo');
            console.error(error);
        }

        return false; // Empêcher l'upload automatique
    };

    /**
     * Générer l'icône SVG à partir du logo carré
     */
    const handleGenerateSvgIcon = async () => {
        try {
            message.loading({ content: 'Génération de l\'icône SVG en cours...', key: 'svg' });
            const result = await companyApi.generateSvgIcon(companyId);

            if (result.success) {
                message.success({ content: 'Icône SVG générée avec succès !', key: 'svg' });
                message.info(`Fichier: ${result.data.filename}`);
            } else {
                message.error({ content: result.message || 'Erreur lors de la génération', key: 'svg' });
            }
        } catch (error) {
            message.error({ content: 'Erreur lors de la génération de l\'icône SVG', key: 'svg' });
            console.error(error);
        }
    };

    /**
     * Actions du drawer (footer)
     */
    const drawerActions = (
        <Space style={{ width: "100%", display: "flex", paddingRight: "15px", justifyContent: "flex-end" }}>
            <Button onClick={onClose}>
                Annuler
            </Button>

            <CanAccess permission="settings.company.edit">
                <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={() => form.submit()}
                    loading={loading}
                >
                    Enregistrer
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
            label: 'Général',
            icon: <BuildOutlined />,
            children: (
                <>
                    {/* Informations générales */}
                    <div className="box">
                        <Row gutter={16}>
                            <Col span={24}>
                                <Form.Item
                                    name="cop_label"
                                    label="Nom de la société"
                                    rules={[{ required: true, message: "Le nom est obligatoire" }]}
                                >
                                    <Input placeholder="Nom de la société" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col span={24}>
                                <Form.Item
                                    name="cop_address"
                                    label="Adresse"
                                >
                                    <Input placeholder="Adresse" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col span={6}>
                                <Form.Item
                                    name="cop_zip"
                                    label="Code postal"
                                >
                                    <Input placeholder="Code postal" />
                                </Form.Item>
                            </Col>

                            <Col span={12}>
                                <Form.Item
                                    name="cop_city"
                                    label="Ville"
                                >
                                    <Input placeholder="Ville" />
                                </Form.Item>
                            </Col>

                            <Col span={6}>
                                <Form.Item
                                    name="cop_country_code"
                                    label="Pays"
                                >
                                    <CountrySelect initialData={entity?.cop_country_code ?? 'FR'} />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    name="cop_phone"
                                    label="Téléphone"
                                >
                                    <Input placeholder="Téléphone" />
                                </Form.Item>
                            </Col>
                        </Row>
                          <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    name="cop_url_site"
                                    label="Site web"
                                >
                                    <Input placeholder="Site web" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    {/* Informations juridiques */}
                    <div className="box" style={{ marginTop: "15px" }}>
                        <Divider titlePlacement="left" style={{ fontWeight: "600", marginTop: "0px" }}>
                            Informations juridiques
                        </Divider>

                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    name="cop_registration_code"
                                    label="SIRET (siège)"
                                >
                                    <Input placeholder="SIRET" />
                                </Form.Item>
                            </Col>

                            <Col span={12}>
                                <Form.Item
                                    name="cop_legal_status"
                                    label="Forme juridique"
                                >
                                    <Input placeholder="SARL, SAS, etc." />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    name="cop_rcs"
                                    label="RCS"
                                >
                                    <Input placeholder="RCS" />
                                </Form.Item>
                            </Col>

                            <Col span={12}>
                                <Form.Item
                                    name="cop_capital"
                                    label="Capital social"
                                >
                                    <Input placeholder="Capital social" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    name="cop_naf_code"
                                    label="Code NAF ou APE"
                                >
                                    <Input placeholder="Code NAF" />
                                </Form.Item>
                            </Col>

                            <Col span={12}>
                                <Form.Item
                                    name="cop_tax_code"
                                    label="Numéro de TVA"
                                >
                                    <Input placeholder="FR..." />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>


                </>
            ),
        },
        {
            key: '2',
            label: 'Logos',
            icon: <PictureOutlined />,
            children: (
                <>
                    {/* Logo large */}
                    <div className="box">
                        <Divider titlePlacement="left" style={{ fontWeight: "600", marginTop: "0px" }}>
                            Logo
                        </Divider>

                        <Row gutter={16}>
                            <Col span={16}>
                                {logoUrls.large && (
                                    <Image
                                        src={logoUrls.large}
                                        alt="Logo large"
                                        style={{ maxHeight: 70, objectFit: 'contain', backgroundColor :"var(--primary-color)" }}
                                    />
                                )}
                                {!logoUrls.large && (
                                    <div style={{ padding: 20, textAlign: 'center', backgroundColor: '#f5f5f5' }}>
                                        Aucun logo
                                    </div>
                                )}
                            </Col>
                            <Col span={8}>
                                <Upload
                                    beforeUpload={(file) => handleLogoUpload(file, 'large')}
                                    showUploadList={false}
                                    accept="image/jpeg,image/png,image/jpg"
                                >
                                    <Button icon={<UploadOutlined />}>Changer le logo</Button>
                                </Upload>
                            </Col>
                        </Row>
                    </div>

                    {/* Logo carré */}
                    <div className="box" style={{ marginTop: "15px" }}>
                        <Divider titlePlacement="left" style={{ fontWeight: "600", marginTop: "0px" }}>
                            Logo carré
                        </Divider>

                        <Row gutter={16}>
                            <Col span={16}>
                                {logoUrls.square && (
                                    <Image
                                        src={logoUrls.square}
                                        alt="Logo carré"
                                        style={{ maxHeight: 30, objectFit: 'contain' }}
                                    />
                                )}
                                {!logoUrls.square && (
                                    <div style={{ padding: 20, textAlign: 'center', backgroundColor: '#f5f5f5' }}>
                                        Aucun logo carré
                                    </div>
                                )}
                            </Col>
                            <Col span={8}>
                                <Space vertical style={{ width: '100%' }}>
                                    <Upload
                                        beforeUpload={(file) => handleLogoUpload(file, 'square')}
                                        showUploadList={false}
                                        accept="image/jpeg,image/png,image/jpg"
                                    >
                                        <Button icon={<UploadOutlined />} block>Changer le logo</Button>
                                    </Upload>
                                    {logoUrls.square && (
                                        <Button
                                            icon={<FileImageOutlined />}
                                            onClick={handleGenerateSvgIcon}
                                            block
                                        >
                                            Générer icône SVG
                                        </Button>
                                    )}
                                </Space>
                            </Col>
                        </Row>
                    </div>

                    {/* Logo imprimable */}
                    <div className="box" style={{ marginTop: "15px" }}>
                        <Divider titlePlacement="left" style={{ fontWeight: "600", marginTop: "0px" }}>
                            Logo imprimable
                        </Divider>

                        <Row gutter={16}>
                            <Col span={16}>
                                {logoUrls.printable && (
                                    <Image
                                        src={logoUrls.printable}
                                        alt="Logo imprimable"
                                        style={{ maxHeight: 300, objectFit: 'contain' }}
                                    />
                                )}
                                {!logoUrls.printable && (
                                    <div style={{ padding: 20, textAlign: 'center', backgroundColor: '#f5f5f5' }}>
                                        Aucun logo imprimable
                                    </div>
                                )}
                            </Col>
                            <Col span={8}>
                                <Upload
                                    beforeUpload={(file) => handleLogoUpload(file, 'printable')}
                                    showUploadList={false}
                                    accept="image/jpeg,image/png,image/jpg"
                                >
                                    <Button icon={<UploadOutlined />}>Changer le logo</Button>
                                </Upload>
                            </Col>
                        </Row>
                    </div>
                </>
            ),
        },
        {
            key: '3',
            label: 'Mail',
            icon: <MailOutlined />,
            children: (
                <>
                    {/* Modèles emails */}
                    <div className="box">
                        <Divider titlePlacement="left" style={{ fontWeight: "600", marginTop: "0px" }}>
                            Modèle mail
                        </Divider>

                        <Row gutter={16}>
                            <Col span={24}>
                                <Form.Item
                                    name="fk_emt_id_reset_password"
                                    label="Reset du mot de passe"
                                >
                                    <MessageTemplateSelect />

                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col span={24}>
                                <Form.Item
                                    name="fk_emt_id_changed_password"
                                    label="Accusé de changement de mot de passe"
                                >
                                    <MessageTemplateSelect />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={16}>
                            <Col span={24}>
                                <Form.Item
                                    name="cop_mail_parser"
                                    label="Mail parser"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Le contenu est requis"
                                        }
                                    ]}
                                    getValueFromEvent={(content) => content}
                                >
                                    <RichTextEditor
                                        height={100}
                                        placeholder="Saisir le mail parser..."
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    {/* Comptes email */}
                    <div className="box" style={{ marginTop: "15px" }}>
                        <Divider titlePlacement="left" style={{ fontWeight: "600", marginTop: "0px" }}>
                            Compte email
                        </Divider>

                        <Row gutter={16}>
                            <Col span={24}>
                                <Form.Item
                                    name="fk_eml_id_default"
                                    label="Compte par défaut"
                                >
                                    <MessageEmailAccountSelect
                                        placeholder="Sélectionner un compte email"
                                    />

                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                    {/* Email de vente */}
                    <div className="box" style={{ marginTop: "15px" }}>
                        <Divider titlePlacement="left" style={{ fontWeight: "600", marginTop: "0px" }}>
                            Email
                        </Divider>

                        <Row gutter={16}>
                            <Col span={24}>
                                <Form.Item
                                    name="fk_eml_id_sale"
                                    label="Email d'envoi des éléments de ventes"
                                >
                                    <MessageEmailAccountSelect
                                        placeholder="Sélectionner un compte email"
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                </>
            ),
        },
        {
            key: '4',
            label: 'Banques',
            icon: <BankOutlined />,
            children: (
                <Suspense fallback={<Spin tip="Chargement..." spinning={true}><div style={{ minHeight: '200px' }} /></Spin>}>
                    <BankTab
                        entityType="company"
                        entityId={companyId}
                        permission="settings.company.edit"
                    />
                </Suspense>
            ),
        },
        {
            key: '5',
            label: 'Veryfi',
            icon: <ScanOutlined />,
            children: (
                <>
                    <div className="box">
                        <Divider titlePlacement="left" style={{ fontWeight: "600", marginTop: "0px" }}>
                            Configuration Veryfi OCR
                        </Divider>
                        <p style={{ marginBottom: 16, color: '#666' }}>
                            Veryfi permet d'extraire automatiquement les informations des factures fournisseur au format PDF.
                            Obtenez vos identifiants sur <a href="https://www.veryfi.com" target="_blank" rel="noopener noreferrer">veryfi.com</a>
                        </p>

                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    name="cop_veryfi_client_id"
                                    label="Client ID"
                                >
                                    <Input placeholder="Client ID Veryfi" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="cop_veryfi_client_secret"
                                    label="Client Secret"
                                >
                                    <Input.Password placeholder="Client Secret Veryfi" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item
                                    name="cop_veryfi_username"
                                    label="Username"
                                >
                                    <Input placeholder="Username Veryfi" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="cop_veryfi_api_key"
                                    label="API Key"
                                >
                                    <Input.Password placeholder="API Key Veryfi" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                </>
            ),
        },
    ];

    return (
        <Drawer
            title={`Configuration de la société ${pageLabel ? `- ${pageLabel}` : ''}`}
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
                    <Form.Item name="cop_id" hidden>
                        <Input />
                    </Form.Item>
                    <Tabs defaultActiveKey="1" items={tabItems} />
                </Form>
            </Spin>
        </Drawer>
    );
}
