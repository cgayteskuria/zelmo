import { Card, Space, Spin, Pagination, Empty } from "antd";
import { UserOutlined, CalendarOutlined, EuroOutlined } from "@ant-design/icons";
import { formatCurrency, formatDate } from "../../../utils/formatters";
import { formatStatus, formatPaymentStatus } from "../../../configs/ExpenseConfig";

/**
 * Vue mobile pour la liste des notes de frais
 */
export default function ExpenseReportsMobileView({ data, loading, pagination, onPageChange, onRowClick }) {
    return (
        <Spin spinning={!!loading}>
            {data?.length === 0 ? (
                <Empty description="Aucune note de frais" style={{ padding: 40 }} />
            ) : (
                data?.map((item) => (
                    <Card
                        key={item.exr_id ?? item.id}
                        style={{ marginBottom: 12 }}
                        onClick={() => onRowClick(item)}
                        hoverable
                        styles={{ body: { padding: '12px 16px' } }}
                    >
                        {/* Header avec référence + titre */}
                        <div style={{ marginBottom: 8, fontSize: 16, fontWeight: 600 }}>
                            {item.exr_title?.trim() ? (
                                <>
                                    <span style={{ color: '#1890ff' }}>
                                        {item.exr_title}
                                    </span>
                                    {" "}
                                    <span style={{ color: '#999', fontWeight: 400 }}>
                                        ({item.exr_number})
                                    </span>
                                </>
                            ) : (
                                <span style={{ color: '#1890ff' }}>
                                    {item.exr_number}
                                </span>
                            )}
                        </div>

                        <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                            {/* Période */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                fontSize: 13,
                                color: '#666'
                            }}>
                                <CalendarOutlined style={{ marginRight: 6 }} />
                                <span>
                                    {formatDate(item.exr_period_from)} - {formatDate(item.exr_period_to)}
                                </span>
                            </div>

                            {/* Montant et Statut */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginTop: 4
                            }}>
                                <span style={{ fontSize: 16, fontWeight: 600, color: '#262626' }}>
                                    <EuroOutlined style={{ marginRight: 4 }} />
                                    {formatCurrency(item.exr_total_amount_ttc)}
                                </span>
                                {formatStatus({ value: item.exr_status })}
                            </div>

                            {/* Employé et Paiement */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginTop: 4
                            }}>
                                <span style={{ fontSize: 13, color: '#666' }}>
                                    <UserOutlined style={{ marginRight: 4 }} />
                                    {item.employee}
                                </span>
                                {formatPaymentStatus({ value: item.exr_payment_progress })}
                            </div>

                            {/* Approbateur (si présent) */}
                            {item.approver_name && (
                                <div style={{
                                    color: '#999',
                                    fontSize: 12,
                                    marginTop: 4,
                                    paddingTop: 8,
                                    borderTop: '1px solid #f0f0f0'
                                }}>
                                    Approbateur: {item.approver_name}
                                </div>
                            )}

                            {/* Date de soumission */}
                            {item.exr_submission_date && (
                                <div style={{
                                    color: '#999',
                                    fontSize: 12
                                }}>
                                    Soumise le {formatDate(item.exr_submission_date)}
                                </div>
                            )}
                        </Space>
                    </Card>
                ))
            )}
            {pagination && (
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <Pagination
                        {...pagination}
                        onChange={onPageChange}
                        showSizeChanger={false}
                        simple
                    />
                </div>
            )}
        </Spin>
    );
}
