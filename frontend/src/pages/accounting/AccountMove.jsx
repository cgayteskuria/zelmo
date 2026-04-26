import { useEffect, useState, useCallback, useRef } from "react";
import { Form, Input, Button, Row, Col, DatePicker, Popconfirm, Space, Spin, Table, InputNumber, Tag, Alert } from "antd";
import { message } from '../../utils/antdStatic';
import { DeleteOutlined, SaveOutlined, CopyOutlined, ArrowLeftOutlined, LockOutlined, PlusOutlined, LeftOutlined, RightOutlined, RetweetOutlined, ExportOutlined } from "@ant-design/icons";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useListNavigation } from "../../hooks/useListNavigation";
import dayjs from "dayjs";
import PageContainer from "../../components/common/PageContainer";
import { accountMovesApi, taxsApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";
import { createDateValidator } from '../../utils/writingPeriod';
import CanAccess from "../../components/common/CanAccess";
import AccountJournalSelect from "../../components/select/AccountJournalSelect";
import AccountSelect from "../../components/select/AccountSelect";
import TaxSelect from "../../components/select/TaxSelect";
import { formatStatus } from "../../configs/AccountConfig";
import { usePermission } from "../../hooks/usePermission";
import { useVisibilityRefresh } from "../../hooks/useVisibilityRefresh";

/**
 * Composant AccountMove
 * Page d'édition d'une écriture comptable
 */
const SALE_TYPES     = ['income', 'income_other'];
const PURCHASE_TYPES = ['expense', 'expense_direct_cost'];

const getTaxUse = (accType) => {
    if (SALE_TYPES.includes(accType))     return 'sale';
    if (PURCHASE_TYPES.includes(accType)) return 'purchase';
    return null;
};

const getDocType = (accType) =>
    SALE_TYPES.includes(accType) ? 'out_invoice' : 'in_invoice';

export default function AccountMove() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const { can } = usePermission();

    const amoId = id === 'new' ? null : parseInt(id, 10);

    const [formDisabled, setFormDisabled] = useState(false);
    const [amoValid, setAmoValid] = useState(null);
    const [pageLabel, setPageLabel] = useState();
    const [documentType, setDocumentType] = useState(null);
    const [moveLines, setMoveLines] = useState([]);
    const [loadingLines, setLoadingLines] = useState(false);
    const [totalDebit, setTotalDebit] = useState(0);
    const [totalCredit, setTotalCredit] = useState(0);
    const [isEditable, setIsEditable] = useState(true);
    const [lockedByLinked, setLockedByLinked] = useState(false);
    const [linkedMove, setLinkedMove] = useState(null); // { type: 'parent'|'children', moves: [...] }
    //  const [editabilityMessage, setEditabilityMessage] = useState('');
    const nextLineIdRef = useRef(1);

    // Mémoriser les callbacks pour éviter les re-renders inutiles
    const transformData = useCallback((data) => ({
        ...data,
        amo_date: data.amo_date ? dayjs(data.amo_date) : dayjs(),
    }), []);

    const onSuccessCallback = useCallback(({ action }) => {
        if (action === 'delete') {
            navigate('/account-moves');
        }
    }, [navigate]);

    const onDeleteCallback = useCallback(() => {
        navigate('/account-moves');
    }, [navigate]);

    const onDataLoadedCallback = useCallback(async (data) => {
        if (data.amo_id) {
            setPageLabel(`Écriture n° ${data.amo_id}`);
        }
        setAmoValid(data.amo_valid);
        setDocumentType(data.amo_document_type ?? null);

        // Liaison pay↔vat_od
        if (data.parent_move) {
            setLinkedMove({ type: 'parent', moves: [data.parent_move] });
        } else if (data.linked_moves?.length) {
            setLinkedMove({ type: 'children', moves: data.linked_moves });
        } else {
            setLinkedMove(null);
        }

        // Vérifier si l'écriture est éditable
        // Une vat_od (enfant) est toujours en lecture seule — elle ne peut être modifiée
        // ou supprimée individuellement, uniquement via son écriture de règlement parente.
        const isChild = !!data.parent_move;
        const editable = isChild ? false : (data.editable !== undefined ? data.editable : true);
        setIsEditable(editable);
        setLockedByLinked(isChild || data.locked_by_linked === true);

        // Charger les lignes d'écriture
        if (amoId) {
            await loadMoveLines(amoId);
        }
    }, [amoId]);


    // Charger les lignes d'écriture
    const loadMoveLines = async (moveId) => {
        setLoadingLines(true);
        try {
            const response = await accountMovesApi.getLines(moveId);
            const lines = response.data.map((line, index) => ({
                key: `line-${index}`,
                aml_id: line.aml_id,
                fk_parent_aml_id: line.fk_parent_aml_id ?? null,
                fk_acc_id: line.fk_acc_id,
                fk_tax_id: line.fk_tax_id ?? null,
                tax_label: line.tax?.tax_label ?? null,
                acc_type: line.account?.acc_type ?? null,
                acc_code: line.account?.acc_code ?? null,
                acc_label: line.account?.acc_label ?? null,
                acc_text: line.account ? `${line.account.acc_code} - ${line.account.acc_label}` : '',
                aml_is_tax_line: line.aml_is_tax_line ?? 0,
                isAutoTaxLine: !!line.fk_parent_aml_id,
                taxRate: null,
                autoTaxLineFor: null,
                aml_label_entry: line.aml_label_entry,
                aml_ref: line.aml_ref,
                aml_debit: parseFloat(line.aml_debit) || 0,
                aml_credit: parseFloat(line.aml_credit) || 0,
                aml_lettering_code: line.aml_lettering_code,
                aml_lettering_date: line.aml_lettering_date,
                aml_abr_code: line.aml_abr_code,
                aml_abr_date: line.aml_abr_date,
                vat_declaration_id: line.vat_declaration_id ?? null,
                vat_declaration_label: line.vat_declaration_label ?? null,
                account: line.account,
                bank_reconciliation: line.bankReconciliation,
            }));

            // Liaison auto-TVA ↔ base via fk_parent_aml_id (explicite) ou fallback positionnel
            const amlIdToKey = new Map(lines.map(l => [l.aml_id, l.key]));
            for (const line of lines) {
                if (!line.isAutoTaxLine) continue;
                if (line.fk_parent_aml_id && amlIdToKey.has(line.fk_parent_aml_id)) {
                    line.autoTaxLineFor = amlIdToKey.get(line.fk_parent_aml_id);
                }
            }
            // Fallback positionnel pour les lignes TVA sans fk_parent_aml_id (données historiques)
            const linkedKeys = new Set(lines.filter(l => l.autoTaxLineFor).map(l => l.autoTaxLineFor));
            for (const line of lines) {
                if (!line.isAutoTaxLine || line.autoTaxLineFor || !line.fk_tax_id) continue;
                const base = lines.find(l =>
                    !l.isAutoTaxLine && l.fk_tax_id === line.fk_tax_id && !linkedKeys.has(l.key)
                );
                if (base) {
                    line.autoTaxLineFor = base.key;
                    linkedKeys.add(base.key);
                }
            }

            setMoveLines(lines);
            nextLineIdRef.current = lines.length + 1;
        } catch (error) {
            message.error('Erreur lors du chargement des lignes');
        } finally {
            setLoadingLines(false);
        }
    };

    /**
     * Instance du formulaire CRUD
     */
    const { submit, remove, loading, loadError, entity, reload } = useEntityForm({
        api: accountMovesApi,
        entityId: amoId,
        idField: 'amo_id',
        form,
        open: true,
        transformData,
        onSuccess: onSuccessCallback,
        onDelete: onDeleteCallback,
        onDataLoaded: onDataLoadedCallback,
    });

    // Rafraîchissement silencieux à la reprise de focus (lettrage/pointage modifiés depuis un autre onglet)
    // Uniquement en mode lecture : formDisabled garantit qu'aucune saisie n'est en cours
    useVisibilityRefresh(
        () => { if (amoId) reload(false); },
        { enabled: !!amoId && formDisabled }
    );

    // Fonction helper pour formater les dates des valeurs du formulaire
    const formatFormDates = useCallback((values) => ({
        ...values,
        amo_date: values.amo_date ? values.amo_date.format('YYYY-MM-DD') : null,
    }), []);

    // Initialiser deux lignes vierges pour une nouvelle écriture
    useEffect(() => {
        if (amoId) return;
        const makeLine = (n) => ({
            key: `new-${n}`,
            aml_id: null,
            fk_acc_id: null,
            acc_type: null,
            acc_code: null,
            acc_label: null,
            acc_text: '',
            fk_tax_id: null,
            taxRate: null,
            isAutoTaxLine: false,
            autoTaxLineFor: null,
            aml_label_entry: '',
            aml_ref: '',
            aml_debit: 0,
            aml_credit: 0,
        });
        nextLineIdRef.current = 3;
        setMoveLines([makeLine(1), makeLine(2)]);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Recalculer les totaux à chaque changement de lignes
    // Arrondi à 2 décimales pour éviter la dérive floating-point (ex: 330.20-330.19 = 0.009999...)
    useEffect(() => {
        let debit = 0, credit = 0;
        moveLines.forEach(l => {
            debit  += parseFloat(l.aml_debit)  || 0;
            credit += parseFloat(l.aml_credit) || 0;
        });
        setTotalDebit(Math.round(debit  * 100) / 100);
        setTotalCredit(Math.round(credit * 100) / 100);
    }, [moveLines]);

    // Ajouter une ligne
    const handleAddLine = () => {
        const newLine = {
            key: `new-${nextLineIdRef.current++}`,
            aml_id: null,
            fk_acc_id: null,
            acc_type: null,
            acc_code: null,
            acc_label: null,
            acc_text: '',
            fk_tax_id: null,
            taxRate: null,
            isAutoTaxLine: false,
            autoTaxLineFor: null,
            aml_label_entry: form.getFieldValue('amo_label') || '',
            aml_ref: form.getFieldValue('amo_ref') || '',
            aml_debit: 0,
            aml_credit: 0,
        };
        setMoveLines(prev => [...prev, newLine]);
    };

    // Supprimer une ligne (et sa ligne TVA auto liée le cas échéant)
    const handleDeleteLine = (key) => {
        setMoveLines(prev =>
            prev.filter(l => l.key !== key && l.autoTaxLineFor !== key)
        );
    };

    // Mettre à jour une ligne (accepte soit field/value, soit un objet de changements multiples)
    const handleLineChange = (key, fieldOrChanges, value) => {
        const changes = typeof fieldOrChanges === 'object'
            ? fieldOrChanges
            : { [fieldOrChanges]: value };

        setMoveLines(prev => {
            let lines = prev.map(line => {
                if (line.key !== key) return line;

                const updatedLine = { ...line, ...changes };

                if (changes.aml_debit !== undefined && changes.aml_debit > 0) {
                    updatedLine.aml_credit = 0;
                }
                if (changes.aml_credit !== undefined && changes.aml_credit > 0) {
                    updatedLine.aml_debit = 0;
                }

                return updatedLine;
            });

            // Recalculer les montants des lignes TVA auto si le montant de base a changé
            if (changes.aml_debit !== undefined || changes.aml_credit !== undefined) {
                const baseLine = lines.find(l => l.key === key);
                if (baseLine != null && baseLine.taxRate != null) {
                    const baseAmt    = baseLine.aml_credit || baseLine.aml_debit || 0;
                    const normalDir  = baseLine.aml_debit > 0 ? 'debit' : 'credit';
                    lines = lines.map(l => {
                        if (l.autoTaxLineFor !== key) return l;
                        const factor = l.trl_factor_percent ?? 100;
                        const absAmt = Math.round(baseAmt * baseLine.taxRate / 100 * Math.abs(factor) / 100 * 100) / 100;
                        const dir    = factor >= 0 ? normalDir : (normalDir === 'debit' ? 'credit' : 'debit');
                        return {
                            ...l,
                            aml_debit:  dir === 'debit'  ? absAmt : 0,
                            aml_credit: dir === 'credit' ? absAmt : 0,
                        };
                    });
                }
            }

            return lines;
        });
    };

    // Sélection d'une taxe sur une ligne base : insérer la ligne TVA auto
    const handleTaxChange = async (lineKey, taxId, taxLabel = null) => {
        // Mettre à jour fk_tax_id + supprimer l'ancienne ligne TVA auto
        setMoveLines(prev => {
            const withoutOldTva = prev.filter(l => l.autoTaxLineFor !== lineKey);
            return withoutOldTva.map(l =>
                l.key === lineKey ? { ...l, fk_tax_id: taxId ?? null, tax_label: taxLabel, taxRate: null } : l
            );
        });

        if (!taxId) return;

        try {
            const res = await taxsApi.getRepartitionLines(taxId);
            const taxRate        = res.tax_rate != null ? parseFloat(res.tax_rate) : 0;
            const trlLines       = res.data ?? [];
            const isOnPayment    = res.is_on_payment === true;
            const waitingAccount = res.waiting_account ?? null;

            setMoveLines(prev => {
                const baseLine = prev.find(l => l.key === lineKey);
                if (!baseLine) return prev;

                const docType = getDocType(baseLine.acc_type);
                const taxTrls = trlLines.filter(l =>
                    l.trl_repartition_type === 'tax' && l.trl_document_type === docType
                );

                // Pas de ligne TVA configurée du tout → avertissement
                if (taxTrls.length === 0) {
                    message.warning("Aucune ligne de type TVA configurée pour cette taxe");
                    return prev;
                }

                const baseAmt   = baseLine.aml_credit || baseLine.aml_debit || 0;
                const normalDir = baseLine.aml_debit > 0 ? 'debit' : 'credit';

                // Créer une ligne auto pour chaque TRL TVA ayant un compte GL.
                // En régime encaissements on_payment : substituer le compte d'attente TVA
                // au compte GL définitif (même comportement que AccountTransferService).
                const autoLines = taxTrls
                    .filter(trl => !!trl.fk_acc_id || (isOnPayment && !!waitingAccount))
                    .map((trl, i) => {
                        const factor   = trl.trl_factor_percent ?? 100;
                        const absAmt   = Math.round(baseAmt * taxRate / 100 * Math.abs(factor) / 100 * 100) / 100;
                        const dir      = factor >= 0 ? normalDir : (normalDir === 'debit' ? 'credit' : 'debit');

                        // Compte effectif : compte d'attente si on_payment, sinon compte GL configuré
                        const effAccId    = isOnPayment && waitingAccount ? waitingAccount.acc_id    : trl.fk_acc_id;
                        const effAccCode  = isOnPayment && waitingAccount ? waitingAccount.acc_code  : (trl.account?.acc_code  ?? null);
                        const effAccLabel = isOnPayment && waitingAccount ? waitingAccount.acc_label : (trl.account?.acc_label ?? null);

                        return {
                            key: `${lineKey}-tva-${i}`,
                            aml_id: null,
                            fk_acc_id: effAccId,
                            acc_type: null,
                            acc_code:  effAccCode,
                            acc_label: effAccLabel,
                            acc_text: effAccCode ? `${effAccCode} - ${effAccLabel}` : `Compte #${effAccId}`,
                            fk_tax_id: taxId,
                            aml_is_tax_line: 1,
                            isAutoTaxLine: true,
                            autoTaxLineFor: lineKey,
                            trl_factor_percent: factor,
                            taxRate: null,
                            aml_debit:  dir === 'debit'  ? absAmt : 0,
                            aml_credit: dir === 'credit' ? absAmt : 0,
                            aml_label_entry: baseLine.aml_label_entry,
                            aml_ref: baseLine.aml_ref,
                        };
                    });

                if (autoLines.length === 0) return prev;

                // Mettre à jour taxRate sur la base + insérer les lignes TVA après elle
                const updated = prev.map(l =>
                    l.key === lineKey ? { ...l, taxRate } : l
                );
                const idx = updated.findIndex(l => l.key === lineKey);
                updated.splice(idx + 1, 0, ...autoLines);
                return [...updated];
            });
        } catch {
            message.error("Erreur lors du chargement de la configuration TVA");
        }
    };

    // Valider l'écriture
    const validateMove = () => {
        if (moveLines.length < 2) {
            message.error("L'écriture doit comporter au moins 2 mouvements");
            return false;
        }

        // Vérifier que tous les comptes sont renseignés
        const hasEmptyAccount = moveLines.some(line => !line.fk_acc_id);
        if (hasEmptyAccount) {
            message.error("Veuillez compléter tous les comptes");
            return false;
        }

        // Vérifier que tous les montants sont renseignés
        const hasEmptyAmount = moveLines.some(line =>
            (parseFloat(line.aml_debit) === 0 && parseFloat(line.aml_credit) === 0)
        );
        if (hasEmptyAmount) {
            message.error("Tous les mouvements doivent avoir un montant");
            return false;
        }

        // Vérifier que les lignes de charge/produit ont toutes une taxe assignée
        const missingTax = moveLines.some(l =>
            !l.isAutoTaxLine && getTaxUse(l.acc_type) && !l.fk_tax_id
        );
        if (missingTax) {
            message.error("Assignez un taux de TVA à toutes les lignes de charge/produit.");
            return false;
        }

        // Vérifier l'équilibre (strict : tolérance 0, arrondi de la différence pour éviter le floating-point)
        const diff = Math.round(Math.abs(totalDebit - totalCredit) * 100) / 100;
        if (diff >= 0.01) {
            message.error(`Écriture déséquilibrée — Débit : ${totalDebit.toFixed(2)}, Crédit : ${totalCredit.toFixed(2)}, Différence : ${diff.toFixed(2)}`);
            return false;
        }

        return true;
    };

    const handleFormSubmit = useCallback(async (values) => {
        if (!validateMove()) {
            return;
        }

        const formattedValues = formatFormDates(values);
        formattedValues.moveLines = moveLines.map((line) => ({
            aml_id:          line.aml_id,
            fk_acc_id:       line.fk_acc_id,
            fk_tax_id:       line.fk_tax_id ?? null,
            aml_is_tax_line: line.isAutoTaxLine ? 1 : (line.aml_is_tax_line ?? 0),
            parent_index:    line.autoTaxLineFor
                ? moveLines.findIndex(l => l.key === line.autoTaxLineFor)
                : null,
            aml_label_entry: line.aml_label_entry,
            aml_ref:         line.aml_ref,
            aml_debit:       parseFloat(line.aml_debit)  || 0,
            aml_credit:      parseFloat(line.aml_credit) || 0,
        }));

        await submit(formattedValues);
        navigate('/account-moves');
    }, [formatFormDates, submit, moveLines, validateMove, navigate]);

    const handleValidate = useCallback(async () => {
        try {
            // Valider le formulaire
            await form.validateFields();

            if (!validateMove()) {
                return;
            }

            // Sauvegarder d'abord si nécessaire
            const currentValues = form.getFieldsValue();
            const formattedValues = formatFormDates(currentValues);
            formattedValues.moveLines = moveLines.map((line) => ({
                aml_id:          line.aml_id,
                fk_acc_id:       line.fk_acc_id,
                fk_tax_id:       line.fk_tax_id ?? null,
                aml_is_tax_line: line.isAutoTaxLine ? 1 : (line.aml_is_tax_line ?? 0),
                parent_index:    line.autoTaxLineFor
                    ? moveLines.findIndex(l => l.key === line.autoTaxLineFor)
                    : null,
                aml_label_entry: line.aml_label_entry,
                aml_ref:         line.aml_ref,
                aml_debit:       parseFloat(line.aml_debit)  || 0,
                aml_credit:      parseFloat(line.aml_credit) || 0,
            }));

            // Ajouter le flag de validation
            formattedValues.amo_valid = true;

            await submit(formattedValues);
            setAmoValid(dayjs().format('YYYY-MM-DD'));
            setFormDisabled(true);
            message.success('Écriture validée');
            navigate('/account-moves');
        } catch (error) {
            // useEntityForm.submit a déjà affiché le message d'erreur détaillé via message.error
            // On ne ré-affiche pas de message générique pour ne pas masquer le détail
        }
    }, [form, formatFormDates, submit, moveLines, validateMove, navigate]);

    const handleDelete = useCallback(async () => {
        try {
            await remove();
        } catch {
            // Le message d'erreur est déjà affiché par useEntityForm (lettrage, pointage, déclaration TVA…)
        }
    }, [remove]);

    const handleDuplicate = useCallback(async () => {
        try {
            const result = await accountMovesApi.duplicate(amoId);
            message.success("Écriture dupliquée avec succès");
            navigate(`/account-moves/${result.data.amo_id}`);
        } catch (error) {
            console.error(error);
            message.error("Erreur lors de la duplication");
        }
    }, [amoId, navigate]);

    // Gérer les erreurs de chargement
    useEffect(() => {
        if (loadError && amoId) {
            message.error("L'écriture demandée n'existe pas ou vous n'avez pas les droits pour y accéder");
            navigate('/account-moves');
        }
    }, [loadError, amoId, navigate]);

    // Gérer l'activation/désactivation du formulaire selon l'éditabilité
    useEffect(() => {
        setFormDisabled(!isEditable);
    }, [isEditable]);

    // Mettre à jour le libellé et la référence des lignes quand on modifie l'en-tête
    const handleLabelChange = (value) => {
        const newLines = moveLines.map(line => ({
            ...line,
            aml_label_entry: value
        }));
        setMoveLines(newLines);
    };

    const handleRefChange = (value) => {
        const newLines = moveLines.map(line => ({
            ...line,
            aml_ref: value
        }));
        setMoveLines(newLines);
    };

    // Colonnes de la table des lignes
    const lineColumns = [
        {
            title: 'Compte', dataIndex: 'fk_acc_id', key: 'fk_acc_id',
          
            render: (value, record) => {
                if (record.isAutoTaxLine) {
                    return (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {/* Connecteur arborescent └─→ */}
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                color: '#d0aff5',
                                fontSize: 13,
                                lineHeight: 1,
                                userSelect: 'none',
                                flexShrink: 0,
                            }}>
                                <svg width="20" height="18" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                                    {/* Ligne verticale */}
                                    <line x1="5" y1="0" x2="5" y2="11" stroke="#d9d9d9" strokeWidth="1.5" strokeLinecap="round" />
                                    {/* Ligne horizontale */}
                                    <line x1="5" y1="11" x2="14" y2="11" stroke="#d9d9d9" strokeWidth="1.5" strokeLinecap="round" />
                                    {/* Pointe de flèche */}
                                    <polyline points="11,7 15,11 11,15" stroke="#d9d9d9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                </svg>
                            </span>
                            <span style={{ color: '#8c8c8c', fontStyle: 'italic', fontSize: '0.92em' }}>
                                {record.acc_code} — {record.acc_label}
                            </span>
                        </span>
                    );
                }

                if (formDisabled) {
                    return record.account ? `${record.account.acc_code} - ${record.account.acc_label}` : '';
                }

                return (
                    <AccountSelect
                        showSearch
                        value={value}
                        loadInitially={true}
                        initialData={record?.account}
                        filters={{ isActive: true }}
                        onChange={(val, option) => {
                            handleLineChange(record.key, {
                                fk_acc_id: val,
                                acc_type:  option?.type  ?? null,
                                acc_code:  option?.code  ?? null,
                                acc_label: option?.label ?? null,
                                acc_text:  option?.label ?? '',
                                fk_tax_id:  null,
                                tax_label:  null,
                                taxRate:    null,
                            });
                            // Supprimer la ligne TVA auto éventuellement liée
                            setMoveLines(prev => prev.filter(l => l.autoTaxLineFor !== record.key));
                        }}
                        style={{ width: '100%' }}
                    />
                );
            }
        },
        {
            title: 'Libellé', dataIndex: 'aml_label_entry', key: 'aml_label_entry',
            render: (value, record) => {
                if (formDisabled ) {
                    return <span style={record.isAutoTaxLine ? { color: '#aaa' } : {}}>{value}</span>;
                }

                return (
                    <Input
                        value={value}
                        onChange={(e) => handleLineChange(record.key, 'aml_label_entry', e.target.value)}
                    />
                );
            }
        },
        {
            title: 'Débit', dataIndex: 'aml_debit', key: 'aml_debit', width: 130, align: 'right', render: (value, record) => {
                const fmt = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
                if (formDisabled) {
                    return fmt;
                }

                return (
                    <InputNumber
                        value={value}
                        onChange={(val) => handleLineChange(record.key, 'aml_debit', val || 0)}
                        min={0}
                        precision={2}
                        style={{ width: '100%', color: record.isAutoTaxLine ? '#aaa' : undefined }}
                    />
                );
            }
        },
        {
            title: 'Crédit', dataIndex: 'aml_credit', key: 'aml_credit', width: 130, align: 'right', render: (value, record) => {
                const fmt = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
                if (formDisabled) {
                    return fmt;
                }

                return (
                    <InputNumber
                        value={value}
                        onChange={(val) => handleLineChange(record.key, 'aml_credit', val || 0)}
                        min={0}
                        precision={2}
                        style={{ width: '100%', color: record.isAutoTaxLine ? '#aaa' : undefined }}
                    />
                );
            }
        },
        {
            title: 'TVA', key: 'fk_tax_id', width: 160,
            render: (_, record) => {
                if (record.isAutoTaxLine) return null;
                const taxUse = getTaxUse(record.acc_type);
                if (!taxUse) return null;
                if (formDisabled) {
                    return record.tax_label ? <Tag>{record.tax_label}</Tag> : null;
                }
                return (
                    <TaxSelect                        
                        style={{ width: '100%' }}
                        filters={{ tax_use: taxUse, tax_is_active: 1 }}
                        loadInitially={true}
                        value={record.fk_tax_id ?? undefined}
                        onChange={(v, opt) => handleTaxChange(record.key, v, opt?.label ?? null)}
                        allowClear
                        status={record.acc_type && !record.fk_tax_id ? 'error' : undefined}
                    />
                );
            }
        },
        ...(!isEditable && moveLines.some(l => l.aml_lettering_code) ? [
            { title: 'Code lett.', dataIndex: 'aml_lettering_code', key: 'aml_lettering_code', width: 100, align: 'center' },
            {
                title: 'Date lett.', dataIndex: 'aml_lettering_date', key: 'aml_lettering_date', width: 120, align: 'center',
                render: (value) => value ? dayjs(value).format('DD/MM/YYYY') : null,
            },
        ] : []),
        ...(!isEditable && moveLines.some(l => l.aml_abr_code) ? [
            {
                title: 'Code Point.', dataIndex: 'bank_reconciliation', key: 'aml_abr_code', width: 120, align: 'center',
                render: (abr) => abr?.abr_label ?? null,
            },
            {
                title: 'Date Point.', dataIndex: 'aml_abr_date', key: 'aml_abr_date', width: 120, align: 'center',
                render: (value) => value ? dayjs(value).format('DD/MM/YYYY') : null,
            },
        ] : []),
        ...(!isEditable && moveLines.some(l => l.vat_declaration_id) ? [
            {
                title: 'Décla TVA', key: 'vat_declaration', width: 130, align: 'center',
                render: (_, record) => {
                    if (!record.vat_declaration_id) return null;
                    const label = record.vat_declaration_label || `#${record.vat_declaration_id}`;
                    return (
                        <a
                            href={`/vat-declarations/${record.vat_declaration_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {label}
                        </a>
                    );
                },
            },
        ] : []),
        {
            title: '', key: 'action', width: 50, render: (_, record) => {
                if (formDisabled || record.isAutoTaxLine) {
                    return null;
                }

                return (
                    <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteLine(record.key)}
                    />
                );
            }
        },
    ];

    const handleBack = useCallback(() => {
        navigate('/account-moves');
    }, [navigate]);

    const { hasNav, hasPrev, hasNext, goToPrev, goToNext, position } = useListNavigation();

    const isBalanced = Math.round(Math.abs(totalDebit - totalCredit) * 100) / 100 === 0;
    const canDelete = isEditable;

    const DOCUMENT_TYPE_CONFIG = {
        out_invoice: { label: 'Facture client',       color: 'blue'     },
        out_refund:  { label: 'Avoir client',         color: 'orange'   },
        in_invoice:  { label: 'Facture fournisseur',  color: 'geekblue' },
        in_refund:   { label: 'Avoir fournisseur',    color: 'volcano'  },
        entry:       { label: 'Écriture comptable',   color: 'default'  },
    };

    const sourceUrl = entity?.fk_inv_id
        ? (['out_invoice', 'out_refund'].includes(documentType)
            ? `/customer-invoices/${entity.fk_inv_id}`
            : `/supplier-invoices/${entity.fk_inv_id}`)
        : entity?.fk_exr_id
            ? `/expense-reports/${entity.fk_exr_id}`
            : null;

    return (
        <PageContainer
            title={
                <Space>
                    {pageLabel || "Nouvelle écriture"}
                    {documentType && DOCUMENT_TYPE_CONFIG[documentType] && (
                        <Tag color={DOCUMENT_TYPE_CONFIG[documentType].color}>
                            {DOCUMENT_TYPE_CONFIG[documentType].label}
                        </Tag>
                    )}
                    {sourceUrl && (
                        <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                            <Button size="small" icon={<ExportOutlined />}>
                                Ouvrir la source
                            </Button>
                        </a>
                    )}
                </Space>
            }
            headerStyle={{
                center: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                        <Space>
                            {formatStatus(amoValid)}
                        </Space>
                    </div>
                )
            }}
            actions={
                <Space>
                    {hasNav && (
                        <>
                            <Button icon={<LeftOutlined />} onClick={goToPrev} disabled={!hasPrev} title="Précédent" />
                            <span style={{ fontSize: 12, color: '#888' }}>{position}</span>
                            <Button icon={<RightOutlined />} onClick={goToNext} disabled={!hasNext} title="Suivant" />
                        </>
                    )}
                    <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>Retour</Button>
                </Space>
            }
        >

            <Spin spinning={loading || loadingLines} tip="Chargement...">
                {!isEditable && (!amoValid || amoValid === '0000-00-00') && (
                    <Alert
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                        description={
                            lockedByLinked
                                ? "Cette écriture est en lecture seule : une écriture liée (OD TVA encaissements) contient des lignes lettrées ou pointées."
                                : "Cette écriture contient des lignes lettrées ou pointées ou attachées à une déclaration de TVA et ne peut plus être modifiée."
                        }
                    />
                )}
                {linkedMove && (
                    <Alert
                        type={!isEditable ? "error" : "warning"}
                        showIcon
                        style={{ marginBottom: 24 }}
                        description={
                            <Space vertical size={2}>
                                <strong>
                                    {linkedMove.type === 'parent'
                                        ? "Écriture liée (OD TVA encaissements)"
                                        : `${linkedMove.moves.length} OD TVA encaissements liée${linkedMove.moves.length > 1 ? 's' : ''}`
                                    }
                                </strong>
                                <span style={{ fontSize: 12, color: '#666' }}>
                                    {linkedMove.type === 'parent'
                                        ? "Cette écriture ne peut être modifiée ou supprimée individuellement — utilisez l'écriture de règlement."
                                        : "Ces écritures OD sont indissociables de ce règlement. La suppression du règlement les supprimera automatiquement."
                                    }
                                </span>
                                {linkedMove.moves.map(m => (
                                    <Link key={m.amo_id} to={`/account-moves/${m.amo_id}`}>
                                        #{m.amo_id} — {m.journal?.ajl_label ?? ''}{m.amo_ref ? ` · ${m.amo_ref}` : ''}
                                    </Link>
                                ))}
                            </Space>
                        }
                    />
                )}

               
                    <Form
                        disabled={formDisabled}
                        form={form}
                        layout="vertical"
                        onFinish={handleFormSubmit}
                        initialValues={{
                            amo_date: dayjs(),
                        }}
                    >
                        <Form.Item name="amo_id" hidden>
                            <Input />
                        </Form.Item>

                        {/* Section 1: Informations principales */}
                        <Row gutter={[16, 16]}>
                            <Col span={18}>
                                <div className="box" style={{ backgroundColor: "var(--layout-body-bg)", padding: '16px' }}>
                                    <Row gutter={[16, 8]}>
                                        <Col span={8}>
                                            <Form.Item
                                                name="fk_ajl_id"
                                                label="Journal"
                                                rules={[{ required: true, message: "Journal requis" }]}
                                            >
                                                <AccountJournalSelect
                                                    loadInitially={!amoId ? true : false}
                                                    initialData={entity?.journal}
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col span={8}>
                                            <Form.Item
                                                name="amo_date"
                                                label="Date"
                                               
                                                rules={[
                                                    { required: true, message: "Date requise" },
                                                    { validator: createDateValidator() }
                                                ]}
                                            >
                                                <DatePicker format="DD/MM/YYYY"  style={{ width: 'auto' }}

                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col span={8}>
                                            <Form.Item
                                                name="amo_ref"
                                                label="Réf"
                                            >
                                                <Input
                                                    placeholder="Référence"
                                                    onChange={(e) => handleRefChange(e.target.value)}
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                    <Row gutter={[16, 8]}>
                                        <Col span={24}>
                                            <Form.Item
                                                name="amo_label"
                                                label="Libellé"
                                                rules={[{ required: true, message: "Libellé requis" }]}
                                            >
                                                <Input
                                                    placeholder="Libellé de l'écriture"
                                                    onChange={(e) => handleLabelChange(e.target.value)}
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </div>
                            </Col>
                            <Col span={6}>
                                <Space orientation="vertical" style={{ width: '100%' }} size="small">
                                    {!formDisabled && (amoId ? can('accountings.edit') : can('accountings.create')) && (
                                        <Button
                                            color="green"
                                            variant="solid"
                                            size="default"
                                            icon={<SaveOutlined />}
                                            onClick={() => form.submit()}
                                            style={{ width: '100%' }}
                                        >
                                            Enregistrer
                                        </Button>
                                    )}
                                    {(!amoValid || amoValid === '0000-00-00') && can('accountings.edit') && (
                                        <Button
                                            type="primary"
                                            size="default"
                                            icon={<LockOutlined />}
                                            onClick={handleValidate}
                                            style={{ width: '100%' }}
                                            disabled={false}
                                        >
                                            Valider
                                        </Button>
                                    )}
                                    {amoId && can('accountings.create') && (
                                        <Button
                                            type="secondary"
                                            size="default"
                                            icon={<CopyOutlined />}
                                            onClick={handleDuplicate}
                                            style={{ width: '100%' }}
                                            disabled={false}
                                        >
                                            Dupliquer
                                        </Button>
                                    )}
                                    {canDelete && amoId && can('accountings.delete') && (
                                        <CanAccess permission="accountings.delete">
                                            <Popconfirm
                                                title="Êtes-vous sûr de vouloir supprimer cette écriture ?"
                                                description="Cette action est irréversible."
                                                onConfirm={handleDelete}
                                                okText="Oui, supprimer"
                                                cancelText="Annuler"
                                                okButtonProps={{ danger: true }}
                                            >
                                                <Button
                                                    size="default"
                                                    danger
                                                    icon={<DeleteOutlined />}
                                                    style={{ width: '100%' }}
                                                >
                                                    Supprimer
                                                </Button>
                                            </Popconfirm>
                                        </CanAccess>
                                    )}
                                </Space>
                            </Col>
                        </Row>

                        {/* Section 2: Lignes d'écriture */}
                        <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
                            <Col span={24}>
                                <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                                    {!formDisabled && (amoId ? can('accountings.edit') : can('accountings.create')) && (
                                        <Button
                                            icon={<PlusOutlined />}
                                            onClick={handleAddLine}
                                        >
                                            Ajouter une ligne
                                        </Button>
                                    )}
                                    <Table
                                        columns={lineColumns}
                                        dataSource={moveLines}
                                        pagination={false}
                                        size="small"
                                        bordered
                                        className={!formDisabled ? "no-padding-table" : ""}
                                        rowClassName={(record) => record.isAutoTaxLine ? 'move-line-tva-child' : ''}
                                        onRow={(record) => record.isAutoTaxLine ? {
                                            style: { backgroundColor: '#faf7ff' }
                                        } : {}}                                       
                                        summary={() => (
                                            <Table.Summary fixed>
                                               <Table.Summary.Row style={{ fontWeight: 'bold', backgroundColor: '#fafafa' }}>
                                                    <Table.Summary.Cell index={0} colSpan={2} align="right" />
                                                    <Table.Summary.Cell index={1} align="right">
                                                        <strong style={{ color: isBalanced ? '#52c41a' : '#ff4d4f' }}>
                                                            {new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalDebit)}
                                                        </strong>
                                                    </Table.Summary.Cell>
                                                    <Table.Summary.Cell index={2} align="right">
                                                        <strong style={{ color: isBalanced ? '#52c41a' : '#ff4d4f' }}>
                                                            {new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalCredit)}
                                                        </strong>
                                                    </Table.Summary.Cell>
                                                    <Table.Summary.Cell index={3}>
                                                        {!isBalanced && (
                                                            <Tag color="error">Non équilibré</Tag>
                                                        )}
                                                    </Table.Summary.Cell>
                                                </Table.Summary.Row>
                                            </Table.Summary>
                                        )}
                                    />
                                </Space>
                            </Col>
                        </Row>
                    </Form>
               
            </Spin>
        </PageContainer>
    );
}
