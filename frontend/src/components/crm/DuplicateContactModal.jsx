import { Modal, Button, Radio, Typography, Table, Row, Col, Card, Space } from "antd";

export default function DuplicateContactModal({ open, action, duplicates, selectedId, pendingValues, newPartnerNames = [], onActionChange, onSelectDuplicate, onConfirm, onCancel }) {
    const selected = duplicates.find(d => d.ctc_id === selectedId);

    const columns = [
        { title: 'Nom complet', key: 'name', render: (_, r) => [r.ctc_firstname, r.ctc_lastname].filter(Boolean).join(' ') || '—' },
        { title: 'Fonction',    dataIndex: 'ctc_job_title',  key: 'job',     render: v => v || '—' },
        { title: 'Entreprise',  key: 'partner', render: (_, r) => r.partner_names?.join(', ') || r.partner_name || '—' },
        { title: 'Email',       dataIndex: 'ctc_email',      key: 'email',   render: v => v || '—' },
    ];

    const newEntreprises   = newPartnerNames.join(', ') || '—';
    const existEntreprises = selected?.partner_names?.join(', ') || selected?.partner_name || '—';

    const fields = [
        { label: 'Entreprise',   new: newEntreprises,                                                                                                                   existing: existEntreprises },
        { label: 'Nom complet',  new: [pendingValues?.ctc_firstname, pendingValues?.ctc_lastname].filter(Boolean).join(' ') || '—', existing: [selected?.ctc_firstname, selected?.ctc_lastname].filter(Boolean).join(' ') || '—' },
        { label: 'Fonction',     new: pendingValues?.ctc_job_title || '—', existing: selected?.ctc_job_title || '—' },
        { label: 'Email',        new: pendingValues?.ctc_email || '—',     existing: selected?.ctc_email || '—' },
        { label: 'Téléphone',    new: pendingValues?.ctc_phone || '—',     existing: selected?.ctc_phone || '—' },
        { label: 'Mobile',       new: pendingValues?.ctc_mobile || '—',    existing: selected?.ctc_mobile || '—' },
    ];

    return (
        <Modal
            open={open}
            title="Contact en double détecté"
            width={780}
            onCancel={onCancel}
            footer={[
                <Button key="cancel" onClick={onCancel}>Annuler</Button>,
                <Button key="confirm" type="primary" onClick={onConfirm}>
                    {action === 'add' ? 'Ajouter le contact' : 'Mettre à jour'}
                </Button>,
            ]}
        >
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                Un contact avec le même nom ou la même adresse e-mail existe déjà. Que souhaitez-vous faire ?
            </Typography.Text>

            <Radio.Group value={action} onChange={e => onActionChange(e.target.value)} style={{ marginBottom: 16 }}>
                <Space direction="vertical">
                    <Radio value="add">Ajouter un nouveau contact</Radio>
                    <Radio value="update">Mettre à jour les informations du contact sélectionné</Radio>
                </Space>
            </Radio.Group>

            <Table
                size="small"
                bordered
                rowKey="ctc_id"
                columns={columns}
                dataSource={duplicates}
                pagination={false}
                style={{ marginBottom: 16 }}
                rowSelection={{
                    type: 'radio',
                    selectedRowKeys: [selectedId],
                    onChange: (keys) => onSelectDuplicate(keys[0]),
                }}
                onRow={(record) => ({ onClick: () => onSelectDuplicate(record.ctc_id), style: { cursor: 'pointer' } })}
            />

            {action === 'update' && selected && (
                <Row gutter={16}>
                    <Col span={12}>
                        <Card size="small" title="Nouveau contact" headStyle={{ background: '#f0f5ff', fontWeight: 600 }}>
                            {fields.map(f => (
                                <Row key={f.label} style={{ marginBottom: 4 }}>
                                    <Col span={10} style={{ color: '#888', fontSize: 12 }}>{f.label} :</Col>
                                    <Col span={14} style={{ fontSize: 12 }}>{f.new}</Col>
                                </Row>
                            ))}
                        </Card>
                    </Col>
                    <Col span={12}>
                        <Card size="small" title="Contact existant sélectionné" headStyle={{ background: '#fff7e6', fontWeight: 600 }}>
                            {fields.map(f => (
                                <Row key={f.label} style={{ marginBottom: 4 }}>
                                    <Col span={10} style={{ color: '#888', fontSize: 12 }}>{f.label} :</Col>
                                    <Col span={14} style={{ fontSize: 12, color: f.new !== f.existing ? '#d4380d' : undefined }}>{f.existing}</Col>
                                </Row>
                            ))}
                        </Card>
                    </Col>
                </Row>
            )}
        </Modal>
    );
}
