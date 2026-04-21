import { useState, useEffect } from "react";
import { Drawer, Form, DatePicker, Select, Button, Alert, Descriptions, Popconfirm, Space, Divider, Row, Col } from "antd";
import { message } from '../../utils/antdStatic';
import { DownloadOutlined, DeleteOutlined, FileTextOutlined, } from "@ant-design/icons";
import dayjs from "dayjs";
import { formatDate } from "../../utils/formatters";
import { accountingExportsApi } from "../../services/api";
import { usePermission } from "../../hooks/usePermission";
import CanAccess from "../../components/common/CanAccess";
import AccountSelect from "../../components/select/AccountSelect";
import AccountJournalSelect from "../../components/select/AccountJournalSelect";
import { getWritingPeriod } from '../../utils/writingPeriod';

const { RangePicker } = DatePicker;

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
  const [writingPeriod, setWritingPeriod] = useState(null);
  // États mode consultation
  const [entity, setEntity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const isCreation = !exportId || exportId === null;

  const loadWritingPeriod = async () => {
    try {
      const period = await getWritingPeriod();
      setWritingPeriod(period);

      form.setFieldsValue({
        date_range: [dayjs(period.startDate), dayjs(period.endDate)],
      });

    } catch (error) {
      console.error("Erreur lors du chargement de la période d'écriture:", error);
      message.error("Erreur lors du chargement de la période d'écriture");
    }
  };

  // Charger la période d'écriture au montage du composant
  useEffect(() => {
    loadWritingPeriod();
  }, []);

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
    
      const [start_date, end_date] = values.date_range;

      const payload = {
        format: "FEC",
        start_date: start_date.format("YYYY-MM-DD"),
        end_date: end_date.format("YYYY-MM-DD"),
        account_from_id: values.account_from_id || null,
        account_to_id: values.account_to_id || null,
        ajl_id: values.ajl_id || null,
      };
    
      const response = await accountingExportsApi.create(payload);
    
      if (response.success) {
        message.success(`Export généré : ${response.filename}`);
        onSubmit && onSubmit();
        onClose();
      } else {
        message.error(response.message || "Erreur lors de l'export");
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || "Erreur lors de l'export";
      message.error(errorMessage);
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

  return (
    <Drawer
      title={isCreation ? "Nouvel export comptable FEC" : "Détails de l'export"}
      open={open}
      onClose={onClose}
      destroyOnHidden
      size="large"
      forceRender
    >
      {isCreation ? (
        // ========== MODE CRÉATION ==========
        <Form form={form}
          onFinish={handleExport} layout="vertical">
          <Alert
            type="info"
            title="Génération d'un fichier FEC conforme à la norme DGFiP"
            description="Le fichier contiendra toutes les écritures comptables de la période sélectionnée, avec possibilité de filtrage par compte ou journal."
            showIcon
            style={{ marginBottom: 24 }}
          />



          <Form.Item
            label="Période"
            name="date_range"
            rules={[
              {
                required: true,
                message: "Veuillez sélectionner une période",
              },
            ]}
            extra={
              writingPeriod && (
                <span style={{ color: "#888", fontSize: "12px" }}>
                  Période d'écriture : {dayjs(writingPeriod.startDate).format("DD/MM/YYYY")} - {dayjs(writingPeriod.endDate).format("DD/MM/YYYY")}
                </span>
              )
            }
          >
            <RangePicker
              format="DD/MM/YYYY"

              size="large"
              placeholder={["Date de début", "Date de fin"]}
              minDate={writingPeriod ? dayjs(writingPeriod.startDate) : undefined}
              maxDate={writingPeriod ? dayjs(writingPeriod.endDate) : undefined}
            />
          </Form.Item>

          <Divider>Filtres optionnels</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="account_from_id" label="Du compte (optionnel)">
                <AccountSelect />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="account_to_id" label="Au compte (optionnel)">
                <AccountSelect />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ajl_id" label="Journal (optionnel)">
            <AccountJournalSelect size="large" />
          </Form.Item>

          <Form.Item style={{ marginTop: 32 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              icon={<FileTextOutlined />}
              loading={exporting}
            >
              Générer l'export FEC
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
                Télécharger le fichier FEC
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
