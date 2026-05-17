import { useState, useMemo, useEffect, useRef } from 'react';
import {
    Button, Table, Tag, Typography, Space, Empty, Avatar, Tooltip,
    notification, Row, Col, Skeleton, Card, Popover, Divider, Spin,
} from 'antd';
import {
    SearchOutlined, AimOutlined,
    CheckCircleFilled, UserAddOutlined, EyeOutlined,
    SettingOutlined, PhoneOutlined, ThunderboltOutlined,
    ApartmentOutlined, GlobalOutlined, TeamOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../../components/common/PageContainer';
import ProspectEnrichmentModal from './ProspectEnrichmentModal';
import CanAccess from '../../components/common/CanAccess';
import { enrichmentApi } from '../../services/apiEnrichment';

const { Text, Title, Paragraph } = Typography;

const LS_PEOPLE  = 'prospector_people';
const LS_TOTAL   = 'prospector_total';
const LS_FILTERS = 'prospector_filters';
const LS_EXISTS  = 'prospector_exists';

const readLS = (key, fallback) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
};

const FIELD_LABELS = {
    pays: 'Pays', ville: 'Ville', poste: 'Poste', niveau: 'Niveau',
    taille: 'Taille', nom_societe: 'Société', localisation: 'Localisation', domaine: 'Domaine',
};

const toEmployeeRange = (n) => {
    if (!n) return '—';
    const v = Number(n);
    if (v <= 10)   return '1 – 10';
    if (v <= 50)   return '11 – 50';
    if (v <= 200)  return '51 – 200';
    if (v <= 500)  return '201 – 500';
    if (v <= 1000) return '501 – 1 000';
    if (v <= 5000) return '1 001 – 5 000';
    return '5 000+';
};

export default function Prospector() {
    const navigate = useNavigate();

    const [configStatus, setConfigStatus] = useState('loading');
    const [searchOpen, setSearchOpen]     = useState(false);
    const [people, setPeople]             = useState(() => readLS(LS_PEOPLE, []));
    const [total, setTotal]               = useState(() => parseInt(localStorage.getItem(LS_TOTAL) || '0'));
    const [lastFilters, setLastFilters]   = useState(() => readLS(LS_FILTERS, null));
    const [existsMap, setExistsMap]       = useState(() => readLS(LS_EXISTS, {}));
    const [rowStates, setRowStates]       = useState({});
    const [orgEnrich, setOrgEnrich]       = useState({}); // { [orgId]: { loading, data, error } }
    const pollingRefs = useRef({});

    useEffect(() => {
        enrichmentApi.getConfig()
            .then(res => {
                const data = res.data || res;
                setConfigStatus(data.crc_api_url ? 'ok' : 'missing');
            })
            .catch(() => setConfigStatus('missing'));
    }, []);

    const updateRowState = (id, patch) =>
        setRowStates(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

    const handleSearchDone = (filters, { people: newPeople, total: newTotal, existsMap: newExists }) => {
        setPeople(newPeople);
        setTotal(newTotal);
        setLastFilters(filters);
        setExistsMap(newExists);
        setRowStates({});
        localStorage.setItem(LS_PEOPLE,  JSON.stringify(newPeople));
        localStorage.setItem(LS_TOTAL,   String(newTotal));
        localStorage.setItem(LS_FILTERS, JSON.stringify(filters));
        localStorage.setItem(LS_EXISTS,  JSON.stringify(newExists));
        setSearchOpen(false);
    };

    const startPolling = (apolloId, crrId) => {
        if (pollingRefs.current[apolloId]) return;
        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            if (attempts > 100) {
                clearInterval(interval);
                delete pollingRefs.current[apolloId];
                updateRowState(apolloId, { revealStatus: 'error' });
                return;
            }
            try {
                const res = await enrichmentApi.revealStatus(crrId);
                if (res.crr_status === 'received') {
                    clearInterval(interval);
                    delete pollingRefs.current[apolloId];
                    updateRowState(apolloId, { revealStatus: 'received', phone: res.phone_number });
                    notification.success({ message: `Mobile révélé : ${res.phone_number}` });
                } else if (res.crr_status === 'error') {
                    clearInterval(interval);
                    delete pollingRefs.current[apolloId];
                    updateRowState(apolloId, { revealStatus: 'error' });
                    notification.warning({ message: res.error || 'Mobile non disponible pour ce contact.' });
                }
            } catch (_) {}
        }, 3000);
        pollingRefs.current[apolloId] = interval;
    };

    const handleAddToCrm = async (person) => {
        const apolloId = person.id;
        const org      = person.organization || {};
        updateRowState(apolloId, { status: 'adding', revealStatus: null });

        // ── Étape 1 : révélation mobile (doit réussir avant de créer quoi que ce soit) ──
        let crrId = null;
        try {
            const revRes = await enrichmentApi.reveal({
                apollo_person_id:  apolloId,
                firstname:         person.first_name,
                lastname:          person.last_name,
                title:             person.title,
                organization_name: org.name,
                email:             person.email,
                linkedin_url:      person.linkedin_url,
            });
            crrId = (revRes.data || revRes).crr_id;
        } catch (revErr) {
            updateRowState(apolloId, { status: 'idle', revealStatus: null });
            const code = revErr?.response?.data?.code;
            if (code === 'CREDITS_EXHAUSTED') {
                notification.warning({ message: 'Quota de crédits atteint — aucune action effectuée.' });
            } else {
                const msg = revErr?.response?.data?.message || revErr?.message || 'Le service de révélation a échoué.';
                notification.error({ message: msg });
            }
            return; // On s'arrête ici — rien n'est créé
        }

        // ── Étape 2 : import société + contact (seulement si Apollo a accepté) ──
        try {
            const orgKey   = org.id || org.name;
            const enriched = orgEnrich[orgKey]?.data;

            const impRes = await enrichmentApi.importPerson({
                person_external_id: apolloId,
                firstname:          person.first_name  || '',
                lastname:           person.last_name   || '',
                title:              person.title        || '',
                email:              person.email        || '',
                org_external_id:    org.id              || '',
                org_name:           org.name            || '',
                org_city:           enriched?.city      || org.city  || person.city || '',
                org_headcount:      (enriched?.estimated_num_employees ?? org.estimated_num_employees)?.toString() || '',
                org_industry:       enriched?.industry  || org.industry || '',
                crr_id:             crrId,
            });
            const { ctc_id: ctcId, ptr_id: ptrId, created } = impRes.data || impRes;

            updateRowState(apolloId, { status: 'added', revealStatus: 'polling' });
            setExistsMap(prev => {
                const updated = { ...prev, [apolloId]: { ctc_id: ctcId, ptr_id: ptrId } };
                localStorage.setItem(LS_EXISTS, JSON.stringify(updated));
                return updated;
            });

            const label = `${person.first_name || ''} ${person.last_name || ''}`.trim();
            notification.success({
                message: created
                    ? `${label} ajouté — révélation du mobile en cours…`
                    : `${label} existait déjà — révélation du mobile en cours…`,
            });

            startPolling(apolloId, crrId);
        } catch (err) {
            updateRowState(apolloId, { status: 'idle', revealStatus: null });
            notification.error({ message: err?.message || "Erreur lors de la création du contact." });
        }
    };

    const handleEnrichOrg = async (org) => {
        const key = org.id || org.name;
        if (!key || orgEnrich[key]?.data || orgEnrich[key]?.loading) return;

        const domain = org.primary_domain || org.website_url?.replace(/^https?:\/\//, '').split('/')[0] || null;
        const name   = org.name || null;

        setOrgEnrich(prev => ({ ...prev, [key]: { loading: true } }));
        try {
            const res  = await enrichmentApi.enrichOrganization({ domain, name });
            const data = res.data?.organization || res.data || res;
            setOrgEnrich(prev => ({ ...prev, [key]: { loading: false, data } }));
        } catch (err) {
            setOrgEnrich(prev => ({ ...prev, [key]: { loading: false, error: err?.message || 'Erreur' } }));
            notification.error({ message: 'Impossible d\'enrichir cette organisation.' });
        }
    };

    const filterChips = useMemo(() => {
        if (!lastFilters) return [];
        const chips = [];
        [...(lastFilters.personFilters || []), ...(lastFilters.orgFilters || [])].forEach(f => {
            if (f.values?.length) {
                chips.push({ label: FIELD_LABELS[f.field] || f.field, values: f.values });
            }
        });
        return chips;
    }, [lastFilters]);

    const columns = [
        {
            title: 'Organisation',
            key: 'organisation',
            width: 260,
            render: (_, person) => {
                const org    = person.organization || {};
                const orgKey = org.id || org.name;
                const letter = (org.name || '?')[0].toUpperCase();
                const location = [org.city, org.country].filter(Boolean).join(', ');
                const enrich = orgEnrich[orgKey] || {};

                const popoverContent = enrich.loading ? (
                    <div style={{ width: 200, textAlign: 'center', padding: '8px 0' }}>
                        <Spin size="small" />
                        <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 6 }}>
                            Chargement…
                        </Text>
                    </div>
                ) : enrich.data ? (
                    <div style={{ maxWidth: 300, fontSize: 12 }}>
                        {enrich.data.short_description && (
                            <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                                {enrich.data.short_description}
                            </Text>
                        )}
                        <Divider style={{ margin: '6px 0' }} />
                        {enrich.data.industry && (
                            <div style={{ marginBottom: 4 }}>
                                <Text type="secondary">Secteur : </Text>
                                <Text>{enrich.data.industry}</Text>
                            </div>
                        )}
                        {enrich.data.estimated_num_employees && (
                            <div style={{ marginBottom: 4 }}>
                                <TeamOutlined style={{ marginRight: 4, color: '#8c8c8c' }} />
                                <Text>{Number(enrich.data.estimated_num_employees).toLocaleString('fr-FR')} employés</Text>
                            </div>
                        )}
                        {enrich.data.annual_revenue && (
                            <div style={{ marginBottom: 4 }}>
                                <Text type="secondary">CA estimé : </Text>
                                <Text>{Number(enrich.data.annual_revenue).toLocaleString('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</Text>
                            </div>
                        )}
                        {enrich.data.founded_year && (
                            <div style={{ marginBottom: 4 }}>
                                <Text type="secondary">Fondée en : </Text>
                                <Text>{enrich.data.founded_year}</Text>
                            </div>
                        )}
                        {enrich.data.website_url && (
                            <div style={{ marginTop: 8 }}>
                                <GlobalOutlined style={{ marginRight: 4, color: '#1677ff' }} />
                                <a href={enrich.data.website_url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                                    {enrich.data.website_url.replace(/^https?:\/\//, '')}
                                </a>
                            </div>
                        )}
                    </div>
                ) : null;

                return (
                    <Space>
                        <Avatar
                            size={32}
                            style={{ background: '#e6f4ff', color: '#1677ff', fontWeight: 600, fontSize: 13, flexShrink: 0 }}
                        >
                            {letter}
                        </Avatar>
                        <div>
                            <Space size={4} align="center">
                                <Text strong style={{ fontSize: 13 }}>{org.name || '—'}</Text>
                                <CanAccess permission="enrichment.reveal">
                                    <Popover
                                        content={popoverContent}
                                        title={enrich.data || enrich.loading
                                            ? <Space size={4}><ApartmentOutlined />{org.name}</Space>
                                            : null
                                        }
                                        trigger="click"
                                        placement="rightTop"
                                        onOpenChange={(open) => {
                                            if (open && !enrich.data && !enrich.loading) {
                                                handleEnrichOrg(org);
                                            }
                                        }}
                                    >
                                        <Tooltip title="Enrichir les infos société" mouseEnterDelay={0.6}>
                                            <Button
                                                type="text"
                                                size="small"
                                                icon={<ApartmentOutlined style={{ fontSize: 12, color: enrich.data ? '#1677ff' : '#bfbfbf' }} />}
                                                style={{ padding: '0 2px', height: 20 }}
                                            />
                                        </Tooltip>
                                    </Popover>
                                </CanAccess>
                            </Space>
                            {location && (
                                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{location}</Text>
                            )}
                        </div>
                    </Space>
                );
            },
        },
        {
            title: 'Personne',
            key: 'personne',
            render: (_, person) => {
                const displayName = [person.first_name, person.last_name].filter(Boolean).join(' ');
                return (
                    <Space size={6}>
                        <Text strong style={{ fontSize: 13 }}>{displayName || '—'}</Text>
                        {person.has_direct_phone && (
                            <Tooltip title="Mobile disponible">
                                <PhoneOutlined style={{ color: '#52c41a', fontSize: 11 }} />
                            </Tooltip>
                        )}
                    </Space>
                );
            },
        },
        {
            title: 'Titre',
            key: 'titre',
            render: (_, person) => person.title
                ? <Text style={{ fontSize: 12 }}>{person.title}</Text>
                : <Text type="secondary">—</Text>,
        },
        {
            title: "Secteur",
            key: 'secteur',
            width: 160,
            render: (_, person) => person.organization?.industry
                ? <Text style={{ fontSize: 12 }}>{person.organization.industry}</Text>
                : <Text type="secondary">—</Text>,
        },
        {
            title: 'Taille',
            key: 'taille',
            width: 120,
            render: (_, person) => (
                <Text style={{ fontSize: 12 }}>
                    {toEmployeeRange(person.organization?.estimated_num_employees)}
                </Text>
            ),
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 160,
            render: (_, person) => {
                const apolloId   = person.id;
                const rowState   = rowStates[apolloId] || {};
                const inCrm      = existsMap[apolloId];
                const revealSt   = rowState.revealStatus;

                if (inCrm) {
                    return (
                        <Space size={4} wrap>
                            <Tag icon={<CheckCircleFilled />} color="success" style={{ fontSize: 12 }}>
                                Dans le CRM
                            </Tag>
                            {inCrm.ptr_id && (
                                <Tooltip title="Voir la fiche">
                                    <Button size="small" icon={<EyeOutlined />}
                                        onClick={() => navigate(`/prospects/${inCrm.ptr_id}`)} />
                                </Tooltip>
                            )}
                            {revealSt === 'polling' && (
                                <Tag icon={<Spin size="small" />} style={{ fontSize: 11 }}>
                                    Mobile en attente…
                                </Tag>
                            )}
                            {revealSt === 'received' && rowState.phone && (
                                <Tag icon={<PhoneOutlined />} color="blue" style={{ fontSize: 12 }}>
                                    {rowState.phone}
                                </Tag>
                            )}
                        </Space>
                    );
                }
                return (
                    <CanAccess permission="enrichment.search">
                        <Button
                            size="small"
                            icon={<UserAddOutlined />}
                            loading={rowState.status === 'adding'}
                            onClick={() => handleAddToCrm(person)}
                        >
                            Accéder au mobile et ajouter au prospect
                        </Button>
                    </CanAccess>
                );
            },
        },
    ];

    const hasResults = people.length > 0;

    return (
        <PageContainer
            title="Prospecteur"
            actions={
                configStatus === 'ok' && (
                    <CanAccess permission="enrichment.search">
                        <Button
                            type="primary"
                            icon={<SearchOutlined />}
                            onClick={() => setSearchOpen(true)}
                            size="large"
                            style={{ background: '#16a34a', borderColor: '#16a34a' }}
                        >
                            {hasResults ? 'Nouvelle recherche' : 'Commencer la prospection'}
                        </Button>
                    </CanAccess>
                )
            }
        >
            {configStatus === 'loading' ? (
                <Skeleton active paragraph={{ rows: 4 }} style={{ marginTop: 32 }} />

            ) : configStatus === 'missing' ? (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', minHeight: 'calc(100vh - 200px)',
                    padding: '40px 24px', textAlign: 'center',
                }}>
                    <div style={{
                        width: 72, height: 72, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: 24, boxShadow: '0 8px 24px rgba(22, 163, 74, 0.25)',
                    }}>
                        <AimOutlined style={{ fontSize: 32, color: '#fff' }} />
                    </div>
                    <Title level={2} style={{ marginBottom: 8, fontWeight: 700 }}>
                        Trouvez vos prochains clients
                    </Title>
                    <Title level={4} type="secondary" style={{ marginBottom: 24, fontWeight: 400 }}>
                        Le Prospecteur — module d'enrichissement et de découverte de leads
                    </Title>
                    <Paragraph style={{ fontSize: 15, color: '#595959', maxWidth: 560, marginBottom: 32 }}>
                        Accédez à une base de millions d'entreprises et de contacts qualifiés.
                        Filtrez par secteur, localisation, taille d'entreprise, poste ou niveau hiérarchique,
                        puis importez vos prospects directement dans votre CRM en un clic.
                    </Paragraph>
                    <Row gutter={16} justify="center" style={{ marginBottom: 40, maxWidth: 680 }}>
                        {[
                            {
                                icon: <SearchOutlined style={{ fontSize: 22, color: '#16a34a' }} />,
                                title: 'Recherche avancée',
                                desc: 'Critères multi-filtres sur les personnes et les organisations.',
                            },
                            {
                                icon: <PhoneOutlined style={{ fontSize: 22, color: '#16a34a' }} />,
                                title: 'Révélation de mobile',
                                desc: 'Obtenez le numéro direct de vos interlocuteurs en quelques secondes.',
                            },
                            {
                                icon: <ThunderboltOutlined style={{ fontSize: 22, color: '#16a34a' }} />,
                                title: 'Import instantané',
                                desc: 'Ajoutez prospects et contacts dans le CRM sans ressaisie.',
                            },
                        ].map(item => (
                            <Col key={item.title} xs={24} sm={8}>
                                <Card
                                    bordered
                                    style={{ borderRadius: 12, height: '100%', textAlign: 'left' }}
                                    styles={{ body: { padding: '20px 18px' } }}
                                >
                                    <Space direction="vertical" size={8}>
                                        {item.icon}
                                        <Text strong style={{ fontSize: 14 }}>{item.title}</Text>
                                        <Text type="secondary" style={{ fontSize: 13 }}>{item.desc}</Text>
                                    </Space>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                        <SettingOutlined style={{ marginRight: 6 }} />
                        Pour activer le Prospecteur, renseignez vos identifiants API dans
                        {' '}<strong>Paramètres → CRM → Service d'enrichissement</strong>.
                    </Text>
                </div>

            ) : !hasResults && !lastFilters ? (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={<Text type="secondary">Aucune recherche effectuée</Text>}
                    style={{ marginTop: 80 }}
                >
                    <CanAccess permission="enrichment.search">
                        <Button
                            type="primary"
                            size="large"
                            icon={<SearchOutlined />}
                            onClick={() => setSearchOpen(true)}
                            style={{ background: '#16a34a', borderColor: '#16a34a' }}
                        >
                            Commencer la prospection
                        </Button>
                    </CanAccess>
                </Empty>

            ) : !hasResults ? (
                <div style={{ textAlign: 'center', marginTop: 80 }}>
                    {filterChips.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            {filterChips.map((chip, i) => (
                                <Tag key={i} style={{ marginBottom: 4 }}>
                                    <Text type="secondary" style={{ fontSize: 11 }}>{chip.label} </Text>
                                    {chip.values.join(', ')}
                                </Tag>
                            ))}
                        </div>
                    )}
                    <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                        Aucun résultat pour cette recherche.
                    </Text>
                    <CanAccess permission="enrichment.search">
                        <Button
                            icon={<SearchOutlined />}
                            onClick={() => setSearchOpen(true)}
                        >
                            Modifier la recherche
                        </Button>
                    </CanAccess>
                </div>

            ) : (
                <>
                    {filterChips.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                            {filterChips.map((chip, i) => (
                                <Tag key={i} style={{ marginBottom: 4 }}>
                                    <Text type="secondary" style={{ fontSize: 11 }}>{chip.label} </Text>
                                    {chip.values.join(', ')}
                                </Tag>
                            ))}
                        </div>
                    )}

                    <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                        <Col>
                            <Text type="secondary">
                                <strong>{total.toLocaleString('fr-FR')}</strong> résultat{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}
                                {' '}· <strong>{people.length}</strong> affiché{people.length > 1 ? 's' : ''}
                            </Text>
                        </Col>
                        <Col>
                            <CanAccess permission="enrichment.search">
                                <Button
                                    icon={<SearchOutlined />}
                                    onClick={() => setSearchOpen(true)}
                                >
                                    Modifier la recherche
                                </Button>
                            </CanAccess>
                        </Col>
                    </Row>

                    <Table
                        columns={columns}
                        dataSource={people}
                        rowKey="id"
                        pagination={false}
                        size="middle"
                        rowClassName={(person) => existsMap[person.id] ? 'ant-table-row-selected' : ''}
                    />
                </>
            )}

            {searchOpen && (
                <ProspectEnrichmentModal
                    open={searchOpen}
                    onClose={() => setSearchOpen(false)}
                    onSearch={handleSearchDone}
                    initialFilters={lastFilters}
                />
            )}
        </PageContainer>
    );
}
