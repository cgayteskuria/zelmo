import { useState } from 'react';
import {
    Modal, Button, Select, Input, Row, Col, Space, Typography, Divider, notification,
} from 'antd';
import {
    SearchOutlined, PlusOutlined, CloseOutlined,
    UserOutlined, BankOutlined,
} from '@ant-design/icons';
import { enrichmentApi } from '../../services/apiEnrichment';

const { Text } = Typography;

const SENIORITY_OPTIONS = [
    { label: 'Propriétaire / Fondateur', value: 'owner' },
    { label: 'C-Suite (PDG, DG...)', value: 'c_suite' },
    { label: 'Associé / Partner', value: 'partner' },
    { label: 'VP / Vice-Président', value: 'vp' },
    { label: 'Directeur', value: 'director' },
    { label: 'Responsable', value: 'manager' },
    { label: 'Senior', value: 'senior' },
    { label: 'Cadre', value: 'entry' },
    { label: 'Stagiaire', value: 'intern' },
];

const EMPLOYEE_RANGES = [
    { label: '1 – 10',        value: '1,10' },
    { label: '11 – 50',       value: '11,50' },
    { label: '51 – 200',      value: '51,200' },
    { label: '201 – 500',     value: '201,500' },
    { label: '501 – 1 000',   value: '501,1000' },
    { label: '1 001 – 5 000', value: '1001,5000' },
    { label: '5 001+',        value: '5001,10000' },
];

const PERSON_FILTER_DEFS = [
    { key: 'pays', label: 'Pays', type: 'tags', placeholder: 'ex : France, Belgique' },
    { key: 'ville', label: 'Ville', type: 'tags', placeholder: 'ex : Paris, Lyon' },
    { key: 'poste', label: 'Intitulé de poste', type: 'tags', placeholder: 'ex : Directeur Commercial' },
    { key: 'niveau', label: 'Niveau hiérarchique', type: 'select', options: SENIORITY_OPTIONS, multiple: true, placeholder: 'Sélectionner' },
];

const ORG_FILTER_DEFS = [
    { key: 'taille',      label: 'Taille',              type: 'select', options: EMPLOYEE_RANGES, multiple: true, placeholder: 'Sélectionner une valeur' },
    { key: 'nom_societe', label: 'Nom de la société',   type: 'text',   placeholder: 'ex : Acme  (recherche partielle)' },
    { key: 'localisation',label: 'Localisation siège',  type: 'text',   placeholder: 'ex : Paris  (recherche partielle)' },
    { key: 'domaine',     label: 'Domaine web',         type: 'tags',   placeholder: 'ex : acme.fr' },
];

function FilterRow({ filterDefs, row, onChange, onRemove }) {
    const def = filterDefs.find(d => d.key === row.field) || filterDefs[0];

    return (
        <Row gutter={8} align="middle" style={{ marginBottom: 10 }}>
            <Col style={{ width: 185, flexShrink: 0 }}>
                <Select
                    value={row.field}
                    onChange={(val) => onChange({ field: val, values: [] })}
                    style={{ width: '100%' }}
                    popupMatchSelectWidth={false}
                >
                    {filterDefs.map(d => (
                        <Select.Option key={d.key} value={d.key}>{d.label}</Select.Option>
                    ))}
                </Select>
            </Col>
            <Col flex="1">
                {def.type === 'select' ? (
                    <Select
                        mode={def.multiple ? 'multiple' : undefined}
                        value={def.multiple ? row.values : (row.values[0] ?? undefined)}
                        onChange={(val) => onChange({ ...row, values: def.multiple ? val : (val ? [val] : []) })}
                        options={def.options}
                        style={{ width: '100%' }}
                        placeholder={def.placeholder || 'Sélectionner une valeur'}
                        allowClear
                    />
                ) : def.type === 'text' ? (
                    <Input
                        value={row.values[0] || ''}
                        onChange={(e) => onChange({ ...row, values: e.target.value ? [e.target.value] : [] })}
                        placeholder={def.placeholder || 'Saisir une valeur'}
                        allowClear
                    />
                ) : (
                    <Select
                        mode="tags"
                        value={row.values}
                        onChange={(vals) => onChange({ ...row, values: vals })}
                        style={{ width: '100%' }}
                        placeholder={def.placeholder || 'Ajouter une ou plusieurs valeurs'}
                        tokenSeparators={[',']}
                        open={false}
                        suffixIcon={null}
                    />
                )}
            </Col>
            <Col style={{ width: 28, flexShrink: 0, textAlign: 'center' }}>
                <Button
                    type="text"
                    icon={<CloseOutlined style={{ fontSize: 11 }} />}
                    onClick={onRemove}
                    size="small"
                    style={{ color: '#bfbfbf' }}
                />
            </Col>
        </Row>
    );
}

export default function ProspectEnrichmentModal({ open, onClose, onSearch, initialFilters }) {
    const [loading, setLoading] = useState(false);
    const [personFilters, setPersonFilters] = useState(
        initialFilters?.personFilters?.length ? initialFilters.personFilters : [{ field: 'pays', values: [] }]
    );
    const [orgFilters, setOrgFilters] = useState(
        initialFilters?.orgFilters?.length ? initialFilters.orgFilters : [{ field: 'taille', values: [] }]
    );

    const addFilter = (list, setList, defs) => {
        const used = new Set(list.map(f => f.field));
        const next = defs.find(d => !used.has(d.key));
        if (next) setList(prev => [...prev, { field: next.key, values: [] }]);
    };

    const handleClear = () => {
        setPersonFilters([{ field: 'pays', values: [] }]);
        setOrgFilters([{ field: 'taille', values: [] }]);
    };

    const buildApiFilters = () => {
        const filters = {};
        const pMap = Object.fromEntries(
            personFilters.filter(f => f.values.length).map(f => [f.field, f.values])
        );
        const oMap = Object.fromEntries(
            orgFilters.filter(f => f.values.length).map(f => [f.field, f.values])
        );

        if (pMap.poste)  filters.person_titles = pMap.poste;
        if (pMap.niveau) filters.person_seniorities = pMap.niveau;

        const personLocs = [...(pMap.ville || []), ...(pMap.pays || [])];
        if (personLocs.length) filters.person_locations = personLocs;

        if (oMap.nom_societe?.length)  filters.q_organization_name = oMap.nom_societe[0];
        if (oMap.domaine?.length)      filters.q_organization_domains_list = oMap.domaine;
        if (oMap.taille?.length)       filters.organization_num_employees_ranges = oMap.taille;
        if (oMap.localisation?.length) filters.organization_locations = oMap.localisation;

        return filters;
    };

    const handleSearch = async () => {
        setLoading(true);
        try {
            const apiFilters = buildApiFilters();
            const res = await enrichmentApi.search({ ...apiFilters, page: 1, per_page: 25 });
            const data = res.data || res;
            const people = data?.people || data?.contacts || [];
            const total = data?.pagination?.total_entries ?? people.length;

            let existsMap = {};
            const ids = people.map(p => p.id).filter(Boolean);
            if (ids.length) {
                const existsRes = await enrichmentApi.checkExists(ids);
                existsMap = existsRes.found || {};
            }

            onSearch({ personFilters, orgFilters }, { people, total, existsMap });
        } catch (err) {
            notification.error({ message: err?.message || 'Erreur lors de la recherche.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            title="Rechercher des prospects"
            width={600}
            footer={
                <Row justify="space-between">
                    <Col>
                        <Button icon={<CloseOutlined />} onClick={handleClear}>
                            Tout effacer
                        </Button>
                    </Col>
                    <Col>
                        <Button
                            type="primary"
                            icon={<SearchOutlined />}
                            loading={loading}
                            onClick={handleSearch}
                            style={{ background: '#16a34a', borderColor: '#16a34a' }}
                        >
                            Rechercher des prospects
                        </Button>
                    </Col>
                </Row>
            }
            destroyOnHide
        >
            {/* Section Personne */}
            <Space align="center" style={{ marginBottom: 14 }}>
                <UserOutlined style={{ fontSize: 15, color: '#595959' }} />
                <Text strong>Renseignements sur la personne</Text>
            </Space>

            {personFilters.map((row, idx) => (
                <FilterRow
                    key={idx}
                    filterDefs={PERSON_FILTER_DEFS}
                    row={row}
                    onChange={(updated) => {
                        const copy = [...personFilters];
                        copy[idx] = updated;
                        setPersonFilters(copy);
                    }}
                    onRemove={() => setPersonFilters(personFilters.filter((_, i) => i !== idx))}
                />
            ))}

            {personFilters.length < PERSON_FILTER_DEFS.length && (
                <Button
                    type="link"
                    icon={<PlusOutlined />}
                    onClick={() => addFilter(personFilters, setPersonFilters, PERSON_FILTER_DEFS)}
                    style={{ paddingLeft: 0, color: '#16a34a', marginBottom: 4 }}
                >
                    Ajouter des critères de recherche
                </Button>
            )}

            <Divider style={{ margin: '16px 0' }} />

            {/* Section Organisation */}
            <Space align="center" style={{ marginBottom: 14 }}>
                <BankOutlined style={{ fontSize: 15, color: '#595959' }} />
                <Text strong>Détails de l'organisation</Text>
            </Space>

            {orgFilters.map((row, idx) => (
                <FilterRow
                    key={idx}
                    filterDefs={ORG_FILTER_DEFS}
                    row={row}
                    onChange={(updated) => {
                        const copy = [...orgFilters];
                        copy[idx] = updated;
                        setOrgFilters(copy);
                    }}
                    onRemove={() => setOrgFilters(orgFilters.filter((_, i) => i !== idx))}
                />
            ))}

            {orgFilters.length < ORG_FILTER_DEFS.length && (
                <Button
                    type="link"
                    icon={<PlusOutlined />}
                    onClick={() => addFilter(orgFilters, setOrgFilters, ORG_FILTER_DEFS)}
                    style={{ paddingLeft: 0, color: '#16a34a' }}
                >
                    Ajouter des critères de recherche
                </Button>
            )}
        </Modal>
    );
}
