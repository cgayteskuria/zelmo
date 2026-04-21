import { useState, useEffect } from "react";
import {
  Drawer,
  Form,
  Select,
  Upload,
  Button,
  Alert,
  Descriptions,
  Popconfirm,
  message,
  Space,
  Divider,
  Table,
} from "antd";
import {
  UploadOutlined,
  DeleteOutlined,
  CloudUploadOutlined,
} from "@ant-design/icons";
import { formatDate, formatCurrency } from "../../utils/formatters";
import { accountingImportsApi } from "../../services/api";
import { usePermission } from "../../hooks/usePermission";
import CanAccess from "../../components/common/CanAccess";

const { Option } = Select;

/**
 * Drawer de détails d'un import comptable
 * Mode création : Upload → Prévisualisation → Import
 * Mode consultation : Affichage données importées + Suppression
 */
export default function AccountingImport({ open, onClose, importId, onSubmit }) {
  const [form] = Form.useForm();
  const { can } = usePermission();

  // États mode création
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [linesCount, setLinesCount] = useState(0);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);

  // États mode consultation
  const [entity, setEntity] = useState(null);
  const [loading, setLoading] = useState(false);

  const isCreation = !importId || importId === null;

  // Colonnes table prévisualisation
  const previewColumns = [
    { title: "Jrnl.",    dataIndex: "journalcode", key: "journalcode", width: 60 },
    { title: "Pièce",    dataIndex: "ecriturenum", key: "ecriturenum", width: 80 },
    { title: "Date",     dataIndex: "piecedate",   key: "piecedate",   width: 100, render: (v) => formatDate(v) },
    { title: "Cpte",     dataIndex: "comptenum",   key: "comptenum",   width: 80 },
    {
      title: "Libellé",
      dataIndex: "ecriturelib",
      key: "ecriturelib",
      render: (v) => {
        const value = v || '';
        return value.length > 20 ? value.substring(0, 20) + '...' : value;
      },
    },
    { title: "Débit",    dataIndex: "debit",       key: "debit",       width: 110, align: "right", render: (v) => formatCurrency(v) },
    { title: "Crédit",   dataIndex: "credit",      key: "credit",      width: 110, align: "right", render: (v) => formatCurrency(v) },
    { title: "Lettrage", dataIndex: "ecriturelet", key: "ecriturelet", width: 80 },
  ];

  // Chargement données mode consultation
  useEffect(() => {
    if (!isCreation && open) {
      loadImportDetails();
    }
  }, [importId, open]);

  // Reset states à la fermeture
  useEffect(() => {
    if (!open) {
      form.resetFields();
      setPreviewData(null);
      setLinesCount(0);
      setErrors([]);
      setWarnings([]);
      setEntity(null);
    }
  }, [open]);

  const loadImportDetails = async () => {
    setLoading(true);
    try {
      const response = await accountingImportsApi.get(importId);
      setEntity(response);
    } catch (error) {
      message.error("Erreur lors du chargement des détails");
    } finally {
      setLoading(false);
    }
  };

  // Upload fichier pour prévisualisation
  const handleUpload = async ({ file }) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("format", form.getFieldValue("aie_type"));

    setUploading(true);
    setErrors([]);
    setWarnings([]);
    setPreviewData(null);

    try {
      const response = await accountingImportsApi.uploadForPreview(formData);

      if (response.success) {
        setPreviewData(response.data);
        setLinesCount(response.lines_count);
        setErrors(response.errors || []);
        setWarnings(response.warnings || []);

        if (response.errors && response.errors.length > 0) {
          message.error("Erreurs détectées dans le fichier");
        } else if (response.warnings && response.warnings.length > 0) {
          message.warning("Fichier validé avec avertissements");
        } else {
          message.success("Fichier validé avec succès");
        }
      } else {
        setErrors(response.errors || ["Erreur inconnue"]);
        message.error("Erreurs dans le fichier");
      }
    } catch (error) {
      message.error("Erreur lors de l'upload du fichier");
      setErrors([error.message || "Erreur inconnue"]);
    } finally {
      setUploading(false);
    }
  };

  // Import final
  const handleImport = async () => {
    if (!previewData) {
      message.error("Aucune prévisualisation disponible");
      return;
    }

    if (errors.length > 0) {
      message.error("Impossible d'importer : le fichier contient des erreurs");
      return;
    }

    setImporting(true);

    try {
      const response = await accountingImportsApi.import(previewData);

      if (response.success) {
        message.success(
          `Import réussi : ${response.stats.moves_created} mouvements créés`
        );
        onSubmit && onSubmit();
        onClose();
      } else {
        message.error(response.message || "Erreur lors de l'import");
      }
    } catch (error) {
      message.error("Erreur lors de l'import");
    } finally {
      setImporting(false);
    }
  };

  // Suppression
  const handleDelete = async () => {
    try {
      await accountingImportsApi.delete(importId);
      message.success("Import supprimé avec succès");
      onSubmit && onSubmit();
      onClose();
    } catch (error) {
      message.error("Erreur lors de la suppression");
    }
  };

  // Données mode consultation (parse JSON depuis aie_moves)
  const consultationData = (() => {
    if (!entity?.aie_moves) return [];
    try {
      return typeof entity.aie_moves === 'string'
        ? JSON.parse(entity.aie_moves)
        : entity.aie_moves;
    } catch {
      return [];
    }
  })();

  return (
    <Drawer
      title={isCreation ? "Nouvel import comptable" : "Détails de l'import"}
      open={open}
      onClose={onClose}
      //size="large"
      width="50%"
      destroyOnHidden
    >
      {isCreation ? (
        // ========== MODE CRÉATION ==========
        <Space orientation="vertical" style={{ width: "100%" }} size="large">
          {!previewData && (
            <Alert
              type="info"
              showIcon
              title="Import d'écritures comptables"
              description={
                <div>
                  <p style={{ marginBottom: 8 }}>
                    <strong>Formats supportés :</strong> FEC (Fichier des Écritures Comptables) et CIEL Compta
                  </p>
                  <p style={{ marginBottom: 8 }}>
                    <strong>Procédure d'import :</strong>
                  </p>
                  <ol style={{ marginBottom: 8, paddingLeft: 20 }}>
                    <li>Sélectionnez le format de votre fichier</li>
                    <li>Chargez votre fichier .txt</li>
                    <li>Vérifiez la prévisualisation et les éventuels avertissements</li>
                    <li>Confirmez l'import si aucune erreur n'est détectée</li>
                  </ol>
                  <p style={{ marginBottom: 0 }}>
                    <strong>Important :</strong> Les journaux et comptes inexistants seront créés automatiquement.
                    Les codes de lettrage existants seront ignorés.
                  </p>
                </div>
              }
            />
          )}

          <Form form={form} layout="vertical">
            <Form.Item
              name="aie_type"
              label="Format d'import"
              initialValue="FEC"
              rules={[{ required: true }]}
            >
              <Select disabled={!!previewData}>
                <Option value="FEC">FEC (Fichier Écritures Comptables)</Option>
                <Option value="CIEL">CIEL Compta</Option>
              </Select>
            </Form.Item>

            {!previewData && (
              <Form.Item label="Fichier à importer">
                <Upload
                  customRequest={handleUpload}
                  accept=".txt"
                  maxCount={1}
                  showUploadList={false}
                  disabled={uploading}
                >
                  <Button
                    type="secondary"
                    icon={<UploadOutlined />}
                    loading={uploading}
                    size="large"
                    block
                  >
                    {uploading
                      ? "Analyse en cours..."
                      : "Sélectionner le fichier"}
                  </Button>
                </Upload>
              </Form.Item>
            )}
          </Form>

          {/* Affichage erreurs */}
          {errors.length > 0 && (
            <Alert
              type="error"
              title="Erreurs bloquantes détectées"
              description={
                <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              }
              showIcon
            />
          )}

          {/* Affichage warnings */}
          {warnings.length > 0 && (
            <Alert
              type="warning"
              title="Avertissements"
              description={
                <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                  {warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              }
              showIcon
            />
          )}

          {/* Prévisualisation */}
          {previewData && (
            <>
              <Alert
                type="info"
                title={`${linesCount} lignes détectées et validées`}
                showIcon
              />

              <Divider>Prévisualisation des données</Divider>

              <Table
                columns={previewColumns}
                dataSource={previewData || []}
                rowKey={(_, i) => i}
                size="small"
                pagination={false}
                scroll={{ y: 360 }}
              />

              <Button
                type="primary"
                size="large"
                block
                icon={<CloudUploadOutlined />}
                disabled={errors.length > 0}
                loading={importing}
                onClick={handleImport}
              >
                Confirmer l'import ({linesCount} lignes)
              </Button>
            </>
          )}
        </Space>
      ) : (
        // ========== MODE CONSULTATION ==========
        <Space orientation="vertical" style={{ width: "100%" }} size="large">
          {entity && (
            <>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="Format">
                  {entity.aie_type}
                </Descriptions.Item>
                <Descriptions.Item label="Mouvements importés">
                  {entity.aie_moves_number || "N/A"}
                </Descriptions.Item>
                <Descriptions.Item label="Période">
                  {entity.aie_transfer_start && entity.aie_transfer_end
                    ? `${formatDate(entity.aie_transfer_start)} - ${formatDate(entity.aie_transfer_end)}`
                    : "N/A"}
                </Descriptions.Item>
                <Descriptions.Item label="Date d'import">
                  {formatDate(entity.aie_created)}
                </Descriptions.Item>
                <Descriptions.Item label="Importé par">
                  {entity.author}
                </Descriptions.Item>
              </Descriptions>

              <Divider>Données importées</Divider>

              <Table
                columns={previewColumns}
                dataSource={consultationData}
                rowKey={(_, i) => i}
                size="small"
                pagination={false}
                scroll={{ y: 460 }}
              />

              <CanAccess permission="accountings.delete">
                <Popconfirm
                  title="Supprimer cet import ?"
                  description="Cette action est irréversible. Les écritures importées ne seront pas supprimées."
                  onConfirm={handleDelete}
                  okText="Supprimer"
                  cancelText="Annuler"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger icon={<DeleteOutlined />} block size="large">
                    Supprimer l'import
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
