import { useState, useMemo, useEffect } from "react";
import { Button, Card, Space, Col, Typography, Statistic, Row, Modal, Alert, Table, Tag, Tooltip,  } from "antd";
import { message } from '../../utils/antdStatic';
import { FileTextOutlined, CheckCircleOutlined, ExclamationCircleOutlined, EyeOutlined, } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import PageContainer from "../../components/common/PageContainer";
import { formatStatus } from "../../configs/ContractConfig.jsx";
import { contractsGenericApi } from "../../services/api";
import dayjs from "dayjs";


// Fonction pour formater la devise
const formatCurrency = (value) => {
  if (value == null) return "-";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value);
};

// Fonction pour formater la date
const formatDate = (value) => {
  if (!value || value === "0000-00-00") return "-";
  return dayjs(value).format("DD/MM/YYYY");
};

/**
 * Page de génération de factures à partir des contrats d'abonnement
 * Permet de sélectionner plusieurs contrats éligibles et de générer leurs factures
 */
export default function GenerateContractInvoices() {
  const navigate = useNavigate();

  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [contracts, setContracts] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Charger les contrats éligibles
  const fetchEligibleContracts = async () => {
    try {
      setDataLoading(true);
      const response = await contractsGenericApi.getEligibleForInvoicing();

      if (response.success) {
        const contractsData = response.data;

        // Filtrer et enrichir les contrats
        const enrichedContracts = contractsData.map((contract) => {
          const nextInvoiceDate = dayjs(contract.con_next_invoice_date);
          const today = dayjs().startOf("day");

          const isEligible = nextInvoiceDate.valueOf() <= today.valueOf();

          return {
            ...contract,
            isEligible,
            daysOverdue: isEligible
              ? today.diff(nextInvoiceDate, "days")
              : null,
          };
        });

        setContracts(enrichedContracts);
      }
    } catch (error) {
      message.error(
        "Erreur lors du chargement des contrats : " + error.message
      );
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    fetchEligibleContracts();
  }, []);

  // Gestionnaire de sélection des lignes
  const onSelectChange = (newSelectedRowKeys, newSelectedRows) => {
    // Filtrer uniquement les lignes éligibles
    const eligibleKeys = newSelectedRowKeys.filter((key) => {
      const contract = contracts.find((c) => c.id === key);
      return contract?.isEligible;
    });

    const eligibleRows = newSelectedRows.filter((row) => row.isEligible);

    setSelectedRowKeys(eligibleKeys);
    setSelectedRows(eligibleRows);
  };

  // Configuration de la sélection
  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
    getCheckboxProps: (record) => ({
      disabled: !record.isEligible,
      name: record.number,
    }),
  };



  // Générer les factures
  const handleGenerate = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning("Veuillez sélectionner au moins un contrat");
      return;
    }

    Modal.confirm({
      title: "Confirmer la génération des factures",
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>
            Vous êtes sur le point de générer <strong>{selectedRowKeys.length}</strong> facture(s)
            à partir des contrats sélectionnés.
          </p>
          <ul>
            <li>Créer les factures en brouillon</li>
            <li>Mettre à jour la prochaine date de facturation</li>
          </ul>
        </div>
      ),
      okText: "Générer les factures",
      cancelText: "Annuler",
      onOk: async () => {
        try {
          setLoading(true);
          const response = await contractsGenericApi.generateInvoices(selectedRowKeys);


          const { success, errors, invoice_ids, invoice_numbers, error_details } = response.data;

          // Réinitialiser la sélection
          setSelectedRowKeys([]);
          setSelectedRows([]);

          // Recharger la liste
          await fetchEligibleContracts();

          // Afficher un modal de résultat
          Modal.success({
            title: "Factures générées",
            width: 800,
            content: (
              <div>
                <p>
                  <strong>{success}</strong> facture(s) créée(s) avec succès
                </p>
                <ul style={{ marginLeft: 16 }}>
                  {invoice_numbers.map((number, index) => (
                    <li key={number}>
                      <a
                        href={`/customer-invoices/${invoice_ids[index]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {number}
                      </a>
                    </li>
                  ))}
                </ul>
                {errors > 0 && (
                  <>
                    <p style={{ marginTop: 12 }}>
                      <strong style={{ color: "#cf1322" }}>
                        {errors} erreur(s) lors de la génération :
                      </strong>
                    </p>
                    <ul style={{ marginLeft: 16 }}>
                      {error_details.map((err) => (
                        <li key={err.contract_id} style={{ color: "#cf1322" }}>
                          <strong>Contrat {err.con_number} :</strong> {err.message}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <Button
                  type="link"
                  onClick={() => {
                    Modal.destroyAll();
                    navigate("/customer-invoices");
                  }}
                >
                  Ouvrir factures
                </Button>
              </div>
            ),
          });

        } catch (error) {
          message.error(
            "Erreur lors de la génération des factures : " + error.message
          );
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // Calcul des statistiques
  const stats = useMemo(() => {
    const totalSelected = selectedRows.length;
    const totalAmount = selectedRows.reduce(
      (sum, row) => sum + (parseFloat(row.con_totalhtsub) || 0),
      0
    );
    const totalAmountTTC = selectedRows.reduce(
      (sum, row) => sum + (parseFloat(row.con_totalttc) || 0),
      0
    );

    return {
      totalSelected,
      totalAmount,
      totalAmountTTC,
    };
  }, [selectedRows]);


  // Colonnes du tableau Ant Design
  const columns = useMemo(
    () => [
      {
        title: "N° Contrat",
        dataIndex: "con_number",
        key: "con_number",
        width: 120,
        sorter: (a, b) => (a.con_number || "").localeCompare(b.con_number || ""),
        render: (text, record) => (
          <strong style={{ color: record.isEligible ? "#000" : "#999" }}>
            {text}
          </strong>
        ),
      },
      {
        title: "Libellé",
        dataIndex: "con_label",
        key: "con_label",
        sorter: (a, b) => (a.con_label || "").localeCompare(b.con_label || ""),
        render: (text, record) => (
          <span style={{ color: record.isEligible ? "#000" : "#999" }}>
            {text}
          </span>
        ),
      },
      {
        title: "Tiers",
        dataIndex: "ptr_name",
        key: "ptr_name",
        sorter: (a, b) => (a.ptr_name || "").localeCompare(b.ptr_name || ""),
        render: (text, record) => (
          <span style={{ color: record.isEligible ? "#000" : "#999" }}>
            {text || "N/A"}
          </span>
        ),
      },
      {
        title: "Date du contrat",
        dataIndex: "con_date",
        key: "con_date",
        align: "center",
        width: 120,
        sorter: (a, b) => new Date(a.con_date) - new Date(b.con_date),
        render: (date, record) => (
          <span style={{ color: record.isEligible ? "#000" : "#999" }}>
            {formatDate(date)}
          </span>
        ),
      },
      {
        title: "Prochaine facture",
        dataIndex: "con_next_invoice_date",
        key: "con_next_invoice_date",
        align: "center",
        width: 170,
        sorter: (a, b) => new Date(a.con_next_invoice_date) - new Date(b.con_next_invoice_date),
        render: (date, record) => {
          const formattedDate = formatDate(date);
          const isOverdue = record.daysOverdue > 0;
          return (
            <Space>
              {formattedDate}
              {isOverdue && (
                <Tag color="red" style={{ fontSize: "11px" }}>
                  +{record.daysOverdue}j
                </Tag>
              )}
              {!record.isEligible && (
                <Tag color="default" style={{ fontSize: "11px" }}>
                  À venir
                </Tag>
              )}
            </Space>
          );
        },
      },
      {
        title: "Montant HT",
        dataIndex: "con_totalhtsub",
        key: "con_totalhtsub",
        width: 150,
        align: "right",
        sorter: (a, b) => (a.con_totalhtsub || 0) - (b.con_totalhtsub || 0),
        render: (amount, record) => (
          <strong style={{ color: record.isEligible ? "#000" : "#999" }}>
            {formatCurrency(amount)}
          </strong>
        ),
      },
      {
        title: "Montant TTC",
        dataIndex: "con_totalttc",
        key: "con_totalttc",
        width: 150,
        align: "right",
        sorter: (a, b) => (a.con_totalttc || 0) - (b.con_totalttc || 0),
        render: (amount, record) => (
          <strong style={{ color: record.isEligible ? "#000" : "#999" }}>
            {formatCurrency(amount)}
          </strong>
        ),
      },
      {
        title: "Statut",
        dataIndex: "con_status",
        key: "con_status",
        width: 120,
        align: "center",
        sorter: (a, b) => (a.con_status || 0) - (b.con_status || 0),
        render: (status) => formatStatus({ value: status }),
      },
    ],
    []
  );


  return (
    <PageContainer
      title="Génération de factures d'abonnement"
      subtitle="Sélectionnez les contrats pour lesquels générer des factures"

    >
      <Space orientation="vertical" size="large" style={{ width: "100%" }}>
        {/* Panneau de résumé et actions */}

        <Card
          title="Sélectionnez les contrats pour lesquels générer des factures"
          style={{
            position: "sticky",
            bottom: 0,
            zIndex: 1000,
            boxShadow: "0 -2px 8px rgba(0,0,0,0.15)",
            marginBottom: 15
          }}
          styles={{
            body: {
              height: 100, // ou la hauteur souhaitée en pixels
            }
          }}
          extra={
            <Tooltip
              title={
                <div>
                  <p>
                    Cette page affiche les contrats actifs dont la date de prochaine
                    facturation est arrivée ou dépassée.
                  </p>
                  <ul style={{ paddingLeft: 20 }}>
                    <li>
                      Les contrats <strong>sélectionnables</strong> sont ceux dont
                      la date de facturation est déjà passée
                    </li>
                    <li>
                      Les contrats en <strong>gris</strong> ne sont pas encore à
                      facturer
                    </li>
                  </ul>
                </div>
              }
            >
              <ExclamationCircleOutlined style={{ fontSize: 18, color: "#1890ff", cursor: "help" }} />
            </Tooltip>
          }

        >   {selectedRowKeys.length > 0 && (
          <Row gutter={16} align="middle" >
            <Col flex="auto">
              <Row gutter={16}>
                <Col>
                  <Statistic
                    title="Contrats sélectionnés"
                    value={stats.totalSelected}
                    prefix={<FileTextOutlined />}
                  />
                </Col>
                <Col>
                  <Statistic
                    title="Montant total HT"
                    value={stats.totalAmount}
                    precision={2}
                    suffix="€"
                  />
                </Col>
                <Col>
                  <Statistic
                    title="Montant total TTC"
                    value={stats.totalAmountTTC}
                    precision={2}
                    suffix="€"
                  />
                </Col>
              </Row>
            </Col>
            <Col>
              <Space>

                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={handleGenerate}
                  loading={loading}
                  size="large"
                >
                  Générer {stats.totalSelected} facture(s)
                </Button>
              </Space>
            </Col>
          </Row>
        )}
        </Card>

      </Space>
      {/* Tableau de sélection */}

      <Table
        columns={columns}
        dataSource={contracts}
        rowKey="id"
        rowSelection={rowSelection}
        loading={dataLoading}
        pagination={{
          pageSize: 100,
          showSizeChanger: true,
          showTotal: (total) => `${total} contrat(s) éligible(s)`,
          pageSizeOptions: ["100"],
        }}
        bordered
        size="middle"
      />

    </PageContainer>
  );
}
