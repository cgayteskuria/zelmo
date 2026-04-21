import { useMemo, useState, useCallback, useRef, lazy, Suspense } from "react";
import { contactsApi } from "../../services/api";
import { useServerSearchSelect } from "../../hooks/useServerSearchSelect";
import { Select, Button, Divider } from "antd";
import { InfoCircleOutlined, PlusOutlined, LinkOutlined } from "@ant-design/icons";

// Import lazy du composant Contact
const Contact = lazy(() => import("../../pages/crm/Contact"));

const isEmailLike = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str || "");

/**
 * ContactSelect - Sélecteur de contacts avec recherche serveur et bouton "Ajouter"
 * Si un email est saisi et introuvable pour ce client mais existe ailleurs,
 * propose de rattacher le contact existant directement dans le dropdown.
 */
export default function ContactSelect({
    filters = {},
    loadInitially = false,
    initialData = null,
    showAddButton,
    partnerId,
    onChange,
    value,
    ...props
}) {

    const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
    const [attachCandidate, setAttachCandidate] = useState(null); // contact global trouvé
    const [attachLoading, setAttachLoading] = useState(false);
    const lastSearchRef = useRef("");

    const effectivePartnerId = partnerId || filters.ptrId;

    const shouldShowAddButton = showAddButton !== undefined
        ? showAddButton
        : !!effectivePartnerId;

    // Préparer l'option initiale
    const initialOptions = useMemo(() => {
        if (!initialData || !initialData.ctc_id) return [];

        const computedLabel =
            initialData.label ||
            `${initialData.ctc_firstname || ""} ${initialData.ctc_lastname || ""}`.trim() ||
            initialData.ctc_email;

        return [{ value: initialData.ctc_id, label: computedLabel }];
    }, [initialData]);

    const mapOption = useCallback((item) => ({
        value: item.id,
        label: item.label,
        email: item.email,
        name: item.name,
    }), []);

    const renderOption = useCallback((option) => (
        <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 500 }}>{option.label || option.name}</span>
            {option.email && (
                <span style={{ fontSize: 12, color: "#888" }}>{option.email}</span>
            )}
        </div>
    ), []);

    const handleAdd = useCallback(() => {
        setContactDrawerOpen(true);
    }, []);

    const handleSearch = useCallback((val) => {
        if (val) {
            lastSearchRef.current = val;
        } else {
            setAttachCandidate(null);
        }
    }, []);

    // Après chaque chargement local : si 0 résultat + email valide → cherche globalement
    const onOptionsLoaded = useCallback(async (options) => {
        const searchVal = lastSearchRef.current;

        if (options.length > 0) {
            setAttachCandidate(null);
            return;
        }

        if (!searchVal || !effectivePartnerId || !isEmailLike(searchVal)) return;

        try {
            const res = await contactsApi.options({ search: searchVal });
            const found = res.data?.[0];
            setAttachCandidate(found || null);
        } catch {
            // silencieux
        }
    }, [effectivePartnerId]);

    const { selectProps, reload, injectOption } = useServerSearchSelect({
        apiFn: (params) => contactsApi.options(params),
        mapOption,
        placeholder: "Rechercher un contact...",
        filters,
        loadInitially,
        initialOptions,
        // Le bouton "Ajouter" est géré dans notre popupRender custom
        showAddButton: false,
        renderOption,
        onOptionsLoaded,
    });

    // Rattacher le contact existant au partenaire courant
    const handleAttach = useCallback(async () => {
        if (!attachCandidate || !effectivePartnerId) return;
        setAttachLoading(true);
        try {
            await contactsApi.attachPartner(attachCandidate.id, effectivePartnerId);
            const newOption = {
                value: attachCandidate.id,
                label: attachCandidate.name || attachCandidate.email,
                email: attachCandidate.email,
                name: attachCandidate.name,
            };
            injectOption(newOption);
            onChange?.(attachCandidate.id);
            setAttachCandidate(null);
            lastSearchRef.current = "";
        } catch {
            // erreurs gérées par l'intercepteur Axios
        } finally {
            setAttachLoading(false);
        }
    }, [attachCandidate, effectivePartnerId, injectOption, onChange]);

    // Footer du dropdown : "Rattacher" si candidat trouvé, sinon "+ Ajouter"
    const customPopupRender = useCallback((menu) => {
        const hasFooter = attachCandidate || shouldShowAddButton;
        if (!hasFooter) return menu;

        return (
            <>
                {menu}
                <Divider style={{ margin: "4px 0" }} />

                {attachCandidate ? (
                    // Suggestion de rattachement
                    <div
                        style={{
                            padding: "6px 10px 8px",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            background: "#fffbe6",
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        <InfoCircleOutlined style={{ color: "#faad14", flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 12, lineHeight: 1.4 }}>
                            <strong>{attachCandidate.name || attachCandidate.email}</strong>
                            {attachCandidate.partner_name && (
                                <span style={{ color: "#888" }}> — {attachCandidate.partner_name}</span>
                            )}
                        </span>
                        <Button
                            type="primary"
                            size="small"
                            icon={<LinkOutlined />}
                            loading={attachLoading}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleAttach}
                        >
                            Rattacher
                        </Button>
                    </div>
                ) : (
                    // Bouton standard "+ Ajouter un contact"
                    <Button
                        type="text"
                        icon={<PlusOutlined />}
                        style={{ width: "100%", textAlign: "left" }}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleAdd}
                    >
                        Ajouter un contact
                    </Button>
                )}
            </>
        );
    }, [attachCandidate, shouldShowAddButton, attachLoading, handleAttach, handleAdd]);

    // Callback quand un contact est créé
    const handleContactSubmit = useCallback(({ action, data }) => {
        if (action === "create" && data?.ctc_id) {
            const newOption = {
                value: data.ctc_id,
                label: `${data.ctc_firstname || ""} ${data.ctc_lastname || ""}`.trim() || data.ctc_email,
            };
            injectOption(newOption);
            onChange?.(data.ctc_id);
        }
        setContactDrawerOpen(false);
        lastSearchRef.current = "";
        reload();
    }, [onChange, reload]);

    const handleContactClose = useCallback(() => {
        setContactDrawerOpen(false);
        lastSearchRef.current = "";
    }, []);

    return (
        <>
            <Select
                value={value}
                onChange={(val) => {
                    setAttachCandidate(null);
                    onChange?.(val);
                }}
                {...selectProps}
                onSearch={(val) => {
                    handleSearch(val);
                    selectProps.onSearch?.(val);
                }}
                popupRender={customPopupRender}
                {...props}
            />

            {/* Drawer pour créer un nouveau contact */}
            {contactDrawerOpen && (
                <Suspense fallback={<div>Chargement...</div>}>
                    <Contact
                        contactId={null}
                        open={contactDrawerOpen}
                        onClose={handleContactClose}
                        onSubmit={handleContactSubmit}
                        initialValues={{
                            fk_ptr_id: effectivePartnerId,
                            ctc_is_active: true,
                            ctc_email: lastSearchRef.current || undefined,
                        }}
                    />
                </Suspense>
            )}
        </>
    );
}
