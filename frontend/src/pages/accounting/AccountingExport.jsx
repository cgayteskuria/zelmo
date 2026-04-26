import { useState, useEffect } from "react";
import { Drawer, Form, Button, Alert, Descriptions, Popconfirm, Space, Divider, Row, Col, Radio } from "antd";
import { message } from '../../utils/antdStatic';
import { DownloadOutlined, DeleteOutlined, FileTextOutlined, TableOutlined } from "@ant-design/icons";
import { formatDate } from "../../utils/formatters";
import { accountingExportsApi } from "../../services/api";
import { usePermission } from "../../hooks/usePermission";
import CanAccess from "../../components/common/CanAccess";
import AccountSelect from "../../components/select/AccountSelect";
import AccountJournalSelect from "../../components/select/AccountJournalSelect";
import PeriodSelector from "../../components/common/PeriodSelector";
import { getWritingPeriod } from "../../utils/writingPeriod";

/**
 * Drawer de détails d'un export comptable FEC
 * Mode création : Formulaire filtres → Génération export
 * Mode consultation : Affichage infos + Téléchargement + Suppression
 */
export default function AccountingExport({ open, onClose, exportId, onSubmit }) {
  const [form] = Form.useForm();
  const { can } = usePermission();

  // États mode création
  const [exporting, setExporting] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState("FEC");
  // États mode consultation
  const [entity, setEntity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const isCreation = !exportId || exportId === null;

  // Pré-remplissage de la période à l'ouverture en mode création
  useEffect(() => {
    if (isCreation && open) {
      getWritingPeriod()
        .then((wp) => form.setFieldsValue({ period: { start: wp.startDate, end: wp.endDate } }))
        .catch(() => {});
    }
  }, [open]);

  // Chargement données mode consultation
  useEffect(() => {
    if (!isCreation && open) {
      loadExportDetails();
    }
  }, [exportId, open]);



  // Reset à la fermeture
  useEffect(() => {
    if (!open) {
      form.resetFields();
      setEntity(null);
      setSelectedFormat("FEC");
    }
  }, [open]);



  const loadExportDetails = async () => {
    setLoading(true);
    try {
      const response = await accountingExportsApi.get(exportId);
      setEntity(response);
    } catch (error) {
      message.error("Erreur lors du chargement des détails");
    } finally {
      setLoading(false);
    }
  };


  // Génération export
  const handleExport = async (values) => {
    setExporting(true);

    try {
      const { start, end } = values.period || {};

      const payload = {
        format: values.format,
        start_date: start?.slice(0, 10) ?? null,
        end_date: end?.slice(0, 10) ?? null,
        account_from_id: values.account_from_id || null,
        account_to_id: values.account_to_id || null,
        ajl_id: values.ajl_id || null,
      };

      const response = await accountingExportsApi.create(payload);

      if (response.success) {
        // Téléchargement automatique
        const blob = await accountingExportsApi.download(response.aie_id);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = response.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        message.success(`Export ${values.format} téléchargé : ${response.filename}`);
        onSubmit && onSubmit();
        onClose();
      } else {
        message.error(response.message || "Erreur lors de l'export");
      }
    } catch (error) {
      message.error(error.message || "Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  // Téléchargement
  const handleDownload = async () => {
    setDownloading(true);

    try {
      const response = await accountingExportsApi.download(exportId);

      // Création lien téléchargement
      const url = window.URL.createObjectURL(response);
      const link = document.createElement("a");
      link.href = url;
      link.download = entity.aie_filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success("Téléchargement démarré");
    } catch (error) {
      message.error("Erreur lors du téléchargement");
    } finally {
      setDownloading(false);
    }
  };

  // Suppression
  const handleDelete = async () => {
    try {
      await accountingExportsApi.delete(exportId);
      message.success("Export supprimé avec succès");
      onSubmit && onSubmit();
      onClose();
    } catch (error) {
      message.error("Erreur lors de la suppression");
    }
  };

  const formatLabels = { FEC: "FEC (norme DGFiP)", CSV: "CSV (Excel)" };

  return (
    <Drawer
      title={isCreation ? `Nouvel export comptable — ${formatLabels[selectedFormat] ?? selectedFormat}` : "Détails de l'export"}
      open={open}
      onClose={onClose}
      destroyOnHidden
      size="large"
      forceRender
    >
      {isCreation ? (
        // ========== MODE CRÉATION ==========
        <Form form={form} onFinish={handleExport} layout="vertical" initialValues={{ format: "FEC" }}>

          <Divider orientation="left">Période</Divider>
          <Form.Item
            name="period"
            rules={[{
              validator: (_, val) =>
                val?.start && val?.end
                  ? Promise.resolve()
                  : Promise.reject(new Error("Veuillez sélectionner une période")),
            }]}
          >
            <PeriodSelector presets />
          </Form.Item>

          <Divider orientation="left">Filtres optionnels</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="account_from_id" label="Du compte">
                <AccountSelect />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="account_to_id" label="Au compte">
                <AccountSelect />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ajl_id" label="Journal">
            <AccountJournalSelect size="large" />
          </Form.Item>

          <Divider orientation="left">Format d'export</Divider>
          <Form.Item name="format">
            <Radio.Group
              onChange={(e) => setSelectedFormat(e.target.value)}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="FEC">
                <FileTextOutlined /> FEC (norme DGFiP)
              </Radio.Button>
              <Radio.Button value="CSV">
                <TableOutlined /> CSV (Excel)
              </Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Alert
            type={selectedFormat === "FEC" ? "info" : "success"}
            description={
              selectedFormat === "FEC"
                ? "Fichier FEC conforme à la norme DGFiP. Requis pour les contrôles fiscaux. Format : texte tabulé, dates YYYYMMDD, montants avec virgule."
                : "Fichier CSV lisible directement dans Excel. Séparateur point-virgule, BOM UTF-8, dates au format JJ/MM/AAAA."
            }
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              icon={selectedFormat === "CSV" ? <TableOutlined /> : <FileTextOutlined />}
              loading={exporting}
            >
              Exporter
            </Button>
          </Form.Item>
        </Form>
      ) : (
        // ========== MODE CONSULTATION ==========
        <Space orientation="vertical" style={{ width: "100%" }} size="large">
          {entity && (
            <>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="Format">
                  {entity.aie_type}
                </Descriptions.Item>
                <Descriptions.Item label="Taille">
                  {entity.aie_size_human}
                </Descriptions.Item>
                <Descriptions.Item label="Période" span={2}>
                  {formatDate(entity.aie_transfer_start)} -{" "}
                  {formatDate(entity.aie_transfer_end)}
                </Descriptions.Item>
                <Descriptions.Item label="Fichier" span={2}>
                  {entity.aie_filename}
                </Descriptions.Item>
                <Descriptions.Item label="Date d'export">
                  {formatDate(entity.aie_created)}
                </Descriptions.Item>
                <Descriptions.Item label="Exporté par">
                  {entity.author}
                </Descriptions.Item>
              </Descriptions>

              <Button
                type="primary"
                icon={<DownloadOutlined />}
                size="large"
                block
                onClick={handleDownload}
                loading={downloading}
              >
                Télécharger le fichier {entity?.aie_type}
              </Button>

              <CanAccess permission="accountings.delete">
                <Popconfirm
                  title="Supprimer cet export ?"
                  description="Cette action est irréversible"
                  onConfirm={handleDelete}
                  okText="Supprimer"
                  cancelText="Annuler"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger icon={<DeleteOutlined />} block size="large">
                    Supprimer l'export
                  </Button>
                </Popconfirm>
              </CanAccess>
            </>
          )}
        </Space>
      )}
    </Drawer>
  );
}
